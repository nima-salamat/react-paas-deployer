/**
 * Deploy history logs: REST history + live DeploymentConsumer WS + poll fallback.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import apiRequest from "../../customHooks/apiRequest";
import {
  API_BASE,
  DEPLOY_BASE,
  DEPLOY_LOG_PAGE_SIZE,
  DEPLOY_LOG_POLL_INTERVAL,
  LOG_BUFFER_MAX,
} from "../constants";
import { normalizeLogEntry, normalizeTextEntries, mergeEntries, mergeEntriesPrepend } from "../utils";

function appendLiveEvent(payload, setEntries) {
  if (!payload || typeof payload !== "object") return;
  const stage = payload.stage || "";
  const message = payload.message || "";
  const levelRaw = String(payload.level || "info").toLowerCase();
  const level = levelRaw === "warn" ? "warning" : levelRaw;
  const progress = payload.progress;
  const ts = payload.timestamp || payload.ts || new Date().toISOString();
  const parts = [];
  if (stage) parts.push(`[${stage}]`);
  if (progress != null && progress !== "") parts.push(`(${progress}%)`);
  if (message) parts.push(message);
  const text = parts.join(" ").trim() || JSON.stringify(payload);
  const key = `live-${payload.deploy_id || ""}-${stage}-${ts}-${text.slice(0, 48)}`;
  const entry = normalizeLogEntry(
    {
      id: key,
      message: text,
      level,
      timestamp: ts,
      stage: stage || undefined,
      progress: progress != null ? progress : undefined,
    },
    null,
    { key }
  );
  if (!entry) return;
  setEntries((prev) => {
    if (prev.some((e) => (e.key || e.id) === key)) return prev;
    const out = [...prev, entry];
    return out.length > LOG_BUFFER_MAX ? out.slice(out.length - LOG_BUFFER_MAX) : out;
  });
}

export default function useDeployLogs({
  deployId,
  enabled,
  serviceStatus,
  deployStatus,
}) {
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [filter, setFilter] = useState("");
  const [level, setLevel] = useState("all");
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);

  const scrollRef = useRef(null);
  const oldestCursorRef = useRef(null);
  const newestCursorRef = useRef(null);
  const hasMoreOlderRef = useRef(false);
  const pollTimerRef = useRef(null);
  const pollLockRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const wsRef = useRef(null);
  const wsReconnectTimerRef = useRef(null);
  const wsReconnectAttemptRef = useRef(0);
  const wsShouldReconnectRef = useRef(true);
  const deployIdRef = useRef(deployId);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    deployIdRef.current = deployId;
  }, [deployId]);

  const stopWs = useCallback(() => {
    wsShouldReconnectRef.current = false;
    wsReconnectAttemptRef.current = 0;
    if (wsReconnectTimerRef.current) {
      clearTimeout(wsReconnectTimerRef.current);
      wsReconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
    if (mountedRef.current) {
      setConnected(false);
      setReconnecting(false);
    }
  }, []);

  const connectWs = useCallback(
    (id) => {
      if (!id) return;
      wsShouldReconnectRef.current = true;

      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          /* ignore */
        }
        wsRef.current = null;
      }
      if (wsReconnectTimerRef.current) {
        clearTimeout(wsReconnectTimerRef.current);
        wsReconnectTimerRef.current = null;
      }

      const token = localStorage.getItem("access");
      if (!token) {
        setError((prev) => prev || "Authentication required for live deploy events.");
        setConnected(false);
        return;
      }

      let backendUrl;
      try {
        backendUrl = new URL(API_BASE);
      } catch {
        setError("Invalid API base URL for WebSocket.");
        return;
      }
      const protocol = backendUrl.protocol === "https:" ? "wss:" : "ws:";
      const socketUrl = `${protocol}//${backendUrl.host}/ws/deployments/${id}/?token=${encodeURIComponent(token)}`;
      const socket = new WebSocket(socketUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (!mountedRef.current) return;
        if (deployIdRef.current !== String(id)) {
          try {
            socket.close();
          } catch {
            /* ignore */
          }
          return;
        }
        wsReconnectAttemptRef.current = 0;
        setConnected(true);
        setReconnecting(false);
        setError(null);
      };

      socket.onmessage = (event) => {
        if (!mountedRef.current) return;
        if (deployIdRef.current !== String(id)) return;
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        if (payload?.type === "deployment.connected") {
          setConnected(true);
          return;
        }
        if (payload?.type === "deployment.event") {
          appendLiveEvent(payload.event || payload, setEntries);
          return;
        }
        if (payload?.stage || payload?.message) {
          appendLiveEvent(payload, setEntries);
        }
      };

      socket.onerror = () => {
        if (mountedRef.current) setConnected(false);
      };

      socket.onclose = (evt) => {
        if (!mountedRef.current) return;
        setConnected(false);
        if (!wsShouldReconnectRef.current || evt.wasClean) return;
        if (deployIdRef.current !== String(id)) return;
        setReconnecting(true);
        wsReconnectAttemptRef.current += 1;
        const attempt = wsReconnectAttemptRef.current;
        const delay = Math.min(15000, 1000 * 2 ** Math.max(0, attempt - 1));
        wsReconnectTimerRef.current = setTimeout(() => {
          if (!mountedRef.current || !wsShouldReconnectRef.current) return;
          if (deployIdRef.current !== String(id)) return;
          connectWs(id);
        }, delay);
      };
    },
    []
  );

  const fetchInitial = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setEntries([]);
    oldestCursorRef.current = null;
    newestCursorRef.current = null;
    hasMoreOlderRef.current = false;
    setHasMoreOlder(false);

    try {
      const resp = await apiRequest({
        method: "GET",
        url: `${DEPLOY_BASE}${id}/logs/`,
        params: { limit: DEPLOY_LOG_PAGE_SIZE },
      });
      if (!mountedRef.current || deployIdRef.current !== String(id)) return;
      const normalized = normalizeTextEntries(resp.data?.logs).map((e) =>
        normalizeLogEntry(
          {
            id: e.key,
            message: e.text,
            level: e.level,
            timestamp: e.timestamp,
          },
          null,
          { key: e.key }
        )
      );
      setEntries(normalized.filter(Boolean));
      oldestCursorRef.current = resp.data?.next_before || null;
      newestCursorRef.current = resp.data?.latest_after || null;
      hasMoreOlderRef.current = Boolean(resp.data?.has_more_older);
      setHasMoreOlder(hasMoreOlderRef.current);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err.response?.data?.detail || "Unable to load deploy history.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const loadOlder = useCallback(async () => {
    const id = deployIdRef.current;
    if (!id || !hasMoreOlderRef.current || !oldestCursorRef.current || loadingOlderRef.current) {
      return;
    }
    loadingOlderRef.current = true;
    setLoadingOlder(true);

    const scroller = scrollRef.current;
    const prevHeight = scroller?.scrollHeight || 0;
    const prevTop = scroller?.scrollTop || 0;

    try {
      const resp = await apiRequest({
        method: "GET",
        url: `${DEPLOY_BASE}${id}/logs/`,
        params: { limit: DEPLOY_LOG_PAGE_SIZE, before: oldestCursorRef.current },
      });
      if (!mountedRef.current || deployIdRef.current !== String(id)) return;
      const older = normalizeTextEntries(resp.data?.logs).map((e) =>
        normalizeLogEntry(
          {
            id: e.key,
            message: e.text,
            level: e.level,
            timestamp: e.timestamp,
          },
          null,
          { key: e.key }
        )
      );
      if (older.length) {
        setEntries((prev) => mergeEntriesPrepend(prev, older.filter(Boolean)));
      }
      oldestCursorRef.current = resp.data?.next_before || oldestCursorRef.current;
      newestCursorRef.current = resp.data?.latest_after || newestCursorRef.current;
      hasMoreOlderRef.current = Boolean(resp.data?.has_more_older);
      setHasMoreOlder(hasMoreOlderRef.current);

      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop =
            scrollRef.current.scrollHeight - prevHeight + prevTop;
        }
      });
    } catch (err) {
      if (mountedRef.current) {
        setError(err.response?.data?.detail || "Unable to load older deploy logs.");
      }
    } finally {
      loadingOlderRef.current = false;
      if (mountedRef.current) setLoadingOlder(false);
    }
  }, []);

  const pollNew = useCallback(async () => {
    const id = deployIdRef.current;
    if (!id || pollLockRef.current) return;
    pollLockRef.current = true;
    try {
      const params = { limit: 100 };
      if (newestCursorRef.current) params.after = newestCursorRef.current;
      const resp = await apiRequest({
        method: "GET",
        url: `${DEPLOY_BASE}${id}/logs/`,
        params,
      });
      if (!mountedRef.current || deployIdRef.current !== String(id)) return;
      const fresh = normalizeTextEntries(resp.data?.logs).map((e) =>
        normalizeLogEntry(
          {
            id: e.key,
            message: e.text,
            level: e.level,
            timestamp: e.timestamp,
          },
          null,
          { key: e.key }
        )
      );
      if (fresh.length) {
        setEntries((prev) => mergeEntries(prev, fresh.filter(Boolean)));
        newestCursorRef.current =
          resp.data?.next_after || resp.data?.latest_after || newestCursorRef.current;
      } else if (!newestCursorRef.current) {
        newestCursorRef.current = resp.data?.latest_after || resp.data?.next_after || null;
      }
    } catch {
      /* silent poll */
    } finally {
      pollLockRef.current = false;
    }
  }, []);

  const download = useCallback(
    async (id) => {
      const target = id || deployIdRef.current;
      if (!target) return;
      setExporting(true);
      try {
        const token = localStorage.getItem("access");
        const resp = await axios.get(`${DEPLOY_BASE}/${target}/logs/export/`, {
          params: {
            format: "txt",
            limit: 5000,
            q: filter || undefined,
            level: level !== "all" ? level : undefined,
          },
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          responseType: "blob",
        });
        const blob = resp.data instanceof Blob ? resp.data : new Blob([resp.data || ""]);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `deploy-${target}-logs.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
      } catch (err) {
        if (mountedRef.current) {
          setError(err?.response?.data?.detail || err?.message || "Export failed");
        }
      } finally {
        if (mountedRef.current) setExporting(false);
      }
    },
    [filter, level]
  );

  // Initial fetch when deploy changes / tab enabled
  useEffect(() => {
    if (!enabled || !deployId) {
      stopWs();
      return undefined;
    }
    fetchInitial(deployId);
    connectWs(deployId);
    return () => stopWs();
  }, [enabled, deployId, fetchInitial, connectWs, stopWs]);

  // Poll fallback while active
  useEffect(() => {
    if (!enabled || !deployId) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return undefined;
    }
    const svcActive = ["queued", "deploying", "running", "stopping", "pending"].includes(
      String(serviceStatus || "").toLowerCase()
    );
    const depActive = ["pending", "running", "rolling_back"].includes(
      String(deployStatus || "").toLowerCase()
    );
    if (!svcActive && !depActive) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return undefined;
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollTimerRef.current = setInterval(() => {
      if (!document.hidden) pollNew();
    }, DEPLOY_LOG_POLL_INTERVAL);
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [enabled, deployId, serviceStatus, deployStatus, pollNew]);

  const retryConnection = useCallback(() => {
    if (!deployId) return;
    setError(null);
    setReconnecting(true);
    wsReconnectAttemptRef.current = 0;
    connectWs(deployId);
  }, [connectWs, deployId]);

  return {
    entries,
    error,
    loading,
    loadingOlder,
    filter,
    setFilter,
    level,
    setLevel,
    connected,
    reconnecting,
    exporting,
    hasMoreOlder,
    loadOlder,
    download,
    scrollRef,
    retryConnection,
    clear: () => setEntries([]),
    refresh: () => (deployId ? fetchInitial(deployId) : Promise.resolve()),
  };
}

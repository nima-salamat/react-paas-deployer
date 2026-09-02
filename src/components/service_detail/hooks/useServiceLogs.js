/**
 * Single source of truth for runtime service logs (persistent history + WS).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { API_BASE, SERVICE_BASE, LOG_BUFFER_MAX, LOG_PAGE_SIZE } from "../constants";
import { normalizeLogEntry } from "../utils";

const SEARCH_DEBOUNCE_MS = 350;

function mergeBounded(prev, incoming, { prepend = false } = {}) {
  const map = new Map();
  const order = [];
  const push = (e) => {
    if (!e) return;
    const key = e.cursor || e.id || e.key;
    if (!key || map.has(key)) return;
    map.set(key, e);
    order.push(key);
  };
  if (prepend) {
    incoming.forEach(push);
    prev.forEach(push);
  } else {
    prev.forEach(push);
    incoming.forEach(push);
  }
  let out = order.map((k) => map.get(k));
  if (out.length > LOG_BUFFER_MAX) {
    out = prepend ? out.slice(0, LOG_BUFFER_MAX) : out.slice(out.length - LOG_BUFFER_MAX);
  }
  return out;
}

export default function useServiceLogs({ serviceId, enabled }) {
  const [entries, setEntries] = useState([]);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [searching, setSearching] = useState(false);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState("");
  const [level, setLevel] = useState("all");
  const [searchMode, setSearchMode] = useState("local"); // "local" | "server"
  const [historyQInput, setHistoryQInput] = useState("");
  const [historyQ, setHistoryQ] = useState("");
  const [gap, setGap] = useState(null);
  const [usage, setUsage] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [exporting, setExporting] = useState(false);

  const cursorRef = useRef(null);
  const oldestCursorRef = useRef(null);
  const socketRef = useRef(null);
  const shouldReconnect = useRef(true);
  const reconnectTimer = useRef(null);
  const reconnectAttempt = useRef(0);
  const pausedRef = useRef(false);
  const scrollRef = useRef(null);
  const loadingOlderRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem("access");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const logsUrl = useCallback(
    (extra = "") => {
      const base = String(SERVICE_BASE || "").replace(/\/+$/, "");
      const sid = String(serviceId || "").replace(/^\/+|\/+$/g, "");
      const path = `${base}/${sid}/logs/`;
      const ext = String(extra || "").replace(/^\/+/, "");
      return ext ? `${path}${ext}` : path;
    },
    [serviceId]
  );

  const loadHistory = useCallback(
    async ({ cursor, direction = "older", q, replace = false, isSearch = false } = {}) => {
      if (!serviceId) return;
      if (direction === "older" && cursor) {
        if (loadingOlderRef.current) return;
        loadingOlderRef.current = true;
        setLoadingOlder(true);
      } else if (isSearch) {
        setSearching(true);
      } else {
        setLoading(true);
      }

      const scroller = scrollRef.current;
      const prevHeight = scroller?.scrollHeight || 0;
      const prevTop = scroller?.scrollTop || 0;

      try {
        const params = { limit: LOG_PAGE_SIZE };
        if (cursor) params.cursor = cursor;
        if (direction) params.direction = direction;
        const qq = q !== undefined ? q : historyQ;
        if (qq) params.q = qq;
        if (level && level !== "all") params.level = level;
        const resp = await axios.get(logsUrl(), {
          params,
          headers: authHeaders(),
        });
        if (!mountedRef.current) return;
        const data = resp?.data || {};
        if (data.code === "EXPIRED_CURSOR" || resp.status === 409) {
          setGap("Historical gap detected. Some older logs are no longer available.");
          return;
        }
        let events = (data.events || [])
          .map((e) => normalizeLogEntry(e))
          .filter(Boolean);
        if ((!events.length || data.source === "none") && data.logs?.length) {
          events = data.logs.map((t) => normalizeLogEntry(null, t)).filter(Boolean);
        }
        setEntries((prev) =>
          replace ? events : mergeBounded(prev, events, { prepend: direction === "older" })
        );
        if (data.usage) setUsage(data.usage);
        if (data.policy) setPolicy(data.policy);
        setHasMoreOlder(Boolean(data.has_more_older));
        if (events.length) {
          oldestCursorRef.current = data.next_cursor || events[0]?.cursor || null;
          cursorRef.current = data.prev_cursor || events[events.length - 1]?.cursor || null;
        }
        setError(null);

        if (direction === "older" && cursor && scroller) {
          requestAnimationFrame(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop =
                scrollRef.current.scrollHeight - prevHeight + prevTop;
            }
          });
        }
      } catch (err) {
        if (!mountedRef.current) return;
        const detail = err?.response?.data?.detail || err?.message || "Failed to load logs";
        if (err?.response?.status === 409) {
          setGap(detail || "Historical gap detected.");
        } else {
          setError(detail);
        }
      } finally {
        loadingOlderRef.current = false;
        if (mountedRef.current) {
          setLoading(false);
          setLoadingOlder(false);
          setSearching(false);
        }
      }
    },
    [authHeaders, historyQ, level, logsUrl, serviceId]
  );

  useEffect(() => {
    if (!enabled) return undefined;
    const t = setTimeout(() => setHistoryQ(String(historyQInput || "").trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [historyQInput, enabled]);

  useEffect(() => {
    if (!enabled || !serviceId) return;
    cursorRef.current = null;
    oldestCursorRef.current = null;
    const isServerSearch = searchMode === "server" && Boolean(historyQ);
    loadHistory({
      replace: true,
      q: isServerSearch ? historyQ : "",
      isSearch: isServerSearch,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, serviceId, historyQ, level, searchMode]);

  const connectWs = useCallback(() => {
    if (!enabled || !serviceId) return;
    const token = localStorage.getItem("access");
    if (!token) {
      setError("Authentication required for live logs.");
      return;
    }
    shouldReconnect.current = true;
    try {
      socketRef.current?.close();
    } catch {
      /* noop */
    }
    let backendUrl;
    try {
      backendUrl = new URL(API_BASE);
    } catch {
      backendUrl = new URL(window.location.origin);
    }
    const protocol = backendUrl.protocol === "https:" ? "wss:" : "ws:";
    let url = `${protocol}//${backendUrl.host}/ws/services/logs/${serviceId}/?token=${encodeURIComponent(token)}`;
    if (cursorRef.current) url += `&cursor=${encodeURIComponent(cursorRef.current)}`;
    const socket = new WebSocket(url);
    socketRef.current = socket;
    socket.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
      setReconnecting(false);
      setError(null);
      reconnectAttempt.current = 0;
    };
    socket.onmessage = (evt) => {
      if (pausedRef.current) return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "logs.gap") {
          setGap(msg.detail || "Historical gap detected. Some older logs are no longer available.");
          return;
        }
        if (msg.type === "logs.snapshot") {
          const events = (msg.events || []).map((e) => normalizeLogEntry(e)).filter(Boolean);
          setEntries(events);
          if (msg.gap) setGap("Historical gap detected. Showing latest available window.");
          if (events.length) {
            cursorRef.current = events[events.length - 1]?.cursor || null;
            oldestCursorRef.current = events[0]?.cursor || null;
          }
          return;
        }
        if (msg.type === "logs.line" && msg.event) {
          const e = normalizeLogEntry(msg.event);
          if (!e) return;
          setEntries((prev) => mergeBounded(prev, [e]));
          if (e.cursor) cursorRef.current = e.cursor;
        }
      } catch {
        /* ignore */
      }
    };
    socket.onclose = (evt) => {
      if (!mountedRef.current) return;
      setConnected(false);
      if (!shouldReconnect.current || evt.wasClean) return;
      setReconnecting(true);
      reconnectAttempt.current += 1;
      const delay = Math.min(1000 * 2 ** Math.min(reconnectAttempt.current, 5), 30000);
      reconnectTimer.current = setTimeout(() => connectWs(), delay);
    };
    socket.onerror = () => {
      if (mountedRef.current) setConnected(false);
    };
  }, [enabled, serviceId]);

  useEffect(() => {
    if (!enabled) return undefined;
    connectWs();
    return () => {
      shouldReconnect.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      try {
        socketRef.current?.close();
      } catch {
        /* noop */
      }
      socketRef.current = null;
    };
  }, [enabled, connectWs]);

  const loadOlder = useCallback(() => {
    if (!oldestCursorRef.current || loadingOlderRef.current) return;
    loadHistory({ cursor: oldestCursorRef.current, direction: "older" });
  }, [loadHistory]);

  const jumpToLatest = useCallback(() => {
    cursorRef.current = null;
    loadHistory({ replace: true }).then(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [loadHistory]);

  const download = useCallback(
    async (fmt = "txt") => {
      if (!serviceId) return;
      setExporting(true);
      try {
        const params = { format: fmt, limit: 5000 };
        if (searchMode === "server" && historyQ) params.q = historyQ;
        if (level && level !== "all") params.level = level;
        const resp = await axios.get(logsUrl("export/"), {
          params,
          headers: authHeaders(),
          responseType: "blob",
        });
        const blob = resp.data instanceof Blob ? resp.data : new Blob([resp.data || ""]);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `service-${serviceId}-logs.${fmt === "jsonl" ? "jsonl" : "txt"}`;
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
    [authHeaders, historyQ, level, logsUrl, searchMode, serviceId]
  );

  const retryConnection = useCallback(() => {
    setError(null);
    setReconnecting(true);
    reconnectAttempt.current = 0;
    connectWs();
  }, [connectWs]);

  return {
    entries,
    connected,
    reconnecting,
    error,
    loading,
    loadingOlder,
    searching,
    paused,
    setPaused,
    filter,
    setFilter,
    level,
    setLevel,
    searchMode,
    setSearchMode,
    historyQInput,
    setHistoryQInput,
    gap,
    setGap,
    usage,
    policy,
    hasMoreOlder,
    loadOlder,
    jumpToLatest,
    download,
    exporting,
    scrollRef,
    retryConnection,
    clear: () => setEntries([]),
    refresh: () => loadHistory({ replace: true }),
  };
}

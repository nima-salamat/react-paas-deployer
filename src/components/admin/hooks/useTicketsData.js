import { useCallback, useEffect, useRef, useState } from "react";
import apiRequest from "../../customHooks/apiRequest";
import { TICKETS_API, unwrapData } from "../../tickets/api";

/**
 * useTicketsData — owns the tickets list, stats, and detail state.
 *
 * Returns the state plus action callbacks used by AdminDashboard, TicketsPanel,
 * OverviewPanel and the TicketDetailDrawer.
 */
export function useTicketsData() {
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("");
  const [tLoading, setTLoading] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);

  // Refs to allow stable callbacks for the websocket
  const selectedIdRef = useRef(null);
  const loadTicketsRef = useRef(() => {});
  const openDetailRef = useRef(async () => {});
  const loadStatsRef = useRef(() => {});
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  const loadStats = useCallback(async () => {
    try {
      const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/staff/stats/` });
      setStats(unwrapData(res));
    } catch { /* */ }
  }, []);
  loadStatsRef.current = loadStats;

  const loadTickets = useCallback(async (opts = {}) => {
    const silent = Boolean(opts && opts.silent);
    if (!silent) setTLoading(true);
    try {
      const params = { page };
      if (search) params.search = search;
      if (status) params.status = status;
      if (priority) params.priority = priority;
      if (assignedFilter) params.assigned_to = assignedFilter;
      const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/staff/`, params });
      const data = res.data;
      const results = data.results || data.data || [];
      setTickets(Array.isArray(results) ? results : []);
      setCount(typeof data.count === 'number' ? data.count : (Array.isArray(results) ? results.length : 0));
    } catch {
      setTickets([]);
    } finally {
      if (!silent) setTLoading(false);
    }
  }, [page, search, status, priority, assignedFilter]);
  loadTicketsRef.current = loadTickets;

  const openDetail = useCallback(async (id, opts = {}) => {
    const silent = Boolean(opts.silent);
    setSelectedId(id);
    selectedIdRef.current = id;
    if (!silent) {
      setDetailLoading(true);
      setReply("");
      setFiles([]);
    }
    try {
      const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/${id}/` });
      setDetail(unwrapData(res));
      if (typeof document === "undefined" || document.visibilityState !== "hidden") {
        try {
          const rr = await apiRequest({ method: "POST", url: `${TICKETS_API}/${id}/read/` });
          const rd = rr.data?.data || rr.data || {};
          const ids = new Set((rd.message_ids || []).map(String));
          if (ids.size) {
            setDetail((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: (prev.messages || []).map((m) =>
                  ids.has(String(m.id))
                    ? {
                        ...m,
                        seen_at: rd.last_read_at || new Date().toISOString(),
                        is_seen: true,
                        read_state: "read",
                      }
                    : m
                ),
              };
            });
          }
        } catch { /* */ }
      }
    } catch {
      if (!silent) setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);
  openDetailRef.current = (id) => openDetail(id, { silent: true });

  const changeStatus = useCallback(async (v) => {
    if (!selectedId) return;
    await apiRequest({ method: "POST", url: `${TICKETS_API}/staff/${selectedId}/status/`, data: { status: v } });
    openDetail(selectedId);
    loadTickets();
    loadStats();
  }, [selectedId, openDetail, loadTickets, loadStats]);

  const sendReply = useCallback(async (bodyOverride) => {
    if (!selectedId) return;
    const body = bodyOverride != null ? bodyOverride : reply;
    if (!htmlToPlain(body) && !files.length) return;
    setSending(true);
    try {
      const form = new FormData();
      form.append("body", htmlToPlain(body) ? body : "<p></p>");
      files.forEach((f) => form.append("attachments", f));
      const res = await apiRequest({ method: "POST", url: `${TICKETS_API}/${selectedId}/messages/`, data: form });
      const created = res.data?.data || res.data;
      setReply("");
      setFiles([]);
      if (created && created.id) {
        setDetail((prev) => {
          if (!prev) return prev;
          const msgs = prev.messages || [];
          const exists = msgs.some((m) => String(m.id) === String(created.id));
          return {
            ...prev,
            messages: exists
              ? msgs.map((m) => (String(m.id) === String(created.id) ? { ...m, ...created } : m))
              : [...msgs, created],
          };
        });
      }
      await openDetail(selectedId, { silent: true });
      loadTickets({ silent: true });
    } finally {
      setSending(false);
    }
  }, [selectedId, reply, files, openDetail, loadTickets]);

  const deleteTicket = useCallback(async (id) => {
    if (!window.confirm("Delete this ticket permanently?")) return null;
    try {
      await apiRequest({ method: "DELETE", url: `${TICKETS_API}/staff/${id}/delete/` });
      setSelectedId(null);
      setDetail(null);
      loadTickets();
      loadStats();
      return true;
    } catch (e) {
      return e?.response?.data?.message || "Delete failed";
    }
  }, [loadTickets, loadStats]);

  const closeDetail = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
  }, []);

  // Initial stats + ticket list
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => {
    const t = setTimeout(loadTickets, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadTickets, search]);

  return {
    // state
    stats, tickets, page, setPage, count, search, setSearch,
    status, setStatus, priority, setPriority,
    assignedFilter, setAssignedFilter, tLoading,
    selectedId, detail, detailLoading, reply, setReply, files, setFiles, sending,
    // actions
    loadStats, loadTickets, openDetail, changeStatus, sendReply, deleteTicket, closeDetail,
    // refs (for ws callbacks)
    selectedIdRef, loadTicketsRef, openDetailRef, loadStatsRef,
  };
}

// Local copy of htmlToPlain to avoid an extra import cycle
function htmlToPlain(html) {
  if (!html) return "";
  try {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return (tmp.textContent || "").trim();
  } catch {
    return String(html).replace(/<[^>]*>/g, "").trim();
  }
}

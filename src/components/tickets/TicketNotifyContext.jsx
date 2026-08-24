import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import {
  Badge, IconButton, Menu, MenuItem, ListItemText, Typography, Snackbar, Alert, Box,
  Divider, ListItemIcon, Switch, Tooltip,
} from "@mui/material";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import NotificationsOffOutlinedIcon from "@mui/icons-material/NotificationsOffOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import { API_HOST } from "./api";
import { refreshAccessToken } from "../customHooks/apiRequest.jsx";

const Ctx = createContext(null);
const MUTE_KEY = "tickets_notify_muted";
const ITEMS_KEY = "tickets_notify_items_v1";

function decodeJwtUserId(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    const id = json.user_id ?? json.userId ?? json.sub ?? null;
    return id == null ? null : id;
  } catch {
    return null;
  }
}

function buildNotifyWsUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  const token = window.localStorage.getItem("access");
  if (!token) return null;
  try {
    const backendUrl = new URL(API_HOST.startsWith("http") ? API_HOST : `https://${API_HOST}`);
    const protocol = backendUrl.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${backendUrl.host}/ws/tickets/notify/?token=${encodeURIComponent(token)}`;
  } catch (e) {
    console.warn("[tickets-ws] bad API_HOST", API_HOST, e);
    return null;
  }
}

function loadMuted() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistMuted(value) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch { /* */ }
}

function loadStoredItems() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 40) : [];
  } catch {
    return [];
  }
}

function persistItems(items) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(ITEMS_KEY, JSON.stringify(items.slice(0, 40)));
  } catch { /* */ }
}

export function TicketNotifyProvider({ children }) {
  const [items, setItems] = useState(() => loadStoredItems());
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);
  const [toast, setToast] = useState(null);
  const [muted, setMutedState] = useState(() => loadMuted());
  const [userId, setUserId] = useState(() => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const t = window.localStorage.getItem("access");
      return t ? decodeJwtUserId(t) : null;
    } catch {
      return null;
    }
  });
  const wsRef = useRef(null);
  const listenersRef = useRef(new Set());
  const reconnectRef = useRef(0);
  const userIdRef = useRef(userId);
  const mutedRef = useRef(muted);
  userIdRef.current = userId;
  mutedRef.current = muted;

  const setMuted = useCallback((value) => {
    const next = Boolean(value);
    setMutedState(next);
    mutedRef.current = next;
    persistMuted(next);
  }, []);

  const emit = useCallback((event) => {
    listenersRef.current.forEach((fn) => {
      try { fn(event); } catch { /* */ }
    });
  }, []);

  const subscribe = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  const send = useCallback((payload) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify(payload)); } catch { /* */ }
    }
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => {
      const next = prev.filter((it) => it.id !== id);
      persistItems(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    setUnread(0);
    persistItems([]);
  }, []);

  useEffect(() => {
    let closed = false;
    let timer;
    let pingTimer;
    // Guard: while we're waiting for a token refresh + retry, don't fire off
    // additional reconnect attempts (prevents a thundering herd of WS connects
    // each using the same expired token).
    let refreshing = false;

    const connect = async () => {
      let token = localStorage.getItem("access");
      // If there's no token at all, the user simply isn't logged in — don't
      // try to connect (and don't schedule a retry). The auth-changed event
      // will trigger a reconnect when the user logs in.
      if (!token) {
        setConnected(false);
        return;
      }

      // Check token expiry BEFORE opening the socket. If the token is already
      // expired (or about to be), refresh it first so the WS connect succeeds.
      // Access JWTs are short-lived (5 minutes by default); if we skip this
      // check we end up reconnecting with the same expired token every 500ms,
      // which is exactly what produced the ExpiredTokenError flood in the logs.
      try {
        const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        const exp = Number(payload.exp || 0) * 1000;
        // If token expires in < 10s, refresh proactively.
        if (exp && exp - Date.now() < 10000) {
          if (!refreshing) {
            refreshing = true;
            try {
              token = await refreshAccessToken();
            } catch {
              // refreshAccessToken already redirected to /signin_or_signup
              setConnected(false);
              return;
            } finally {
              refreshing = false;
            }
          }
        }
      } catch {
        // Token wasn't a JWT — fall through and let the server reject it.
      }

      const uid = token ? decodeJwtUserId(token) : null;
      setUserId(uid);
      userIdRef.current = uid;

      const url = buildNotifyWsUrl();
      if (!url) {
        setConnected(false);
        return;
      }

      let socket;
      try {
        socket = new WebSocket(url);
      } catch (e) {
        console.warn("[tickets-ws] construct failed", e);
        setConnected(false);
        return;
      }
      wsRef.current = socket;

      socket.onopen = () => {
        reconnectRef.current = 0;
        setConnected(true);
        console.info("[tickets-ws] connected");
        try { socket.send(JSON.stringify({ type: "ping" })); } catch { /* */ }
        clearInterval(pingTimer);
        pingTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            try { socket.send(JSON.stringify({ type: "ping" })); } catch { /* */ }
          }
        }, 20000);
      };

      socket.onclose = (ev) => {
        setConnected(false);
        clearInterval(pingTimer);
        console.warn("[tickets-ws] closed", ev.code, ev.reason || "");
        if (closed) return;
        // 4401 = our backend's "auth failed" close code (see consumers.py).
        // Treat it as "token expired" — try to refresh, then reconnect.
        // If refresh fails, refreshAccessToken() will redirect to login.
        if (ev.code === 4401) {
          if (!refreshing) {
            refreshing = true;
            refreshAccessToken()
              .then(() => {
                refreshing = false;
                timer = setTimeout(connect, 300);
              })
              .catch(() => {
                refreshing = false;
                // refresh already redirected to login — stop retrying
              });
          }
          return;
        }
        if (!localStorage.getItem("access")) return;
        const attempt = Math.min(reconnectRef.current + 1, 8);
        reconnectRef.current = attempt;
        timer = setTimeout(connect, Math.min(500 * 2 ** attempt, 12000));
      };

      socket.onerror = () => {
        console.warn("[tickets-ws] error");
        try { socket.close(); } catch { /* */ }
      };

      socket.onmessage = (ev) => {
        let data;
        try { data = JSON.parse(ev.data); } catch { return; }
        if (data.type === "connected") {
          console.info("[tickets-ws] hello", data);
          return;
        }
        // Never treat presence / pong / subscribe as "seen"
        if (data.type === "pong" || data.type === "subscribed") return;

        // Always fan-out raw events to page subscribers (TicketDetail, lists, …)
        // Seen is handled ONLY by explicit POST /read/ from TicketDetail when the
        // user is actually viewing that ticket — not by being online / connected.
        emit(data);

        const me = userIdRef.current;
        const isSelf =
          data.type === "ticket.message"
          && me != null
          && data.author_id != null
          && String(data.author_id) === String(me);

        if (isSelf) return;

        // ticket.seen must never create a notification or toast
        if (data.type === "ticket.seen") return;

        if (data.type === "ticket.message" || data.type === "ticket.created") {
          // Respect mute: still deliver to page subscribers via emit() above,
          // but do not show toast / badge / list items when muted.
          if (mutedRef.current) return;

          const title = data.type === "ticket.created" ? "New ticket" : "New reply";
          const body = data.preview || data.subject || data.public_id || "";
          const item = {
            id: `${Date.now()}-${data.message_id || data.ticket_id}-${Math.random().toString(36).slice(2, 7)}`,
            title,
            body,
            data,
            at: new Date().toISOString(),
          };
          setItems((prev) => {
            const next = [item, ...prev].slice(0, 40);
            persistItems(next);
            return next;
          });
          setUnread((n) => n + 1);
          setToast({ severity: "info", message: `${title}: ${body}` });
        }
      };
    };

    connect();

    const onAuth = () => {
      clearTimeout(timer);
      clearInterval(pingTimer);
      try { wsRef.current?.close(); } catch { /* */ }
      reconnectRef.current = 0;
      timer = setTimeout(connect, 200);
    };
    window.addEventListener("auth-changed", onAuth);
    window.addEventListener("storage", onAuth);

    return () => {
      closed = true;
      clearTimeout(timer);
      clearInterval(pingTimer);
      window.removeEventListener("auth-changed", onAuth);
      window.removeEventListener("storage", onAuth);
      try { wsRef.current?.close(); } catch { /* */ }
    };
  }, [emit]);

  const value = useMemo(
    () => ({
      connected,
      items,
      unread,
      userId,
      muted,
      setMuted,
      clearUnread: () => setUnread(0),
      removeItem,
      clearAll,
      subscribe,
      send,
    }),
    [connected, items, unread, userId, muted, setMuted, removeItem, clearAll, subscribe, send],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {toast ? (
          <Alert severity={toast.severity} onClose={() => setToast(null)} variant="filled">
            {toast.message}
          </Alert>
        ) : null}
      </Snackbar>
    </Ctx.Provider>
  );
}

export function useTicketNotify() {
  return useContext(Ctx) || {
    connected: false,
    items: [],
    unread: 0,
    userId: null,
    muted: false,
    setMuted: () => {},
    clearUnread: () => {},
    removeItem: () => {},
    clearAll: () => {},
    subscribe: () => () => {},
    send: () => {},
  };
}

export function TicketNotifyBell() {
  const {
    items, unread, clearUnread, connected, muted, setMuted, removeItem, clearAll,
  } = useTicketNotify();
  const [anchor, setAnchor] = useState(null);

  const openMenu = (e) => {
    setAnchor(e.currentTarget);
    clearUnread();
  };

  return (
    <>
      <Tooltip title={muted ? "Notifications muted" : "Notifications"}>
        <IconButton color="inherit" onClick={openMenu} aria-label="notifications">
          <Badge
            badgeContent={muted ? 0 : unread}
            color="error"
            max={99}
            variant={connected ? "standard" : "dot"}
          >
            {muted ? (
              <NotificationsOffOutlinedIcon color="disabled" />
            ) : (
              <NotificationsOutlinedIcon color={connected ? "inherit" : "disabled"} />
            )}
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        PaperProps={{ sx: { width: 360, maxHeight: 460 } }}
      >
        <MenuItem dense disableRipple sx={{ cursor: "default", opacity: 1 }}>
          <ListItemText
            primary="Notifications"
            secondary={
              muted
                ? "Muted — you will not get toasts or badge"
                : connected
                  ? "Realtime on"
                  : "Realtime offline — check ASGI/Redis"
            }
          />
        </MenuItem>
        <MenuItem
          onClick={(e) => {
            e.stopPropagation();
            setMuted(!muted);
          }}
        >
          <ListItemIcon>
            {muted ? <NotificationsOutlinedIcon fontSize="small" /> : <NotificationsOffOutlinedIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText primary={muted ? "Turn notifications on" : "Turn notifications off"} />
          <Switch
            edge="end"
            size="small"
            checked={!muted}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setMuted(!e.target.checked)}
          />
        </MenuItem>
        {items.length > 0 && (
          <MenuItem
            onClick={(e) => {
              e.stopPropagation();
              clearAll();
            }}
          >
            <ListItemIcon>
              <ClearAllIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Clear all" />
          </MenuItem>
        )}
        <Divider />
        {items.length === 0 ? (
          <MenuItem disabled><ListItemText primary="No notifications yet" /></MenuItem>
        ) : (
          items.slice(0, 15).map((it) => (
            <MenuItem
              key={it.id}
              sx={{ alignItems: "flex-start", py: 1 }}
              onClick={() => {
                setAnchor(null);
                const href = it.data?.ticket_id ? `/tickets/${it.data.ticket_id}` : "/tickets";
                window.location.href = href;
              }}
            >
              <ListItemText
                primary={it.title}
                secondary={(
                  <Box>
                    <Typography variant="caption" display="block" noWrap>{it.body}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(it.at).toLocaleString()}
                    </Typography>
                  </Box>
                )}
                sx={{ pr: 1 }}
              />
              <IconButton
                size="small"
                edge="end"
                aria-label="delete notification"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  removeItem(it.id);
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
}

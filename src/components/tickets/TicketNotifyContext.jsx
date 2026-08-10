import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Badge, IconButton, Menu, MenuItem, ListItemText, Typography, Snackbar, Alert, Box } from "@mui/material";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";

const Ctx = createContext(null);

function notifyWsUrl() {
  const token = localStorage.getItem("access");
  if (!token) return null;
  try {
    const host = `https://${import.meta.env.VITE_API_BASE}`.replace(/\/+$/, "");
    const u = new URL(host);
    const protocol = u.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${u.host}/ws/tickets/notify/?token=${encodeURIComponent(token)}`;
  } catch {
    return null;
  }
}

export function TicketNotifyProvider({ children }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);
  const [toast, setToast] = useState(null);
  const [anchor, setAnchor] = useState(null);
  const wsRef = useRef(null);
  const listenersRef = useRef(new Set());
  const reconnectRef = useRef(0);

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
      ws.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    let closed = false;
    let timer;

    const connect = () => {
      const url = notifyWsUrl();
      if (!url) {
        setConnected(false);
        return;
      }
      const socket = new WebSocket(url);
      wsRef.current = socket;
      socket.onopen = () => {
        reconnectRef.current = 0;
        setConnected(true);
        try { socket.send(JSON.stringify({ type: "ping" })); } catch { /* */ }
      };
      socket.onclose = () => {
        setConnected(false);
        if (closed) return;
        const attempt = Math.min(reconnectRef.current + 1, 8);
        reconnectRef.current = attempt;
        timer = setTimeout(connect, Math.min(1000 * 2 ** attempt, 15000));
      };
      socket.onerror = () => { try { socket.close(); } catch { /* */ } };
      socket.onmessage = (ev) => {
        let data;
        try { data = JSON.parse(ev.data); } catch { return; }
        if (data.type === "connected" || data.type === "pong" || data.type === "subscribed") return;
        emit(data);
        if (data.type === "ticket.message" || data.type === "ticket.created") {
          const title = data.type === "ticket.created" ? "New ticket" : "New reply";
          const body = data.preview || data.subject || data.public_id;
          setItems((prev) => [{ id: `${Date.now()}-${data.message_id || data.ticket_id}`, title, body, data, at: new Date().toISOString() }, ...prev].slice(0, 40));
          setUnread((n) => n + 1);
          setToast({ severity: "info", message: `${title}: ${body}` });
        } else if (data.type === "ticket.seen") {
          emit(data);
        }
      };
    };

    connect();
    const onAuth = () => {
      try { wsRef.current?.close(); } catch { /* */ }
      reconnectRef.current = 0;
      connect();
    };
    window.addEventListener("auth-changed", onAuth);
    return () => {
      closed = true;
      clearTimeout(timer);
      window.removeEventListener("auth-changed", onAuth);
      try { wsRef.current?.close(); } catch { /* */ }
    };
  }, [emit]);

  const value = useMemo(
    () => ({ connected, items, unread, clearUnread: () => setUnread(0), subscribe, send }),
    [connected, items, unread, subscribe, send]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {toast ? <Alert severity={toast.severity} onClose={() => setToast(null)} variant="filled">{toast.message}</Alert> : null}
      </Snackbar>
    </Ctx.Provider>
  );
}

export function useTicketNotify() {
  return useContext(Ctx) || {
    connected: false,
    items: [],
    unread: 0,
    clearUnread: () => {},
    subscribe: () => () => {},
    send: () => {},
  };
}

/** Bell icon for Navbar */
export function TicketNotifyBell() {
  const { items, unread, clearUnread } = useTicketNotify();
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <IconButton color="inherit" onClick={(e) => { setAnchor(e.currentTarget); clearUnread(); }}>
        <Badge badgeContent={unread} color="error" max={99}>
          <NotificationsOutlinedIcon />
        </Badge>
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} PaperProps={{ sx: { width: 320, maxHeight: 400 } }}>
        {items.length === 0 ? (
          <MenuItem disabled><ListItemText primary="No notifications" /></MenuItem>
        ) : (
          items.slice(0, 15).map((it) => (
            <MenuItem key={it.id} onClick={() => setAnchor(null)} component="a" href={it.data?.ticket_id ? `/tickets/${it.data.ticket_id}` : "/tickets"}>
              <ListItemText
                primary={it.title}
                secondary={
                  <Box>
                    <Typography variant="caption" display="block" noWrap>{it.body}</Typography>
                    <Typography variant="caption" color="text.secondary">{new Date(it.at).toLocaleString()}</Typography>
                  </Box>
                }
              />
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
}

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import {
  Badge, IconButton, Menu, MenuItem, ListItemText, Typography, Snackbar, Alert, Box,
} from "@mui/material";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";

const Ctx = createContext(null);

function decodeJwtUserId(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json.user_id ?? json.userId ?? json.sub ?? null;
  } catch {
    return null;
  }
}

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
  const [userId, setUserId] = useState(() => {
    const t = localStorage.getItem("access");
    return t ? decodeJwtUserId(t) : null;
  });
  const wsRef = useRef(null);
  const listenersRef = useRef(new Set());
  const reconnectRef = useRef(0);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

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
      try {
        ws.send(JSON.stringify(payload));
      } catch { /* */ }
    }
  }, []);

  useEffect(() => {
    let closed = false;
    let timer;
    let pingTimer;

    const connect = () => {
      const token = localStorage.getItem("access");
      const uid = token ? decodeJwtUserId(token) : null;
      setUserId(uid);
      userIdRef.current = uid;

      const url = notifyWsUrl();
      if (!url) {
        setConnected(false);
        return;
      }
      let socket;
      try {
        socket = new WebSocket(url);
      } catch {
        setConnected(false);
        return;
      }
      wsRef.current = socket;

      socket.onopen = () => {
        reconnectRef.current = 0;
        setConnected(true);
        try { socket.send(JSON.stringify({ type: "ping" })); } catch { /* */ }
        clearInterval(pingTimer);
        pingTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            try { socket.send(JSON.stringify({ type: "ping" })); } catch { /* */ }
          }
        }, 25000);
      };

      socket.onclose = () => {
        setConnected(false);
        clearInterval(pingTimer);
        if (closed) return;
        if (!localStorage.getItem("access")) return;
        const attempt = Math.min(reconnectRef.current + 1, 8);
        reconnectRef.current = attempt;
        timer = setTimeout(connect, Math.min(800 * 2 ** attempt, 15000));
      };

      socket.onerror = () => {
        try { socket.close(); } catch { /* */ }
      };

      socket.onmessage = (ev) => {
        let data;
        try { data = JSON.parse(ev.data); } catch { return; }
        if (data.type === "connected" || data.type === "pong" || data.type === "subscribed") return;

        // Never notify yourself about your own messages
        const me = userIdRef.current;
        if (
          data.type === "ticket.message"
          && me != null
          && data.author_id != null
          && String(data.author_id) === String(me)
        ) {
          emit(data); // still emit for live UI refresh
          return;
        }

        emit(data);

        if (data.type === "ticket.message" || data.type === "ticket.created") {
          const title = data.type === "ticket.created" ? "New ticket" : "New reply";
          const body = data.preview || data.subject || data.public_id || "";
          setItems((prev) => [
            {
              id: `${Date.now()}-${data.message_id || data.ticket_id}`,
              title,
              body,
              data,
              at: new Date().toISOString(),
            },
            ...prev,
          ].slice(0, 40));
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
      // small delay so token is written
      timer = setTimeout(connect, 150);
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
      clearUnread: () => setUnread(0),
      subscribe,
      send,
    }),
    [connected, items, unread, userId, subscribe, send],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4500}
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
    clearUnread: () => {},
    subscribe: () => () => {},
    send: () => {},
  };
}

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
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        PaperProps={{ sx: { width: 320, maxHeight: 400 } }}
      >
        {items.length === 0 ? (
          <MenuItem disabled><ListItemText primary="No notifications" /></MenuItem>
        ) : (
          items.slice(0, 15).map((it) => (
            <MenuItem
              key={it.id}
              onClick={() => setAnchor(null)}
              component="a"
              href={it.data?.ticket_id ? `/tickets/${it.data.ticket_id}` : "/tickets"}
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
              />
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
}

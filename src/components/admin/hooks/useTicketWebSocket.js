import { useEffect, useRef, useState } from "react";
import { hostBase } from "../adminUtils";
import { clearAuthAndRedirect } from "../../customHooks/apiRequest.jsx";
import { isSessionBoundToken } from "../../customHooks/authSession.js";

/**
 * useTicketWebSocket — connects to /ws/tickets/ as soon as `enabled` becomes
 * true (typically after the staff identity has been loaded). Re-emits
 * incoming events through `onEvent` and tracks connection state.
 *
 * Returns: { connected, events }
 */
export function useTicketWebSocket({ enabled, onEvent }) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const wsRef = useRef(null);
  const reconnectRef = useRef(0);
  const onEventRef = useRef(onEvent);

  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!enabled) return;
    let closed = false;
    let timer;
    let pingTimer;

    const connect = () => {
      const token = localStorage.getItem("access");
      if (!token) return;
      if (!isSessionBoundToken(token)) {
        clearAuthAndRedirect();
        return;
      }
      let url;
      try {
        const backendUrl = new URL(hostBase());
        const protocol = backendUrl.protocol === "https:" ? "wss:" : "ws:";
        url = `${protocol}//${backendUrl.host}/ws/tickets/?token=${encodeURIComponent(token)}`;
      } catch {
        return;
      }
      const socket = new WebSocket(url);
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
        }, 20000);
      };
      socket.onclose = (event) => {
        clearInterval(pingTimer);
        if (event.code === 4401) {
          clearAuthAndRedirect();
          return;
        }
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
        if (data.type === "connected" || data.type === "pong") return;
        setEvents((prev) => [data, ...prev].slice(0, 30));
        onEventRef.current?.(data);
      };
    };
    connect();

    return () => {
      closed = true;
      clearTimeout(timer);
      clearInterval(pingTimer);
      try { wsRef.current?.close(); } catch { /* */ }
    };
  }, [enabled]);

  return { connected, events, setEvents };
}

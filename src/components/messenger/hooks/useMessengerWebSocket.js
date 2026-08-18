import { useEffect } from "react";
import apiRequest, { refreshAccessToken } from "../../customHooks/apiRequest.jsx";
import { MSG_API, WS_URL } from "../api";

/**
 * Messenger WebSocket connection + event dispatch.
 * Keeps reconnect / token-refresh logic out of MessengerApp.
 */
export default function useMessengerWebSocket({
  meId,
  wsRef,
  activeIdRef,
  callConfigRef,
  panelHistoryRef,
  messagesCacheRef,
  nearBottomRef,
  pendingNewIdsRef,
  seenRingIdsRef,
  bottomRef,
  loadConversations,
  loadMessages,
  loadConversationDetail,
  loadPinnedMessages,
  loadConvJoinRequests,
  loadMyJoinRequests,
  closeChat,
  openChat,
  flash,
  setMessages,
  setOnlineUsers,
  setTypingUsers,
  setIncomingCall,
  setCallConfig,
  setActiveCallInfo,
  setNewBelowCount,
}) {
useEffect(() => {
  let cancelled = false;
  let pingTimer = null;
  let reconnectTimer = null;
  let refreshing = false;

  const buildUrl = (tok) => `${WS_URL}?token=${encodeURIComponent(tok)}`;

  const handleOnMessage = (ev) => {
    let data;
    try { data = JSON.parse(ev.data); } catch { return; }
    if (data.type === "message.deleted") {
      const mid = data.message_id || data.id;
      const cid = String(data.conversation_id || "");
      if (mid && cid === String(activeIdRef.current)) {
        setMessages((prev) => prev.filter((m) => String(m.id) !== String(mid)));
        // patch cache
        const cached = messagesCacheRef.current.get(cid);
        if (cached?.messages) {
          messagesCacheRef.current.set(cid, {
            ...cached,
            messages: cached.messages.filter((m) => String(m.id) !== String(mid)),
          });
        }
        // Refresh pinned messages list — the deleted message may have been pinned
        loadPinnedMessages(Number(cid));
      }
      loadConversations({ silent: true });
    }
    if (data.type === "call.started") {
      // Incoming call from another participant
      if (String(data.initiator?.id) !== String(meId)) {
        // Already in another call → busy (auto-decline)
        if (callConfigRef.current) {
          const cid = data.conversation_id;
          const callId = data.call_id;
          (async () => {
            try {
              await apiRequest({
                method: "POST",
                url: `${MSG_API}/conversations/${cid}/call/end/`,
                data: { call_id: callId, reason: "busy" },
              });
            } catch { /* */ }
          })();
          return;
        }
        const rid = data.call_id || `${data.conversation_id}:${data.initiator?.id}`;
        if (seenRingIdsRef.current.has(String(rid))) return;
        seenRingIdsRef.current.add(String(rid));
        setIncomingCall({ ...data, _receivedAt: data._receivedAt || Date.now() });
        // If this is the open chat, show in-chat join bar too
        if (String(data.conversation_id) === String(activeIdRef.current)) {
          setActiveCallInfo({
            call_id: data.call_id,
            status: "ringing",
            is_video: !!(data.media?.video || data.is_video),
            initiator: data.initiator,
            conversation_id: data.conversation_id,
          });
        }
      }
    }
    if (data.type === "call.answered") {
      // Someone else answered — stop our ringing UI if still showing
      setIncomingCall((prev) =>
        prev && String(prev.call_id) === String(data.call_id) ? null : prev
      );
    }
    if (data.type === "call.ended") {
      setIncomingCall((prev) => {
        if (!prev) return null;
        if (data.call_id && String(prev.call_id) === String(data.call_id)) return null;
        if (String(prev.conversation_id) === String(data.conversation_id)) return null;
        return prev;
      });
      // If we are in this call, close modal (remote hangup / timeout)
      setCallConfig((prev) => {
        if (!prev) return null;
        if (data.call_id && prev.call_id && String(prev.call_id) === String(data.call_id)) {
          return null;
        }
        if (String(prev.conversation_id) === String(data.conversation_id)) return null;
        return prev;
      });
      if (data.status === "busy") {
        try { flash("User is busy on another call"); } catch { /* */ }
      }
      if (data.call_id) {
        seenRingIdsRef.current.delete(String(data.call_id));
      }
      setActiveCallInfo((prev) => {
        if (!prev) return null;
        if (data.call_id && String(prev.call_id) === String(data.call_id)) return null;
        if (String(prev.conversation_id) === String(data.conversation_id)) return null;
        return prev;
      });
    }
    if (["message.new", "message.edited", "message.reaction", "message.read"].includes(data.type)) {
      if (String(data.conversation_id) === String(activeIdRef.current)) {
        if (data.type === "message.new") {
          const mid = data.message?.id || data.message_id || data.id;
          if (mid && !nearBottomRef.current) {
            const sid = String(mid);
            if (!pendingNewIdsRef.current.includes(sid)) {
              pendingNewIdsRef.current = [...pendingNewIdsRef.current, sid];
              setNewBelowCount(pendingNewIdsRef.current.length);
            }
          } else if (nearBottomRef.current) {
            setTimeout(() => {
              bottomRef.current?.scrollIntoView({ behavior: "smooth" });
              // New inbound message while watching → mark seen shortly after it lands
              setTimeout(() => {
                try { markVisibleMessagesRead(); } catch { /* */ }
              }, 350);
            }, 40);
          }
        }
        if (data.type === "message.read") {
          // Peer (or self on another device) marked messages read → update ticks on my messages
          const idsRaw = data.message_ids || data.read_ids || data.ids || [];
          const idSet = new Set(
            (Array.isArray(idsRaw) ? idsRaw : [data.message_id || data.last_read_id])
              .filter((x) => x != null)
              .map((x) => String(x))
          );
          const readerId = data.user_id ?? data.reader_id ?? data.read_by;
          // If server only sends last_read_id, mark all of my earlier msgs as read
          const lastRead = data.last_read_id != null ? Number(data.last_read_id) : null;
          setMessages((prev) => prev.map((m) => {
            if (String(m.sender?.id) !== String(meId)) return m;
            if (m.read_state === "read") return m;
            if (idSet.has(String(m.id))) return { ...m, read_state: "read" };
            if (lastRead != null && Number(m.id) <= lastRead) return { ...m, read_state: "read" };
            // Some backends only emit conversation-level read without ids
            if (!idSet.size && lastRead == null && readerId != null && String(readerId) !== String(meId)) {
              return { ...m, read_state: "read" };
            }
            return m;
          }));
        }
        if (data.type !== "message.read") {
          loadMessages(activeIdRef.current, { silent: true });
        } else {
          // Still soft-refresh to stay consistent with server
          loadMessages(activeIdRef.current, { silent: true });
        }
      }
      loadConversations({ silent: true });
    }
    if (data.type === "typing" && String(data.conversation_id) === String(activeIdRef.current)) {
      const uid = Number(data.user_id);
      if (!uid || String(uid) === String(meId)) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (data.is_typing) {
          next[uid] = {
            username: data.username || "Someone",
            until: Date.now() + 4000,
          };
        } else {
          delete next[uid];
        }
        return next;
      });
    }
    if (data.type === "presence.update" && data.user_id != null) {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (data.online) next.add(Number(data.user_id));
        else next.delete(Number(data.user_id));
        return next;
      });
      loadConversations({ silent: true });
    }
    if ([
      "member.left", "member.removed", "member.role_changed",
      "ownership.transferred", "conversation.deleted", "member.joined",
      "messages.cleared",
    ].includes(data.type)) {
      if (
        (data.type === "member.removed" || data.type === "conversation.deleted")
        && String(data.user_id) === String(meId)
      ) {
        flash(data.type === "conversation.deleted"
          ? "The group was deleted"
          : "You were removed from the group");
        closeChat();
        loadConversations({ silent: false });
        return;
      }
      if (
        data.type === "member.left"
        && String(data.user_id) === String(meId)
      ) {
        flash("You left the group");
        closeChat();
        loadConversations({ silent: false });
        return;
      }
      if (data.conversation_id && String(data.conversation_id) === String(activeIdRef.current)) {
        loadConversationDetail(data.conversation_id);
        loadMessages(data.conversation_id, { silent: data.type !== "messages.cleared" });
        if (panelHistoryRef.current.includes("join-requests")) {
          loadConvJoinRequests(data.conversation_id);
        }
      }
      loadConversations({ silent: true });
    }
    if (data.type === "profile.update") {
      loadConversations({ silent: true });
      if (activeIdRef.current) {
        loadConversationDetail(activeIdRef.current);
        // Do not reload messages on profile updates — that used to wipe
        // older pages the user had already scrolled in.
      }
      if (profileDataRef.current?.id && String(profileDataRef.current.id) === String(data.user_id)) {
        refreshProfileData(profileDataRef.current.id);
      }
    }
    if (data.type === "group.settings_changed") {
      if (data.conversation_id && String(data.conversation_id) === String(activeIdRef.current)) {
        loadConversationDetail(data.conversation_id);
        loadMessages(data.conversation_id, { silent: false });
      }
      loadConversations({ silent: true });
    }
    if ([
      "join_request.new", "join_request.approved",
      "join_request.rejected", "join_request.cancelled",
    ].includes(data.type)) {
      if (data.conversation_id && String(data.conversation_id) === String(activeIdRef.current)) {
        loadConvJoinRequests(data.conversation_id);
      }
      if (panelHistoryRef.current.includes("my-requests")) {
        loadMyJoinRequests();
      }
      if (data.type === "join_request.approved" && String(data.user_id) === String(meId)) {
        flash("Your join request was approved!");
        loadConversations({ silent: false }).then((list) => {
          const conv = list.find((c) => String(c.id) === String(data.conversation_id));
          if (conv) openChat(conv);
        });
      }
      if (data.type === "join_request.rejected" && String(data.user_id) === String(meId)) {
        flash("Your join request was rejected");
        loadMyJoinRequests();
      }
    }
    // Pin/unpin message events — refresh the pinned bar in real-time
    if (data.type === "message.pinned" || data.type === "message.unpinned") {
      if (data.conversation_id && String(data.conversation_id) === String(activeIdRef.current)) {
        loadPinnedMessages(data.conversation_id);
      }
    }
  };

  const connect = async () => {
    let token = localStorage.getItem("access");
    if (!token) {
      // Not logged in — abort. The auth-changed listener will reconnect
      // after the user logs in.
      return;
    }
    // Proactively refresh the token if it's about to expire.
    try {
      const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      const exp = Number(payload.exp || 0) * 1000;
      if (exp && exp - Date.now() < 10000) {
        if (!refreshing) {
          refreshing = true;
          try { token = await refreshAccessToken(); }
          catch { refreshing = false; return; }
          finally { refreshing = false; }
        }
      }
    } catch { /* not a JWT — fall through */ }

    if (cancelled) return;
    const ws = new WebSocket(buildUrl(token));
    wsRef.current = ws;
    ws.onopen = () => {
      // Announce online presence so peers can see us (and we receive updates)
      try {
        ws.send(JSON.stringify({ type: "presence.update", online: true }));
      } catch { /* */ }
    };
    ws.onmessage = handleOnMessage;
    ws.onclose = (ev) => {
      clearInterval(pingTimer);
      if (cancelled) return;
      // 4401 = our backend's "auth failed" close code (see consumers.py).
      // Try to refresh the token and reconnect once.
      if (ev.code === 4401) {
        if (!refreshing) {
          refreshing = true;
          refreshAccessToken()
            .then(() => {
              refreshing = false;
              if (!cancelled) reconnectTimer = setTimeout(connect, 300);
            })
            .catch(() => {
              refreshing = false;
              // refreshAccessToken already redirected to /signin_or_signup
            });
        }
        return;
      }
      // Other close codes — try to reconnect with exponential backoff.
      // The token might still be valid (network blip, server restart, etc.).
      if (!localStorage.getItem("access")) return;
      reconnectTimer = setTimeout(connect, 3000);
    };
    ws.onerror = () => {
      try { ws.close(); } catch { /* */ }
    };
    pingTimer = setInterval(() => {
      try { ws.send(JSON.stringify({ type: "ping" })); } catch { /* */ }
    }, 25000);
  };

  connect();

  // Listen for auth changes (login / logout / token refresh) so we reconnect
  // immediately after the user logs in.
  const onAuth = () => {
    clearTimeout(reconnectTimer);
    clearInterval(pingTimer);
    try { wsRef.current?.close(); } catch { /* */ }
    reconnectTimer = setTimeout(connect, 200);
  };
  window.addEventListener("auth-changed", onAuth);
  window.addEventListener("storage", onAuth);

  return () => {
    cancelled = true;
    clearInterval(pingTimer);
    clearTimeout(reconnectTimer);
    window.removeEventListener("auth-changed", onAuth);
    window.removeEventListener("storage", onAuth);
    try { wsRef.current?.close(); } catch { /* */ }
  };
}, [loadConversations, loadMessages]);


}

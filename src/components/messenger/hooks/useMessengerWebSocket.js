import { useEffect, useRef } from "react";
import apiRequest, { refreshAccessToken } from "../../customHooks/apiRequest.jsx";
import { MSG_API, WS_URL } from "../api";
import { writeComposerDraft } from "../modules/composerDrafts";

/**
 * Messenger WebSocket connection + event dispatch.
 * Keeps reconnect / token-refresh logic out of MessengerApp.
 */
export default function useMessengerWebSocket({
  meId,
  wsRef,
  activeIdRef,
  panelHistoryRef,
  messagesCacheRef,
  nearBottomRef,
  pendingNewIdsRef,
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
  setNewBelowCount,
  setText,
  setConversations,
  onRemoteEmojiPlay,
  onCallEvent,
}) {
  const onCallEventRef = useRef(onCallEvent);
  onCallEventRef.current = onCallEvent;

useEffect(() => {
  let cancelled = false;
  let pingTimer = null;
  let reconnectTimer = null;
  let refreshing = false;

  const buildUrl = (tok) => `${WS_URL}?token=${encodeURIComponent(tok)}`;

  const patchReactionLocally = (conversationId, messageId, emoji, action, actorId) => {
    const cid = String(conversationId);
    const mid = String(messageId);
    const actorIsMe = String(actorId) === String(meId);

    const patchMessages = (items) =>
      (items || []).map((message) => {
        if (String(message.id) !== mid) return message;

        const current = Array.isArray(message.reactions) ? message.reactions : [];
        const index = current.findIndex((r) => String(r?.emoji) === String(emoji));
        const nextReactions = current.map((r) => ({ ...r }));

        if (action === "added") {
          if (index < 0) {
            nextReactions.push({ emoji, count: 1, mine: actorIsMe });
          } else {
            nextReactions[index] = {
              ...nextReactions[index],
              count: Number(nextReactions[index].count || 0) + 1,
              mine: actorIsMe ? true : !!nextReactions[index].mine,
            };
          }
        } else if (action === "removed" && index >= 0) {
          const currentCount = Number(nextReactions[index].count || 0);
          if (currentCount <= 1) {
            nextReactions.splice(index, 1);
          } else {
            nextReactions[index] = {
              ...nextReactions[index],
              count: currentCount - 1,
              mine: actorIsMe ? false : !!nextReactions[index].mine,
            };
          }
        }

        return { ...message, reactions: nextReactions };
      });

    setMessages((items) => patchMessages(items));

    try {
      const cached = messagesCacheRef.current.get(cid);
      if (cached?.messages) {
        messagesCacheRef.current.set(cid, {
          ...cached,
          messages: patchMessages(cached.messages),
          savedAt: Date.now(),
        });
      }
    } catch {
      // Cache is an optimization; live state is authoritative.
    }
  };

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
    if (
      data.type === "call.started"
      || data.type === "call.answered"
      || data.type === "call.ended"
    ) {
      try {
        onCallEventRef.current?.(data);
      } catch {
        // Call UI owns its own recovery; one bad handler must not break WS dispatch.
      }
    }
    if (["message.new", "message.edited", "message.reaction", "message.read"].includes(data.type)) {
      if (String(data.conversation_id) === String(activeIdRef.current)) {
        if (data.type === "message.new") {
          // Message implies they stopped typing — drop indicator immediately
          const senderId = data.message?.sender?.id ?? data.sender_id ?? data.user_id;
          if (senderId != null) {
            setTypingUsers((prev) => {
              if (!prev[senderId] && !prev[String(senderId)] && !prev[Number(senderId)]) {
                return prev;
              }
              const next = { ...prev };
              delete next[senderId];
              delete next[String(senderId)];
              delete next[Number(senderId)];
              return next;
            });
          }
          const mid = data.message?.id || data.message_id || data.id;
          if (mid && !nearBottomRef.current) {
            const sid = String(mid);
            if (!pendingNewIdsRef.current.includes(sid)) {
              pendingNewIdsRef.current = [...pendingNewIdsRef.current, sid];
              setNewBelowCount(pendingNewIdsRef.current.length);
            }
          } else if (nearBottomRef.current) {
            // Scroll may race loadMessages paint — several passes so the new
            // bubble (and typing row) end up in view without a second gesture.
            const pin = () => {
              try {
                const root = bottomRef.current?.parentElement;
                if (root && typeof root.scrollHeight === "number") {
                  try {
                    root.scrollTo({ top: root.scrollHeight, behavior: "smooth" });
                  } catch {
                    root.scrollTop = root.scrollHeight;
                  }
                }
              } catch { /* */ }
              try {
                bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
              } catch {
                try { bottomRef.current?.scrollIntoView?.(); } catch { /* */ }
              }
            };
            pin();
            setTimeout(pin, 50);
            setTimeout(pin, 150);
            setTimeout(pin, 320);
            setTimeout(() => {
              try { markVisibleMessagesRead(); } catch { /* */ }
            }, 400);
          }
        }
        if (data.type === "message.read") {
          // Read receipts are local UI state. Re-fetching the entire history here
          // causes scroll jumps and can undo an in-progress history window.
          const idsRaw = data.message_ids || data.read_ids || data.ids || [];
          const idSet = new Set(
            (Array.isArray(idsRaw) ? idsRaw : [data.message_id || data.last_read_id])
              .filter((x) => x != null)
              .map((x) => String(x))
          );
          const readerId = data.user_id ?? data.reader_id ?? data.read_by;
          const lastRead = data.last_read_id != null ? Number(data.last_read_id) : null;
          const patchRead = (items) => (items || []).map((m) => {
            if (String(m.sender?.id) !== String(meId)) return m;
            if (m.read_state === "read") return m;
            if (idSet.has(String(m.id))) return { ...m, read_state: "read" };
            if (lastRead != null && Number(m.id) <= lastRead) return { ...m, read_state: "read" };
            if (!idSet.size && lastRead == null && readerId != null && String(readerId) !== String(meId)) {
              return { ...m, read_state: "read" };
            }
            return m;
          });
          setMessages(patchRead);
          try {
            const cid = String(data.conversation_id);
            const cached = messagesCacheRef.current.get(cid);
            if (cached?.messages) {
              messagesCacheRef.current.set(cid, {
                ...cached,
                messages: patchRead(cached.messages),
                savedAt: Date.now(),
              });
            }
          } catch {
            // Cache is an optimization.
          }
        } else if (data.type === "message.reaction") {
          patchReactionLocally(
            data.conversation_id,
            data.message_id || data.id,
            data.emoji,
            data.action,
            data.user_id ?? data.actor_id,
          );
        } else if (data.type === "message.new" || data.type === "message.edited") {
          // These events can change the message window itself, so retain the
          // existing background refresh behavior.
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
            // Slightly above sender debounce (2.2s) so a single laggy packet doesn't flicker
            until: Date.now() + 2800,
          };
        } else {
          delete next[uid];
        }
        return next;
      });
    }
    if (data.type === "draft" && data.user_id != null && String(data.user_id) === String(meId)) {
      const cid = data.conversation_id;
      const draft = typeof data.text === "string" ? data.text : "";
      // Only write localStorage when remote has content or we're clearing —
      // avoid resetting updatedAt on empty echo while user is typing.
      try {
        const localNow = (() => {
          try {
            const raw = localStorage.getItem("messenger.composerDrafts.v2");
            const all = raw ? JSON.parse(raw) : {};
            const e = all?.[String(cid)];
            return typeof e === "object" && e && typeof e.text === "string" ? e.text : (typeof e === "string" ? e : "");
          } catch { return ""; }
        })();
        // Don't overwrite a non-empty local draft with empty server echo
        // (race: local keystroke vs delayed empty ack).
        if (draft.trim() || !String(localNow || "").trim()) {
          writeComposerDraft(cid, draft);
        }
      } catch { /* */ }
      if (setConversations) {
        setConversations((prev) => prev.map((c) => {
          if (String(c.id) !== String(cid)) return c;
          // Keep non-empty local list preview if server sent empty
          if (!draft.trim() && (c.draft_text || "").trim()) return c;
          return { ...c, draft_text: draft };
        }));
      }
      // Apply to open composer only if this chat is active and user isn't mid-edit
      if (String(cid) === String(activeIdRef.current) && setText) {
        setText((cur) => {
          if (String(cur || "") === draft) return cur;
          // Prefer remote only when local is empty (multi-device / reload sync)
          if (!String(cur || "").trim()) return draft;
          return cur;
        });
      }
    }
    if (data.type === "emoji_play" && String(data.conversation_id) === String(activeIdRef.current)) {
      if (onRemoteEmojiPlay && data.message_id) {
        onRemoteEmojiPlay(data.message_id, data.user_id);
      }
    }
    if (data.type === "presence.update" && data.user_id != null) {
      const uid = Number(data.user_id);
      const online = data.online === true || data.online === "true" || data.online === 1;
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (online) next.add(uid);
        else next.delete(uid);
        return next;
      });
      // Update peer.is_online on matching private chats without a full list reload
      setConversations?.((prev) => {
        if (!Array.isArray(prev)) return prev;
        let changed = false;
        const mapped = prev.map((c) => {
          if (c?.type !== "private" || c?.peer?.id == null) return c;
          if (Number(c.peer.id) !== uid) return c;
          if (Boolean(c.peer.is_online) === online) return c;
          changed = true;
          return { ...c, peer: { ...c.peer, is_online: online } };
        });
        return changed ? mapped : prev;
      });
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

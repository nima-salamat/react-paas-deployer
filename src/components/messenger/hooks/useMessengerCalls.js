import { useCallback, useEffect, useRef, useState } from "react";
import apiRequest from "../../customHooks/apiRequest.jsx";
import { MSG_API, unwrapData } from "../api";
import { convAvatar, convTitle, peerUser, withTokenQuery } from "../messengerUtils";

const DEFAULT_RING_SECONDS = 30;
const DISCONNECTED_POLL_MS = 5000;

function sameCall(a, b) {
  if (!a || !b) return false;
  if (a.call_id && b.call_id) return String(a.call_id) === String(b.call_id);
  return String(a.conversation_id || "") === String(b.conversation_id || "");
}

function callConfigFor({
  cfg,
  conversationId,
  isInitiator,
  isGroup,
  title,
  avatar,
}) {
  return {
    ...cfg,
    is_initiator: !!isInitiator,
    is_group: !!isGroup,
    conversation_id: conversationId,
    peer_title: title,
    peer_avatar: avatar || null,
  };
}

export default function useMessengerCalls({
  meId,
  activeId,
  activeIdRef,
  activeDetail,
  conversations,
  openChat,
  flash,
  wsRef,
}) {
  const [callConfig, setCallConfig] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCallInfo, setActiveCallInfo] = useState(null);
  const [callMode, setCallMode] = useState("inline");
  const [callEnding, setCallEnding] = useState(false);
  const [incomingCallBusy, setIncomingCallBusy] = useState(false);

  const callConfigRef = useRef(null);
  const incomingCallRef = useRef(null);
  const activeCallInfoRef = useRef(null);
  const conversationsRef = useRef([]);
  const seenRingIdsRef = useRef(new Set());
  const endRetryTimerRef = useRef(null);

  useEffect(() => {
    callConfigRef.current = callConfig;
  }, [callConfig]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    activeCallInfoRef.current = activeCallInfo;
  }, [activeCallInfo]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => () => {
    if (endRetryTimerRef.current) clearTimeout(endRetryTimerRef.current);
  }, []);

  const resolveConversation = useCallback((conversationId) => {
    const key = String(conversationId);
    if (String(activeId) === key) {
      return activeDetail || conversationsRef.current.find((c) => String(c.id) === key) || null;
    }
    return conversationsRef.current.find((c) => String(c.id) === key) || null;
  }, [activeId, activeDetail]);

  const buildIncoming = useCallback((data, conversationId) => {
    const remaining = Number(data.ring_remaining ?? data.ring_timeout ?? DEFAULT_RING_SECONDS);
    const startedAt = data.started_at ? new Date(data.started_at).getTime() : NaN;
    const receivedAt = Number.isFinite(startedAt)
      ? startedAt
      : Date.now() - Math.max(0, DEFAULT_RING_SECONDS * 1000 - remaining * 1000);

    return {
      conversation_id: data.conversation_id || conversationId,
      call_id: data.call_id,
      media: data.media,
      is_video: data.is_video,
      is_group: !!data.is_group,
      initiator: data.initiator,
      ring_timeout: Math.max(1, remaining),
      ring_remaining: Math.max(1, remaining),
      started_at: data.started_at,
      _receivedAt: receivedAt,
      replay: true,
    };
  }, []);

  const surfaceIncoming = useCallback((data, conversationId) => {
    const rid = data.call_id || `${conversationId}:${data.initiator?.id || ""}`;
    if (seenRingIdsRef.current.has(String(rid))) return false;
    seenRingIdsRef.current.add(String(rid));
    const next = buildIncoming(data, conversationId);
    setIncomingCall(next);
    if (String(activeIdRef.current) === String(next.conversation_id)) {
      setActiveCallInfo({
        call_id: next.call_id,
        status: "ringing",
        is_video: !!(next.media?.video || next.is_video),
        initiator: next.initiator,
        conversation_id: next.conversation_id,
      });
    }
    return true;
  }, [activeIdRef, buildIncoming]);

  const joinCall = useCallback(async (incoming) => {
    const call = incoming || incomingCallRef.current || activeCallInfoRef.current;
    const cid = call?.conversation_id;
    const callId = call?.call_id;
    if (!cid) {
      flash("Call is no longer available");
      return false;
    }
    if (callConfigRef.current && !sameCall(callConfigRef.current, call)) {
      flash("You're already in another call");
      return false;
    }

    setIncomingCallBusy(true);
    try {
      const res = await apiRequest({
        method: "GET",
        url: `${MSG_API}/conversations/${cid}/call/join/${callId ? `?call_id=${encodeURIComponent(callId)}` : ""}`,
      });
      const cfg = unwrapData(res);
      if (!cfg?.room) throw new Error("Call is no longer available");

      const conv = resolveConversation(cid);
      const isGroup = !!(call?.is_group || conv?.type === "group");
      const initiator = call?.initiator || cfg?.initiator || {};
      const title = isGroup
        ? (convTitle(conv, meId) || call?.peer_title || "Group call")
        : (initiator.username || initiator.display_name || call?.peer_title || "Call");
      const avatar = isGroup
        ? withTokenQuery(convAvatar(conv, meId))
        : (withTokenQuery(initiator.avatar || initiator.avatar_url) || null);

      const nextConfig = callConfigFor({
        cfg: {
          ...cfg,
          call_status: cfg.call_status || "active",
          started_at: cfg.started_at || call?.started_at || null,
        },
        conversationId: cid,
        isInitiator: false,
        isGroup,
        title,
        avatar,
      });

      setCallConfig(nextConfig);
      setCallMode("full");
      setIncomingCall(null);
      setActiveCallInfo(null);

      if (String(activeIdRef.current) !== String(cid)) {
        if (conv) openChat(conv);
        else openChat({
          id: cid,
          type: isGroup ? "group" : "private",
          peer: initiator,
        });
      }
      return true;
    } catch (e) {
      flash(e?.response?.data?.message || e?.message || "Could not join call");
      return false;
    } finally {
      setIncomingCallBusy(false);
    }
  }, [activeIdRef, flash, meId, openChat, resolveConversation]);

  const endServerCall = useCallback(async (config, reason = "ended") => {
    const cid = config?.conversation_id;
    const callId = config?.call_id;
    if (!cid) return true;

    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await apiRequest({
          method: "POST",
          url: `${MSG_API}/conversations/${cid}/call/end/`,
          data: { call_id: callId, reason },
        });
        return true;
      } catch (e) {
        lastError = e;
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      }
    }

    if (lastError) {
      endRetryTimerRef.current = setTimeout(async () => {
        await endServerCall(config, reason);
      }, 1800);
    }
    return false;
  }, []);

  const endActiveCall = useCallback(async (reason = "ended") => {
    const config = callConfigRef.current;
    if (!config) return false;
    setCallEnding(true);
    setCallConfig(null);
    setActiveCallInfo(null);
    setCallMode("inline");
    const ok = await endServerCall(config, reason);
    setCallEnding(false);
    if (!ok) {
      flash("Call closed locally; the server is retrying the end request");
    }
    return ok;
  }, [endServerCall, flash]);

  const startCall = useCallback(async ({ video = false, audio = true } = {}) => {
    if (!activeId) return;
    if (callConfigRef.current || incomingCallRef.current) {
      flash("You're already handling a call");
      return;
    }

    const conv = activeDetail || conversationsRef.current.find((c) => String(c.id) === String(activeId));
    try {
      const res = await apiRequest({
        method: "POST",
        url: `${MSG_API}/conversations/${activeId}/call/`,
        data: { video, audio },
      });
      const cfg = unwrapData(res);
      if (!cfg?.room) throw new Error("Could not create call");

      const isGroup = conv?.type === "group";
      const peer = !isGroup ? peerUser(conv, meId) : null;
      const title = isGroup
        ? (convTitle(conv, meId) || "Group call")
        : (peer?.username || peer?.display_name || convTitle(conv, meId) || "Call");
      const avatar = withTokenQuery(
        isGroup ? convAvatar(conv, meId) : (peer?.avatar || peer?.avatar_url || convAvatar(conv, meId))
      );

      setCallConfig(callConfigFor({
        cfg,
        conversationId: activeId,
        isInitiator: true,
        isGroup,
        title,
        avatar,
      }));
      setActiveCallInfo({
        call_id: cfg.call_id,
        status: "ringing",
        is_video: !!video,
        initiator: { id: meId, username: "You" },
        conversation_id: activeId,
      });
      setCallMode("full");
    } catch (e) {
      flash(e?.response?.data?.message || e?.message || "Could not start call");
    }
  }, [activeDetail, activeId, flash, meId]);

  const startCallWithUser = useCallback(async (user, opts = {}) => {
    if (!user?.id) return;
    if (callConfigRef.current || incomingCallRef.current) {
      flash("You're already handling a call");
      return;
    }

    try {
      const res = await apiRequest({
        method: "POST",
        url: `${MSG_API}/conversations/`,
        data: { type: "private", user_id: user.id },
      });
      const conv = unwrapData(res) || res?.data;
      const cid = conv?.id;
      if (!cid) throw new Error("Could not open conversation");

      openChat(conv);

      const callRes = await apiRequest({
        method: "POST",
        url: `${MSG_API}/conversations/${cid}/call/`,
        data: { video: !!opts.video, audio: true },
      });
      const cfg = unwrapData(callRes);
      if (!cfg?.room) throw new Error("Could not create call");

      setCallConfig(callConfigFor({
        cfg,
        conversationId: cid,
        isInitiator: true,
        isGroup: false,
        title: user.username || user.display_name || "Call",
        avatar: withTokenQuery(user.avatar || user.avatar_url),
      }));
      setActiveCallInfo({
        call_id: cfg.call_id,
        status: "ringing",
        is_video: !!opts.video,
        initiator: { id: meId, username: "You" },
        conversation_id: cid,
      });
      setCallMode("full");
    } catch (e) {
      flash(e?.response?.data?.message || e?.message || "Could not start call");
    }
  }, [flash, meId, openChat]);

  const handleCallEvent = useCallback((data) => {
    if (!data?.type) return;

    if (data.type === "call.started") {
      if (String(data.initiator?.id) === String(meId)) return;

      const current = callConfigRef.current;
      if (current) {
        const cid = data.conversation_id;
        const callId = data.call_id;
        apiRequest({
          method: "POST",
          url: `${MSG_API}/conversations/${cid}/call/end/`,
          data: { call_id: callId, reason: "busy" },
        }).catch(() => {});
        return;
      }

      surfaceIncoming(data, data.conversation_id);
      return;
    }

    if (data.type === "call.answered") {
      const current = callConfigRef.current;
      if (current && (!data.call_id || String(current.call_id) === String(data.call_id))) {
        setCallConfig((prev) => prev ? { ...prev, call_status: "active" } : prev);
        setActiveCallInfo((prev) => prev ? { ...prev, status: "active" } : prev);
        setIncomingCall(null);
      }
      return;
    }

    if (data.type === "call.ended") {
      const current = callConfigRef.current;
      const incoming = incomingCallRef.current;
      const active = activeCallInfoRef.current;
      const matches = (candidate) => {
        if (!candidate) return false;
        if (data.call_id && candidate.call_id) {
          return String(data.call_id) === String(candidate.call_id);
        }
        return String(data.conversation_id || "") === String(candidate.conversation_id || "");
      };

      const hit = matches(current) || matches(incoming) || matches(active);
      if (!hit) return;

      if (current && matches(current)) {
        setCallConfig(null);
        setCallMode("inline");
      }
      if (incoming && matches(incoming)) setIncomingCall(null);
      if (active && matches(active)) setActiveCallInfo(null);
      if (data.call_id) seenRingIdsRef.current.delete(String(data.call_id));

      if (data.status === "busy") flash("User is busy on another call");
      else if (data.status === "no_answer") flash("Call was not answered");
      else if (data.status === "declined") flash("Call declined");
    }
  }, [flash, meId, surfaceIncoming]);

  // Recover the authoritative state whenever a chat is opened.
  useEffect(() => {
    if (!activeId) {
      setActiveCallInfo(null);
      return undefined;
    }

    let cancelled = false;
    const check = async () => {
      try {
        const res = await apiRequest({
          method: "GET",
          url: `${MSG_API}/conversations/${activeId}/call/active/`,
        });
        const data = unwrapData(res);
        if (cancelled) return;

        if (!data?.active) {
          if (!callConfigRef.current || String(callConfigRef.current.conversation_id) === String(activeId)) {
            setActiveCallInfo(null);
          }
          return;
        }

        setActiveCallInfo({
          ...data,
          conversation_id: data.conversation_id || activeId,
        });

        if (
          data.status === "ringing"
          && String(data.initiator?.id) !== String(meId)
          && !callConfigRef.current
        ) {
          surfaceIncoming(data, activeId);
        }
      } catch {
        // A transient failure should not erase a visible call. WebSocket remains the primary signal.
      }
    };

    check();
    return () => { cancelled = true; };
  }, [activeId, meId, surfaceIncoming]);

  // WebSocket is authoritative. Poll only while it is unavailable, so calls
  // still recover after a dropped socket without hammering the API.
  useEffect(() => {
    if (!meId) return undefined;
    let cancelled = false;

    const checkOtherConversations = async () => {
      if (cancelled || callConfigRef.current || incomingCallRef.current) return;
      if (wsRef?.current?.readyState === 1) return;

      const candidates = (conversationsRef.current || [])
        .filter((c) => String(c.id) !== String(activeIdRef.current))
        .slice(0, 50);

      for (const c of candidates) {
        if (cancelled || callConfigRef.current || incomingCallRef.current) return;
        try {
          const res = await apiRequest({
            method: "GET",
            url: `${MSG_API}/conversations/${c.id}/call/active/`,
          });
          const data = unwrapData(res);
          if (!data?.active || data.status !== "ringing") continue;
          if (String(data.initiator?.id) === String(meId)) continue;
          if (surfaceIncoming(data, c.id)) return;
        } catch {
          // The next pass retries transient conversation/API failures.
        }
      }
    };

    const initial = setTimeout(checkOtherConversations, 1200);
    const timer = setInterval(checkOtherConversations, DISCONNECTED_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [activeIdRef, meId, wsRef, surfaceIncoming]);

  const callConversationId = callConfig?.conversation_id || null;
  const callConv = callConversationId
    ? resolveConversation(callConversationId)
    : null;

  return {
    callConfig,
    callConfigRef,
    incomingCall,
    incomingCallRef,
    activeCallInfo,
    callMode,
    callEnding,
    incomingCallBusy,
    setCallMode,
    setIncomingCall,
    setActiveCallInfo,
    startCall,
    startCallWithUser,
    joinCall,
    declineIncomingCall: useCallback(async () => {
      const incoming = incomingCallRef.current;
      if (!incoming) return;
      setIncomingCallBusy(true);
      const ok = await endServerCall(incoming, "declined");
      setIncomingCallBusy(false);
      if (ok) {
        setIncomingCall(null);
        setActiveCallInfo(null);
        if (incoming.call_id) seenRingIdsRef.current.delete(String(incoming.call_id));
      } else {
        flash("Could not decline the call. Try again.");
      }
    }, [endServerCall, flash]),
    timeoutIncomingCall: useCallback(async () => {
      const incoming = incomingCallRef.current;
      if (!incoming) return;
      setIncomingCallBusy(true);
      const ok = await endServerCall(incoming, "no_answer");
      setIncomingCallBusy(false);
      if (ok) {
        setIncomingCall(null);
        setActiveCallInfo(null);
        if (incoming.call_id) seenRingIdsRef.current.delete(String(incoming.call_id));
      } else {
        flash("Could not finish the incoming call. Retrying…");
      }
    }, [endServerCall, flash]),
    endActiveCall,
    handleCallEvent,
    callConversationId,
    callConv,
  };
}

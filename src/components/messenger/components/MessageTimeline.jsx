import React from "react";
import {
  Box, Typography, CircularProgress, Button, Stack, LinearProgress,
} from "@mui/material";
import MessageBubble from "./MessageBubble";
import { MSG_SCROLL_CLASS, updateScrollbarGutterVisibility } from "../modules/msgScrollStyles";
import { getSenderGroupFlags } from "../modules/messageGrouping";

/**
 * MessageTimeline owns the chat history viewport: pagination affordance,
 * message rendering, pending uploads, typing state, and scroll interaction.
 * MessengerApp supplies data/actions but does not own the visual timeline.
 */
export default function MessageTimeline(props) {
  const {
    listRef,
    isMobile,
    onScrollMsgs,
    onMessagesListPointerDown,
    onMessagesListPointerMove,
    onMessagesListPointerUp,
    rearmScrollDownByUser,
    callIsExpanded,
    selectionMode,
    hasMoreMsgs,
    loadingMore,
    loadOlder,
    loadingMsgs,
    messages,
    messagesWithDays,
    jumpHighlightId,
    jumpHighlightDayId,
    appearance,
    remoteEmojiPlay,
    activeIdRef,
    wsRef,
    setDayJumpOpen,
    apiRequest,
    MSG_API,
    setMessages,
    flash,
    setError,
    activeConv,
    meId,
    openCtx,
    selectedIds,
    seenMsgIds,
    isMessagePinned,
    toggleSelectMessage,
    react,
    setReactAnchor,
    inputRef,
    setReplyTo,
    setEditingMsg,
    startEdit,
    deleteMsg,
    setForwardOpen,
    openPreview,
    forceComposerText,
    setReadersMessage,
    loadUserProfile,
    onJumpToMessage,
    playAudioFromMessage,
    onToggleAudio,
    onSeekAudio,
    audioState,
    loadUserProfileByUsername,
    pendingUploads,
    bottomRef,
    typingUsers = {},
  } = props;

  const onCancelSchedule = async (msg) => {
    if (!msg?.id) return;
    try {
      await apiRequest({ method: "POST", url: `${MSG_API}/messages/${msg.id}/cancel-schedule/` });
      setMessages((prev) => prev.filter((m) => String(m.id) !== String(msg.id)));
      flash("Scheduled message cancelled");
    } catch (e) {
      setError(e?.response?.data?.message || "Cancel failed");
    }
  };

  return (
  <Box
    ref={listRef} className={MSG_SCROLL_CLASS} onScroll={onScrollMsgs}
    onMouseMove={(e) => {
      if (isMobile) return;
      updateScrollbarGutterVisibility(listRef.current, e.clientX, true);
    }}
    onMouseLeave={() => {
      if (isMobile) return;
      updateScrollbarGutterVisibility(listRef.current, null, false);
    }}
    sx={{
      position: "relative",
      flex: 1, overflow: "auto", px: { xs: 0.75, sm: 1.5 }, pt: 1.5, pb: 1,
      // Soften visual jank when older messages prepend
      scrollBehavior: "auto",
      "& > *": { transition: "opacity 0.2s ease" },
      touchAction: selectionMode ? "none" : "pan-y",
      userSelect: selectionMode ? "none" : "auto",
      // Expanded call takes the stage; mini bar keeps messages visible
      // (Telegram / WhatsApp style). Messages stay mounted so scroll
      // position is preserved across minimise/expand.
      // MUST be column — default flex row lays messages left-to-right.
      display: callIsExpanded ? "none" : "flex",
      flexDirection: "column",
    }}
    onContextMenu={(e) => {
      e.preventDefault();
      // Mobile/desktop: right-click anywhere in list tries to open menu for nearest message
      const bubble = e.target.closest?.("[data-msg-id]");
      if (bubble) {
        const id = bubble.getAttribute("data-msg-id");
        const msg = messages.find((x) => String(x.id) === String(id));
        if (msg) openCtx(e, msg);
      }
    }}
    onWheel={rearmScrollDownByUser}
    onTouchMove={rearmScrollDownByUser}
    onPointerDown={(e) => {
      rearmScrollDownByUser();
      onMessagesListPointerDown(e);
    }}
    onPointerMove={(e) => {
      // Pointer movement can be the scrollbar drag on desktop or a
      // touch/drag gesture on mobile. Treat it as user intent.
      if (e.buttons || e.pointerType === "touch" || e.pointerType === "pen") {
        rearmScrollDownByUser();
      }
      onMessagesListPointerMove(e);
    }}
    onPointerUp={onMessagesListPointerUp}
    onPointerCancel={onMessagesListPointerUp}
    onPointerLeave={onMessagesListPointerUp}
  >
    {hasMoreMsgs && (
      <Box
        sx={{
          textAlign: "center",
          py: 1.25,
          opacity: loadingMore ? 1 : 0.85,
          transition: "opacity 0.25s ease",
        }}
      >
        {loadingMore
          ? (
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
              <CircularProgress size={16} thickness={4} />
              <Typography variant="caption" color="text.secondary">Loading earlier messages…</Typography>
            </Stack>
          )
          : <Button size="small" onClick={loadOlder} sx={{ textTransform: "none" }}>Load older messages</Button>}
      </Box>
    )}
    {loadingMsgs && !messages.length && (
      <Box sx={{ textAlign: "center", py: 6 }}><CircularProgress /></Box>
    )}
    {messagesWithDays.map((m, msgIdx) => {
      const isMsg = m.type === "msg";
      const isDay = m.type === "day";
      const msgHl = isMsg && jumpHighlightId != null && String(jumpHighlightId) === String(m.id);
      const dayHl = isDay && jumpHighlightDayId != null && (
        String(jumpHighlightDayId) === String(m.id)
        || String(jumpHighlightDayId) === String(m.label)
      );
      const { isFirstInSenderGroup, isLastInSenderGroup } = getSenderGroupFlags(messagesWithDays, msgIdx);
      return (
      <Box
        key={m.id}
        id={isMsg ? `msg-${m.id}` : isDay ? m.id : undefined}
        data-day-id={isDay ? m.id : undefined}
        data-day-label={isDay ? m.label : undefined}
        sx={
          msgHl
            ? {
                animation: "msgFlash 2.2s ease-out",
                borderRadius: 2,
                "@keyframes msgFlash": {
                  "0%": {
                    backgroundColor: "rgba(255, 193, 7, 0.55)",
                    boxShadow: "0 0 0 3px rgba(255, 193, 7, 0.65)",
                  },
                  "35%": {
                    backgroundColor: "rgba(255, 193, 7, 0.35)",
                    boxShadow: "0 0 0 2px rgba(255, 193, 7, 0.4)",
                  },
                  "100%": {
                    backgroundColor: "transparent",
                    boxShadow: "none",
                  },
                },
              }
            : undefined
        }
      >
        <MessageBubble
          isFirstInSenderGroup={isFirstInSenderGroup}
          isLastInSenderGroup={isLastInSenderGroup}
          showOwnAvatar={appearance?.showOwnAvatar !== false}
          showOthersAvatar={appearance?.showOthersAvatar !== false}
          bubbleStyle={appearance?.bubbleStyle || "modern"}
          remoteEmojiPlay={
            remoteEmojiPlay && String(remoteEmojiPlay.messageId) === String(m.id)
              ? remoteEmojiPlay.key
              : 0
          }
          onEmojiPlay={(msg) => {
            const cid = activeIdRef.current;
            if (!cid || !wsRef.current || wsRef.current.readyState !== 1 || !msg?.id) return;
            try {
              wsRef.current.send(JSON.stringify({
                type: "emoji_play",
                conversation_id: Number(cid),
                message_id: Number(msg.id),
              }));
            } catch { /* */ }
          }}
          onDayClick={() => setDayJumpOpen(true)}
          onCancelSchedule={async (msg) => {
            if (!msg?.id) return;
            try {
              await apiRequest({ method: "POST", url: `${MSG_API}/messages/${msg.id}/cancel-schedule/` });
              setMessages((prev) => prev.filter((m) => String(m.id) !== String(msg.id)));
              flash("Scheduled message cancelled");
            } catch (e) {
              setError(e?.response?.data?.message || "Cancel failed");
            }
          }}
          m={isDay ? { ...m, _dayHighlight: dayHl } : m}
          meId={meId} activeConv={activeConv}
          onContextOpen={openCtx}
          selectionMode={selectionMode}
          selected={selectedIds.has(String(m.id))}
          isUnread={
            (String(m.sender?.id) !== String(meId) || m.is_system)
            && !seenMsgIds.has(String(m.id))
          }
          isPinnedMessage={isMessagePinned(m.id)}
          onToggleSelect={toggleSelectMessage}
          onReact={react}
          onReactAnchor={(e, message) => setReactAnchor({ anchorPosition: { top: e.clientY, left: e.clientX }, message })}
          onReply={(message) => { setReplyTo(message); setEditingMsg(null); inputRef.current?.focus(); }}
          onEdit={startEdit}
          onDelete={deleteMsg}
          onForward={(message) => setForwardOpen(message)}
          onOpenPreview={openPreview}
          onEditCode={(fence) => {
            forceComposerText((prev) => {
              const p = (prev || "").trim();
              return p ? `${p}\n\n${fence}` : fence;
            });
            setTimeout(() => inputRef.current?.focus?.(), 50);
          }}
          onShowReaders={(message) => setReadersMessage(message)}
          onCopyText={async (msg) => {
            await copyText(typeof msg?.body === "string" ? msg.body : "");
            flash("Copied");
            setCtx(null);
          }}
          onLoadUserProfile={loadUserProfile}
          onJumpToMessage={onJumpToMessage}
          onPlayAudio={(att) => playAudioFromMessage(att, m)}
          onToggleAudio={onToggleAudio}
          onSeekAudio={onSeekAudio}
          activeAudioId={audioState.attId}
          audioIsPlaying={audioState.isPlaying}
          audioCurrentTime={audioState.currentTime}
          audioDuration={audioState.duration}
          onMentionClick={loadUserProfileByUsername}
        />
      </Box>
    );})}

    {pendingUploads
      .filter((u) => String(u.conversationId) === String(activeId))
      .map((u) => (
        <Box key={u.id} sx={{ display: "flex", justifyContent: "flex-end", mb: 0.8, px: 0.5 }}>
          <Box sx={{
            width: { xs: "82%", sm: 360 },
            maxWidth: "82%",
            px: 1.25,
            py: 1,
            borderRadius: "14px 14px 4px 14px",
            bgcolor: u.status === "failed" ? "error.dark" : "primary.main",
            color: "#fff",
            boxShadow: 1,
          }}>
            {u.body && (
              <Typography sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 14.5, mb: 0.5 }}>
                {u.body}
              </Typography>
            )}
            <Stack spacing={0.5}>
              {u.files.map((f, idx) => (
                <Typography key={`${f.name}-${idx}`} variant="caption" noWrap sx={{ opacity: 0.9 }}>
                  {f.name || "file"}
                </Typography>
              ))}
              <LinearProgress
                variant={u.total ? "determinate" : "indeterminate"}
                value={u.progress || 0}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: "rgba(255,255,255,0.25)",
                  "& .MuiLinearProgress-bar": { bgcolor: "#fff" },
                }}
              />
              <Typography variant="caption" sx={{ opacity: 0.85, textAlign: "right" }}>
                {u.status === "failed" ? (u.error || "Failed") : u.status === "sent" ? "Sent" : `${u.progress || 0}% uploading`}
              </Typography>
            </Stack>
          </Box>
        </Box>
      ))}
    {/* iMessage-style typing bubble */}
    {Object.keys(typingUsers).length > 0 && (
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "flex-end",
          mb: 0.7,
          px: 0.5,
          py: 0.1,
        }}
      >
        <Box sx={{ width: 28, mr: 0.75, flexShrink: 0 }} />
        <Box
          sx={{
            px: 1.5,
            py: 1.1,
            borderRadius: "14px 14px 14px 4px",
            bgcolor: (t) => t.palette.mode === "dark" ? "background.paper" : "background.paper",
            boxShadow: (t) => t.palette.mode === "dark" ? "none" : 1,
            display: "flex",
            alignItems: "center",
            gap: 0.45,
            minWidth: 52,
            minHeight: 28,
          }}
        >
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                bgcolor: "text.secondary",
                animation: "typingDotPulse 1.2s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`,
                "@keyframes typingDotPulse": {
                  "0%, 60%, 100%": { opacity: 0.35, transform: "translateY(0)" },
                  "30%": { opacity: 1, transform: "translateY(-2px)" },
                },
              }}
            />
          ))}
        </Box>
      </Box>
    )}
    <div ref={bottomRef} />

  </Box>
  );
}

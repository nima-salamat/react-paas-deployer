import React from "react";
import { useLocale } from "../../../i18n/LocaleProvider.jsx";
import {
  Box, Typography, IconButton, CircularProgress, Menu, MenuItem, ListItemIcon,
  Stack, Avatar, TextField, Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import BlockIcon from "@mui/icons-material/Block";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LogoutIcon from "@mui/icons-material/Logout";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import SearchIcon from "@mui/icons-material/Search";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import CallIcon from "@mui/icons-material/Call";
import VideocamIcon from "@mui/icons-material/Videocam";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import CheckIcon from "@mui/icons-material/Check";
import { convAvatar, convTitle } from "../messengerUtils";

export default function ChatHeader(props) {
  const { t: tr } = useLocale();
  const {
    isMobile,
    msgSearchOpen,
    closeChat,
    closeMsgSearch,
    drawerOpen,
    setDrawerOpen,
    msgSearchQ,
    setMsgSearchQ,
    msgSearchLoading,
    msgSearchResults,
    msgSearchIdx,
    msgSearchLastQRef,
    runMessageSearch,
    focusCurrentSearchResult,
    goMsgSearchResult,
    activeConv,
    meId,
    peer,
    loadUserProfile,
    pushPanel,
    onlineUsers,
    typingUsers,
    formatTypingLabel,
    setCallChoiceOpen,
    startCall,
    openMsgSearch,
    headerMenu,
    setHeaderMenu,
    addContact,
    setConfirmCleanup,
    setConfirmBlock,
    unblockUser,
    setConfirmDelete,
    role,
    setConfirmLeave,
    onCreateTopic,
    onSwitchTopic,
    onStartSecureChat,
    secureMode = false,
    onOpenSecuritySettings,
    onReconnectSecureChat,
    onOpenSecureSearch,
  } = props;

  const [topicMenuAnchor, setTopicMenuAnchor] = React.useState(null);
  const title = convTitle(activeConv, meId);
  const forumRootId = activeConv?.is_forum
    ? activeConv.id
    : activeConv?.parent_conversation;
  const isForumConversation = activeConv?.type === "group"
    && Boolean(activeConv?.is_forum || activeConv?.parent_conversation);
  const forumTopics = Array.isArray(activeConv?.topics) ? activeConv.topics : [];

  return (
  <Stack
    direction="row"
    alignItems="center"
    spacing={msgSearchOpen && !secureMode ? (isMobile ? 0 : 0.5) : 1}
    sx={{
      px: msgSearchOpen && isMobile ? 0.35 : { xs: 1, md: 1.5 },
      py: secureMode ? 0.65 : 0.85,
      bgcolor: (t) => alpha(t.palette.background.paper, 0.96),
      backgroundImage: secureMode
        ? (t) => t.palette.mode === "dark"
          ? "linear-gradient(105deg, rgba(45,145,105,.13), transparent 48%)"
          : "linear-gradient(105deg, rgba(35,145,105,.075), transparent 48%)"
        : "none",
      backdropFilter: "blur(18px)",
      borderBottom: "1px solid",
      borderColor: secureMode ? (t) => alpha(t.palette.success.main, t.palette.mode === "dark" ? 0.28 : 0.18) : "divider",
      minHeight: 56,
      position: "relative",
      zIndex: 11,
      boxShadow: (t) => t.palette.mode === "dark" ? "0 4px 22px rgba(0,0,0,0.16)" : "0 5px 22px rgba(15,23,42,0.055)",
    }}
  >
    {isMobile && (!msgSearchOpen || secureMode) && <IconButton onClick={closeChat}><ArrowBackIcon /></IconButton>}
    {isMobile && msgSearchOpen && !secureMode && (
      <IconButton onClick={closeMsgSearch} size="small" sx={{ p: 0.4, flexShrink: 0 }} title={tr("Close search")}>
        <ArrowBackIcon fontSize="small" />
      </IconButton>
    )}
    {!isMobile && (
      <IconButton
        onClick={() => setDrawerOpen((v) => !v)}
        size="small"
        title={tr(drawerOpen ? "Hide chat list" : "Show chat list")}
      >
        {drawerOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
      </IconButton>
    )}
    {msgSearchOpen && !secureMode && !isMobile ? (
      <>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder={tr("Search messages…")}
          value={msgSearchQ}
          onChange={(e) => setMsgSearchQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); closeMsgSearch(); }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!msgSearchResults.length || msgSearchLastQRef.current !== msgSearchQ.trim()) {
                runMessageSearch(msgSearchQ);
              } else {
                goMsgSearchResult(1);
              }
            }
            if (e.key === "Enter" && e.shiftKey) {
              e.preventDefault();
              goMsgSearchResult(-1);
            }
            if (e.key === "F3") {
              e.preventDefault();
              goMsgSearchResult(e.shiftKey ? -1 : 1);
            }
          }}
          sx={{
            flex: 1,
            minWidth: 0,
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              bgcolor: "action.hover",
              minHeight: { xs: 40, sm: 36 },
              fontSize: { xs: 16, sm: 14 },
            },
            "& .MuiOutlinedInput-input": {
              py: { xs: 1, sm: 0.75 },
              px: { xs: 1, sm: 1.5 },
            },
          }}
        />
        <IconButton
          color="primary"
          size="small"
          title={tr("Search")}
          disabled={msgSearchLoading || !msgSearchQ.trim()}
          onClick={() => {
            if (msgSearchLastQRef.current === msgSearchQ.trim() && msgSearchResults.length) {
              focusCurrentSearchResult();
            } else {
              runMessageSearch(msgSearchQ);
            }
          }}
          sx={{ p: 1, flexShrink: 0 }}
        >
          {msgSearchLoading ? <CircularProgress size={18} /> : <SearchIcon />}
        </IconButton>
        <Typography
          variant="caption"
          color="text.secondary"
          onClick={focusCurrentSearchResult}
          sx={{
            minWidth: 48,
            textAlign: "center",
            px: 0.25,
            flexShrink: 0,
            cursor: msgSearchResults.length ? "pointer" : "default",
            userSelect: "none",
          }}
          title={tr("Go to current result")}
        >
          {msgSearchLoading
            ? "…"
            : msgSearchResults.length
              ? `${msgSearchIdx + 1}/${msgSearchResults.length}`
              : (msgSearchLastQRef.current ? "0/0" : "")}
        </Typography>
        <IconButton
          size="small"
          disabled={!msgSearchResults.length}
          onClick={() => goMsgSearchResult(-1)}
          title={tr("Previous result")}
          sx={{ p: 1, flexShrink: 0 }}
        >
          <KeyboardArrowUpIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          disabled={!msgSearchResults.length}
          onClick={() => goMsgSearchResult(1)}
          title={tr("Next result")}
          sx={{ p: 1, flexShrink: 0 }}
        >
          <KeyboardArrowDownIcon fontSize="small" />
        </IconButton>
        <IconButton onClick={closeMsgSearch} size="small" title={tr("Close search")}>
          <CloseIcon />
        </IconButton>
      </>
    ) : (!msgSearchOpen || secureMode) ? (
      <>
    <Box sx={{ position: "relative" }}>
      <Avatar
        src={convAvatar(activeConv, meId)}
        sx={{
          width: 40,
          height: 40,
          cursor: "pointer",
          border: secureMode ? "2px solid" : "none",
          borderColor: secureMode ? (t) => alpha(t.palette.success.main, 0.5) : "transparent",
          boxShadow: secureMode ? (t) => `0 0 0 3px ${alpha(t.palette.success.main, 0.08)}` : "none",
        }}
        onClick={() => (peer?.id ? loadUserProfile(peer.id) : pushPanel("info"))}
      >
        {convTitle(activeConv, meId)[0]?.toUpperCase()}
      </Avatar>
      {peer?.id && onlineUsers.has(Number(peer.id)) && (
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 11,
            height: 11,
            borderRadius: "50%",
            bgcolor: "#4caf50",
            border: "2px solid",
            borderColor: "background.paper",
          }}
        />
      )}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0, cursor: "pointer" }}
      onClick={() => (peer?.id ? loadUserProfile(peer.id) : pushPanel("info"))}>
      <Stack direction="row" spacing={0.65} alignItems="center" minWidth={0}>
        <Typography fontWeight={750} noWrap fontSize={{ xs: 14.5, sm: 15.5 }} sx={{ letterSpacing: -0.15 }}>{title}</Typography>
        {secureMode ? (
          <Tooltip title={tr("Separate end-to-end encrypted conversation")}>
            <Box
              sx={{
                width: 23,
                height: 23,
                borderRadius: 1.75,
                display: "grid",
                placeItems: "center",
                color: "success.main",
                bgcolor: (t) => alpha(t.palette.success.main, 0.11),
                flexShrink: 0,
              }}
            >
              <LockOutlinedIcon sx={{ fontSize: 14 }} />
            </Box>
          </Tooltip>
        ) : null}
      </Stack>
      <Typography
        variant="caption"
        color={secureMode ? "success.main" : Object.keys(typingUsers).length ? "primary.main" : "text.secondary"}
        noWrap
        sx={{
          fontStyle: !secureMode && Object.keys(typingUsers).length ? "italic" : "normal",
          maxWidth: 280,
          fontWeight: secureMode ? 600 : 400,
          letterSpacing: secureMode ? 0.08 : 0,
        }}
      >
        {secureMode
          ? tr("End-to-end encrypted")
          : Object.keys(typingUsers).length
            ? formatTypingLabel(typingUsers, activeConv?.type === "group")
            : activeConv?.type === "group"
              ? `${(activeConv?.participants || []).length} ${tr("members")}`
              : peer?.id && onlineUsers.has(Number(peer.id))
                ? tr("online")
                : tr("tap for info")}
      </Typography>
    </Box>
    {isForumConversation && (
      <Tooltip title={tr(activeConv?.is_forum ? "Choose a topic" : "Switch topic")}>
        <IconButton
          size="small"
          aria-label={tr("Choose topic")}
          onClick={(event) => setTopicMenuAnchor(event.currentTarget)}
          sx={{ flexShrink: 0, color: "primary.main" }}
        >
          <ForumOutlinedIcon fontSize="small" />
          <KeyboardArrowDownIcon sx={{ ml: -0.4, fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    )}
    {/* Mobile: keep a single call icon → popup with voice/video; rest in ⋮ menu */}
    {secureMode ? (
      <Tooltip title={tr("Security settings")}>
        <IconButton
          aria-label={tr("Security settings")}
          onClick={() => onOpenSecuritySettings?.()}
          sx={{
            width: 34,
            height: 34,
            color: "success.main",
            bgcolor: (t) => alpha(t.palette.success.main, 0.09),
            border: "1px solid",
            borderColor: (t) => alpha(t.palette.success.main, 0.16),
            "&:hover": { bgcolor: (t) => alpha(t.palette.success.main, 0.16) },
          }}
        >
          <LockOutlinedIcon />
        </IconButton>
      </Tooltip>
    ) : isMobile ? (
      <Tooltip title={tr("Call")}>
        <IconButton
          onClick={() => setCallChoiceOpen(true)}
          sx={{
            color: "text.secondary",
            "&:hover": { bgcolor: (t) => alpha(t.palette.success.main, 0.12), color: "success.main" },
          }}
        >
          <CallIcon />
        </IconButton>
      </Tooltip>
    ) : (
      <>
        <Tooltip title={tr("Voice call")}>
          <IconButton
            onClick={() => startCall({ video: false, audio: true })}
            sx={{
              color: "text.secondary",
              "&:hover": { bgcolor: (t) => alpha(t.palette.success.main, 0.12), color: "success.main" },
            }}
          >
            <CallIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={tr("Video call")}>
          <IconButton
            onClick={() => startCall({ video: true, audio: true })}
            sx={{
              color: "text.secondary",
              "&:hover": { bgcolor: (t) => alpha(t.palette.primary.main, 0.12), color: "primary.main" },
            }}
          >
            <VideocamIcon />
          </IconButton>
        </Tooltip>
        <IconButton onClick={() => pushPanel("info")}>
          <InfoOutlinedIcon />
        </IconButton>
        <IconButton size="small" title={tr("Search messages")} onClick={() => openMsgSearch()}>
          <SearchIcon fontSize="small" />
        </IconButton>
      </>
    )}
    <IconButton aria-label={tr("Chat actions")} onClick={(e) => setHeaderMenu(e.currentTarget)}><MoreVertIcon /></IconButton>
    <Menu anchorEl={headerMenu} open={Boolean(headerMenu)} onClose={() => setHeaderMenu(null)}>
      {secureMode && (
        <MenuItem onClick={() => { onOpenSecureSearch?.(); setHeaderMenu(null); }}>
          <ListItemIcon><SearchIcon fontSize="small" /></ListItemIcon>
          {tr("Search loaded messages")}
        </MenuItem>
      )}
      {secureMode && (
        <MenuItem onClick={() => { onReconnectSecureChat?.(); setHeaderMenu(null); }}>
          <ListItemIcon><RefreshIcon fontSize="small" /></ListItemIcon>
          {tr("Reconnect secure room")}
        </MenuItem>
      )}
      {secureMode && (
        <MenuItem onClick={() => { onOpenSecuritySettings?.(); setHeaderMenu(null); }}>
          <ListItemIcon><LockOutlinedIcon fontSize="small" color="success" /></ListItemIcon>
          {tr("Security settings")}
        </MenuItem>
      )}
      {isMobile && !secureMode && (
        <MenuItem onClick={() => { openMsgSearch(); setHeaderMenu(null); }}>
          <ListItemIcon><SearchIcon fontSize="small" /></ListItemIcon> Search messages
        </MenuItem>
      )}
      {isMobile && (
        <MenuItem onClick={() => {
          pushPanel("info");
          setHeaderMenu(null);
        }}>
          <ListItemIcon><InfoOutlinedIcon fontSize="small" /></ListItemIcon>
          Chat info
        </MenuItem>
      )}
      {!isMobile && peer && (
        <MenuItem onClick={() => { loadUserProfile(peer.id); setHeaderMenu(null); }}>
          <ListItemIcon><InfoOutlinedIcon fontSize="small" /></ListItemIcon> View profile
        </MenuItem>
      )}
      {peer && !peer.is_contact && !peer.is_blocked && (
        <MenuItem onClick={() => { addContact(peer.id); setHeaderMenu(null); }}>
          <ListItemIcon><PersonAddIcon fontSize="small" /></ListItemIcon> Add contact
        </MenuItem>
      )}
      {activeConv?.type === "private"
        && !secureMode
        && activeConv?.security_mode !== "matrix_e2ee"
        && peer?.id
        && !peer?.is_blocked && (
        <MenuItem onClick={() => { onStartSecureChat?.(peer.id); setHeaderMenu(null); }}>
          <ListItemIcon><LockOutlinedIcon fontSize="small" color="success" /></ListItemIcon>
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            <Typography variant="body2">Start separate secure chat</Typography>
            <Typography variant="caption" color="text.secondary">Encrypted history starts fresh</Typography>
          </Box>
        </MenuItem>
      )}
      {activeConv?.type === "group" && !activeConv?.parent_conversation
        && (role === "owner" || role === "admin") && (
        <MenuItem onClick={() => { onCreateTopic?.(activeConv); setHeaderMenu(null); }}>
          <ListItemIcon><ForumOutlinedIcon fontSize="small" /></ListItemIcon>
          {tr(activeConv.is_forum ? "Create topic" : "Organize group into topics")}
        </MenuItem>
      )}
      {peer && !peer.is_blocked && (
        <MenuItem onClick={() => { setConfirmBlock({ user: peer }); setHeaderMenu(null); }}>
          <ListItemIcon><BlockIcon fontSize="small" /></ListItemIcon> Block
        </MenuItem>
      )}
      {peer && peer.is_blocked && (
        <MenuItem onClick={() => { unblockUser(peer.id); setHeaderMenu(null); }}>
          <ListItemIcon><BlockIcon fontSize="small" /></ListItemIcon> Unblock
        </MenuItem>
      )}
      {!secureMode && (
        <>
          <MenuItem onClick={() => { setConfirmCleanup({ conv: activeConv }); setHeaderMenu(null); }}>
            <ListItemIcon><CleaningServicesIcon fontSize="small" /></ListItemIcon> Clear messages
          </MenuItem>
          {activeConv?.type === "private" && (
            <MenuItem
              onClick={() => { setConfirmDelete({ type: "chat", conv: activeConv }); setHeaderMenu(null); }}
              sx={{ color: "error.main" }}
            >
              <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon> Delete chat
            </MenuItem>
          )}
          {activeConv?.type === "group" && (role === "owner" || role === "admin") && (
            <MenuItem
              onClick={() => { setConfirmDelete({ type: "group", conv: activeConv }); setHeaderMenu(null); }}
              sx={{ color: "error.main" }}
            >
              <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon> Delete group
            </MenuItem>
          )}
          {activeConv?.type === "group" && (
            <MenuItem onClick={() => { setConfirmLeave({ conv: activeConv }); setHeaderMenu(null); }}>
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon> Leave
            </MenuItem>
          )}
        </>
      )}
    </Menu>
    {isForumConversation && (
      <Menu
        anchorEl={topicMenuAnchor}
        open={Boolean(topicMenuAnchor)}
        onClose={() => setTopicMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 220, maxWidth: 320, borderRadius: 2 } } }}
      >
        <MenuItem
          selected={String(activeConv?.id) === String(forumRootId)}
          onClick={() => {
            setTopicMenuAnchor(null);
            onSwitchTopic?.({
              id: forumRootId,
              type: "group",
              title: activeConv?.is_forum
                ? activeConv.title
                : (activeConv?.parent_conversation_title || "General"),
            });
          }}
        >
          <ListItemIcon><ForumOutlinedIcon fontSize="small" /></ListItemIcon>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={600}>General</Typography>
            <Typography variant="caption" color="text.secondary">Main group conversation</Typography>
          </Box>
          {String(activeConv?.id) === String(forumRootId) && <CheckIcon fontSize="small" color="primary" />}
        </MenuItem>
        {forumTopics.map((topic) => (
          <MenuItem
            key={topic.id}
            selected={String(activeConv?.id) === String(topic.id)}
            onClick={() => {
              setTopicMenuAnchor(null);
              onSwitchTopic?.(topic);
            }}
          >
            <ListItemIcon><ForumOutlinedIcon fontSize="small" /></ListItemIcon>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap fontWeight={600}>{topic.title}</Typography>
              {topic.description ? (
                <Typography variant="caption" color="text.secondary" noWrap>{topic.description}</Typography>
              ) : null}
            </Box>
            {String(activeConv?.id) === String(topic.id) && <CheckIcon fontSize="small" color="primary" />}
          </MenuItem>
        ))}
      </Menu>
    )}
      </>
    ) : (
      /* Mobile search mode: minimal header — search UI is at the bottom */
      <>
        <Typography fontWeight={600} noWrap fontSize={15} sx={{ flex: 1 }}>
          Search messages
        </Typography>
        <IconButton onClick={closeMsgSearch} size="small" title={tr("Close search")}>
          <CloseIcon />
        </IconButton>
      </>
    )}

  </Stack>

  );

}

import React from "react";
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
import CallIcon from "@mui/icons-material/Call";
import VideocamIcon from "@mui/icons-material/Videocam";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import CheckIcon from "@mui/icons-material/Check";
import { convAvatar, convTitle } from "../messengerUtils";

export default function ChatHeader(props) {
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
    spacing={msgSearchOpen ? (isMobile ? 0 : 0.5) : 1}
    sx={{
      px: msgSearchOpen && isMobile ? 0.35 : 1,
      py: 0.85,
      bgcolor: (t) => alpha(t.palette.background.paper, 0.94),
      backdropFilter: "blur(16px)",
      borderBottom: "1px solid",
      borderColor: "divider",
      minHeight: 56,
      position: "relative",
      zIndex: 11,
      boxShadow: (t) => t.palette.mode === "dark" ? "0 4px 18px rgba(0,0,0,0.10)" : "0 4px 18px rgba(15,23,42,0.04)",
    }}
  >
    {isMobile && !msgSearchOpen && <IconButton onClick={closeChat}><ArrowBackIcon /></IconButton>}
    {isMobile && msgSearchOpen && (
      <IconButton onClick={closeMsgSearch} size="small" sx={{ p: 0.4, flexShrink: 0 }} title="Close search">
        <ArrowBackIcon fontSize="small" />
      </IconButton>
    )}
    {!isMobile && (
      <IconButton
        onClick={() => setDrawerOpen((v) => !v)}
        size="small"
        title={drawerOpen ? "Hide chat list" : "Show chat list"}
      >
        {drawerOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
      </IconButton>
    )}
    {msgSearchOpen && !isMobile ? (
      <>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder="Search messages…"
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
          title="Search"
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
          title="Go to current result"
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
          title="Previous result"
          sx={{ p: 1, flexShrink: 0 }}
        >
          <KeyboardArrowUpIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          disabled={!msgSearchResults.length}
          onClick={() => goMsgSearchResult(1)}
          title="Next result"
          sx={{ p: 1, flexShrink: 0 }}
        >
          <KeyboardArrowDownIcon fontSize="small" />
        </IconButton>
        <IconButton onClick={closeMsgSearch} size="small" title="Close search">
          <CloseIcon />
        </IconButton>
      </>
    ) : !msgSearchOpen ? (
      <>
    <Box sx={{ position: "relative" }}>
      <Avatar src={convAvatar(activeConv, meId)} sx={{ width: 40, height: 40, cursor: "pointer" }}
        onClick={() => (peer?.id ? loadUserProfile(peer.id) : pushPanel("info"))}>
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
      <Typography fontWeight={750} noWrap fontSize={{ xs: 14.5, sm: 15.5 }} sx={{ letterSpacing: -0.15 }}>{title}</Typography>
      <Typography
        variant="caption"
        color={Object.keys(typingUsers).length ? "primary.main" : "text.secondary"}
        noWrap
        sx={{ fontStyle: Object.keys(typingUsers).length ? "italic" : "normal", maxWidth: 280 }}
      >
        {Object.keys(typingUsers).length
          ? formatTypingLabel(typingUsers, activeConv?.type === "group")
          : activeConv?.type === "group"
            ? `${(activeConv?.participants || []).length} members`
            : peer?.id && onlineUsers.has(Number(peer.id))
              ? "online"
              : "tap for info"}
      </Typography>
    </Box>
    {isForumConversation && (
      <Tooltip title={activeConv?.is_forum ? "Choose a topic" : "Switch topic"}>
        <IconButton
          size="small"
          aria-label="Choose topic"
          onClick={(event) => setTopicMenuAnchor(event.currentTarget)}
          sx={{ flexShrink: 0, color: "primary.main" }}
        >
          <ForumOutlinedIcon fontSize="small" />
          <KeyboardArrowDownIcon sx={{ ml: -0.4, fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    )}
    {/* Mobile: keep a single call icon → popup with voice/video; rest in ⋮ menu */}
    {isMobile ? (
      <Tooltip title="Call">
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
        <Tooltip title="Voice call">
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
        <Tooltip title="Video call">
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
        <IconButton size="small" title="Search messages" onClick={() => openMsgSearch()}>
          <SearchIcon fontSize="small" />
        </IconButton>
      </>
    )}
    <IconButton aria-label="Chat actions" onClick={(e) => setHeaderMenu(e.currentTarget)}><MoreVertIcon /></IconButton>
    <Menu anchorEl={headerMenu} open={Boolean(headerMenu)} onClose={() => setHeaderMenu(null)}>
      {isMobile && (
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
          {activeConv.is_forum ? "Create topic" : "Organize group into topics"}
        </MenuItem>
      )}
      <MenuItem onClick={() => { setConfirmCleanup({ conv: activeConv }); setHeaderMenu(null); }}>
        <ListItemIcon><CleaningServicesIcon fontSize="small" /></ListItemIcon> Clear messages
      </MenuItem>
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
        <IconButton onClick={closeMsgSearch} size="small" title="Close search">
          <CloseIcon />
        </IconButton>
      </>
    )}

  </Stack>

  );

}

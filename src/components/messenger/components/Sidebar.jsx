import React, { useState } from "react";
import {
  Box, Stack, Typography, IconButton, TextField, InputAdornment, Avatar,
  List, ListItemButton, ListItemAvatar, ListItemText, CircularProgress,
  Tabs, Tab, Badge, MenuItem, ListItemIcon, alpha, Button,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import ChatIcon from "@mui/icons-material/Chat";
import CloseIcon from "@mui/icons-material/Close";
import PublicIcon from "@mui/icons-material/Public";
import LinkIcon from "@mui/icons-material/Link";
import MenuIcon from "@mui/icons-material/Menu";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import MarkChatReadIcon from "@mui/icons-material/MarkChatRead";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LogoutIcon from "@mui/icons-material/Logout";
import BlockIcon from "@mui/icons-material/Block";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import {
  convAvatar, convTitle, formatTime, formatUnread,
} from "../messengerUtils";
import ContextMenu from "./ContextMenu";
import OnlineDot from "./OnlineDot";

/**
 * Sidebar — chat list, tabs (Chats / Public groups), user search,
 * right-click context menu on chat rows (pin / mark read / cleanup / delete / leave / block).
 *
 * Public groups tab behaviour (Telegram-style):
 *   - Public groups are NEVER listed automatically.
 *   - The user must type a query in the search box — results appear as they type.
 *   - Each result has a button:
 *       • "Join"      if the group is open (no approval required)
 *       • "Request"   if the group requires admin approval
 *       • "Pending"   if the user already has a pending request (clicking cancels)
 *       • "Open"      if the user is already a member
 *
 * Props (all callbacks/state passed down from parent):
 *  - meId, conversations, loadingConvs
 *  - activeId, openChat
 *  - searchQ, setSearchQ, searchResults, searching
 *  - onViewUserProfile: (userId) => void   (open the profile panel — does NOT start a DM)
 *  - startDm: (user) => void               (only called when user explicitly picks "Message")
 *  - addContact: (userId) => void
 *  - listTab, setListTab, publicGroups, searchPublicGroups
 *  - onJoinPublicGroup: (group) => void    (direct join or send request)
 *  - onTogglePin(conv), onMarkRead(conv), onCleanupChat(conv), onLeaveChat(conv),
 *    onDeleteChat(conv), onBlockPeer(peer)
 *  - onOpenCreateGroup, onOpenJoin, onOpenSettings, onNavigateHome
 *  - onOpenMyRequests: () => void          (open the "My Join Requests" panel)
 */
export default function Sidebar({
  meId, conversations, loadingConvs,
  activeId, openChat,
  searchQ, setSearchQ, searchResults, searching,
  onViewUserProfile, startDm, addContact,
  listTab, setListTab, publicGroups, searchPublicGroups,
  onJoinPublicGroup, onConfirmJoinPublicGroup,
  onTogglePin, onMarkRead, onCleanupChat, onLeaveChat, onDeleteChat, onBlockPeer,
  onOpenCreateGroup, onOpenJoin, onOpenSettings, onNavigateHome,
  onOpenMyRequests,
  onlineUsers,
}) {
  const [ctx, setCtx] = useState(null); // { x, y, conv, peer, role }
  const [publicSearchQ, setPublicSearchQ] = useState("");

  const onRowContext = (e, conv) => {
    e.preventDefault();
    e.stopPropagation();
    const other = conv.type === "private"
      ? (conv.peer || (conv.participants || []).find((p) => String(p.user?.id) !== String(meId ?? ""))?.user)
      : null;
    const myP = (conv.participants || []).find((p) => String(p.user?.id) === String(meId ?? ""));
    setCtx({ x: e.clientX, y: e.clientY, conv, peer: other, role: myP?.role || "member" });
  };

  // Local handler for the public-group search input — debounces + clears
  // when the user empties the box (so public groups never show by default).
  const publicSearchTimer = React.useRef(null);
  const onPublicSearchChange = (e) => {
    const v = e.target.value;
    setPublicSearchQ(v);
    if (publicSearchTimer.current) clearTimeout(publicSearchTimer.current);
    if (!v.trim()) {
      // Clear immediately when empty
      searchPublicGroups("");
      return;
    }
    publicSearchTimer.current = setTimeout(() => {
      searchPublicGroups(v);
    }, 280);
  };

  return (
    <Box
      sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.paper" }}
      onContextMenu={(e) => {
        // Only suppress the browser menu when no child has its own handler
        if (e.target === e.currentTarget) e.preventDefault();
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ p: 1.25 }}>
        <IconButton size="small" onClick={onOpenSettings}>
          <MenuIcon />
        </IconButton>
        <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>Messenger</Typography>
        <IconButton size="small" onClick={onOpenCreateGroup} title="New group">
          <GroupAddIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={onOpenJoin} title="Join invite">
          <LinkIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" color="primary" onClick={onNavigateHome} title="Back to Deployer">
          <HomeOutlinedIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Box sx={{ px: 1.25, pb: 1 }}>
        <TextField
          fullWidth size="small" placeholder="Search users…"
          value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                {searching ? <CircularProgress size={14} /> : <SearchIcon fontSize="small" />}
              </InputAdornment>
            ),
            endAdornment: searchQ ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQ("")}><CloseIcon fontSize="small" /></IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
      </Box>

      {!searchQ.trim() && (
        <Tabs value={listTab} onChange={(_, v) => {
          setListTab(v);
          // When switching to "Public groups" tab, do NOT auto-load — clear results
          if (v === 1) {
            setPublicSearchQ("");
            searchPublicGroups("");
          }
        }}
          variant="fullWidth" sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, py: 0.5, fontSize: 13 } }}>
          <Tab label="Chats" />
          <Tab label="Public groups" />
        </Tabs>
      )}

      {searchQ.trim() ? (
        <List dense sx={{ overflow: "auto", flex: 1, py: 0 }}>
          {searchResults.map((u) => (
            <ListItemButton
              key={u.id}
              onClick={() => onViewUserProfile(u.id)}
              sx={{ py: 1 }}
            >
              <ListItemAvatar>
                <Avatar src={u.avatar || undefined}>{u.username?.[0]?.toUpperCase()}</Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={u.username}
                secondary={u.is_contact ? "Contact · tap to view profile" : "Tap to view profile"}
              />
              <Stack direction="row" spacing={0.5}>
                <IconButton
                  size="small"
                  title="Start chat"
                  onClick={(e) => { e.stopPropagation(); startDm(u); }}
                >
                  <ChatIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  title="Add to contacts"
                  onClick={(e) => { e.stopPropagation(); addContact(u.id); }}
                >
                  <PersonAddIcon fontSize="small" />
                </IconButton>
              </Stack>
            </ListItemButton>
          ))}
          {!searching && !searchResults.length && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No users found</Typography>
          )}
        </List>
      ) : listTab === 1 ? (
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Box sx={{ px: 1.25, py: 1.25 }}>
            <TextField
              fullWidth size="small"
              placeholder="Search public groups by name…"
              value={publicSearchQ}
              onChange={onPublicSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: publicSearchQ ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => {
                      setPublicSearchQ("");
                      searchPublicGroups("");
                    }}><CloseIcon fontSize="small" /></IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, px: 0.5 }}>
              Type to discover public groups. They are not listed automatically.
            </Typography>
          </Box>
          <List dense sx={{ overflow: "auto", flex: 1, py: 0 }}>
            {publicGroups.map((g) => {
              const isMember = Boolean(g.is_member);
              const pending = Boolean(g.my_pending_request);
              const requiresApproval = Boolean(g.requires_approval);
              return (
                <ListItemButton
                  key={g.id}
                  onClick={() => {
                    if (isMember) {
                      openChat(g);
                    } else if (!pending && onConfirmJoinPublicGroup) {
                      // Not a member and no pending request → open the
                      // "Join this group?" confirmation dialog.
                      onConfirmJoinPublicGroup(g);
                    }
                    // If pending, do nothing — the user can cancel from the
                    // "My join requests" panel.
                  }}
                  sx={{ py: 1, opacity: isMember ? 1 : 0.9 }}
                >
                  <ListItemAvatar>
                    <Avatar src={g.avatar_url || g.avatar || undefined}><PublicIcon /></Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography component="span" noWrap fontWeight={600}>{g.title}</Typography>
                        {requiresApproval && (
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{
                              bgcolor: alpha("#9c27b0", 0.12),
                              color: "#9c27b0",
                              px: 0.5, borderRadius: 1, fontSize: 10, lineHeight: "16px",
                            }}
                          >
                            approval
                          </Typography>
                        )}
                      </Stack>
                    }
                    secondary={
                      <Typography variant="body2" color="text.secondary" component="span" noWrap>
                        {(g.participants?.length || 0) + " members"}
                        {g.description ? ` · ${g.description}` : ""}
                      </Typography>
                    }
                  />
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {isMember ? (
                      <Button size="small" color="primary" startIcon={<HowToRegIcon fontSize="small" />}
                        onClick={(e) => { e.stopPropagation(); openChat(g); }}>
                        Open
                      </Button>
                    ) : pending ? (
                      <Button size="small" disabled startIcon={<HourglassEmptyIcon fontSize="small" />}>
                        Pending
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant={requiresApproval ? "outlined" : "contained"}
                        onClick={(e) => { e.stopPropagation(); onJoinPublicGroup(g); }}
                      >
                        {requiresApproval ? "Request" : "Join"}
                      </Button>
                    )}
                  </Stack>
                </ListItemButton>
              );
            })}
            {publicSearchQ.trim() && !publicGroups.length && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                No public groups match "{publicSearchQ}"
              </Typography>
            )}
            {!publicSearchQ.trim() && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                Start typing to search public groups.
              </Typography>
            )}
          </List>
          {/* "My requests" entry — shows pending requests the current user has sent */}
          <Box sx={{ p: 1, borderTop: "1px solid", borderColor: "divider" }}>
            <Button size="small" fullWidth startIcon={<HourglassEmptyIcon fontSize="small" />} onClick={onOpenMyRequests}>
              My join requests
            </Button>
          </Box>
        </Box>
      ) : (
        <List dense sx={{ overflow: "auto", flex: 1, py: 0 }}>
          {loadingConvs && <Box sx={{ p: 3, textAlign: "center" }}><CircularProgress size={22} /></Box>}
          {!loadingConvs && !conversations.length && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
              No chats yet. Search a username to start.
            </Typography>
          )}
          {conversations.map((c) => {
            const unread = formatUnread(c.unread_count);
            const pinned = Boolean(c.is_pinned);
            return (
              <ListItemButton
                key={c.id}
                selected={c.id === activeId}
                onClick={() => openChat(c)}
                onContextMenu={(e) => onRowContext(e, c)}
                sx={{
                  py: 1.1,
                  "&.Mui-selected": { bgcolor: (t) => alpha(t.palette.primary.main, 0.12) },
                }}
              >
                <ListItemAvatar>
                  <Badge
                    badgeContent={unread}
                    color="error"
                    max={999}
                    overlap="circular"
                    sx={{
                      "& .MuiBadge-badge": {
                        fontSize: 11,
                        height: 18,
                        minWidth: 18,
                        px: 0.5,
                      },
                    }}
                  >
                    <Box sx={{ position: "relative" }}>
                      <Avatar src={convAvatar(c, meId)} sx={{ width: 48, height: 48 }}>
                        {convTitle(c, meId)[0]?.toUpperCase()}
                      </Avatar>
                      {c.type === "private" && c.peer?.id && onlineUsers?.has(Number(c.peer.id)) && (
                        <OnlineDot />
                      )}
                    </Box>
                  </Badge>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                        {pinned && (
                          <PushPinIcon sx={{ fontSize: 13, color: "text.secondary", flexShrink: 0 }} />
                        )}
                        <Typography noWrap fontWeight={c.unread_count ? 700 : 600} fontSize={14.5}>
                          {convTitle(c, meId)}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                        {formatTime(c.last_message_at)}
                      </Typography>
                    </Stack>
                  }
                  secondary={
                    <Typography noWrap variant="body2" color="text.secondary" fontSize={13}>
                      {c.last_message?.body || (c.last_message?.has_attachments ? "📎 Attachment" : "No messages yet")}
                    </Typography>
                  }
                />
              </ListItemButton>
            );
          })}
        </List>
      )}

      {/* Chat-row context menu */}
      <ContextMenu ctx={ctx} onClose={() => setCtx(null)} minWidth={220}>
        {ctx && ctx.conv && (
          <>
            <MenuItem onClick={() => { onTogglePin(ctx.conv); setCtx(null); }}>
              <ListItemIcon>
                {ctx.conv.is_pinned
                  ? <PushPinOutlinedIcon fontSize="small" />
                  : <PushPinIcon fontSize="small" />}
              </ListItemIcon>
              {ctx.conv.is_pinned ? "Unpin" : "Pin"}
            </MenuItem>
            <MenuItem onClick={() => { onMarkRead(ctx.conv); setCtx(null); }}>
              <ListItemIcon><MarkChatReadIcon fontSize="small" /></ListItemIcon>
              Mark as read
            </MenuItem>
            <MenuItem onClick={() => { onCleanupChat(ctx.conv); setCtx(null); }} sx={{ color: "warning.main" }}>
              <ListItemIcon><CleaningServicesIcon fontSize="small" /></ListItemIcon>
              Clear messages
            </MenuItem>
            {ctx.peer && (
              <MenuItem onClick={() => { onBlockPeer(ctx.peer); setCtx(null); }} sx={{ color: "warning.main" }}>
                <ListItemIcon><BlockIcon fontSize="small" /></ListItemIcon> Block user
              </MenuItem>
            )}
            {ctx.conv.type === "private" && (
              <MenuItem
                onClick={() => { onDeleteChat(ctx.conv); setCtx(null); }}
                sx={{ color: "error.main" }}
              >
                <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>
                Delete chat (both sides)
              </MenuItem>
            )}
            {ctx.conv.type === "group" && (
              <>
                <MenuItem
                  onClick={() => { onLeaveChat(ctx.conv); setCtx(null); }}
                  sx={{ color: "warning.main" }}
                >
                  <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                  Leave group
                </MenuItem>
                {(ctx.role === "owner" || ctx.role === "admin") && (
                  <MenuItem
                    onClick={() => { onDeleteChat(ctx.conv); setCtx(null); }}
                    sx={{ color: "error.main" }}
                  >
                    <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>
                    Delete group
                  </MenuItem>
                )}
              </>
            )}
          </>
        )}
      </ContextMenu>
    </Box>
  );
}

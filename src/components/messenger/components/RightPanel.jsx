import React, { useRef, useState } from "react";
import {
  Box, Stack, Typography, IconButton, Divider, List, ListItemButton, ListItemIcon,
  ListItemText, ListItemAvatar, Button, TextField, FormControlLabel, Switch, Paper, Avatar,
  Chip, Menu, MenuItem, alpha, FormControl, Select, InputLabel, CircularProgress,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import ContactsIcon from "@mui/icons-material/Contacts";
import BlockIcon from "@mui/icons-material/Block";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import LinkIcon from "@mui/icons-material/Link";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ShieldIcon from "@mui/icons-material/Shield";
import CrownIcon from "@mui/icons-material/EmojiEvents";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import {
  convAvatar, convTitle, peerUser, myRole,
} from "../messengerUtils";
import ProfileView from "./ProfileView";
import ContextMenu from "./ContextMenu";
import OnlineDot from "./OnlineDot";

/**
 * Right panel — settings menu / contacts / blocked / info / profile / join-requests.
 * Rendered inside a centered modal Dialog (see MessengerApp). The parent manages
 * a panel-history stack; `onBack` pops one level, `onClose` closes the modal.
 *
 * Group info panel features:
 *  - Owner/admin/member tags next to each member name
 *  - Right-click on a member (or click the ⋮ button) opens a context menu with:
 *      • View profile
 *      • Message
 *      • Promote to admin / Demote to member  (owner only)
 *      • Transfer ownership  (owner only)
 *      • Remove from group  (owner/admin only)
 *  - Group avatar upload/clear (owner/admin)
 *  - Channel mode toggle (only_admins_send) — admins only
 *  - History visibility for new members (all / from_join / none) — owner only
 *  - "Requires approval" toggle (owner only) — public groups can require admin
 *    approval before new users can join
 *  - "Join requests" button — admins see pending requests for this group
 *
 * Settings menu includes:
 *  - My join requests — see/cancel requests the current user has sent
 */
export default function RightPanel({
  kind, meId, activeConv, profileData,
  contacts, blocks, inviteLinks,
  onlineUsers,
  myJoinRequests, convJoinRequests,
  canGoBack, onBack, onClose,
  onOpenMyProfile, onOpenContacts, onOpenBlocks, onOpenMyRequests, onOpenConvJoinRequests,
  onOpenCreateGroup, onOpenJoin, onNavigateHome,
  onStartDm, onRemoveContact, onUnblock,
  onPatchGroup, onCreateInvite, onRevokeInvite,
  onOpenAddMembers, onAddContact, onBlockUser, onMessage, onOpenPhoto,
  onDeleteChat, onDeleteGroup, onCleanupChat,
  onRemoveMember, onChangeMemberRole, onTransferOwnership,
  onUploadGroupAvatar, onClearGroupAvatar,
  onCancelJoinRequest, onActOnJoinRequest,
}) {
  const [memberCtx, setMemberCtx] = useState(null); // { x, y, user, role }
  const [memberMenuAnchor, setMemberMenuAnchor] = useState(null); // for ⋮ button
  const [memberMenuTarget, setMemberMenuTarget] = useState(null);

  const headerTitle = (() => {
    switch (kind) {
      case "settings": return "Settings";
      case "contacts": return "Contacts";
      case "blocks": return "Blocked users";
      case "profile": return "Profile";
      case "my-requests": return "My join requests";
      case "conv-requests": return "Join requests";
      default: return activeConv?.type === "group" ? "Group info" : "Chat info";
    }
  })();

  const header = (
    <>
      <Stack direction="row" alignItems="center" sx={{ p: 1.5 }}>
        {canGoBack && (
          <IconButton size="small" onClick={onBack} title="Back">
            <ArrowBackIcon />
          </IconButton>
        )}
        <Typography fontWeight={700} sx={{ flex: 1, ml: canGoBack ? 1 : 0 }}>{headerTitle}</Typography>
        <IconButton size="small" onClick={onClose} title="Close">
          <HomeOutlinedIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Divider />
    </>
  );

  if (kind === "settings") {
    return (
      <Box sx={{ width: "100%", height: "100%", bgcolor: "background.paper" }}>
        {header}
        <List>
          <ListItemButton onClick={onOpenMyProfile}>
            <ListItemIcon><AccountCircleIcon /></ListItemIcon>
            <ListItemText primary="My profile photos" secondary="Upload, reorder & privacy" />
          </ListItemButton>
          <ListItemButton onClick={onOpenContacts}>
            <ListItemIcon><ContactsIcon /></ListItemIcon>
            <ListItemText primary="Contacts" />
          </ListItemButton>
          <ListItemButton onClick={onOpenBlocks}>
            <ListItemIcon><BlockIcon /></ListItemIcon>
            <ListItemText primary="Blocked users" />
          </ListItemButton>
          <ListItemButton onClick={onOpenMyRequests}>
            <ListItemIcon><HourglassEmptyIcon /></ListItemIcon>
            <ListItemText
              primary="My join requests"
              secondary={myJoinRequests?.length ? `${myJoinRequests.filter((r) => r.status === "pending").length} pending` : "No pending requests"}
            />
          </ListItemButton>
          <ListItemButton onClick={onOpenCreateGroup}>
            <ListItemIcon><GroupAddIcon /></ListItemIcon>
            <ListItemText primary="New group" />
          </ListItemButton>
          <ListItemButton onClick={onOpenJoin}>
            <ListItemIcon><LinkIcon /></ListItemIcon>
            <ListItemText primary="Join with invite" />
          </ListItemButton>
          <Divider sx={{ my: 1 }} />
          <ListItemButton onClick={onNavigateHome}>
            <ListItemIcon><HomeOutlinedIcon /></ListItemIcon>
            <ListItemText primary="Back to Deployer" />
          </ListItemButton>
        </List>
      </Box>
    );
  }

  // My outgoing join requests (any status — pending, approved, rejected)
  if (kind === "my-requests") {
    return (
      <Box sx={{ width: "100%", height: "100%", bgcolor: "background.paper", display: "flex", flexDirection: "column" }}>
        {header}
        <List dense sx={{ overflow: "auto", flex: 1 }}>
          {(myJoinRequests || []).map((r) => (
            <ListItemButton key={r.id}>
              <ListItemAvatar>
                <Avatar src={r.user?.avatar || undefined}>
                  {r.user?.username?.[0]?.toUpperCase() || r.conversation_title?.[0]?.toUpperCase()}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={r.conversation_title || "Group"}
                secondary={
                  <Typography variant="caption" component="span" sx={{
                    color: r.status === "pending" ? "warning.main"
                      : r.status === "approved" ? "success.main"
                      : "error.main",
                    fontWeight: 600,
                  }}>
                    {r.status.toUpperCase()} · {new Date(r.created_at).toLocaleDateString()}
                  </Typography>
                }
              />
              {r.status === "pending" && (
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  startIcon={<CloseIcon fontSize="small" />}
                  onClick={() => onCancelJoinRequest(r.id)}
                >
                  Cancel
                </Button>
              )}
            </ListItemButton>
          ))}
          {!(myJoinRequests || []).length && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              You have no join requests. Search public groups and request to join one.
            </Typography>
          )}
        </List>
      </Box>
    );
  }

  // Pending join requests for the active group (admin view)
  if (kind === "conv-requests") {
    const role = myRole(activeConv, meId);
    const canManage = role === "owner" || role === "admin";
    return (
      <Box sx={{ width: "100%", height: "100%", bgcolor: "background.paper", display: "flex", flexDirection: "column" }}>
        {header}
        {!canManage ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            Only group admins can view join requests.
          </Typography>
        ) : (
          <List dense sx={{ overflow: "auto", flex: 1 }}>
            {(convJoinRequests || []).map((r) => (
              <ListItemButton key={r.id}>
                <ListItemAvatar>
                  <Box sx={{ position: "relative" }}>
                    <Avatar src={r.user?.avatar || undefined}>{r.user?.username?.[0]?.toUpperCase()}</Avatar>
                    {r.user?.id && onlineUsers?.has(Number(r.user.id)) && <OnlineDot size={10} />}
                  </Box>
                </ListItemAvatar>
                <ListItemText
                  primary={r.user?.username || "Unknown"}
                  secondary={`Requested ${new Date(r.created_at).toLocaleString()}`}
                />
                <Stack direction="row" spacing={0.5}>
                  <IconButton
                    size="small"
                    color="success"
                    title="Approve"
                    onClick={() => onActOnJoinRequest(activeConv?.id, r.id, "approve")}
                  >
                    <CheckIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    title="Reject"
                    onClick={() => onActOnJoinRequest(activeConv?.id, r.id, "reject")}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </ListItemButton>
            ))}
            {!(convJoinRequests || []).length && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No pending join requests.
              </Typography>
            )}
          </List>
        )}
      </Box>
    );
  }

  if (kind === "contacts") {
    return (
      <Box sx={{ width: "100%", height: "100%", bgcolor: "background.paper", display: "flex", flexDirection: "column" }}>
        {header}
        <List dense sx={{ overflow: "auto", flex: 1 }}>
          {contacts.map((c) => (
            <ListItemButton key={c.id} onClick={() => c.contact && onStartDm(c.contact)}>
              <ListItemAvatar>
                <Box sx={{ position: "relative" }}>
                  <Avatar src={c.contact?.avatar || undefined}>{c.contact?.username?.[0]}</Avatar>
                  {c.contact?.id && onlineUsers?.has(Number(c.contact.id)) && <OnlineDot />}
                </Box>
              </ListItemAvatar>
              <ListItemText primary={c.nickname || c.contact?.username} secondary={c.contact?.username} />
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onRemoveContact(c.contact?.id); }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </ListItemButton>
          ))}
          {!contacts.length && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No contacts</Typography>
          )}
        </List>
      </Box>
    );
  }

  if (kind === "blocks") {
    return (
      <Box sx={{ width: "100%", height: "100%", bgcolor: "background.paper", display: "flex", flexDirection: "column" }}>
        {header}
        <List dense sx={{ overflow: "auto", flex: 1 }}>
          {blocks.map((u) => (
            <ListItemButton key={u.id}>
              <ListItemAvatar><Avatar src={u.avatar || undefined}>{u.username?.[0]}</Avatar></ListItemAvatar>
              <ListItemText primary={u.username} />
              <Button size="small" onClick={() => onUnblock(u.id)}>Unblock</Button>
            </ListItemButton>
          ))}
          {!blocks.length && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>None</Typography>
          )}
        </List>
      </Box>
    );
  }

  if (kind === "profile") {
    return (
      <Box sx={{ width: "100%", height: "100%", bgcolor: "background.paper", overflow: "auto" }}>
        {header}
        <ProfileView
          profileData={profileData}
          isOnline={profileData?.id && onlineUsers?.has(Number(profileData.id))}
          onMessage={onMessage}
          onAddContact={onAddContact}
          onBlock={onBlockUser}
          onOpenPhoto={onOpenPhoto}
        />
      </Box>
    );
  }

  // default: 'info'
  const peer = peerUser(activeConv, meId);
  const role = myRole(activeConv, meId);
  const parts = activeConv?.participants || [];
  const isOwner = role === "owner";
  const isAdmin = role === "owner" || role === "admin";
  const groupAvatarRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const openMemberContext = (e, user, mRole) => {
    e.preventDefault();
    e.stopPropagation();
    setMemberCtx({ x: e.clientX, y: e.clientY, user, role: mRole });
  };

  const openMemberMenu = (e, user, mRole) => {
    setMemberMenuAnchor(e.currentTarget);
    setMemberMenuTarget({ user, role: mRole });
  };

  const closeMemberMenu = () => {
    setMemberMenuAnchor(null);
    setMemberMenuTarget(null);
  };

  // Build the context menu items for a member
  const renderMemberActions = (target) => {
    if (!target) return null;
    const tUser = target.user;
    const tRole = target.role;
    const isMe = String(tUser?.id) === String(meId);
    return (
      <>
        <MenuItem onClick={() => { tUser?.id && onStartDm(tUser); setMemberCtx(null); closeMemberMenu(); }}>
          <ListItemIcon><AccountCircleIcon fontSize="small" /></ListItemIcon> View profile
        </MenuItem>
        <MenuItem onClick={() => { onMessage(tUser); setMemberCtx(null); closeMemberMenu(); }}>
          <ListItemIcon><PersonAddIcon fontSize="small" /></ListItemIcon> Message
        </MenuItem>
        {!isMe && isOwner && tRole !== "owner" && (
          <MenuItem onClick={() => { onChangeMemberRole(activeConv.id, tUser.id, tRole === "admin" ? "member" : "admin"); setMemberCtx(null); closeMemberMenu(); }}>
            <ListItemIcon><ShieldIcon fontSize="small" /></ListItemIcon>
            {tRole === "admin" ? "Demote to member" : "Promote to admin"}
          </MenuItem>
        )}
        {!isMe && isOwner && tRole !== "owner" && (
          <MenuItem onClick={() => { onTransferOwnership(activeConv.id, tUser.id); setMemberCtx(null); closeMemberMenu(); }}>
            <ListItemIcon><SwapHorizIcon fontSize="small" /></ListItemIcon> Transfer ownership
          </MenuItem>
        )}
        {!isMe && (isOwner || (role === "admin" && tRole === "member")) && (
          <MenuItem
            onClick={() => { onRemoveMember(activeConv.id, tUser.id); setMemberCtx(null); closeMemberMenu(); }}
            sx={{ color: "error.main" }}
          >
            <ListItemIcon><PersonRemoveIcon fontSize="small" color="error" /></ListItemIcon> Remove from group
          </MenuItem>
        )}
      </>
    );
  };

  // Handler for group avatar file selection — opens file picker, uploads if chosen
  const onPickGroupAvatar = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type?.startsWith("image/")) return;
    setUploadingAvatar(true);
    onUploadGroupAvatar(activeConv.id, file).finally(() => setUploadingAvatar(false));
  };

  return (
    <Box sx={{ width: "100%", height: "100%", bgcolor: "background.paper", overflow: "auto" }}>
      {header}
      <Box sx={{ p: 2, textAlign: "center" }}>
        <Box sx={{ position: "relative", display: "inline-block" }}>
          <Avatar src={convAvatar(activeConv, meId)} sx={{ width: 80, height: 80, mx: "auto", mb: 1 }}>
            {convTitle(activeConv, meId)[0]?.toUpperCase()}
          </Avatar>
          {peer?.id && onlineUsers?.has(Number(peer.id)) && (
            <OnlineDot size={14} bottom={4} right={4} />
          )}
          {/* Group avatar upload button — owner/admin only */}
          {activeConv?.type === "group" && isAdmin && (
            <>
              <IconButton
                size="small"
                onClick={() => groupAvatarRef.current?.click()}
                disabled={uploadingAvatar}
                sx={{
                  position: "absolute",
                  bottom: 0,
                  right: -8,
                  bgcolor: "primary.main",
                  color: "#fff",
                  width: 26,
                  height: 26,
                  "&:hover": { bgcolor: "primary.dark" },
                  zIndex: 2,
                }}
                title="Change group photo"
              >
                {uploadingAvatar ? <CircularProgress size={14} color="inherit" /> : <AddPhotoAlternateIcon sx={{ fontSize: 16 }} />}
              </IconButton>
              <input
                ref={groupAvatarRef}
                type="file"
                accept="image/*"
                hidden
                onChange={onPickGroupAvatar}
              />
            </>
          )}
        </Box>
        <Typography variant="h6">{convTitle(activeConv, meId)}</Typography>
        {peer && <Typography variant="body2" color="text.secondary">@{peer.username}</Typography>}
        {peer && peer.id && onlineUsers?.has(Number(peer.id)) && (
          <Typography variant="caption" sx={{ color: "success.main", fontWeight: 600 }}>online</Typography>
        )}
        {/* Group avatar clear button — only show if avatar exists and user is admin */}
        {activeConv?.type === "group" && isAdmin && (activeConv.avatar_url || activeConv.avatar) && (
          <Box>
            <Button size="small" color="error" onClick={() => onClearGroupAvatar(activeConv.id)} sx={{ mt: 0.5 }}>
              Remove photo
            </Button>
          </Box>
        )}
        {peer?.bio && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: "italic" }}>
            {peer.bio}
          </Typography>
        )}
      </Box>

      {activeConv?.type === "group" && (
        <Box sx={{ px: 2, pb: 2 }}>
          {/* Description — visible to ALL members.
              Admins see an editable TextField; non-admins see read-only text. */}
          {activeConv.description && !isAdmin && (
            <Paper variant="outlined" sx={{ p: 1.25, mb: 1.5, bgcolor: "action.hover" }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 600 }}>
                Description
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {activeConv.description}
              </Typography>
            </Paper>
          )}
          {/* Channel-mode indicator for non-admins (read-only) */}
          {!isAdmin && Boolean(activeConv.only_admins_send) && (
            <Paper variant="outlined" sx={{ p: 1, mb: 1.5, bgcolor: alpha("#2196f3", 0.08), borderColor: alpha("#2196f3", 0.3) }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <ShieldIcon sx={{ fontSize: 16, color: "#2196f3" }} />
                <Typography variant="caption" sx={{ color: "#2196f3", fontWeight: 600 }}>
                  Channel mode — only admins can send messages
                </Typography>
              </Stack>
            </Paper>
          )}
          {/* Approval-required indicator for non-admins */}
          {!isAdmin && Boolean(activeConv.requires_approval) && (
            <Paper variant="outlined" sx={{ p: 1, mb: 1.5, bgcolor: alpha("#9c27b0", 0.08), borderColor: alpha("#9c27b0", 0.3) }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <HowToRegIcon sx={{ fontSize: 16, color: "#9c27b0" }} />
                <Typography variant="caption" sx={{ color: "#9c27b0", fontWeight: 600 }}>
                  This group requires admin approval to join
                </Typography>
              </Stack>
            </Paper>
          )}
          {isAdmin && (
            <>
              <TextField fullWidth size="small" label="Group title" defaultValue={activeConv.title || ""}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== activeConv.title)
                    onPatchGroup({ title: e.target.value.trim() });
                }} sx={{ mb: 1.5 }} />
              <TextField fullWidth size="small" label="Description" multiline minRows={2}
                defaultValue={activeConv.description || ""}
                onBlur={(e) => {
                  if (e.target.value !== (activeConv.description || ""))
                    onPatchGroup({ description: e.target.value });
                }} sx={{ mb: 1.5 }} />
              <FormControlLabel
                control={<Switch checked={Boolean(activeConv.is_public)} onChange={(e) => onPatchGroup({ is_public: e.target.checked })} />}
                label="Public (searchable)"
              />
              <FormControlLabel
                control={<Switch checked={Boolean(activeConv.is_closed)} onChange={(e) => onPatchGroup({ is_closed: e.target.checked })} />}
                label="Closed"
              />
              {/* Public groups can require admin approval before new users can join.
                  Owner-only — Telegram-style "private public groups". */}
              {isOwner && Boolean(activeConv.is_public) && (
                <FormControlLabel
                  control={<Switch
                    checked={Boolean(activeConv.requires_approval)}
                    onChange={(e) => onPatchGroup({ requires_approval: e.target.checked })}
                  />}
                  label="Require admin approval to join"
                />
              )}
              <FormControlLabel
                control={<Switch checked={activeConv.members_can_add !== false} onChange={(e) => onPatchGroup({ members_can_add: e.target.checked })} />}
                label="Members can add contacts"
              />
              {/* Channel-like mode — only admins can send messages */}
              <FormControlLabel
                control={<Switch
                  checked={Boolean(activeConv.only_admins_send)}
                  onChange={(e) => onPatchGroup({ only_admins_send: e.target.checked })}
                />}
                label="Only admins can send messages (channel mode)"
              />
              {/* History visibility for new members — owner only */}
              {isOwner && (
                <FormControl fullWidth size="small" sx={{ mt: 1.5 }}>
                  <InputLabel>History visibility for new members</InputLabel>
                  <Select
                    label="History visibility for new members"
                    value={activeConv.history_visibility || "all"}
                    onChange={(e) => onPatchGroup({ history_visibility: e.target.value })}
                  >
                    <MenuItem value="all">All new members see full history</MenuItem>
                    <MenuItem value="from_join">Only messages from join-time onward</MenuItem>
                    <MenuItem value="none">No history for new members</MenuItem>
                  </Select>
                </FormControl>
              )}
              {/* "Join requests" button — admins see this when the group requires
                  approval. Shows the count of pending requests. */}
              {Boolean(activeConv.requires_approval) && (
                <Button
                  size="small"
                  fullWidth
                  variant="outlined"
                  startIcon={<HowToRegIcon fontSize="small" />}
                  sx={{ mt: 1, mb: 1 }}
                  onClick={onOpenConvJoinRequests}
                >
                  Join requests{(convJoinRequests || []).length ? ` (${convJoinRequests.length})` : ""}
                </Button>
              )}
              <Button size="small" variant="contained" startIcon={<PersonAddIcon />}
                sx={{ mt: 1, mb: 1 }} onClick={onOpenAddMembers}>
                Add from contacts
              </Button>
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Invite links</Typography>
              <Button size="small" variant="outlined" startIcon={<LinkIcon />} onClick={onCreateInvite} sx={{ mb: 1 }}>
                Create link
              </Button>
              {(inviteLinks || []).map((l) => (
                <Paper key={l.id} variant="outlined" sx={{ p: 1, mb: 1 }}>
                  <Typography variant="caption" sx={{ wordBreak: "break-all" }}>{l.url || l.code}</Typography>
                  <Stack direction="row" spacing={1} mt={0.5}>
                    <Button size="small" onClick={() => { navigator.clipboard?.writeText(l.url || l.code); }}>Copy</Button>
                    <Button size="small" color="error" onClick={() => onRevokeInvite(l.id)}>Revoke</Button>
                  </Stack>
                </Paper>
              ))}
            </>
          )}

          {(isAdmin || activeConv.members_can_add !== false) && (
            <Button size="small" fullWidth variant="outlined" startIcon={<PersonAddIcon />} sx={{ mb: 1 }}
              onClick={onOpenAddMembers}>
              Add members
            </Button>
          )}
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            Members ({parts.length})
          </Typography>
          <List dense>
            {parts.map((p) => {
              const isMe = String(p.user?.id) === String(meId);
              const pRole = p.role || "member";
              const canManage = !isMe && (
                isOwner ||
                (role === "admin" && pRole === "member")
              );
              return (
                <ListItemButton
                  key={p.id || p.user?.id}
                  onClick={() => p.user?.id && onMessage(p.user)}
                  onContextMenu={(e) => canManage && openMemberContext(e, p.user, pRole)}
                  sx={{ borderRadius: 1 }}
                >
                  <ListItemAvatar>
                    <Box sx={{ position: "relative" }}>
                      <Avatar src={p.user?.avatar || undefined} sx={{ width: 36, height: 36 }}>{p.user?.username?.[0]}</Avatar>
                      {p.user?.id && onlineUsers?.has(Number(p.user.id)) && <OnlineDot size={10} />}
                    </Box>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography component="span" variant="body2">{p.user?.username || "Unknown"}</Typography>
                        {pRole === "owner" && (
                          <Chip
                            size="small"
                            icon={<CrownIcon sx={{ fontSize: 12 }} />}
                            label="Creator"
                            sx={{ height: 18, fontSize: 10, bgcolor: alpha("#ff9800", 0.15), color: "#ff9800" }}
                          />
                        )}
                        {pRole === "admin" && (
                          <Chip
                            size="small"
                            icon={<ShieldIcon sx={{ fontSize: 12 }} />}
                            label="Admin"
                            sx={{ height: 18, fontSize: 10, bgcolor: alpha("#2196f3", 0.15), color: "#2196f3" }}
                          />
                        )}
                        {isMe && (
                          <Typography component="span" variant="caption" color="text.secondary"> (you)</Typography>
                        )}
                      </Stack>
                    }
                  />
                  {canManage && (
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); openMemberMenu(e, p.user, pRole); }}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  )}
                </ListItemButton>
              );
            })}
            {!parts.length && (
              <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>No members loaded</Typography>
            )}
          </List>

          {/* Member ⋮ menu (same actions as the right-click context menu) */}
          <Menu
            anchorEl={memberMenuAnchor}
            open={Boolean(memberMenuAnchor)}
            onClose={closeMemberMenu}
            anchorOrigin={{ vertical: "center", horizontal: "right" }}
            transformOrigin={{ vertical: "center", horizontal: "left" }}
          >
            {renderMemberActions(memberMenuTarget)}
          </Menu>

          {/* Member right-click context menu */}
          <ContextMenu ctx={memberCtx} onClose={() => setMemberCtx(null)} minWidth={220}>
            {renderMemberActions(memberCtx)}
          </ContextMenu>

          {isAdmin && (
            <>
              <Button fullWidth color="warning" variant="outlined" startIcon={<CleaningServicesIcon />} sx={{ mt: 2 }} onClick={onCleanupChat}>
                Clear messages
              </Button>
              <Button fullWidth color="error" variant="outlined" sx={{ mt: 1 }} onClick={onDeleteGroup}>
                Delete group
              </Button>
            </>
          )}
        </Box>
      )}

      {activeConv?.type === "private" && peer && (
        <Stack spacing={1} sx={{ px: 2, pb: 2 }}>
          <Button variant="outlined" onClick={() => onMessage(peer)}>View profile</Button>
          <Button variant="outlined" startIcon={<PersonAddIcon />} onClick={() => onAddContact(peer.id)}>Add contact</Button>
          <Button color="warning" variant="outlined" startIcon={<CleaningServicesIcon />} onClick={onCleanupChat}>
            Clear messages
          </Button>
          <Button color="error" variant="outlined" startIcon={<BlockIcon />} onClick={() => onBlockUser(peer.id)}>Block</Button>
          <Button color="error" variant="contained" startIcon={<DeleteOutlineIcon />} onClick={onDeleteChat}>
            Delete chat
          </Button>
        </Stack>
      )}
    </Box>
  );
}

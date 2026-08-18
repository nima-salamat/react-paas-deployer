import React from "react";
import {
  Box, Typography, Avatar, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, FormControlLabel, Switch, List, ListItemButton, ListItemAvatar,
  ListItemText, Fade, Chip, Snackbar, CircularProgress,
} from "@mui/material";
import ConfirmDialog from "./ConfirmDialog";
import CallChoiceDialog from "./CallChoiceDialog";
import MediaSettingsDialog from "./MediaSettingsDialog";
import DayJumpDialog from "./DayJumpDialog";
import AuthRequiredDialog from "./AuthRequiredDialog";
import { convTitle, convAvatar, withTokenQuery } from "../messengerUtils";

/**
 * All modal / toast UI for MessengerApp — kept out of the main shell file.
 */
export default function MessengerDialogs({
  meId,
  conversations,
  contacts,
  activeConv,
  // forward
  forwardOpen, setForwardOpen, forwardTo,
  // create group
  createGroupOpen, setCreateGroupOpen, groupTitle, setGroupTitle, groupPublic, setGroupPublic, createGroup,
  // join invite
  joinOpen, setJoinOpen, joinCode, setJoinCode, joinByCode,
  // join public group confirm
  joinConfirm, setJoinConfirm, onConfirmJoin,
  // add members
  addMemberOpen, setAddMemberOpen, addMemberSelected, setAddMemberSelected, addMembersToGroup,
  // call choice
  callChoiceOpen, setCallChoiceOpen, startCall,
  // confirms
  confirmDelete, setConfirmDelete, deleteConversation,
  confirmCleanup, setConfirmCleanup, cleanupConversation,
  confirmBlock, setConfirmBlock, blockUser,
  confirmLeave, setConfirmLeave, leaveChat,
  // media settings
  mediaSettingsOpen, setMediaSettingsOpen,
  // toasts
  toast, error, setError, exitHint,
  // boot / auth
  hashReady, showAuthPopup, setShowAuthPopup, navigate,
  // day jump
  dayJumpOpen, setDayJumpOpen, messagesWithDays, messages, jumpToDayInChat,
}) {
  return (
    <>
      <Dialog open={Boolean(forwardOpen)} onClose={() => setForwardOpen(null)} fullWidth maxWidth="xs">
        <DialogTitle>Forward to…</DialogTitle>
        <DialogContent dividers sx={{ maxHeight: 360 }}>
          <List dense>
            {conversations.map((c) => (
              <ListItemButton key={c.id} onClick={() => forwardTo(c.id)}>
                <ListItemAvatar>
                  <Avatar src={convAvatar(c, meId)}>{convTitle(c, meId)[0]}</Avatar>
                </ListItemAvatar>
                <ListItemText primary={convTitle(c, meId)} />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
        <DialogActions><Button onClick={() => setForwardOpen(null)}>Cancel</Button></DialogActions>
      </Dialog>

      <Dialog open={createGroupOpen} onClose={() => setCreateGroupOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New group</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Group title" value={groupTitle}
            onChange={(e) => setGroupTitle(e.target.value)} sx={{ mt: 1 }} />
          <FormControlLabel sx={{ mt: 1.5 }}
            control={<Switch checked={groupPublic} onChange={(e) => setGroupPublic(e.target.checked)} />}
            label="Public (appears in search)" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateGroupOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createGroup} disabled={!groupTitle.trim()}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={joinOpen} onClose={() => setJoinOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Join with invite code</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Invite code" value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJoinOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={joinByCode} disabled={!joinCode.trim()}>Join</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(joinConfirm)}
        onClose={() => setJoinConfirm(null)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 1.25 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {joinConfirm?.group?.avatar_url ? (
            <Avatar src={withTokenQuery(joinConfirm.group.avatar_url)} sx={{ width: 40, height: 40 }} />
          ) : (
            <Avatar sx={{ width: 40, height: 40 }}>{joinConfirm?.group?.title?.[0]?.toUpperCase()}</Avatar>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={700} noWrap>{joinConfirm?.group?.title || "Group"}</Typography>
            <Typography variant="caption" color="text.secondary">
              {(joinConfirm?.group?.participants?.length || 0)} members
              {joinConfirm?.group?.requires_approval ? " · approval required" : ""}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {joinConfirm?.group?.description ? (
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {joinConfirm.group.description}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No description provided.
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
            {joinConfirm?.group?.requires_approval
              ? "An admin will need to approve your request before you can join."
              : "You will be added as a member immediately."}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button onClick={() => setJoinConfirm(null)} color="inherit">Cancel</Button>
          <Button variant="contained" color="primary" onClick={onConfirmJoin}>
            {joinConfirm?.group?.requires_approval ? "Send request" : "Join group"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addMemberOpen} onClose={() => setAddMemberOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add members from contacts</DialogTitle>
        <DialogContent dividers sx={{ maxHeight: 360 }}>
          <List dense>
            {contacts.map((c) => {
              const u = c.contact;
              if (!u) return null;
              const checked = addMemberSelected.includes(u.id);
              const already = (activeConv?.participants || []).some((p) => String(p.user?.id) === String(u.id));
              return (
                <ListItemButton
                  key={u.id} disabled={already}
                  onClick={() => {
                    setAddMemberSelected((prev) =>
                      checked ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                    );
                  }}
                >
                  <ListItemAvatar>
                    <Avatar src={withTokenQuery(u.avatar) || undefined}>{u.username?.[0]}</Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={u.username}
                    secondary={already ? "Already in group" : (checked ? "Selected" : "")}
                  />
                </ListItemButton>
              );
            })}
            {!contacts.length && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No contacts. Add contacts from search first.
              </Typography>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddMemberOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!addMemberSelected.length} onClick={addMembersToGroup}>
            Add ({addMemberSelected.length})
          </Button>
        </DialogActions>
      </Dialog>

      <CallChoiceDialog
        open={callChoiceOpen}
        onClose={() => setCallChoiceOpen(false)}
        onVoice={() => startCall({ video: false, audio: true })}
        onVideo={() => startCall({ video: true, audio: true })}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={confirmDelete?.type === "group" ? "Delete group?" : "Delete chat?"}
        message={confirmDelete?.type === "group"
          ? "This permanently deletes the group and all messages for everyone. This cannot be undone."
          : "This deletes the conversation for both sides. This cannot be undone."}
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={deleteConversation}
        onClose={() => setConfirmDelete(null)}
      />
      <ConfirmDialog
        open={Boolean(confirmCleanup)}
        title="Clear messages?"
        message="This clears all messages in this conversation for you. Other participants will still see their copies. This cannot be undone."
        confirmLabel="Clear"
        confirmColor="warning"
        onConfirm={cleanupConversation}
        onClose={() => setConfirmCleanup(null)}
      />
      <ConfirmDialog
        open={Boolean(confirmBlock)}
        title="Block user?"
        message={confirmBlock?.user?.username
          ? `@${confirmBlock.user.username} will no longer be able to message you. They'll be removed from your contacts.`
          : "This user will no longer be able to message you. They'll be removed from your contacts."}
        confirmLabel="Block"
        confirmColor="error"
        onConfirm={() => confirmBlock?.user?.id && blockUser(confirmBlock.user.id)}
        onClose={() => setConfirmBlock(null)}
      />
      <ConfirmDialog
        open={Boolean(confirmLeave)}
        title="Leave chat?"
        message="You will no longer receive messages from this chat. Other members will see that you left."
        confirmLabel="Leave"
        confirmColor="warning"
        onConfirm={leaveChat}
        onClose={() => setConfirmLeave(null)}
      />

      <MediaSettingsDialog
        open={mediaSettingsOpen}
        onClose={() => setMediaSettingsOpen(false)}
      />

      {toast && (
        <Fade in>
          <Chip label={toast} color="success"
            sx={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 1400 }} />
        </Fade>
      )}
      {error && (
        <Fade in>
          <Chip label={error} color="error" onDelete={() => setError("")}
            sx={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 1400 }} />
        </Fade>
      )}
      <Snackbar
        open={exitHint}
        message="Press back again to leave Messenger"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: 24, sm: 24 } }}
      />
      {!hashReady && !showAuthPopup && (
        <Box sx={{
          position: "fixed", inset: 0, bgcolor: "background.default",
          zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <CircularProgress />
        </Box>
      )}

      <DayJumpDialog
        open={dayJumpOpen}
        onClose={() => setDayJumpOpen(false)}
        messagesWithDays={messagesWithDays}
        messages={messages}
        onJumpToDay={jumpToDayInChat}
      />
      <AuthRequiredDialog
        open={showAuthPopup}
        onClose={() => setShowAuthPopup(false)}
        onSignIn={() => navigate("/signin_or_signup")}
      />
    </>
  );
}

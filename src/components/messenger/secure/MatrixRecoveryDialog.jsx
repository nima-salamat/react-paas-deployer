import React, { useEffect, useState } from "react";
import {
  Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import KeyIcon from "@mui/icons-material/Key";
import {
  commitRecoveryKey, getRecoveryState, getSecureMatrixClient,
  prepareRecoveryKey, restoreRecoveryKey,
} from "./MatrixSecureClient";

export default function MatrixRecoveryDialog({ open, onClose, onReady }) {
  const [phase, setPhase] = useState("loading");
  const [recoveryState, setRecoveryState] = useState(null);
  const [generatedKey, setGeneratedKey] = useState(null);
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [enteredKey, setEnteredKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [client, setClient] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setPhase("loading");
    setError("");
    setMessage("");
    setGeneratedKey(null);
    setSavedConfirmed(false);
    setEnteredKey("");
    setBusy(false);
    (async () => {
      try {
        const matrixClient = await getSecureMatrixClient();
        const state = await getRecoveryState(matrixClient);
        if (cancelled) return;
        setClient(matrixClient);
        setRecoveryState(state);
        setPhase(state.state);
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || "Could not initialize the Matrix secure device.");
        setPhase("error");
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const refreshState = async () => {
    const state = await getRecoveryState(client);
    setRecoveryState(state);
    setPhase(state.state);
    if (state.state === "ready") {
      setMessage("Encrypted key backup is ready on this device.");
      onReady?.();
    }
    return state;
  };

  const generateKey = async () => {
    if (!client || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await prepareRecoveryKey(client);
      setGeneratedKey(result);
      setSavedConfirmed(false);
      setPhase("show_recovery_key");
    } catch (err) {
      setError(err?.message || "Could not prepare the recovery key.");
    } finally {
      setBusy(false);
    }
  };

  const saveRecovery = async () => {
    if (!client || !generatedKey || !savedConfirmed || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await commitRecoveryKey(client, generatedKey);
      setGeneratedKey(null);
      setSavedConfirmed(false);
      await refreshState();
    } catch (err) {
      setError(err?.message || "Could not enable encrypted key backup.");
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!client || !enteredKey.trim() || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const restored = await restoreRecoveryKey(client, enteredKey);
      setEnteredKey("");
      setRecoveryState(restored);
      setPhase(restored.state);
      setMessage(
        Number.isFinite(restored.restored?.totalCount)
          ? `Key backup restored: ${restored.restored.totalCount} session keys checked.`
          : "Recovery finished. The device can now decrypt the messages for which the backup contains keys.",
      );
      if (restored.state === "ready") onReady?.();
    } catch (err) {
      setError(err?.message || "Could not restore the encrypted history.");
    } finally {
      setBusy(false);
    }
  };

  const copyRecoveryKey = async () => {
    const value = generatedKey?.encodedPrivateKey;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Recovery key copied. Store it somewhere separate from this device.");
    } catch {
      setMessage("Clipboard access is unavailable. Select and copy the recovery key manually.");
    }
  };

  return (
    <Dialog open={Boolean(open)} onClose={() => { if (!busy) onClose?.(); }} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <KeyIcon color="primary" />
        Secure chat recovery
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography color="text.secondary" variant="body2">
            Logging in to Paas Deployer is not enough to read encrypted history. This device needs a trusted Matrix key backup or an existing recovery key. The recovery key is never sent to the Messenger backend.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {message && <Alert severity="info">{message}</Alert>}
          {phase === "loading" && (
            <Box sx={{ py: 3, display: "flex", justifyContent: "center" }}>
              <CircularProgress />
            </Box>
          )}
          {phase === "needs_setup" && (
            <>
              <Alert severity="warning">
                This appears to be the first secure device for this Matrix account. Create the encrypted key backup now and save its recovery key outside this browser. Without it, losing this device may make old messages unreadable.
              </Alert>
              <Button variant="contained" onClick={generateKey} disabled={busy}>
                {busy ? "Preparing…" : "Create recovery key"}
              </Button>
            </>
          )}
          {phase === "show_recovery_key" && generatedKey && (
            <>
              <Alert severity="warning">
                Save this key before continuing. It can unlock your encrypted message backup. Anyone who obtains it may be able to recover your encrypted history.
              </Alert>
              <TextField
                fullWidth multiline minRows={3} label="Recovery key"
                value={generatedKey.encodedPrivateKey}
                InputProps={{ readOnly: true }}
              />
              <Button startIcon={<ContentCopyIcon />} variant="outlined" onClick={copyRecoveryKey}>
                Copy recovery key
              </Button>
              <FormControlLabel
                control={<Checkbox checked={savedConfirmed} onChange={(event) => setSavedConfirmed(event.target.checked)} />}
                label="I saved this recovery key somewhere separate and secure."
              />
              <Button variant="contained" onClick={saveRecovery} disabled={!savedConfirmed || busy}>
                {busy ? "Verifying backup…" : "Enable encrypted key backup"}
              </Button>
            </>
          )}
          {phase === "recovery_required" && (
            <>
              <Alert severity="warning">
                This account already has device or recovery state. The app will not replace an existing backup. Enter the existing recovery key to restore message keys, or verify an existing device in a later step. A new key will not recover older messages.
              </Alert>
              <TextField
                fullWidth multiline minRows={3} label="Existing recovery key"
                value={enteredKey}
                onChange={(event) => setEnteredKey(event.target.value)}
                autoComplete="off"
              />
              <Button variant="contained" onClick={restore} disabled={!enteredKey.trim() || busy}>
                {busy ? "Restoring…" : "Restore encrypted history"}
              </Button>
            </>
          )}
          {phase === "ready" && (
            <Alert severity="success">
              This device has a verified Matrix key backup. Messages that were never included in the backup, or whose keys were never shared with this account, may still be unreadable.
            </Alert>
          )}
          {phase === "error" && (
            <Alert severity="error">
              Secure chat remains disabled. No fallback to ordinary plaintext messaging is allowed.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

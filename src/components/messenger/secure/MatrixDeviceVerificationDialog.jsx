import React, { useEffect, useRef, useState } from "react";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Stack, Typography,
} from "@mui/material";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import { VerificationRequestEvent, VerifierEvent } from "matrix-js-sdk/lib/crypto-api";
import { getSecureMatrixClient, MatrixSecureError } from "./MatrixSecureClient";

const PHASE_LABELS = {
  1: "Creating verification request…",
  2: "Waiting for another trusted device to accept…",
  3: "A device accepted. Compare the security codes on both devices.",
  4: "Comparing security codes…",
  5: "Verification was cancelled.",
  6: "Device verification completed.",
};

export default function MatrixDeviceVerificationDialog({ open, onClose, onVerified }) {
  const [phase, setPhase] = useState("loading");
  const [request, setRequest] = useState(null);
  const [sasCallbacks, setSasCallbacks] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const verifierRef = useRef(null);
  const requestRef = useRef(null);
  const sasRef = useRef(null);
  const attachVerifierRef = useRef(null);
  const onVerifiedRef = useRef(onVerified);
  useEffect(() => { onVerifiedRef.current = onVerified; }, [onVerified]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    let activeRequest = null;
    const attachVerifier = (verifier) => {
      if (!verifier || verifierRef.current === verifier) return;
      verifierRef.current = verifier;
      verifier.on(VerifierEvent.ShowSas, (sas) => {
        if (cancelled) return;
        sasRef.current = sas;
        setSasCallbacks(sas);
        setPhase("compare");
      });
      verifier.on(VerifierEvent.Cancel, () => {
        if (cancelled) return;
        setPhase("cancelled");
        setError("The other device cancelled verification. No trust change was made.");
      });
      void verifier.verify().then(() => {
        if (cancelled) return;
        setPhase("verified");
        setSuccess(true);
        onVerifiedRef.current?.();
      }).catch((err) => {
        if (cancelled) return;
        setPhase("cancelled");
        setError(err?.message || "Device verification did not complete.");
      });
    };
    attachVerifierRef.current = attachVerifier;
    const onRequestChange = () => {
      if (cancelled || !activeRequest) return;
      setPhase((current) => (
        sasRef.current && (current === "compare" || current === "comparing")
          ? current
          : activeRequest.phase
      ));
      if (activeRequest.verifier) attachVerifier(activeRequest.verifier);
      if (activeRequest.phase === 5) {
        setError("The other device cancelled verification. No trust change was made.");
      }
      if (activeRequest.phase === 6) {
        setSuccess(true);
        setPhase("verified");
        onVerifiedRef.current?.();
      }
    };

    (async () => {
      setPhase("loading");
      setError("");
      setSuccess(false);
      setRequest(null);
      setSasCallbacks(null);
      sasRef.current = null;
      verifierRef.current = null;
      try {
        const client = await getSecureMatrixClient();
        const verification = await client.getCrypto().requestOwnUserVerification();
        if (cancelled) {
          await verification.cancel({ reason: "Dialog closed" }).catch(() => {});
          return;
        }
        activeRequest = verification;
        requestRef.current = verification;
        setRequest(verification);
        setPhase(verification.phase);
        verification.on(VerificationRequestEvent.Change, onRequestChange);
        if (verification.verifier) attachVerifier(verification.verifier);
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || "Could not request verification from another device.");
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      if (activeRequest) {
        activeRequest.off(VerificationRequestEvent.Change, onRequestChange);
        if (activeRequest.pending) {
          void activeRequest.cancel({ reason: "Verification dialog closed" }).catch(() => {});
        }
      }
      requestRef.current = null;
      verifierRef.current = null;
      sasRef.current = null;
      attachVerifierRef.current = null;
    };
  }, [open]);

  const beginSas = async () => {
    const activeRequest = requestRef.current;
    if (!activeRequest || busy) return;
    setBusy(true);
    setError("");
    try {
      const verifier = activeRequest.verifier || await activeRequest.startVerification("m.sas.v1");
      attachVerifierRef.current?.(verifier);
    } catch (err) {
      setError(err?.message || "Could not start emoji verification.");
    } finally {
      setBusy(false);
    }
  };

  const confirmSas = async () => {
    const callbacks = sasRef.current;
    if (!callbacks || busy) return;
    setBusy(true);
    setError("");
    try {
      await callbacks.confirm();
      setPhase("comparing");
      setSasCallbacks(null);
      sasRef.current = null;
    } catch (err) {
      setError(err?.message || "Could not confirm the matching security codes.");
    } finally {
      setBusy(false);
    }
  };

  const mismatchSas = async () => {
    try {
      sasRef.current?.mismatch?.();
    } catch {
      // Keep the mismatch indication local if the remote session has already ended.
    }
    setError("The security codes did not match. This device remains unverified.");
    setPhase("cancelled");
    setSuccess(false);
  };

  const cancel = async () => {
    try {
      await requestRef.current?.cancel({ reason: "User cancelled verification" });
    } catch {
      // Closing must remain possible if the remote device has already ended.
    }
    onClose?.();
  };

  const phaseLabel = phase === "compare" || phase === "comparing"
    ? "Compare the emoji or numbers with the other device. Confirm only when every symbol matches."
    : (PHASE_LABELS[phase] || (phase === "verified" ? "This device is verified." : "Waiting for the other device…"));

  return (
    <Dialog open={Boolean(open)} onClose={cancel} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <VerifiedUserIcon color={success ? "success" : "primary"} />
        Verify this device
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography color="text.secondary" variant="body2">
            Open the security settings on a device you already trust and approve this verification request. Never approve a device you do not recognize.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {phase === "loading" && <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress /></Box>}
          {phase !== "loading" && phase !== "error" && (
            <Alert severity={success ? "success" : phase === "cancelled" ? "warning" : "info"}>
              {phaseLabel}
            </Alert>
          )}
          {phase === 3 && (
            <Button variant="contained" onClick={beginSas} disabled={busy}>
              {busy ? "Starting…" : "Compare emoji codes"}
            </Button>
          )}
          {phase === "compare" && sasCallbacks?.sas?.emoji && (
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 1 }}>
              {sasCallbacks.sas.emoji.map(([emoji, name], index) => (
                <Box key={`${name}-${index}`} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, p: 1, textAlign: "center" }}>
                  <Typography sx={{ fontSize: 30 }}>{emoji}</Typography>
                  <Typography variant="caption">{name}</Typography>
                </Box>
              ))}
            </Box>
          )}
          {phase === "compare" && sasCallbacks?.sas?.decimal && (
            <Typography variant="h5" textAlign="center" fontWeight={800}>
              {sasCallbacks.sas.decimal.join(" · ")}
            </Typography>
          )}
          {phase === "compare" && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="contained" fullWidth onClick={confirmSas} disabled={busy}>
                The codes match
              </Button>
              <Button variant="outlined" color="error" fullWidth onClick={mismatchSas} disabled={busy}>
                They do not match
              </Button>
            </Stack>
          )}
          {success && (
            <Alert severity="success">
              Verification succeeded. Key sharing may now recover messages from trusted devices. If encrypted key backup is still required, complete that step separately.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={cancel} disabled={busy}>{success ? "Done" : "Cancel"}</Button>
      </DialogActions>
    </Dialog>
  );
}

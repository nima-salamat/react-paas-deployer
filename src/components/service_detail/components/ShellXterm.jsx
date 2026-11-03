import React, { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

/**
 * Real terminal surface for interactive PTY sessions (tinker, django shell, …).
 * Parent owns the WebSocket; this component only renders and relays I/O.
 */
export default function ShellXterm({
  active,
  onData,
  onResize,
  writeRef,
  height = 360,
  keepMounted = false,
}) {
  const hostRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const activeRef = useRef(active);
  const callbacksRef = useRef({ onData, onResize });

  // Keep the same xterm instance alive in Developer mode between commands.
  // A completed command closes its Docker exec PTY, not the browser terminal.
  useEffect(() => {
    activeRef.current = active;
    callbacksRef.current = { onData, onResize };
    const term = termRef.current;
    if (term) {
      term.options.disableStdin = !active;
      if (active) term.focus();
    }
  }, [active, onData, onResize]);

  useEffect(() => {
    if ((!active && !keepMounted) || !hostRef.current) return undefined;

    const term = new Terminal({
      cursorBlink: true,
      disableStdin: !activeRef.current,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      theme: {
        background: "#0a0f14",
        foreground: "#dce6ef",
        cursor: "#f8fafc",
        selectionBackground: "rgba(96,165,250,.35)",
        black: "#0a0f14",
        brightBlack: "#5c6770",
        red: "#ff9b8f",
        green: "#73c9a0",
        yellow: "#e9bd69",
        blue: "#78b6e7",
        magenta: "#c4a1ff",
        cyan: "#6ec6d4",
        white: "#dce6ef",
      },
      allowProposedApi: true,
      convertEol: true,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    fit.fit();
    term.focus();

    termRef.current = term;
    fitRef.current = fit;

    if (writeRef) {
      writeRef.current = (data) => {
        try {
          term.write(data);
        } catch {
          /* disposed */
        }
      };
    }

    const dataDisp = term.onData((data) => {
      if (activeRef.current) callbacksRef.current.onData?.(data);
    });

    const notifyResize = () => {
      try {
        fit.fit();
        callbacksRef.current.onResize?.(term.cols, term.rows);
      } catch {
        /* noop */
      }
    };
    notifyResize();
    const ro = new ResizeObserver(() => notifyResize());
    ro.observe(hostRef.current);

    return () => {
      dataDisp.dispose();
      ro.disconnect();
      if (writeRef) writeRef.current = null;
      try {
        term.dispose();
      } catch {
        /* noop */
      }
      termRef.current = null;
      fitRef.current = null;
    };
  }, [keepMounted, writeRef]);

  if (!active && !keepMounted) return null;

  return (
    <Box
      ref={hostRef}
      sx={{
        height,
        minHeight: 240,
        width: "100%",
        bgcolor: "#0a0f14",
        borderRadius: 1,
        border: "1px solid rgba(148,163,184,.14)",
        overflow: "hidden",
        px: 0.5,
        py: 0.5,
        "& .xterm": { height: "100%" },
        "& .xterm-viewport": { overflowY: "auto !important" },
      }}
    />
  );
}

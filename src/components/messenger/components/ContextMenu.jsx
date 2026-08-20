import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Paper } from "@mui/material";

/**
 * Reusable right-click / long-press context menu.
 * After open, pointer-events stay off briefly so the finger-up that opened
 * the menu cannot activate a MenuItem under the touch point.
 */
export default function ContextMenu({ ctx, children, onClose, minWidth = 200 }) {
  const menuRef = useRef(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!ctx) {
      setArmed(false);
      return undefined;
    }
    setArmed(false);
    // Arm only after the opening gesture has fully ended
    const t = setTimeout(() => setArmed(true), 320);
    return () => clearTimeout(t);
  }, [ctx]);

  useEffect(() => {
    if (!ctx) return undefined;

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    };

    const onScroll = (e) => {
      const menu = menuRef.current;
      const t = e.target;
      if (menu && t && (menu === t || menu.contains(t))) return;
      if (menu && t?.nodeType === 1 && t.closest?.("[data-messenger-ctx-menu]")) return;
      onClose?.();
    };

    const onResize = () => onClose?.();

    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [ctx, onClose]);

  if (!ctx) return null;

  const menuH = Math.min(360, Math.floor(window.innerHeight * 0.7));
  const pad = 12;
  let top = ctx.y;
  let left = ctx.x;
  // Prefer opening slightly above the touch so the first items are not under the finger
  top = Math.max(pad, top - 48);
  if (top + menuH > window.innerHeight - pad) top = Math.max(pad, window.innerHeight - menuH - pad);
  if (top < pad) top = pad;
  if (left + minWidth > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - minWidth - pad);
  if (left < pad) left = pad;

  return createPortal(
    <>
      <div
        onClick={() => { if (armed) onClose?.(); }}
        onContextMenu={(e) => { e.preventDefault(); onClose?.(); }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          background: "transparent",
          // Block ghost clicks on the chat underneath while gesture settles
          pointerEvents: armed ? "auto" : "none",
        }}
      />
      <Paper
        ref={menuRef}
        data-messenger-ctx-menu
        elevation={8}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        sx={{
          position: "fixed",
          top,
          left,
          zIndex: 9999,
          minWidth,
          maxWidth: `min(320px, calc(100vw - ${pad * 2}px))`,
          maxHeight: menuH,
          overflowY: "auto",
          overflowX: "hidden",
          py: 0.5,
          bgcolor: "background.paper",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
          // Critical: ignore the lift that opened the menu
          pointerEvents: armed ? "auto" : "none",
          opacity: armed ? 1 : 0.96,
        }}
      >
        {children}
      </Paper>
    </>,
    document.body
  );
}

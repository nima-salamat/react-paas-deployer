import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Paper } from "@mui/material";

/**
 * Reusable right-click context menu.
 * Closes on outside click, Escape, viewport resize, or scroll *outside* the menu.
 * Scrolling inside the menu (when it has a scrollbar) keeps it open.
 */
export default function ContextMenu({ ctx, children, onClose, minWidth = 200 }) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!ctx) return undefined;

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    };

    // Close only when scroll happens outside the menu panel
    // (scrolling the menu's own overflow must NOT dismiss it).
    const onScroll = (e) => {
      const menu = menuRef.current;
      const t = e.target;
      if (menu && t && (menu === t || menu.contains(t))) return;
      // Also ignore scroll on the menu's portal subtree
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

  // Keep menu fully on-screen on mobile (avoid clipping outside viewport)
  const menuH = Math.min(360, Math.floor(window.innerHeight * 0.7));
  const pad = 12;
  let top = ctx.y;
  let left = ctx.x;
  if (top + menuH > window.innerHeight - pad) top = Math.max(pad, window.innerHeight - menuH - pad);
  if (top < pad) top = pad;
  if (left + minWidth > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - minWidth - pad);
  if (left < pad) left = pad;

  return createPortal(
    <>
      {/* Transparent full-screen backdrop — captures outside clicks and right-clicks */}
      <div
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose?.(); }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          background: "transparent",
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
          // Prevent scroll chaining to the chat list underneath
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {children}
      </Paper>
    </>,
    document.body
  );
}

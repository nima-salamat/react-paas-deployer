import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Paper } from "@mui/material";

/**
 * Reusable right-click context menu — closes on outside click, escape, or scroll.
 *
 * Uses createPortal to render at document.body level, avoiding any stacking
 * context issues caused by ancestor transforms / overflow:hidden / filters.
 *
 * Props:
 *  - ctx: { x, y, payload } | null
 *  - onClose: () => void
 *  - children: rendered inside the menu (typically MenuItem's)
 *  - minWidth: number
 */
export default function ContextMenu({ ctx, children, onClose, minWidth = 200 }) {
  useEffect(() => {
    if (!ctx) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    };
    // Close on any scroll — avoids orphaned menu when the list scrolls
    const onScroll = () => onClose?.();
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    // Close on viewport resize
    const onResize = () => onClose?.();
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
        elevation={8}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        sx={{
          position: "fixed",
          top,
          left,
          zIndex: 9999,
          minWidth,
          maxWidth: `min(320px, calc(100vw - ${pad * 2}px))`,
          py: 0.5,
          borderRadius: 2,
          maxHeight: menuH,
          overflowY: "auto",
        }}
      >
        {children}
      </Paper>
    </>,
    document.body,
  );
}

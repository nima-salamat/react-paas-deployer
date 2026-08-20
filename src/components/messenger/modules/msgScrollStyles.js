/**
 * Scrollbar CSS for the chat message list.
 * - Mobile: no scrollbar at all
 * - Desktop: space reserved, thumb invisible until `.scrollbar-visible`
 *   (toggled when pointer is over the right scrollbar gutter)
 */
export const MSG_SCROLL_CLASS = "messenger-msg-scroll";

export const MSG_SCROLL_STYLE_TEXT = `
  /* Mobile — hide completely */
  @media (max-width: 899.95px) {
    .messenger-msg-scroll {
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }
    .messenger-msg-scroll::-webkit-scrollbar {
      width: 0 !important;
      height: 0 !important;
      display: none !important;
      background: transparent !important;
    }
  }

  /* Desktop — invisible until gutter hover (class toggled in JS) */
  @media (min-width: 900px) {
    .messenger-msg-scroll {
      scrollbar-width: thin;
      scrollbar-color: transparent transparent;
      scrollbar-gutter: stable;
    }
    .messenger-msg-scroll::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }
    .messenger-msg-scroll::-webkit-scrollbar-track {
      background: transparent;
    }
    .messenger-msg-scroll::-webkit-scrollbar-thumb {
      background: transparent;
      border-radius: 8px;
      border: 2px solid transparent;
      background-clip: padding-box;
    }
    .messenger-msg-scroll.scrollbar-visible {
      scrollbar-color: rgba(120, 120, 120, 0.55) transparent;
    }
    .messenger-msg-scroll.scrollbar-visible::-webkit-scrollbar-thumb {
      background: rgba(120, 120, 120, 0.5);
      background-clip: padding-box;
    }
    .messenger-msg-scroll.scrollbar-visible::-webkit-scrollbar-thumb:hover {
      background: rgba(100, 100, 100, 0.75);
      background-clip: padding-box;
    }
  }
`;

/** How wide (px) the right-edge zone is that reveals the scrollbar. */
export const SCROLLBAR_GUTTER_HOVER_PX = 14;

/**
 * Toggle `.scrollbar-visible` when the pointer is over the right gutter.
 * Call from onMouseMove / onMouseLeave on the scroll container (desktop only).
 */
export function updateScrollbarGutterVisibility(el, clientX, visible) {
  if (!el) return;
  if (visible === false) {
    el.classList.remove("scrollbar-visible");
    return;
  }
  if (clientX == null) return;
  const rect = el.getBoundingClientRect();
  const fromRight = rect.right - clientX;
  if (fromRight >= 0 && fromRight <= SCROLLBAR_GUTTER_HOVER_PX) {
    el.classList.add("scrollbar-visible");
  } else {
    el.classList.remove("scrollbar-visible");
  }
}

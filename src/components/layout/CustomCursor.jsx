import React, { useEffect, useRef, useState } from "react";

const POINTER_SELECTOR = [
  "a[href]",
  "button",
  "[role=button]",
  "[tabindex]:not([tabindex='-1'])",
  "summary",
  "label",
  "select",
  "input[type=checkbox]",
  "input[type=radio]",
  "input[type=range]",
  "[data-cursor='pointer']",
].join(",");

const STATE_LABELS = {
  default: "",
  pointer: "",
  text: "",
  grab: "",
  resize: "",
  forbidden: "!",
  loading: "…",
};

function resolveCursorState(target) {
  if (!(target instanceof Element)) return "default";

  const explicit = target.closest("[data-cursor]")?.getAttribute("data-cursor");
  if (explicit && STATE_LABELS[explicit] !== undefined) return explicit;

  const interactive = target.closest(POINTER_SELECTOR);
  if (interactive) {
    if (interactive.disabled || interactive.getAttribute("aria-disabled") === "true") {
      return "forbidden";
    }
    if (interactive.getAttribute("aria-busy") === "true") {
      return "loading";
    }
    if (interactive.matches("[draggable=true]")) return "grab";
    return "pointer";
  }

  if (
    target.closest("textarea, input:not([type]), input[type='text'], input[type='search'], input[type='email'], input[type='url'], input[type='password'], [contenteditable='true']")
  ) {
    return "text";
  }

  return "default";
}

export default function CustomCursor() {
  const rootRef = useRef(null);
  const targetRef = useRef({
    x: -100,
    y: -100,
    renderedX: null,
    renderedY: null,
    visible: false,
    state: "default",
    pressed: false,
  });
  const frameRef = useRef(0);
  const [state, setState] = useState("default");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine) and (hover: hover)");

    // Touch-only devices (phones / tablets) never mount the cursor logic.
    if (!finePointer.matches) return undefined;

    const root = rootRef.current;
    if (!root) return undefined;

    // Real mice report pointerType "mouse". Emulated mouse events produced by
    // taps on touch-screen laptops / hybrid devices are filtered out here too,
    // so the cursor can never be moved or stuck by touch input.
    const isMousePointer = (event) =>
      !event.pointerType || event.pointerType === "mouse";

    const hideCursor = () => {
      const target = targetRef.current;
      target.visible = false;
      target.pressed = false;
      root.classList.remove("is-pressed");
      setVisible((current) => (current ? false : current));
    };

    const handleMove = (event) => {
      // Touch / pen input (including a finger on a hybrid device) must never
      // drive the cursor: hide it until the mouse takes over again.
      if (!isMousePointer(event)) {
        hideCursor();
        return;
      }
      const target = targetRef.current;
      target.x = event.clientX;
      target.y = event.clientY;
      target.visible = true;
      target.state = resolveCursorState(event.target);
      // Re-sync in case the button was released outside the window.
      root.classList.toggle("is-pressed", target.pressed);
      setState(target.state);
      setVisible(true);
    };

    // The mouse left the document entirely: when the pointer exits the window
    // (or moves into an embedded document) relatedTarget/toElement are null.
    const handlePointerOut = (event) => {
      if (!isMousePointer(event)) return;
      if (!event.relatedTarget && !event.toElement) hideCursor();
    };

    // Extra safety nets: window-level mouseleave is unreliable across
    // browsers (it does not bubble), so also listen on the document root.
    const handleDocumentLeave = () => hideCursor();

    const handleDown = (event) => {
      if (!isMousePointer(event)) return;
      targetRef.current.pressed = true;
      root.classList.add("is-pressed");
    };

    const handleUp = () => {
      targetRef.current.pressed = false;
      root.classList.remove("is-pressed");
    };

    // Hybrid devices: the user switched to the finger/touch input.
    const handleTouchStart = () => hideCursor();

    // Alt-tab, minimized window, switched app: the pointer can no longer be
    // tracked, so drop the cursor (and any stuck pressed state) until the
    // mouse moves again.
    const handlePointerLost = () => hideCursor();

    const handleVisibilityChange = () => {
      if (document.hidden) hideCursor();
    };

    const handlePointerPreferenceChange = (event) => {
      if (!event.matches) hideCursor();
    };

    const render = () => {
      const target = targetRef.current;
      if (target.visible) {
        const rect = root.getBoundingClientRect();
        const dx = target.x - rect.left;
        const dy = target.y - rect.top;
        // Skip redundant style writes while the pointer is idle.
        if (dx !== target.renderedX || dy !== target.renderedY) {
          target.renderedX = dx;
          target.renderedY = dy;
          root.style.setProperty("--cursor-x", `${dx}px`);
          root.style.setProperty("--cursor-y", `${dy}px`);
        }
      }
      frameRef.current = requestAnimationFrame(render);
    };

    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("pointerdown", handleDown);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("blur", handlePointerLost);
    window.addEventListener("dragstart", handlePointerLost);
    document.addEventListener("pointerout", handlePointerOut);
    document.addEventListener("mouseleave", handleDocumentLeave);
    document.documentElement.addEventListener("mouseleave", handleDocumentLeave);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    finePointer.addEventListener?.("change", handlePointerPreferenceChange);
    frameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerdown", handleDown);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("blur", handlePointerLost);
      window.removeEventListener("dragstart", handlePointerLost);
      document.removeEventListener("pointerout", handlePointerOut);
      document.removeEventListener("mouseleave", handleDocumentLeave);
      document.documentElement.removeEventListener("mouseleave", handleDocumentLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      finePointer.removeEventListener?.("change", handlePointerPreferenceChange);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`custom-cursor ${visible ? "is-visible" : ""} is-${state}`}
      aria-hidden="true"
    >
      <span className="custom-cursor__halo" />
      <span className="custom-cursor__ring" />
      <span className="custom-cursor__dot" />
      <span className="custom-cursor__label">{STATE_LABELS[state]}</span>
    </div>
  );
}

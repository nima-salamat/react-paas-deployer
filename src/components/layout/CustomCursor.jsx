import React, { useEffect, useRef, useState } from "react";
import { readCursorPreference } from "./cursorSettings";
import { MouseFollower } from "./mouseFollower";

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

const STATE_NAMES = new Set([
  "default",
  "pointer",
  "text",
  "grab",
  "forbidden",
  "loading",
]);

function resolveCursorState(target) {
  if (!(target instanceof Element)) return "default";

  const explicit = target.closest("[data-cursor]")?.getAttribute("data-cursor");
  if (explicit && STATE_NAMES.has(explicit)) return explicit;

  const interactive = target.closest(POINTER_SELECTOR);
  if (interactive) {
    if (
      interactive.disabled ||
      interactive.getAttribute("aria-disabled") === "true"
    ) {
      return "forbidden";
    }
    if (interactive.getAttribute("aria-busy") === "true") {
      return "loading";
    }
    if (interactive.matches("[draggable='true']")) return "grab";
    return "pointer";
  }

  if (
    target.closest(
      "textarea, input:not([type]), input[type='text'], input[type='search'], input[type='email'], input[type='url'], input[type='password'], [contenteditable='true']",
    )
  ) {
    return "text";
  }

  return "default";
}

export default function CustomCursor() {
  const rootRef = useRef(null);
  const [enabled, setEnabled] = useState(() => readCursorPreference() === "custom");

  useEffect(() => {
    const syncPreference = (event) => {
      const next = event?.detail ?? readCursorPreference();
      setEnabled(next === "custom");
    };
    const onStorage = (event) => {
      if (event.key === "paas-cursor-preference") syncPreference();
    };
    window.addEventListener("passdeployer:cursor-preference", syncPreference);
    window.addEventListener("storage", onStorage);
    syncPreference();
    return () => {
      window.removeEventListener("passdeployer:cursor-preference", syncPreference);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const finePointer = window.matchMedia("(pointer: fine) and (hover: hover)");
    if (!finePointer.matches) return undefined;

    const root = rootRef.current;
    if (!root) return undefined;

    const dot = root.querySelector(".custom-cursor__dot");
    const ring = root.querySelector(".custom-cursor__ring");
    if (!dot || !ring) return undefined;

    const setState = (nextState) => {
      const current = root.dataset.state || "default";
      if (current === nextState) return;
      root.classList.remove(
        "is-default",
        "is-pointer",
        "is-text",
        "is-grab",
        "is-forbidden",
        "is-loading",
      );
      root.classList.add(`is-${nextState}`);
      root.dataset.state = nextState;
    };

    const show = () => root.classList.add("is-visible");
    const hide = () => {
      root.classList.remove("is-visible", "is-pressed");
      setState("default");
    };

    document.documentElement.classList.add("custom-cursor-enabled");

    const follower = new MouseFollower({
      // Tight lag keeps the ring expressive without feeling disconnected from the mouse.
      smoothness: 0.72,
      onRawMove: (x, y) => {
        dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        show();
      },
      onFrame: (x, y) => {
        ring.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      },
      onFirstMove: () => show(),
    });

    const handleMove = (event) => {
      if (event.pointerType && event.pointerType !== "mouse") {
        hide();
        return;
      }
      setState(resolveCursorState(event.target));
    };

    const handleDown = (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      root.classList.add("is-pressed");
    };

    const handleUp = () => root.classList.remove("is-pressed");
    const handleLeave = () => hide();
    const handleVisibility = () => {
      if (document.hidden) hide();
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    window.addEventListener("pointerdown", handleDown, { passive: true });
    window.addEventListener("pointerup", handleUp, { passive: true });
    window.addEventListener("pointercancel", handleUp, { passive: true });
    window.addEventListener("blur", handleLeave);
    document.addEventListener("mouseleave", handleLeave);
    document.addEventListener("visibilitychange", handleVisibility);

    follower.start();

    return () => {
      follower.destroy();
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("pointerdown", handleDown);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      window.removeEventListener("blur", handleLeave);
      document.removeEventListener("mouseleave", handleLeave);
      document.removeEventListener("visibilitychange", handleVisibility);
      document.documentElement.classList.remove("custom-cursor-enabled");
    };
  }, [enabled]);

  return (
    <div
      ref={rootRef}
      className="custom-cursor is-default"
      data-state="default"
      aria-hidden="true"
    >
      <span className="custom-cursor__ring" />
      <span className="custom-cursor__dot" />
    </div>
  );
}

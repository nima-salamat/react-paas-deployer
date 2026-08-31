import React, { useEffect, useRef } from "react";
import { slugifyHeading } from "./markdown";

function fallbackCopyText(text) {
  if (!text) return Promise.resolve();

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand("copy");
    if (!copied) throw new Error("Copy command failed");
  } finally {
    textarea.remove();
  }
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the legacy clipboard fallback.
    }
  }
  await fallbackCopyText(text);
}

function findAnchorTarget(root, rawId) {
  const decoded = decodeURIComponent(rawId || "");
  if (!decoded) return null;

  const candidates = [decoded, slugifyHeading(decoded)];
  for (const id of candidates) {
    if (!id) continue;
    const local = root.querySelector(`[id="${CSS.escape(id)}"]`);
    if (local) return local;
    const global = document.getElementById(id);
    if (global) return global;
  }
  return null;
}

export default function MarkdownPreview({ html = "", className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;

    const buttons = Array.from(root.querySelectorAll(".doc-copy-btn"));
    const copyCleanups = buttons.map((button) => {
      const handler = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const codeEl = button.closest(".doc-code")?.querySelector("code");
        const raw = codeEl?.textContent || "";
        const original = button.querySelector(".doc-copy-label")?.textContent || "Copy";

        button.disabled = true;
        try {
          await copyText(raw);
          const label = button.querySelector(".doc-copy-label");
          if (label) label.textContent = "Copied";
          button.classList.add("is-copied");
        } catch {
          const label = button.querySelector(".doc-copy-label");
          if (label) label.textContent = "Copy failed";
          button.classList.add("is-copy-error");
        } finally {
          window.setTimeout(() => {
            const label = button.querySelector(".doc-copy-label");
            if (label) label.textContent = original;
            button.classList.remove("is-copied", "is-copy-error");
            button.disabled = false;
          }, 1400);
        }
      };

      button.addEventListener("click", handler);
      return () => button.removeEventListener("click", handler);
    });

    const onClick = (event) => {
      const anchor = event.target.closest("a[href]");
      if (!anchor || !root.contains(anchor)) return;

      const href = anchor.getAttribute("href") || "";
      if (!href.startsWith("#") || href === "#") return;

      const target = findAnchorTarget(root, href.slice(1));
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });

      const cleanId = target.id || decodeURIComponent(href.slice(1));
      try {
        history.pushState(
          null,
          "",
          `${window.location.pathname}${window.location.search}#${encodeURIComponent(cleanId)}`
        );
      } catch {
        /* Ignore URL update errors. */
      }

      target.setAttribute("tabindex", "-1");
      try {
        target.focus({ preventScroll: true });
      } catch {
        target.focus();
      }
    };

    root.addEventListener("click", onClick);

    const initialHash = window.location.hash?.slice(1);
    if (initialHash) {
      const target = findAnchorTarget(root, initialHash);
      if (target) {
        requestAnimationFrame(() => {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    }

    return () => {
      copyCleanups.forEach((cleanup) => cleanup());
      root.removeEventListener("click", onClick);
    };
  }, [html]);

  return (
    <div
      ref={ref}
      className={className}
      dir="auto"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

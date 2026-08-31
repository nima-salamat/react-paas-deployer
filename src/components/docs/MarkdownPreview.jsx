import React, { useEffect, useRef } from "react";
import { slugifyHeading } from "./markdown";
import DocsStyles from "./DocsStyles";

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
      /* fallback */
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

function wireCopyButtons(root) {
  const buttons = Array.from(root.querySelectorAll(".doc-copy-btn"));
  return buttons.map((button) => {
    const handler = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const codeEl =
        button.closest(".doc-code")?.querySelector("code") ||
        button.closest(".doc-terminal")?.querySelector(".doc-terminal-pre") ||
        button.closest(".doc-output")?.querySelector("pre");
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
}

function wireInlineCopy(root) {
  const buttons = Array.from(root.querySelectorAll(".doc-inline-copy"));
  return buttons.map((button) => {
    const handler = async (event) => {
      event.preventDefault();
      const raw = button.getAttribute("data-copy") || button.querySelector("code")?.textContent || "";
      const label = button.querySelector(".doc-inline-copy-label");
      try {
        await copyText(raw);
        if (label) label.textContent = "Copied";
        button.classList.add("is-copied");
      } catch {
        if (label) label.textContent = "Fail";
      } finally {
        window.setTimeout(() => {
          if (label) label.textContent = "Copy";
          button.classList.remove("is-copied");
        }, 1200);
      }
    };
    button.addEventListener("click", handler);
    return () => button.removeEventListener("click", handler);
  });
}

function wireTabs(root) {
  const groups = Array.from(root.querySelectorAll("[data-doc-tabs]"));
  return groups.map((group) => {
    const handler = (event) => {
      const btn = event.target.closest(".doc-tab");
      if (!btn || !group.contains(btn)) return;
      const target = btn.getAttribute("data-tab-target");
      group.querySelectorAll(".doc-tab").forEach((t) => t.classList.toggle("is-active", t === btn));
      group.querySelectorAll(".doc-tab-panel").forEach((p) => {
        p.classList.toggle("is-active", p.id === target);
      });
    };
    group.addEventListener("click", handler);
    return () => group.removeEventListener("click", handler);
  });
}

function wireFeedback(root) {
  const boxes = Array.from(root.querySelectorAll("[data-doc-feedback]"));
  return boxes.map((box) => {
    const handler = (event) => {
      const btn = event.target.closest(".doc-feedback-btn");
      if (!btn) return;
      box.querySelectorAll(".doc-feedback-btn").forEach((b) => {
        b.disabled = true;
      });
      const thanks = box.querySelector(".doc-feedback-thanks");
      if (thanks) thanks.hidden = false;
    };
    box.addEventListener("click", handler);
    return () => box.removeEventListener("click", handler);
  });
}

function tryRenderMermaid(root) {
  const nodes = Array.from(root.querySelectorAll("[data-mermaid]"));
  if (!nodes.length) return;
  const run = (mermaid) => {
    nodes.forEach((node, idx) => {
      const src = node.querySelector(".doc-mermaid-source")?.textContent || "";
      const target = node.querySelector(".doc-mermaid-render");
      if (!target || !src.trim()) return;
      const id = `mermaid-${idx}-${Math.random().toString(36).slice(2, 7)}`;
      try {
        mermaid
          .render(id, src)
          .then(({ svg }) => {
            target.innerHTML = svg;
            const pre = node.querySelector(".doc-mermaid-source");
            if (pre) pre.style.display = "none";
          })
          .catch(() => {});
      } catch {
        /* ignore */
      }
    });
  };
  if (window.mermaid) {
    run(window.mermaid);
    return;
  }
  if (!document.getElementById("doc-mermaid-cdn")) {
    const s = document.createElement("script");
    s.id = "doc-mermaid-cdn";
    s.src = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
    s.onload = () => {
      try {
        window.mermaid.initialize({ startOnLoad: false, theme: "dark" });
        run(window.mermaid);
      } catch {
        /* ignore */
      }
    };
    document.body.appendChild(s);
  }
}

export default function MarkdownPreview({ html = "", className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;

    const cleanups = [
      ...wireCopyButtons(root),
      ...wireInlineCopy(root),
      ...wireTabs(root),
      ...wireFeedback(root),
    ];

    tryRenderMermaid(root);

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
        /* ignore */
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
      cleanups.forEach((cleanup) => cleanup());
      root.removeEventListener("click", onClick);
    };
  }, [html]);

  return (
    <>
      <DocsStyles />
      <div
        ref={ref}
        className={className}
        dir="auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}

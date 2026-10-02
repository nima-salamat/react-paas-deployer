import React, { useCallback, useRef, useState } from "react";
import Menu from "@mui/material/Menu";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import hljs from "highlight.js/lib/common";
import { CODE_LANGUAGES, getCodeLanguage, getCodeLanguageLabel } from "./codeLanguages.js";
import { Box, Button, ButtonGroup, Collapse, FormControl, IconButton, MenuItem, Paper, Popover, Select, Stack, TextField, Tooltip, Typography } from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import CodeIcon from "@mui/icons-material/Code";
import LinkIcon from "@mui/icons-material/Link";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import FormatSizeIcon from "@mui/icons-material/FormatSize";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const INLINE_TAGS = {
  bold: ["STRONG", "B"],
  italic: ["EM", "I"],
  underline: ["U"],
};

const ALIGNMENT_CLASSES = {
  left: "ticket-align-left",
  center: "ticket-align-center",
  right: "ticket-align-right",
};

const ALIGNMENT_VALUES = Object.keys(ALIGNMENT_CLASSES);

function getBlockAlignment(block) {
  if (!block) return "left";
  const classEntry = ALIGNMENT_VALUES.find((align) =>
    block.classList?.contains(ALIGNMENT_CLASSES[align])
  );
  if (classEntry) return classEntry;

  const inlineStyle = block.style?.textAlign || "";
  return ALIGNMENT_VALUES.includes(inlineStyle) ? inlineStyle : "left";
}

function setBlockAlignment(block, align) {
  if (!block || !ALIGNMENT_VALUES.includes(align)) return;
  Object.values(ALIGNMENT_CLASSES).forEach((className) => {
    block.classList?.remove(className);
  });
  block.classList?.add(ALIGNMENT_CLASSES[align]);
  block.style?.removeProperty("text-align");
}

function copyBlockAlignment(source, target) {
  if (!source || !target) return;
  const hasExplicitClass = ALIGNMENT_VALUES.some((align) =>
    source.classList?.contains(ALIGNMENT_CLASSES[align])
  );
  const hasInlineAlignment = Boolean(source.style?.textAlign);
  if (hasExplicitClass || hasInlineAlignment) {
    setBlockAlignment(target, getBlockAlignment(source));
  }
}

/**
 * Compact HTML editor. Toolbar hidden by default; expand with button.
 * Enter → new line (send only via toolbar/send button from parent).
 */
export default function SimpleHtmlEditor({
  value = "",
  onChange,
  onSubmit,
  placeholder = "Message…",
  minHeight = 40,
  maxHeight = 192,
  enterSends = false,
  disabled = false,
  compact = true,
  showToolbarToggle = true,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
}) {
  const ref = useRef(null);
  const lastHtml = useRef(value || "");
  const savedRange = useRef(null);
  const editingRef = useRef(false);
  const historyRef = useRef([value || ""]);
  const historyIndexRef = useRef(0);
  const [, setHistoryRevision] = useState(0);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    bullet: false,
    ordered: false,
    code: false,
    quote: false,
    block: "P",
    align: "left",
  });
  const [linkAnchor, setLinkAnchor] = useState(null);
  const [codeMenuAnchor, setCodeMenuAnchor] = useState(null);
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [internalExpanded, setInternalExpanded] = useState(Boolean(expandedProp ?? defaultExpanded));
  const expanded = expandedProp ?? internalExpanded;
  const setExpanded = (v) => {
    setInternalExpanded(v);
    onExpandedChange?.(v);
  };

  React.useEffect(() => {
    const editor = ref.current;
    if (!editor) return;
    const incoming = typeof value === "string" ? value : "";
    if (incoming === lastHtml.current || editingRef.current) return;
    editor.innerHTML = incoming;
    editor.querySelectorAll("pre.editor-code-block").forEach((pre) => {
      const code = pre.querySelector("code");
      const language = getCodeLanguage(code);
      pre.setAttribute(
        "data-language-label",
        language ? getCodeLanguageLabel(language) : "Code"
      );
    });
    lastHtml.current = incoming;
    historyRef.current = [incoming];
    historyIndexRef.current = 0;
    setHistoryRevision((v) => v + 1);
  }, [value]);

  const saveSelection = useCallback(() => {
    const editor = ref.current;
    const selection = window.getSelection?.();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange();
  }, []);

  const restoreSelection = () => {
    const editor = ref.current;
    const selection = window.getSelection?.();
    const range = savedRange.current;
    if (!editor || !selection || !range || !editor.contains(range.commonAncestorContainer)) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  };

  const focusEditorSelection = useCallback(() => {
    const editor = ref.current;
    if (!editor) return false;

    editor.focus({ preventScroll: true });

    if (restoreSelection()) return true;

    const selection = window.getSelection?.();
    if (!selection) return false;

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    savedRange.current = range.cloneRange();
    return true;
  }, []);

  const findInlineAncestor = useCallback((command) => {
    const editor = ref.current;
    const selection = window.getSelection?.();
    if (!editor || !selection?.rangeCount) return null;

    const tags = INLINE_TAGS[command] || [];
    let node = selection.anchorNode?.nodeType === Node.ELEMENT_NODE
      ? selection.anchorNode
      : selection.anchorNode?.parentElement;

    while (node && node !== editor) {
      if (tags.includes(node.tagName)) return node;
      node = node.parentElement;
    }
    return null;
  }, []);

  const placeCaretAtBoundary = useCallback((parent, index) => {
    const selection = window.getSelection?.();
    if (!selection || !parent) return;

    const range = document.createRange();
    range.setStart(parent, Math.max(0, Math.min(index, parent.childNodes.length)));
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const toggleInlineFormat = (command) => {
    if (disabled || !ref.current || !INLINE_TAGS[command]) return;
    if (!focusEditorSelection()) return;

    const selection = window.getSelection?.();
    if (!selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    editingRef.current = true;

    if (range.collapsed) {
      const active = findInlineAncestor(command);
      const tagName = (INLINE_TAGS[command]?.[0] || "STRONG").toLowerCase();

      if (!active) {
        const mark = document.createElement(tagName);
        const marker = document.createTextNode("\u200B");
        mark.setAttribute("data-editor-typing-mark", command);
        mark.appendChild(marker);
        range.insertNode(mark);

        const caret = document.createRange();
        caret.setStart(marker, marker.length);
        caret.collapse(true);
        selection.removeAllRanges();
        selection.addRange(caret);
      } else {
        const parent = active.parentNode;
        if (parent) {
          const beforeRange = range.cloneRange();
          beforeRange.selectNodeContents(active);
          beforeRange.setEnd(range.startContainer, range.startOffset);

          const afterRange = range.cloneRange();
          afterRange.selectNodeContents(active);
          afterRange.setStart(range.startContainer, range.startOffset);

          const beforeFragment = beforeRange.cloneContents();
          const afterFragment = afterRange.cloneContents();
          const beforeVisible = (beforeFragment.textContent || "").replace(/\u200B/g, "");
          const afterVisible = (afterFragment.textContent || "").replace(/\u200B/g, "");
          const index = Array.prototype.indexOf.call(parent.childNodes, active);

          const boundary = document.createTextNode("\u200B");
          const beforeMark = active.cloneNode(false);
          beforeMark.removeAttribute("data-editor-typing-mark");

          const afterMark = active.cloneNode(false);
          afterMark.removeAttribute("data-editor-typing-mark");

          if (beforeVisible) beforeMark.appendChild(beforeFragment);
          if (afterVisible) afterMark.appendChild(afterFragment);

          active.remove();

          if (beforeVisible) {
            parent.insertBefore(beforeMark, parent.childNodes[index] || null);
            parent.insertBefore(boundary, beforeMark.nextSibling);
          } else {
            parent.insertBefore(boundary, parent.childNodes[index] || null);
          }

          if (afterVisible) {
            parent.insertBefore(afterMark, boundary.nextSibling);
          }

          const caret = document.createRange();
          caret.setStart(boundary, boundary.length);
          caret.collapse(true);
          selection.removeAllRanges();
          selection.addRange(caret);
        }
      }
    } else {
      try {
        document.execCommand(command, false, null);
      } catch {
        // noop
      }
    }

    saveSelection();
    editingRef.current = false;
    emit();
    updateActiveFormats();
  };

  const findBlock = useCallback(() => {
    const editor = ref.current;
    const selection = window.getSelection?.();
    if (!editor || !selection || !selection.rangeCount) return null;
    const node = selection.anchorNode;
    let block = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    while (block && block !== editor && !["P", "DIV", "PRE", "LI", "BLOCKQUOTE", "H1", "H2", "H3", "H4"].includes(block.tagName)) {
      block = block.parentElement;
    }
    if (block && block !== editor) return block;
    return null;
  }, []);

  const ensureBlock = useCallback(() => {
    const editor = ref.current;
    const selection = window.getSelection?.();
    if (!editor || !selection || !selection.rangeCount) return null;

    let block = findBlock();
    if (block) return block;

    const anchor = selection.anchorNode;
    if (!anchor || !editor.contains(anchor)) return null;

    let target = anchor;
    while (target.parentNode && target.parentNode !== editor) target = target.parentNode;

    const wrapper = document.createElement("p");
    if (target === editor) {
      wrapper.innerHTML = "<br>";
      editor.appendChild(wrapper);
    } else {
      const parent = target.parentNode;
      if (!parent) return null;
      parent.replaceChild(wrapper, target);
      wrapper.appendChild(target);
    }

    const range = document.createRange();
    range.selectNodeContents(wrapper);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    return wrapper;
  }, [findBlock]);

  const placeCaretAtEnd = useCallback((element) => {
    const selection = window.getSelection?.();
    if (!selection || !element) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const placeCaretAtStart = useCallback((element) => {
    const selection = window.getSelection?.();
    if (!selection || !element) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const readHtml = useCallback(() => {
    if (!ref.current) return "";

    const clone = ref.current.cloneNode(true);
    clone.querySelectorAll?.("[data-editor-typing-mark]").forEach((node) => {
      const visible = (node.textContent || "").replace(/\u200B/g, "");
      if (!visible) {
        node.remove();
      } else {
        node.removeAttribute("data-editor-typing-mark");
      }
    });

    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      node.nodeValue = node.nodeValue?.replace(/\u200B/g, "") || "";
      node = walker.nextNode();
    }

    return clone.innerHTML.replace(/^(?:<div><br><\/div>|<br>)$/i, "");
  }, []);

  const recordHistory = useCallback((html) => {
    const history = historyRef.current;
    const index = historyIndexRef.current;
    if (history[index] === html) return;

    history.splice(index + 1);
    history.push(html);
    if (history.length > 100) history.shift();
    historyIndexRef.current = history.length - 1;
    setHistoryRevision((v) => v + 1);
  }, []);

  const emit = useCallback((record = true) => {
    if (!ref.current) return;
    const html = readHtml();
    lastHtml.current = html;
    onChange?.(html);
    if (record) recordHistory(html);
  }, [onChange, readHtml, recordHistory]);

  const updateActiveFormats = useCallback(() => {
    const editor = ref.current;
    const selection = window.getSelection?.();
    if (!editor || !selection || !selection.rangeCount || !editor.contains(selection.anchorNode)) return;

    const safeQueryState = (command) => {
      try { return document.queryCommandState(command); } catch { return false; }
    };

    const block = findBlock();
    const list = block?.tagName === "LI" ? block.parentElement : null;
    setActiveFormats({
      bold: Boolean(findInlineAncestor("bold")),
      italic: Boolean(findInlineAncestor("italic")),
      underline: Boolean(findInlineAncestor("underline")),
      bullet: safeQueryState("insertUnorderedList") || list?.tagName === "UL",
      ordered: safeQueryState("insertOrderedList") || list?.tagName === "OL",
      code: block?.tagName === "PRE",
      quote: block?.tagName === "BLOCKQUOTE",
      block: block?.tagName || "P",
      align: getBlockAlignment(block),
      language: block?.tagName === "PRE"
        ? getCodeLanguage(block.querySelector?.("code"))
        : "",
    });
  }, [findBlock, findInlineAncestor]);

  React.useEffect(() => {
    const refresh = () => updateActiveFormats();
    document.addEventListener("selectionchange", refresh);
    window.addEventListener("focus", refresh);
    refresh();
    return () => {
      document.removeEventListener("selectionchange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [updateActiveFormats]);

  const applyHistory = useCallback((index) => {
    const editor = ref.current;
    const history = historyRef.current;
    if (!editor || index < 0 || index >= history.length) return;

    const html = history[index];
    historyIndexRef.current = index;
    editingRef.current = true;
    editor.innerHTML = html;
    lastHtml.current = html;
    onChange?.(html);
    setHistoryRevision((v) => v + 1);
    placeCaretAtEnd(editor);
    requestAnimationFrame(() => {
      editingRef.current = false;
      updateActiveFormats();
    });
  }, [onChange, placeCaretAtEnd, updateActiveFormats]);

  const undo = useCallback(() => {
    const next = historyIndexRef.current - 1;
    if (next >= 0) applyHistory(next);
  }, [applyHistory]);

  const redo = useCallback(() => {
    const next = historyIndexRef.current + 1;
    if (next < historyRef.current.length) applyHistory(next);
  }, [applyHistory]);

  const applyAlignment = useCallback((align) => {
    if (disabled || !ref.current || !["left", "center", "right"].includes(align)) return;
    const editor = ref.current;
    if (!focusEditorSelection()) return;

    const selection = window.getSelection?.();
    if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return;

    const range = selection.getRangeAt(0);
    let blocks = [];

    if (range.collapsed) {
      const current = findBlock() || ensureBlock();
      if (current) blocks = [current];
    } else {
      const candidates = Array.from(
        editor.querySelectorAll("p, div, li, blockquote, h1, h2, h3, h4")
      ).filter((node) => {
        try {
          return range.intersectsNode(node);
        } catch {
          return false;
        }
      });

      const selected = new Set(candidates);
      blocks = candidates.filter((node) => {
        let ancestor = node.parentElement;
        while (ancestor && ancestor !== editor) {
          if (selected.has(ancestor)) return false;
          ancestor = ancestor.parentElement;
        }
        return true;
      });

      if (!blocks.length) {
        const current = findBlock() || ensureBlock();
        if (current) blocks = [current];
      }
    }

    if (!blocks.length) return;

    editingRef.current = true;
    blocks.forEach((block) => {
      setBlockAlignment(block, align);
    });
    saveSelection();
    editingRef.current = false;
    emit();
    updateActiveFormats();
  }, [disabled, emit, ensureBlock, findBlock, focusEditorSelection, saveSelection, updateActiveFormats]);

  const applyBlockFormat = useCallback((tagName) => {
    if (disabled || !ref.current) return;
    if (!focusEditorSelection()) return;
    const block = findBlock() || ensureBlock();
    if (!block || block.tagName === "PRE" || block.tagName === "LI") return;

    const normalized = String(tagName || "P").toUpperCase();
    if (!["P", "H1", "H2", "H3", "H4"].includes(normalized)) return;
    if (block.tagName === normalized) return;

    editingRef.current = true;
    const next = document.createElement(normalized.toLowerCase());
    next.innerHTML = block.innerHTML || "<br>";
    const parent = block.parentNode;
    if (!parent) return;
    parent.replaceChild(next, block);
    placeCaretAtEnd(next);
    saveSelection();
    editingRef.current = false;
    emit();
    updateActiveFormats();
  }, [disabled, emit, ensureBlock, findBlock, focusEditorSelection, placeCaretAtEnd, saveSelection, updateActiveFormats]);

  const readCodeText = useCallback((node) => {
    if (!node) return "";
    const clone = node.cloneNode(true);
    clone.querySelectorAll?.("br").forEach((br) => {
      br.replaceWith(document.createTextNode("\n"));
    });
    return clone.textContent || "";
  }, []);

  const createParagraphFromText = useCallback((text, alignmentSource = null) => {
    const paragraph = document.createElement("p");
    const normalized = String(text || "").replace(/\r\n?/g, "\n");
    const lines = normalized.split("\n");

    lines.forEach((line, index) => {
      if (index > 0) paragraph.appendChild(document.createElement("br"));
      if (line) paragraph.appendChild(document.createTextNode(line));
    });

    if (!normalized) paragraph.innerHTML = "<br>";
    copyBlockAlignment(alignmentSource, paragraph);
    return paragraph;
  }, []);

  const convertCodeBlockToParagraph = useCallback((pre) => {
    const code = pre?.querySelector?.("code") || pre;
    const text = readCodeText(code);
    const paragraph = createParagraphFromText(text, pre);
    const parent = pre?.parentNode;
    if (parent) parent.replaceChild(paragraph, pre);
    return paragraph;
  }, [createParagraphFromText, readCodeText]);

  const splitCodeBlockAtCaret = useCallback((pre, range) => {
    const code = pre?.querySelector?.("code") || pre;
    const parent = pre?.parentNode;
    if (!pre || !code || !parent || !range) return null;

    const beforeRange = range.cloneRange();
    beforeRange.selectNodeContents(code);
    beforeRange.setEnd(range.startContainer, range.startOffset);

    const afterRange = range.cloneRange();
    afterRange.selectNodeContents(code);
    afterRange.setStart(range.startContainer, range.startOffset);

    const beforeText = readCodeText(beforeRange.cloneContents());
    const afterText = readCodeText(afterRange.cloneContents());

    if (!beforeText) {
      const paragraph = createParagraphFromText(afterText, pre);
      parent.replaceChild(paragraph, pre);
      return paragraph;
    }

    code.textContent = beforeText;
    const paragraph = createParagraphFromText(afterText, pre);
    parent.insertBefore(paragraph, pre.nextSibling);
    return paragraph;
  }, [createParagraphFromText, readCodeText]);

  const insertSoftBreak = useCallback((range, selection) => {
    if (!range || !selection) return;
    range.deleteContents();
    const br = document.createElement("br");
    range.insertNode(br);
    range.setStartAfter(br);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const splitQuoteAtCaret = useCallback((quote, range) => {
    const parent = quote?.parentNode;
    if (!quote || !parent || !range) return null;

    const afterRange = range.cloneRange();
    afterRange.selectNodeContents(quote);
    afterRange.setStart(range.startContainer, range.startOffset);
    const afterFragment = afterRange.extractContents();

    const paragraph = document.createElement("p");
    if (afterFragment.childNodes.length) {
      paragraph.appendChild(afterFragment);
    } else {
      paragraph.innerHTML = "<br>";
    }
    copyBlockAlignment(quote, paragraph);
    parent.insertBefore(paragraph, quote.nextSibling);

    return paragraph;
  }, []);

  const exitCodeBlockAtEnd = useCallback((pre) => {
    const code = pre?.querySelector?.("code") || pre;
    if (!pre || !code) return null;

    const text = readCodeText(code).replace(/\r\n?/g, "\n");
    const remaining = text.endsWith("\n") ? text.slice(0, -1) : text;
    const parent = pre.parentNode;
    if (!parent) return null;

    const paragraph = createParagraphFromText("", pre);
    if (remaining) {
      code.textContent = remaining;
      parent.insertBefore(paragraph, pre.nextSibling);
    } else {
      parent.replaceChild(paragraph, pre);
    }

    return paragraph;
  }, [createParagraphFromText, readCodeText]);

  const insertCodeNewline = useCallback((range, selection) => {
    insertSoftBreak(range, selection);
  }, [insertSoftBreak]);

  const highlightEditorCode = useCallback((code, language) => {
    if (!code) return;
    const text = readCodeText(code);
    const canHighlight = language && language !== "plaintext" && hljs.getLanguage(language);
    const selection = window.getSelection?.();
    let caretOffset = null;

    if (selection?.rangeCount && code.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      const caretRange = document.createRange();
      caretRange.selectNodeContents(code);
      caretRange.setEnd(range.startContainer, range.startOffset);
      caretOffset = caretRange.toString().length;
    }

    if (canHighlight) {
      code.innerHTML = hljs.highlight(text, { language }).value;
    } else {
      code.textContent = text;
    }

    if (caretOffset == null) return;
    const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
    let remaining = caretOffset;
    let node = walker.nextNode();
    while (node) {
      if (remaining <= node.textContent.length) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      remaining -= node.textContent.length;
      node = walker.nextNode();
    }

    const range = document.createRange();
    range.selectNodeContents(code);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }, [readCodeText]);

  const applyCodeLanguage = useCallback((language) => {
    if (disabled || !ref.current) return;
    if (!focusEditorSelection()) return;
    const block = findBlock() || ensureBlock();
    if (!block) return;

    editingRef.current = true;
    let codeBlock = block;
    let code = block.querySelector?.("code");

    if (block.tagName !== "PRE") {
      const pre = document.createElement("pre");
      pre.className = "editor-code-block";
      code = document.createElement("code");
      const text = block.innerText || block.textContent || "";
      code.textContent = text;
      if (!text) code.innerHTML = "<br>";
      pre.setAttribute("data-language-label", "Code");
      pre.appendChild(code);
      block.replaceWith(pre);
      codeBlock = pre;
    }

    code = code || codeBlock.querySelector("code");
    if (!code) {
      editingRef.current = false;
      return;
    }

    Array.from(code.classList)
      .filter((name) => name.startsWith("language-"))
      .forEach((name) => code.classList.remove(name));

    if (language) code.classList.add("language-" + language);
    codeBlock.setAttribute(
      "data-language-label",
      language ? getCodeLanguageLabel(language) : "Code"
    );
    highlightEditorCode(code, language);
    placeCaretAtEnd(code);
    saveSelection();
    editingRef.current = false;
    emit();
    updateActiveFormats();
    setCodeMenuAnchor(null);
  }, [
    disabled,
    emit,
    ensureBlock,
    findBlock,
    focusEditorSelection,
    highlightEditorCode,
    placeCaretAtEnd,
    saveSelection,
    updateActiveFormats,
  ]);

  const openCodeLanguageMenu = (event) => {
    if (disabled) return;
    saveSelection();
    setCodeMenuAnchor(event.currentTarget);
  };

  const setCodeLanguage = (language) => {
    applyCodeLanguage(language);
  };

  const toggleCode = () => {
    if (disabled || !ref.current) return;
    if (!focusEditorSelection()) return;
    const selection = window.getSelection?.();
    const block = findBlock() || ensureBlock();
    if (!selection || !block) return;

    editingRef.current = true;
    if (block.tagName === "PRE") {
      const paragraph = convertCodeBlockToParagraph(block);
      if (paragraph) placeCaretAtEnd(paragraph);
    } else {
      const pre = document.createElement("pre");
      pre.className = "editor-code-block";
      const code = document.createElement("code");
      const text = block.innerText || block.textContent || "";
      code.textContent = text;
      if (!text) code.innerHTML = "<br>";
      pre.appendChild(code);
      block.replaceWith(pre);
      placeCaretAtEnd(code);
    }
    saveSelection();
    editingRef.current = false;
    emit();
    updateActiveFormats();
  };

  const toggleList = (ordered) => {
    if (disabled || !ref.current) return;
    if (!focusEditorSelection()) return;

    const editor = ref.current;
    const selection = window.getSelection?.();
    if (!selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    const anchorBlock = findBlock() || ensureBlock();
    if (!anchorBlock || anchorBlock.tagName === "PRE") return;

    const candidates = Array.from(
      editor.querySelectorAll("p, div, li, blockquote, h1, h2, h3, h4")
    ).filter((node) => {
      try {
        return range.collapsed
          ? node === anchorBlock
          : range.intersectsNode(node);
      } catch {
        return false;
      }
    });

    const selected = new Set(candidates);
    const blocks = candidates.filter((node) => {
      let ancestor = node.parentElement;
      while (ancestor && ancestor !== editor) {
        if (selected.has(ancestor)) return false;
        ancestor = ancestor.parentElement;
      }
      return true;
    });

    const targets = blocks.length ? blocks : [anchorBlock];
    const alignments = targets.map((block) => getBlockAlignment(block));
    const desiredListTag = ordered ? "OL" : "UL";

    editingRef.current = true;
    let applied = false;
    try {
      const command = ordered ? "insertOrderedList" : "insertUnorderedList";
      applied = Boolean(document.execCommand(command, false, null));
    } catch {
      applied = false;
    }

    if (!applied) {
      const block = targets[0];
      if (block.tagName === "LI" && block.parentElement?.tagName === desiredListTag) {
        const p = document.createElement("p");
        p.innerHTML = block.innerHTML || "<br>";
        copyBlockAlignment(block, p);
        const listParent = block.parentElement.parentNode;
        if (listParent) {
          if (block === block.parentElement.firstElementChild) {
            block.parentElement.before(p);
          } else {
            block.parentElement.after(p);
          }
          block.remove();
          if (!block.parentElement?.children.length) {
            block.parentElement?.remove();
          }
          placeCaretAtEnd(p);
        }
      } else {
        const listElement = document.createElement(ordered ? "ol" : "ul");
        targets.forEach((block, index) => {
          const item = document.createElement("li");
          item.innerHTML = block.innerHTML || "<br>";
          setBlockAlignment(item, alignments[index] || "left");
          listElement.appendChild(item);
        });
        const first = targets[0];
        first.parentNode?.insertBefore(listElement, first);
        targets.forEach((block) => block.remove());
        placeCaretAtEnd(listElement.lastElementChild || listElement);
      }
    } else {
      const resultingItems = Array.from(editor.querySelectorAll("li"));
      if (targets.length === 1) {
        const current = findBlock();
        if (current?.tagName === "LI") {
          setBlockAlignment(current, alignments[0]);
        }
      } else if (resultingItems.length >= targets.length) {
        const recent = resultingItems.slice(-targets.length);
        recent.forEach((item, index) => setBlockAlignment(item, alignments[index] || "left"));
      }
    }

    saveSelection();
    editingRef.current = false;
    emit();
    updateActiveFormats();
  };

  const openLink = () => {
    if (disabled) return;
    saveSelection();
    const range = savedRange.current;
    const node = range?.startContainer?.nodeType === Node.ELEMENT_NODE ? range.startContainer : range?.startContainer?.parentElement;
    const anchor = node?.closest?.("a");
    setLinkUrl(anchor?.getAttribute("href") || "");
    setLinkText((range?.toString() || anchor?.textContent || "").trim());
    setLinkAnchor(document.activeElement);
  };

  const validLink = /^(?:https?:\/\/|mailto:|\/|#)/i.test(linkUrl.trim());
  const applyLink = () => {
    if (disabled || !validLink) return;
    ref.current?.focus();
    if (!restoreSelection()) return;
    editingRef.current = true;
    const range = savedRange.current;
    if (range && !range.collapsed) {
      try { document.execCommand("createLink", false, linkUrl.trim()); } catch { /* noop */ }
      const selection = window.getSelection?.();
      const node = selection?.anchorNode?.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection?.anchorNode?.parentElement;
      const anchor = node?.closest?.("a");
      if (anchor) { anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; }
    } else if (range && linkText.trim()) {
      const a = document.createElement("a");
      a.href = linkUrl.trim(); a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = linkText.trim();
      range.insertNode(a);
      const caret = document.createRange(); caret.setStartAfter(a); caret.collapse(true);
      const selection = window.getSelection?.(); selection?.removeAllRanges(); selection?.addRange(caret);
    }
    setLinkAnchor(null); saveSelection(); editingRef.current = false; emit();
  };

  const removeLink = () => {
    if (disabled) return;
    ref.current?.focus();
    if (!restoreSelection()) return;
    editingRef.current = true;
    try { document.execCommand("unlink", false, null); } catch { /* noop */ }
    setLinkAnchor(null); saveSelection(); editingRef.current = false; emit();
  };

  const toggleQuote = () => {
    if (disabled || !ref.current) return;
    if (!focusEditorSelection()) return;
    const block = findBlock() || ensureBlock();
    if (!block || block.tagName === "PRE") return;

    editingRef.current = true;
    if (block.tagName === "BLOCKQUOTE") {
      const p = document.createElement("p");
      p.innerHTML = block.innerHTML || "<br>";
      block.replaceWith(p);
      placeCaretAtEnd(p);
    } else if (block.tagName === "LI") {
      const quote = document.createElement("blockquote");
      quote.innerHTML = block.innerHTML || "<br>";
      block.innerHTML = "";
      block.appendChild(quote);
      placeCaretAtEnd(quote);
    } else {
      const quote = document.createElement("blockquote");
      quote.innerHTML = block.innerHTML || "<br>";
      block.replaceWith(quote);
      placeCaretAtEnd(quote);
    }
    saveSelection();
    editingRef.current = false;
    emit();
    updateActiveFormats();
  };

  const onKeyDown = (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    saveSelection();
    const mod = e.ctrlKey || e.metaKey;
    if (mod && ["b", "i", "u"].includes(e.key.toLowerCase())) {
      e.preventDefault();
      toggleInlineFormat({ b: "bold", i: "italic", u: "underline" }[e.key.toLowerCase()]);
      return;
    }
    if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); openLink(); return; }
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
    if (e.key !== "Enter") return;
    if (e.isComposing || e.keyCode === 229) return;
    const selection = window.getSelection?.();
    const anchor = selection?.anchorNode?.nodeType === Node.ELEMENT_NODE
      ? selection.anchorNode
      : selection?.anchorNode?.parentElement;
    const pre = anchor?.closest?.("pre");
    const quote = anchor?.closest?.("blockquote");

    if (pre && selection?.rangeCount) {
      const range = selection.getRangeAt(0).cloneRange();
      if (range.collapsed && pre.contains(range.startContainer)) {
        e.preventDefault();
        editingRef.current = true;

        if (e.shiftKey) {
          insertCodeNewline(range, selection);
          saveSelection();
          editingRef.current = false;
          emit();
          return;
        }

        const paragraph = splitCodeBlockAtCaret(pre, range);
        if (paragraph) placeCaretAtStart(paragraph);

        saveSelection();
        editingRef.current = false;
        emit();
        updateActiveFormats();
        return;
      }
    }

    if (quote && selection?.rangeCount) {
      const range = selection.getRangeAt(0).cloneRange();
      if (range.collapsed && quote.contains(range.startContainer)) {
        e.preventDefault();
        editingRef.current = true;

        if (e.shiftKey) {
          insertSoftBreak(range, selection);
        } else {
          const paragraph = splitQuoteAtCaret(quote, range);
          if (paragraph) placeCaretAtStart(paragraph);
        }

        saveSelection();
        editingRef.current = false;
        emit();
        updateActiveFormats();
        return;
      }
    }

    const li = anchor?.closest?.("li");
    if (li && !li.textContent.trim()) {
      e.preventDefault();
      const list = li.parentElement;
      const p = document.createElement("p"); p.innerHTML = "<br>";
      list.after(p); li.remove(); if (!list.children.length) list.remove();
      const caret = document.createRange(); caret.selectNodeContents(p); caret.collapse(false); selection.removeAllRanges(); selection.addRange(caret);
      saveSelection(); emit();
      return;
    }

    // Default: Enter inserts a new line (do not send).
    // Only send on Enter when enterSends=true and Shift is NOT held.
    if (enterSends && !e.shiftKey && onSubmit) {
      e.preventDefault();
      e.stopPropagation();
      if (ref.current) {
        const html = ref.current.innerHTML;
        lastHtml.current = html;
        onChange?.(html);
        onSubmit(html);
      } else {
        onSubmit();
      }
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        opacity: disabled ? 0.6 : 1,
        flex: 1,
        minWidth: 0,
        borderRadius: compact ? 2 : 1,
        overflow: "hidden",
      }}
    >
      {showToolbarToggle && (
        <Collapse in={expanded}>
          <Box sx={{ px: 0.75, py: 0.1, borderBottom: 1, borderColor: "divider", bgcolor: "action.hover" }}>
            <ButtonGroup size="small" variant="text">
              <Tooltip title="Bold"><span><IconButton size="small" aria-label="Bold" aria-pressed={activeFormats.bold} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => toggleInlineFormat("bold")} disabled={disabled} sx={{ bgcolor: activeFormats.bold ? "action.selected" : undefined, color: activeFormats.bold ? "primary.main" : undefined }}><FormatBoldIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Italic"><span><IconButton size="small" aria-label="Italic" aria-pressed={activeFormats.italic} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => toggleInlineFormat("italic")} disabled={disabled} sx={{ bgcolor: activeFormats.italic ? "action.selected" : undefined, color: activeFormats.italic ? "primary.main" : undefined }}><FormatItalicIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Underline"><span><IconButton size="small" aria-label="Underline" aria-pressed={activeFormats.underline} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => toggleInlineFormat("underline")} disabled={disabled} sx={{ bgcolor: activeFormats.underline ? "action.selected" : undefined, color: activeFormats.underline ? "primary.main" : undefined }}><FormatUnderlinedIcon fontSize="small" /></IconButton></span></Tooltip>
<Tooltip title="Bullets"><span><IconButton size="small" aria-label="Bulleted list" aria-pressed={activeFormats.bullet} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => toggleList(false)} disabled={disabled} sx={{ bgcolor: activeFormats.bullet ? "action.selected" : undefined, color: activeFormats.bullet ? "primary.main" : undefined }}><FormatListBulletedIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Numbered"><span><IconButton size="small" aria-label="Numbered list" aria-pressed={activeFormats.ordered} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => toggleList(true)} disabled={disabled} sx={{ bgcolor: activeFormats.ordered ? "action.selected" : undefined, color: activeFormats.ordered ? "primary.main" : undefined }}><FormatListNumberedIcon fontSize="small" /></IconButton></span></Tooltip>
              <Box sx={{ display: "inline-flex", alignItems: "center", mx: 0.25 }}>
                <Button
                  size="small"
                  aria-label="Code block"
                  aria-pressed={activeFormats.code}
                  startIcon={<CodeIcon fontSize="small" />}
                  onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
                  onClick={toggleCode}
                  disabled={disabled}
                  sx={{
                    minWidth: 0,
                    px: 1,
                    height: 30,
                    textTransform: "none",
                    fontSize: 12,
                    fontWeight: 700,
                    bgcolor: activeFormats.code ? "action.selected" : undefined,
                    color: activeFormats.code ? "primary.main" : undefined,
                  }}
                >
                  Code
                </Button>
                <IconButton
                  size="small"
                  aria-label="Choose code language"
                  aria-haspopup="menu"
                  aria-expanded={Boolean(codeMenuAnchor)}
                  onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
                  onClick={openCodeLanguageMenu}
                  disabled={disabled}
                  sx={{
                    width: 24,
                    height: 30,
                    borderRadius: "0 7px 7px 0",
                    bgcolor: activeFormats.code ? "action.selected" : undefined,
                    color: activeFormats.code ? "primary.main" : undefined,
                  }}
                >
                  <ArrowDropDownIcon fontSize="small" />
                </IconButton>
              </Box>
              <Tooltip title="Quote"><span><IconButton size="small" aria-label="Quote" aria-pressed={activeFormats.quote} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={toggleQuote} disabled={disabled} sx={{ bgcolor: activeFormats.quote ? "action.selected" : undefined, color: activeFormats.quote ? "primary.main" : undefined }}><FormatQuoteIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Link"><span><IconButton size="small" aria-label="Link" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={openLink} disabled={disabled}><LinkIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Align left"><span><IconButton size="small" aria-label="Align left" aria-pressed={activeFormats.align === "left"} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => applyAlignment("left")} disabled={disabled} sx={{ bgcolor: activeFormats.align === "left" ? "action.selected" : undefined, color: activeFormats.align === "left" ? "primary.main" : undefined }}><FormatAlignLeftIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Align center"><span><IconButton size="small" aria-label="Align center" aria-pressed={activeFormats.align === "center"} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => applyAlignment("center")} disabled={disabled} sx={{ bgcolor: activeFormats.align === "center" ? "action.selected" : undefined, color: activeFormats.align === "center" ? "primary.main" : undefined }}><FormatAlignCenterIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Align right"><span><IconButton size="small" aria-label="Align right" aria-pressed={activeFormats.align === "right"} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => applyAlignment("right")} disabled={disabled} sx={{ bgcolor: activeFormats.align === "right" ? "action.selected" : undefined, color: activeFormats.align === "right" ? "primary.main" : undefined }}><FormatAlignRightIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip
                title="Heading style"
                disableHoverListener={blockMenuOpen}
                disableFocusListener={blockMenuOpen}
                disableTouchListener={blockMenuOpen}
              >
                <span><FormControl size="small" sx={{ minWidth: 112, mx: 0.25 }}><Select
                aria-label="Block style"
                value={["P", "H1", "H2", "H3", "H4"].includes(activeFormats.block) ? activeFormats.block : "P"}
                onChange={(e) => applyBlockFormat(e.target.value)}
                onOpen={() => setBlockMenuOpen(true)}
                onClose={() => setBlockMenuOpen(false)}
                onMouseDown={() => saveSelection()}
                IconComponent={FormatSizeIcon}
                sx={{ height: 30, fontSize: 12, fontWeight: 700 }}
                disabled={disabled}
              >
                <MenuItem value="P">Paragraph</MenuItem>
                <MenuItem value="H1">Heading 1</MenuItem>
                <MenuItem value="H2">Heading 2</MenuItem>
                <MenuItem value="H3">Heading 3</MenuItem>
                <MenuItem value="H4">Heading 4</MenuItem>
              </Select></FormControl></span></Tooltip>
              <Tooltip title="Undo"><span><IconButton size="small" aria-label="Undo" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={undo} disabled={disabled || historyIndexRef.current <= 0} sx={{ opacity: historyIndexRef.current <= 0 ? 0.45 : 1 }}><UndoIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Redo"><span><IconButton size="small" aria-label="Redo" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={redo} disabled={disabled || historyIndexRef.current >= historyRef.current.length - 1} sx={{ opacity: historyIndexRef.current >= historyRef.current.length - 1 ? 0.45 : 1 }}><RedoIcon fontSize="small" /></IconButton></span></Tooltip>
            </ButtonGroup>
          </Box>
        </Collapse>
      )}

      <Menu
        anchorEl={codeMenuAnchor}
        open={Boolean(codeMenuAnchor)}
        onClose={() => setCodeMenuAnchor(null)}
        MenuListProps={{ dense: true }}
        slotProps={{ paper: { sx: { minWidth: 190, maxHeight: 420 } } }}
      >
        {CODE_LANGUAGES.map((language) => (
          <MenuItem
            key={language.value || "auto"}
            selected={activeFormats.language === language.value}
            onClick={() => setCodeLanguage(language.value)}
          >
            {language.label}
          </MenuItem>
        ))}
      </Menu>

      <Box sx={{ display: "flex", alignItems: "flex-end" }}>
        <Box
          ref={ref}
          contentEditable={!disabled}
          dir="auto"
          suppressContentEditableWarning
          onInput={() => { editingRef.current = true; emit(); saveSelection(); requestAnimationFrame(() => { editingRef.current = false; }); }}
          onFocus={saveSelection}
          onBlur={() => { saveSelection(); emit(); }}
          onKeyUp={() => {
            saveSelection();
            const selection = window.getSelection?.();
            const anchor = selection?.anchorNode?.nodeType === Node.ELEMENT_NODE
              ? selection.anchorNode
              : selection?.anchorNode?.parentElement;
            const code = anchor?.closest?.("code");
            const language = getCodeLanguage(code);
            if (code && language && language !== "plaintext") {
              requestAnimationFrame(() => highlightEditorCode(code, language));
            }
          }}
          onMouseUp={saveSelection}
          onKeyDown={onKeyDown}
          onPaste={(e) => { const text = e.clipboardData?.getData("text/plain"); if (text == null) return; e.preventDefault(); const selection = window.getSelection?.(); if (!selection?.rangeCount) return; const range = selection.getRangeAt(0); range.deleteContents(); const parts = text.replace(/\r\n?/g, "\n").split("\n"); parts.forEach((part, i) => { if (i) range.insertNode(document.createElement("br")); if (part) range.insertNode(document.createTextNode(part)); range.collapse(false); }); saveSelection(); emit(); }}
          data-placeholder={placeholder}
          sx={{
            flex: 1,
            minHeight: expanded ? Math.max(minHeight, 72) : minHeight,
            maxHeight: expanded ? Math.max(maxHeight, 220) : maxHeight,
            overflow: "auto",
            px: 1.5,
            py: compact ? 1 : 1.25,
            outline: "none",
            fontSize: "14px",
            lineHeight: 1.45,
            "& p, & li, & blockquote": { fontSize: "14px" },
            "&:empty:before": {
              content: "attr(data-placeholder)",
              color: "text.disabled",
            },
            "& p": { m: 0 },
            "& .ticket-align-left": { textAlign: "left" },
            "& .ticket-align-center": { textAlign: "center" },
            "& .ticket-align-right": { textAlign: "right" },
            "& pre.editor-code-block": {
              m: "0.65rem 0",
              p: 0,
              borderRadius: 0.75,
              overflow: "auto",
              bgcolor: "#0b1220",
              border: "1px solid",
              borderColor: "rgba(120,140,170,0.22)",
              whiteSpace: "pre",
            },
            "& pre.editor-code-block::before": {
              content: "attr(data-language-label)",
              display: "block",
              px: 1,
              py: 0.45,
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.48)",
              bgcolor: "rgba(255,255,255,0.045)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            },
            "& pre.editor-code-block > code": {
              display: "block",
              p: 1.25,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 12.5,
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.9)",
              whiteSpace: "pre",
              "& .hljs-comment, & .hljs-quote": { opacity: 0.65 },
              "& .hljs-keyword, & .hljs-selector-tag, & .hljs-literal": { fontWeight: 700 },
              "& .hljs-string, & .hljs-attr, & .hljs-title": { fontWeight: 600 },
            },
            "& ul, & ol": { pl: 2.25, my: 0.4 },
            "& blockquote": {
              m: "0.65rem 0",
              pl: 1.5,
              pr: 1,
              py: 0.8,
              borderLeft: "3px solid",
              borderColor: "primary.main",
              borderRadius: "0 8px 8px 0",
              bgcolor: "action.hover",
              color: "text.secondary",
              fontStyle: "italic",
              position: "relative",
            },
            "& blockquote::before": {
              content: '"“"',
              position: "absolute",
              left: 6,
              top: -4,
              fontSize: 28,
              fontWeight: 800,
              lineHeight: 1,
              color: "primary.main",
              opacity: 0.65,
            },
            "& a": { color: "primary.main" },
          }}
        />
        {showToolbarToggle && (
          <Tooltip title={expanded ? "Hide formatting" : "Formatting"}>
            <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ mb: 0.5, mr: 0.5 }}>
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Popover
        open={Boolean(linkAnchor)}
        anchorEl={linkAnchor}
        onClose={() => setLinkAnchor(null)}
        slotProps={{ paper: { sx: { p: 1.5, width: { xs: 300, sm: 360 }, maxWidth: "calc(100vw - 24px)" } } }}
      >
        <Stack spacing={1}>
          <Typography variant="subtitle2" fontWeight={800}>Insert link</Typography>
          <TextField size="small" autoFocus label="URL" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} error={Boolean(linkUrl) && !validLink} helperText="HTTP(S), mailto, or internal link" />
          <TextField size="small" label="Text" value={linkText} onChange={(e) => setLinkText(e.target.value)} />
          <Stack direction="row" justifyContent="space-between" spacing={1}>
            <Button size="small" color="error" onClick={removeLink} disabled={!linkUrl.trim()}>Remove</Button>
            <Stack direction="row" spacing={0.5}>
              <Button size="small" onClick={() => setLinkAnchor(null)}>Cancel</Button>
              <Button size="small" variant="contained" onClick={applyLink} disabled={!validLink}>Apply</Button>
            </Stack>
          </Stack>
        </Stack>
      </Popover>
    </Paper>
  );
}

export function htmlToPlain(html) {
  if (html == null || html === "") return "";
  // Guard against objects (avoids innerHTML becoming "[object Object]")
  let s = html;
  if (typeof html !== "string") {
    if (typeof html === "object") {
      s =
        (typeof html.html === "string" && html.html) ||
        (typeof html.body === "string" && html.body) ||
        (typeof html.text === "string" && html.text) ||
        (typeof html.content === "string" && html.content) ||
        "";
    } else {
      s = String(html);
    }
  }
  if (!s) return "";
  const d = document.createElement("div");
  d.innerHTML = s;
  return (d.textContent || d.innerText || "").trim();
}

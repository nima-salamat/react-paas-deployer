import React, { useCallback, useRef, useState } from "react";
import { Box, Button, ButtonGroup, Collapse, IconButton, Paper, Popover, Stack, TextField, Tooltip, Typography } from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import CodeIcon from "@mui/icons-material/Code";
import LinkIcon from "@mui/icons-material/Link";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

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
  expanded: expandedProp,
  onExpandedChange,
}) {
  const ref = useRef(null);
  const lastHtml = useRef(value || "");
  const savedRange = useRef(null);
  const editingRef = useRef(false);
  const [linkAnchor, setLinkAnchor] = useState(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [internalExpanded, setInternalExpanded] = useState(Boolean(expandedProp));
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
    lastHtml.current = incoming;
  }, [value]);

  const saveSelection = useCallback(() => {
    const editor = ref.current;
    const selection = window.getSelection?.();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange();
  }, []);

  const emit = useCallback(() => {
    if (!ref.current) return;
    const html = ref.current.innerHTML.replace(/^(?:<div><br><\/div>|<br>)$/i, "");
    lastHtml.current = html;
    onChange?.(html);
  }, [onChange]);

  const restoreSelection = () => {
    const editor = ref.current;
    const selection = window.getSelection?.();
    const range = savedRange.current;
    if (!editor || !selection || !range || !editor.contains(range.commonAncestorContainer)) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  };

  const cmd = (command, arg = null) => {
    if (disabled) return;
    editingRef.current = true;
    ref.current?.focus();
    restoreSelection();
    try { document.execCommand(command, false, arg); } catch { /* noop */ }
    saveSelection();
    editingRef.current = false;
    emit();
  };

  const findBlock = useCallback(() => {
    const editor = ref.current;
    const selection = window.getSelection?.();
    if (!editor || !selection || !selection.rangeCount) return null;
    const node = selection.anchorNode;
    let block = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    while (block && block !== editor && !["P", "DIV", "PRE", "LI", "BLOCKQUOTE"].includes(block.tagName)) {
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
    } else if (target.nodeType === Node.TEXT_NODE) {
      target.replaceWith(wrapper);
      wrapper.appendChild(target);
    } else {
      target.replaceWith(wrapper);
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

  const toggleCode = () => {
    if (disabled || !ref.current) return;
    restoreSelection();
    const selection = window.getSelection?.();
    const block = findBlock() || ensureBlock();
    if (!selection || !block) return;

    editingRef.current = true;
    if (block.tagName === "PRE") {
      const p = document.createElement("p");
      p.textContent = block.textContent || "";
      if (!p.textContent) p.innerHTML = "<br>";
      block.replaceWith(p);
      placeCaretAtEnd(p);
    } else {
      const pre = document.createElement("pre");
      pre.textContent = block.textContent || "";
      if (!pre.textContent) pre.innerHTML = "<br>";
      block.replaceWith(pre);
      placeCaretAtEnd(pre);
    }
    saveSelection();
    editingRef.current = false;
    emit();
  };

  const toggleList = (ordered) => {
    if (disabled || !ref.current) return;
    restoreSelection();
    const block = findBlock() || ensureBlock();
    if (!block || block.tagName === "PRE") return;

    editingRef.current = true;
    try {
      const command = ordered ? "insertOrderedList" : "insertUnorderedList";
      const applied = document.execCommand(command, false, null);
      if (!applied) throw new Error("List command unavailable");
    } catch {
      const selection = window.getSelection?.();
      if (!selection) return;
      const existing = block.tagName === "LI" ? block.parentElement : null;
      if (existing && existing.tagName === (ordered ? "OL" : "UL")) {
        const p = document.createElement("p");
        p.innerHTML = block.innerHTML || "<br>";
        const parent = existing.parentElement;
        if (!parent) return;
        if (existing.children.length === 1) {
          existing.replaceWith(p);
        } else if (block === existing.firstElementChild) {
          existing.removeChild(block);
          parent.insertBefore(p, existing);
        } else if (block === existing.lastElementChild) {
          existing.removeChild(block);
          parent.insertBefore(p, existing.nextSibling);
        } else {
          const after = document.createElement(existing.tagName.toLowerCase());
          while (block.nextSibling) after.appendChild(block.nextSibling);
          existing.removeChild(block);
          existing.after(p);
          if (after.children.length) p.after(after);
        }
        placeCaretAtEnd(p);
      } else {
        const list = document.createElement(ordered ? "ol" : "ul");
        const item = document.createElement("li");
        item.innerHTML = block.innerHTML || "<br>";
        list.appendChild(item);
        block.replaceWith(list);
        placeCaretAtEnd(item);
      }
    }
    saveSelection();
    editingRef.current = false;
    emit();
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
    restoreSelection();
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
  };

  const onKeyDown = (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    saveSelection();
    const mod = e.ctrlKey || e.metaKey;
    if (mod && ["b", "i", "u"].includes(e.key.toLowerCase())) {
      e.preventDefault();
      cmd({ b: "bold", i: "italic", u: "underline" }[e.key.toLowerCase()]);
      return;
    }
    if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); openLink(); return; }
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); cmd(e.shiftKey ? "redo" : "undo"); return; }
    if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); cmd("redo"); return; }
    if (e.key !== "Enter") return;
    if (e.isComposing || e.keyCode === 229) return;
    const selection = window.getSelection?.();
    const anchor = selection?.anchorNode?.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection?.anchorNode?.parentElement;
    const pre = anchor?.closest?.("pre");
    if (pre && !e.shiftKey) {
      const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
      if (range) {
        range.setStart(pre, 0);
        if (!range.toString().split("\n").pop()?.trim()) {
          e.preventDefault();
          const p = document.createElement("p"); p.innerHTML = "<br>"; pre.after(p);
          const caret = document.createRange(); caret.selectNodeContents(p); caret.collapse(false); selection.removeAllRanges(); selection.addRange(caret);
          saveSelection(); emit();
          return;
        }
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
          <Box sx={{ px: 0.25, py: 0.1, borderBottom: 1, borderColor: "divider", bgcolor: "action.hover" }}>
            <ButtonGroup size="small" variant="text">
              <Tooltip title="Bold"><span><IconButton size="small" aria-label="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("bold")} disabled={disabled}><FormatBoldIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Italic"><span><IconButton size="small" aria-label="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("italic")} disabled={disabled}><FormatItalicIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Underline"><span><IconButton size="small" aria-label="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("underline")} disabled={disabled}><FormatUnderlinedIcon fontSize="small" /></IconButton></span></Tooltip>
<Tooltip title="Bullets"><span><IconButton size="small" aria-label="Bulleted list" onMouseDown={(e) => e.preventDefault()} onClick={() => toggleList(false)} disabled={disabled}><FormatListBulletedIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Numbered"><span><IconButton size="small" aria-label="Numbered list" onMouseDown={(e) => e.preventDefault()} onClick={() => toggleList(true)} disabled={disabled}><FormatListNumberedIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Code block"><span><IconButton size="small" aria-label="Code block" onMouseDown={(e) => e.preventDefault()} onClick={toggleCode} disabled={disabled}><CodeIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Quote"><span><IconButton size="small" aria-label="Quote" onMouseDown={(e) => e.preventDefault()} onClick={toggleQuote} disabled={disabled}><FormatQuoteIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Link"><span><IconButton size="small" aria-label="Link" onMouseDown={(e) => e.preventDefault()} onClick={openLink} disabled={disabled}><LinkIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Undo"><span><IconButton size="small" aria-label="Undo" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("undo")} disabled={disabled}><UndoIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Redo"><span><IconButton size="small" aria-label="Redo" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("redo")} disabled={disabled}><RedoIcon fontSize="small" /></IconButton></span></Tooltip>
            </ButtonGroup>
          </Box>
        </Collapse>
      )}
      <Box sx={{ display: "flex", alignItems: "flex-end" }}>
        <Box
          ref={ref}
          contentEditable={!disabled}
          dir="auto"
          suppressContentEditableWarning
          onInput={() => { editingRef.current = true; emit(); saveSelection(); requestAnimationFrame(() => { editingRef.current = false; }); }}
          onFocus={saveSelection}
          onBlur={() => { saveSelection(); emit(); }}
          onKeyUp={saveSelection}
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
            fontSize: 14,
            lineHeight: 1.45,
            "&:empty:before": {
              content: "attr(data-placeholder)",
              color: "text.disabled",
            },
            "& p": { m: 0 },
            "& pre": { bgcolor: "action.hover", p: 1, borderRadius: 1, overflow: "auto" },
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
          <TextField size="small" autoFocus label="URL" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} error={Boolean(linkUrl) && !validLink} helperText="HTTP(S), mailto, tel, or internal link" />
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

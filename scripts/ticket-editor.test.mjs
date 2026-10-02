import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("editor maintains an explicit undo/redo history", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /const historyRef = useRef\(\[value \|\| ""\]\)/);
  assert.match(source, /const recordHistory = useCallback/);
  assert.match(source, /const applyHistory = useCallback/);
  assert.match(source, /const undo = useCallback/);
  assert.match(source, /const redo = useCallback/);
  assert.match(source, /e\.shiftKey \? redo\(\) : undo\(\)/);
  assert.match(source, /defaultExpanded = false/);
});

test("toolbar reflects the active block and inline formatting", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /const updateActiveFormats = useCallback/);
  assert.match(source, /aria-pressed=\{activeFormats\.bold\}/);
  assert.match(source, /aria-pressed=\{activeFormats\.bullet\}/);
  assert.match(source, /aria-pressed=\{activeFormats\.ordered\}/);
  assert.match(source, /aria-pressed=\{activeFormats\.code\}/);
  assert.match(source, /aria-pressed=\{activeFormats\.quote\}/);
  assert.match(source, /const applyAlignment = useCallback/);
  assert.match(source, /ticket-align-center/);
  assert.match(source, /setBlockAlignment\(block, align\)/);
  assert.match(source, /activeFormats\.align === "center"/);
  assert.match(source, /FormatAlignRightIcon/);
  assert.match(source, /CODE_LANGUAGES/);
  assert.match(source, /Choose code language/);
  assert.match(source, /applyCodeLanguage/);
  assert.match(source, /highlightEditorCode/);
  assert.match(source, /requestAnimationFrame\(\(\) => highlightEditorCode/);
  assert.match(source, /px: 0\.75/);
  assert.match(source, /fontSize: "14px"/);
});

test("headings H1-H4 are supported as block formats", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /applyBlockFormat/);
  assert.match(source, /Heading 1/);
  assert.match(source, /Heading 2/);
  assert.match(source, /Heading 3/);
  assert.match(source, /Heading 4/);
  assert.match(source, /["P", "H1", "H2", "H3", "H4"]/);
});

test("ensureBlock never calls replaceWith on an arbitrary target node", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /parent\.replaceChild\(wrapper, target\)/);
  assert.doesNotMatch(source, /target\.replaceWith\(wrapper\)/);
});

test("code blocks exit through normal paragraphs and keep explicit newlines", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /const convertCodeBlockToParagraph = useCallback/);
  assert.match(source, /const exitCodeBlockAtEnd = useCallback/);
  assert.match(source, /const insertSoftBreak = useCallback/);
  assert.match(source, /const insertCodeNewline = useCallback/);
  assert.match(source, /splitCodeBlockAtCaret\(pre, range\)/);
  assert.match(source, /insertCodeNewline\(range, selection\)/);
});

test("message code renderer highlights and copies code without DOM replacement crashes", () => {
  const source = read("src/components/tickets/MessageBubble.jsx");

  assert.match(source, /highlightAuto/);
  assert.match(source, /data-code-copy/);
  assert.match(source, /getCodeLanguageLabel/);
  assert.match(source, /requestedLanguageLabel/);
  assert.match(source, /parent\.replaceChild\(shell, pre\)/);
  assert.match(source, /shell\.append\(header, pre\)/);
  assert.doesNotMatch(source, /pre\.parentNode\?\.replaceChild\(shell, pre\)/);
});

test("quote blocks have a distinct visual treatment", () => {
  const editor = read("src/components/tickets/SimpleHtmlEditor.jsx");
  const renderer = read("src/components/tickets/MessageBubble.jsx");

  assert.match(editor, /blockquote::before/);
  assert.match(editor, /fontStyle: "italic"/);
  assert.match(renderer, /blockquote::before/);
  assert.match(renderer, /fontStyle: "italic"/);
  assert.match(renderer, /const codeText = \(\(\) =>/);
  assert.match(renderer, /requestedLanguage === "plaintext"/);
  assert.match(renderer, /const codeText = \(\(\) =>/);
  assert.match(renderer, /borderRadius: "0 8px 8px 0"/);
});


test("Create Ticket uses defaultExpanded so the formatting toggle remains functional", () => {
  const source = read("src/components/tickets/CreateTicket.jsx");

  assert.match(source, /defaultExpanded/);
  assert.doesNotMatch(source, /expanded=\{true\}/);
});


test("ticket message code renderer keeps explicit language selection visible", () => {
  const source = read("src/components/tickets/MessageBubble.jsx");

  assert.match(source, /requestedLanguageLabel/);
  assert.match(source, /label\.textContent = requestedLanguage/);
});

test("ticket editor keeps the first toolbar control clear of the rounded corner", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /px: 0\.75, py: 0\.1/);
});


test("collapsed inline formatting is explicitly toggleable before typing", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /const toggleInlineFormat = \(command\) =>/);
  assert.match(source, /data-editor-typing-mark/);
  assert.match(source, /const boundary = document\.createTextNode\("\\u200B"\)/);
  assert.match(source, /active\.remove\(\)/);
  assert.match(source, /Boolean\(findInlineAncestor\("bold"\)\)/);
});

test("alignment applies directly to the containing and selected blocks", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /if \(range\.collapsed\)/);
  assert.match(source, /function getSelectedEditorBlocks/);
  assert.match(source, /blocks = getSelectedEditorBlocks\(editor, range\)/);
  assert.match(source, /setBlockAlignment\(block, align\)/);
  assert.match(source, /const current = findBlock\(\) \|\| ensureBlock\(\)/);
});


test("code block header label follows its selected language", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /getCodeLanguageLabel/);
  assert.match(source, /data-language-label/);
  assert.match(source, /content: "attr\(data-language-label\)"/);
  assert.match(source, /language \? getCodeLanguageLabel\(language\) : "Code"/);
});

test("paragraph selector has no Heading style tooltip that can overlap its menu", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.doesNotMatch(source, /const \[blockMenuOpen, setBlockMenuOpen\]/);
  assert.doesNotMatch(source, /title="Heading style"/);
  assert.doesNotMatch(source, /disableHoverListener=\{blockMenuOpen\}/);
  assert.doesNotMatch(source, /disableFocusListener=\{blockMenuOpen\}/);
  assert.doesNotMatch(source, /disableTouchListener=\{blockMenuOpen\}/);
  assert.match(source, /aria-label="Block style"/);
});


test("inline formatter does not evaluate later hook bindings during component initialization", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");
  const formatterStart = source.indexOf("const toggleInlineFormat =");
  const emitStart = source.indexOf("const emit = useCallback");

  assert.notEqual(formatterStart, -1);
  assert.notEqual(emitStart, -1);
  assert.ok(
    source.slice(formatterStart, formatterStart + 120).includes("const toggleInlineFormat = (command) =>"),
    "toggleInlineFormat must not be a useCallback whose dependency array references later bindings"
  );
});


test("alignment is persisted with allowlisted classes instead of stripped inline styles", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /const ALIGNMENT_CLASSES =/);
  assert.match(source, /ticket-align-left/);
  assert.match(source, /ticket-align-center/);
  assert.match(source, /ticket-align-right/);
  assert.match(source, /block\.style\?\.removeProperty\("text-align"\)/);
});

test("italic can exit cleanly at the end of an inline mark without leaving an empty formatted node", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /const afterFragment = afterRange\.extractContents\(\)/);
  assert.match(source, /const beforeFragment = beforeRange\.cloneContents\(\)/);
  assert.match(source, /const afterFragment = afterRange\.cloneContents\(\)/);
});

test("Create Ticket does not force the editor expanded state", () => {
  const source = read("src/components/tickets/CreateTicket.jsx");

  assert.doesNotMatch(source, /<SimpleHtmlEditor[\s\S]*?expanded\s*\/>/);
});


test("renderer uses adaptive quote contrast and renders persisted alignment classes", () => {
  const source = read("src/components/tickets/MessageBubble.jsx");

  assert.match(source, /borderColor: mine \? "rgba\(255,255,255,0\.62\)" : "divider"/);
  assert.match(source, /bgcolor: mine \? "rgba\(255,255,255,0\.09\)" : "action\.hover"/);
  assert.match(source, /"& \.ticket-align-center": \{ textAlign: "center" \}/);
  assert.match(source, /"& \.ticket-align-right": \{ textAlign: "right" \}/);
});


test("empty paragraphs can choose alignment before typing", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /const focusEditorSelection = useCallback/);
  assert.match(source, /const current = findBlock\(\) \|\| ensureBlock\(\)/);
  assert.match(source, /setBlockAlignment\(block, align\)/);
  assert.match(source, /ALIGNMENT_CLASSES/);
});

test("Enter exits code blocks while Shift+Enter inserts a soft line break inside them", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /const splitCodeBlockAtCaret = useCallback/);
  assert.match(source, /if \(e\.shiftKey\)/);
  assert.match(source, /insertCodeNewline\(range, selection\)/);
  assert.match(source, /splitCodeBlockAtCaret\(pre, range\)/);
});

test("Enter exits quote blocks while Shift+Enter remains inside the same quote", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /const splitQuoteAtCaret = useCallback/);
  assert.ok(source.includes('const quote = anchor?.closest?.("blockquote");'));
  assert.match(source, /insertSoftBreak\(range, selection\)/);
  assert.match(source, /splitQuoteAtCaret\(quote, range\)/);
  assert.doesNotMatch(source, /quote\.after\(document\.createElement\("blockquote"\)\)/);
});

test("list commands restore the editor selection before invoking browser list behavior", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");
  const start = source.indexOf("const toggleList =");
  const end = source.indexOf("const openLink =", start);
  const block = source.slice(start, end);

  assert.match(block, /if \(!focusEditorSelection\(\)\) return;/);
  assert.match(block, /document\.execCommand\(command/);
});


test("inline formatting creates an unformatted typing boundary when toggled off", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /const boundary = document\.createTextNode\("\\u200B"\)/);
  assert.match(source, /const beforeFragment = beforeRange\.cloneContents\(\)/);
  assert.match(source, /const afterFragment = afterRange\.cloneContents\(\)/);
  assert.match(source, /selection\.addRange\(caret\)/);
});

test("code and quote exits place the caret in the new paragraph", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /const placeCaretAtStart = useCallback/);
  assert.match(source, /if \(paragraph\) placeCaretAtStart\(paragraph\)/);
});

test("list conversion preserves paragraph alignment", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  const start = source.indexOf("const toggleList =");
  const end = source.indexOf("const openLink =", start);
  const block = source.slice(start, end);

  assert.match(block, /const alignments = targets\.map\(\(block\) => getBlockAlignment\(block\)\)/);
  assert.match(block, /setBlockAlignment\(item, alignments\[index\]/);
  assert.match(block, /const desiredListTag = ordered \? "OL" : "UL"/);
});


test("selection restoration is hook-safe and reusable by every toolbar action", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /const restoreSelection = useCallback/);
  assert.match(source, /const focusEditorSelection = useCallback/);
  assert.match(source, /\}, \[restoreSelection\]\);/);
});


test("ticket editor uses a smaller corner radius so the text field keeps more usable width", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /borderRadius: compact \? 1 : 1/);
});


test("quote formatting targets only the selected block range and preserves alignment/direction", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /function getSelectedEditorBlocks/);
  assert.match(source, /const targets = range\.collapsed/);
  assert.match(source, /copyBlockAlignment\(block, quoteBlock\)/);
  assert.match(source, /quoteBlock\.setAttribute\("dir", getEditorDirection\(block\)\)/);
});

test("editor blocks use automatic text direction for RTL/LTR content", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /setAttribute\("dir", "auto"\)/);
  assert.match(source, /unicodeBidi: "plaintext"/);
  assert.match(source, /function normalizeEditorDirection/);
});

test("an empty editor can create a paragraph and retain an initial alignment before typing", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /const current = findBlock\(\) \|\| ensureBlock\(\)/);
  assert.match(source, /blocks = \[current\]/);
  assert.match(source, /setBlockAlignment\(block, align\)/);
});


test("quote toggle tracks the exact first converted block", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /let firstResult = null/);
  assert.match(source, /if \(!firstResult\) firstResult = paragraph/);
  assert.match(source, /if \(!firstResult\) firstResult = quoteBlock/);
  assert.match(source, /placeCaretAtEnd\(firstResult \|\| currentBlock\)/);
});

test("RTL MUI selectors are syntactically valid and direction-aware", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /'& \[dir="rtl"\]'/);
  assert.match(source, /'& \[dir="ltr"\]'/);
  assert.match(source, /'& \[dir="auto"\]'/);
  assert.match(source, /unicodeBidi: "plaintext"/);
});


test("message renderer normalizes semantic alignment and RTL before injecting rich text", () => {
  const source = read("src/components/tickets/MessageBubble.jsx");

  assert.match(source, /function normalizeRichTextBlocks/);
  assert.match(source, /RICH_TEXT_ALIGNMENTS/);
  assert.match(source, /block\.style\.textAlign = alignment/);
  assert.match(source, /block\.style\.direction = direction/);
  assert.match(source, /normalizeRichTextBlocks\(root\)/);
});

test("message renderer visibly supports headings, lists and inline formatting", () => {
  const source = read("src/components/tickets/MessageBubble.jsx");

  assert.match(source, /"& h1, & h2, & h3, & h4"/);
  assert.match(source, /"& ul, & ol"/);
  assert.match(source, /"& strong, & b"/);
  assert.match(source, /"& em, & i"/);
  assert.match(source, /"& u"/);
});


test("ticket renderer scopes alignment and direction styles to semantic message blocks", () => {
  const source = read("src/components/tickets/MessageBubble.jsx");

  assert.match(source, /block\.style\.textAlign = alignment/);
  assert.match(source, /'& \[dir="rtl"\]'/);
  assert.match(source, /'& \[dir="ltr"\]'/);
  assert.match(source, /ticket-align-right/);
});

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
  assert.match(source, /onKeyUp=\{saveSelection\}/);
  assert.doesNotMatch(source, /requestAnimationFrame\(\(\) => highlightEditorCode/);
  assert.match(source, /overflowX: "auto"/);
  assert.match(source, /WebkitOverflowScrolling: "touch"/);
  assert.match(source, /minWidth: "max-content"/);
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

  assert.doesNotMatch(source, /highlightAuto/);
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

test("ticket editor toolbar is touch-scrollable without widening the page", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /overflowX: "auto"/);
  assert.match(source, /overflowY: "hidden"/);
  assert.match(source, /WebkitOverflowScrolling: "touch"/);
  assert.match(source, /overscrollBehaviorX: "contain"/);
  assert.match(source, /minWidth: "max-content"/);
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
  assert.match(source, /data-ticket-align=\\"center\\"/);
  assert.match(source, /data-ticket-align=\\"right\\"/);
  assert.match(source, /style\.setProperty\("text-align", alignment, "important"\)/);
  assert.match(source, /data-rendered-ticket-align/);
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
  assert.match(source, /const quote = anchor\?\.closest\?\.\("blockquote"\) \|\| rangeNode\?\.closest\?\.\("blockquote"\)/);
  assert.match(source, /insertSoftBreak\(range, selection\)/);
  assert.match(source, /splitQuoteAtCaret\(quote, quoteRange\)/);
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
  assert.match(source, /let targets = range\.collapsed/);
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
  assert.match(source, /style\.setProperty\("text-align", alignment, "important"\)/);
  assert.match(source, /block\.style\.setProperty\("direction", direction, "important"\)/);
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

  assert.match(source, /'& \[dir="rtl"\]'/);
  assert.match(source, /'& \[dir="ltr"\]'/);
  assert.match(source, /ticket-align-right/);
});


test("ticket message bubbles contain long rich-text content inside the bubble", () => {
  const source = read("src/components/tickets/MessageBubble.jsx");

  assert.match(source, /minWidth: 0/);
  assert.match(source, /boxSizing: "border-box"/);
  assert.match(source, /overflow: "hidden"/);
  assert.match(source, /overflowWrap: "anywhere"/);
  assert.match(source, /width: "100%"/);
  assert.match(source, /"& \*": \{ boxSizing: "border-box", maxWidth: "100%" \}/);
});

test("code blocks stay horizontally scrollable without pushing message content outside the bubble", () => {
  const source = read("src/components/tickets/MessageBubble.jsx");

  assert.match(source, /"& pre": \{/);
  assert.match(source, /"& \.ticket-code-shell pre": \{/);
  assert.match(source, /overflowX: "auto"/);
  assert.match(source, /maxWidth: "100%"/);
});


test("alignment can be chosen before any text exists and is inherited by the first typed block", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /const pendingAlignmentRef = useRef\("left"\)/);
  assert.match(source, /pendingAlignmentRef\.current = align/);
  assert.match(source, /pendingAlignmentRef\.current = align/);
  assert.match(source, /const block = findBlock\(\) \|\| ensureBlock\(\)/);
  assert.match(source, /setBlockAlignment\(block, currentAlignmentRef\.current\)/);
  assert.match(source, /align: block \? getBlockAlignment\(block\) : pendingAlignmentRef\.current/);
});


test("ticket renderer preserves ordered and unordered list semantics", () => {
  const source = read("src/components/tickets/MessageBubble.jsx");

  assert.match(source, /"& ul": \{/);
  assert.match(source, /listStyleType: "disc"/);
  assert.match(source, /"& ol": \{/);
  assert.match(source, /listStyleType: "decimal"/);
  assert.match(source, /display: "list-item"/);
});

test("ticket renderer does not auto-detect an unspecified code language", () => {
  const source = read("src/components/tickets/MessageBubble.jsx");

  assert.doesNotMatch(source, /highlightAuto\(codeText\)/);
  assert.match(source, /requestedLanguage === "plaintext"/);
  assert.match(source, /hljs\.highlight\(codeText, \{ language: requestedLanguage \}\)/);
});


test("empty editor can create code and quote blocks without a pre-existing selection", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /Toolbar actions must also work when the editor has never received text/);
  assert.match(source, /if \(!hasVisualContent && !structuralBlock\)/);
  assert.match(source, /const wrapper = document\.createElement\("p"\)/);
  assert.match(source, /const block = findBlock\(\) \|\| ensureBlock\(\)/);
  assert.match(source, /const quoteBlock = document\.createElement\("blockquote"\)/);
  assert.match(source, /const pre = document\.createElement\("pre"\)/);
});

test("alignment is explicit on an empty editor instead of relying on browser automatic alignment", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /setBlockAlignment\(emptyBlock, align\)/);
  assert.match(source, /pendingAlignmentRef\.current = "left"/);
  assert.doesNotMatch(source, /document\.execCommand\(["']justify/);
});


test("empty editor detection handles a browser-left <br> placeholder", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /const structuralBlock = editor\.querySelector\(EDITOR_BLOCK_SELECTOR\)/);
  assert.match(source, /const hasVisualContent = Boolean\(/);
  assert.match(source, /editor\.replaceChildren\(\)/);
  assert.match(source, /const wrapper = document\.createElement\("p"\)/);
  assert.match(source, /setBlockAlignment\(wrapper, pendingAlignmentRef\.current\)/);
});

test("editor defaults to explicit left alignment instead of automatic start alignment", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /lineHeight: 1\.45,[\s\S]*textAlign: "left"/);
});


test("rendered ticket messages do not impose a renderer-wide alignment default", () => {
  const source = read("src/components/tickets/MessageBubble.jsx");

  assert.match(source, /function getStoredAlignment/);
  assert.match(source, /style\.setProperty\("text-align", alignment, "important"\)/);
});


test("editor coalesces high-frequency history and selection renders", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /const historyRevisionFrameRef = useRef\(null\)/);
  assert.match(source, /historyRevisionFrameRef\.current = requestAnimationFrame/);
  assert.match(source, /cancelAnimationFrame\(frame\)/);
  assert.match(source, /frame = requestAnimationFrame\(\(\) =>/);
});

test("quote Enter creates a hard boundary in one keypress", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /!quote\.contains\(range\.startContainer\)/);
  assert.match(source, /paragraph\.setAttribute\("dir", getEditorDirection\(quote\)\)/);
  assert.match(source, /placeCaretAtStart\(paragraph\)/);
  assert.match(source, /ref\.current\?\.focus\(\{ preventScroll: true \}\)/);
});

test("chat composer coalesces draft updates without delaying Send", () => {
  const source = read("src/components/tickets/ChatComposer.jsx");

  assert.match(source, /const changeFrameRef = useRef\(null\)/);
  assert.match(source, /const scheduleChange = useCallback/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /valueRef\.current = nextValue/);
  assert.match(source, /onChange=\{scheduleChange\}/);
});

test("ticket messages are memoized so draft typing does not rerender the full message history", () => {
  const source = read("src/components/tickets/MessageBubble.jsx");

  assert.match(source, /export default React\.memo\(MessageBubble\)/);
});


test("quote Enter resolves the quote from either the anchor or range container", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /const range = selection\?\.rangeCount \? selection\.getRangeAt\(0\) : null/);
  assert.match(source, /const rangeNode = range\?\.commonAncestorContainer/);
  assert.match(source, /const quote = anchor\?\.closest\?\.\("blockquote"\) \|\| rangeNode\?\.closest\?\.\("blockquote"\)/);
  assert.match(source, /quote: false/);
  assert.match(source, /block: "P"/);
});


test("ticket renderer is source-faithful for explicit alignment and never invents dir=auto", () => {
  const source = read("src/components/tickets/MessageBubble.jsx");

  assert.match(source, /function getStoredAlignment/);
  assert.match(source, /data-ticket-align/);
  assert.match(source, /style\.setProperty\("text-align", alignment, "important"\)/);
  assert.match(source, /data-rendered-ticket-align/);
  assert.doesNotMatch(source, /block\.setAttribute\("dir", "auto"\)/);
  assert.doesNotMatch(source, /normalizeRichTextBlocks[\s\S]*textAlign: "left",/);
});

test("ticket renderer preserves ordered lists and aligns list items from stored alignment metadata", () => {
  const source = read("src/components/tickets/MessageBubble.jsx");

  assert.match(source, /block\.tagName === "OL"/);
  assert.match(source, /list-style-type", "decimal"/);
  assert.match(source, /block\.tagName === "LI"/);
  assert.match(source, /alignedItems/);
  assert.match(source, /list\.style\.setProperty\("text-align", alignedItems\[0\], "important"\)/);
  assert.match(source, /data-ticket-align=\\\"right\\\"/);
});


test("Create Ticket has a back arrow and uses the shared attachment preview below the attach control", () => {
  const source = read("src/components/tickets/CreateTicket.jsx");

  assert.match(source, /ArrowBackIcon/);
  assert.match(source, /Back to tickets/);
  assert.match(source, /PendingFilesBar/);
  assert.match(source, /onRemove=\{/);
  assert.match(source, /onClear=\{\(\) => setFiles\(\[\]\)\}/);
});

test("ticket list has an explicit Open button on desktop and mobile", () => {
  const source = read("src/components/tickets/TicketList.jsx");

  assert.match(source, /TableCell align="right">Action/);
  assert.match(source, /Open ticket/);
  assert.match(source, /e\.stopPropagation\(\)/);
  assert.match(source, /<TableCell colSpan=\{7\}>/);
});


test("normal Enter creates a new block that preserves the current alignment", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /const splitStandardBlockAtCaret = useCallback/);
  assert.match(source, /copyBlockAlignment\(block, next\)/);
  assert.match(source, /copyBlockDirection\(block, next\)/);
  assert.doesNotMatch(source, /enterSends/);
  assert.match(source, /const next = splitStandardBlockAtCaret\(currentBlock, range\)/);
  assert.match(source, /if \(next\) placeCaretAtStart\(next\)/);
});


test("editor block conversions preserve the selected alignment while typing", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /copyBlockAlignment\(block, next\)/);
  assert.match(source, /copyBlockDirection\(block, next\)/);
  assert.match(source, /copyBlockAlignment\(block, pre\)/);
  assert.match(source, /\.ticket-align-center": \{ textAlign: "center !important" \}/);
  assert.match(source, /\.ticket-align-right": \{ textAlign: "right !important" \}/);
});

test("normal editor line breaks remain source-aligned rather than browser-auto-aligned", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /const splitStandardBlockAtCaret = useCallback/);
  assert.match(source, /copyBlockAlignment\(block, next\)/);
  assert.doesNotMatch(source, /enterSends/);
});


test("editor preserves the selected alignment when contentEditable loses it during typing", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /function hasExplicitBlockAlignment/);
  assert.match(source, /const currentAlignmentRef = useRef\("left"\)/);
  assert.match(source, /currentAlignmentRef\.current = align/);
  assert.match(source, /if \(hasExplicitBlockAlignment\(block\)\)/);
  assert.match(source, /currentAlignmentRef\.current = getBlockAlignment\(block\)/);
  assert.match(source, /setBlockAlignment\(block, currentAlignmentRef\.current\)/);
  assert.match(source, /pendingAlignmentRef\.current = "left"/);
});


test("moving to an unaligned block resets the typing alignment to explicit left", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /if \(block\) \{[\s\S]*currentAlignmentRef\.current = getBlockAlignment\(block\)/);
  assert.match(source, /An unaligned block is[\s\S]*explicitly treated as left/);
});


test("toolbar preserves the editor selection on touch and avoids form submission", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /onPointerDown=\{\(e\) => \{ e\.preventDefault\(\); saveSelection\(\); \}\}/);
  assert.match(source, /<IconButton type="button"/);
  assert.match(source, /<Button\ntype="button"/);
});

test("typing history is coalesced instead of creating one undo snapshot per keystroke", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /const historyInputTimerRef = useRef\(null\)/);
  assert.match(source, /const scheduleHistory = useCallback/);
  assert.match(source, /historyInputTimerRef\.current = window\.setTimeout/);
  assert.match(source, /emit\(false\);\n            scheduleHistory\(\);/);
  assert.match(source, /onBlur=\{\(\) => \{ saveSelection\(\); commitHistory\(\); emit\(false\); \}\}/);
});

test("syntax highlighting is not recomputed on every keyup while editing a code block", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /onKeyUp=\{saveSelection\}/);
  assert.match(source, /const highlightEditorCode = useCallback/);
  assert.match(source, /highlightEditorCode\(code, language\)/);
  assert.doesNotMatch(source, /onKeyUp=\{\(\) => \{[\s\S]*highlightEditorCode/);
});


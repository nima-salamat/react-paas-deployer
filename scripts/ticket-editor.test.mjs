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
  assert.match(source, /activeFormats\.align === "center"/);
  assert.match(source, /FormatAlignRightIcon/);
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
  assert.match(source, /const newline = document\.createTextNode\("\\n"\)/);
  assert.match(source, /const atEnd = !afterRange\.toString\(\)/);
  assert.match(source, /const newline = trailingBreak/);
  assert.match(source, /insertCodeNewline\(range, selection, atEnd\)/);
});

test("message code renderer highlights and copies code without DOM replacement crashes", () => {
  const source = read("src/components/tickets/MessageBubble.jsx");

  assert.match(source, /highlightAuto/);
  assert.match(source, /data-code-copy/);
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
  assert.match(renderer, /borderRadius: "0 8px 8px 0"/);
});


test("Create Ticket uses defaultExpanded so the formatting toggle remains functional", () => {
  const source = read("src/components/tickets/CreateTicket.jsx");

  assert.match(source, /defaultExpanded/);
  assert.doesNotMatch(source, /expanded=\{true\}/);
});

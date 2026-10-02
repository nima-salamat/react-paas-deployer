import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("ticket rich-text editor handles unwrapped first-line blocks", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /const findBlock = useCallback/);
  assert.match(source, /const ensureBlock = useCallback/);
  assert.match(source, /const block = findBlock\(\) \|\| ensureBlock\(\)/);
});

test("code block exit detection uses real newlines", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /range\.toString\(\)\.split\("\\n"\)/);
  assert.doesNotMatch(source, /range\.toString\(\)\.split\("\\\\n"\)/);
});

test("list formatting does not replace an entire multi-item list", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /insertOrderedList/);
  assert.match(source, /insertUnorderedList/);
  assert.doesNotMatch(source, /existing\.replaceWith\(p\); block\.remove\(\)/);
});

test("quote formatting is a real toggle and is rendered", () => {
  const editor = read("src/components/tickets/SimpleHtmlEditor.jsx");
  const renderer = read("src/components/tickets/MessageBubble.jsx");

  assert.match(editor, /const toggleQuote = \(\) =>/);
  assert.match(editor, /onClick=\{toggleQuote\}/);
  assert.match(editor, /BLOCKQUOTE/);
  assert.match(renderer, /"& blockquote":/);
});

test("ticket link UI matches the backend-supported protocols", () => {
  const source = read("src/components/tickets/SimpleHtmlEditor.jsx");

  assert.match(source, /https\?:\\\/\\\/\|mailto:/);
  assert.doesNotMatch(source, /https\?:\\\/\\\/\|mailto:\|tel:/);
});

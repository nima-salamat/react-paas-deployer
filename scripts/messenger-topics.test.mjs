import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("forum topics are reachable as nested entries in the conversation sidebar", () => {
  const source = read("src/components/messenger/components/Sidebar.jsx");
  assert.match(source, /const forumTopics = c\.type === "group" && c\.is_forum/);
  assert.match(source, /const topicsExpanded = activeTopicInForum \|\| expandedForumIds\.has/);
  assert.match(source, /forumTopics\.map\(\(topic\) =>/);
  assert.match(source, /parent_conversation: c\.id/);
  assert.match(source, /onClick=\{\(\) => openChat\(\{/);
});

test("forum-topic creation uses the authenticated Messenger topics API", () => {
  const app = read("src/components/messenger/MessengerApp.jsx");
  const header = read("src/components/messenger/components/ChatHeader.jsx");
  const dialogs = read("src/components/messenger/components/MessengerDialogs.jsx");

  assert.match(app, /\/conversations\/\$\{parentId\}\/topics\//);
  assert.match(app, /onCreateTopic=/);
  assert.match(header, /Organize group into topics/);
  assert.match(header, /Choose a topic/);
  assert.match(header, /General/);
  assert.match(dialogs, /The existing conversation stays in General/);
});

test("topic switching preserves the existing API/detail loading path", () => {
  const app = read("src/components/messenger/MessengerApp.jsx");
  const header = read("src/components/messenger/components/ChatHeader.jsx");

  assert.match(app, /onSwitchTopic=/);
  assert.match(app, /void openChat\(listed \|\| topic\)/);
  assert.match(header, /onSwitchTopic\?\.\(topic\)/);
});

# Messenger modules

Small pure helpers extracted from large components to keep file size down.

| Module | Responsibility |
|--------|----------------|
| `msgCache.js` | SessionStorage message cache (slim + read/write) |
| `callSystemMessage.js` | Parse/format `__call__:` system message bodies |
| `messageGrouping.js` | Consecutive same-sender avatar/tail flags |
| `composerDrafts.js` | Local + server-synced composer drafts |
| `mergeConversations.js` | Conversation list merge |
| `groupDescDismiss.js` | Dismissed group description banners |
| `fileHelpers.js` | File/MIME helpers |

## Components (under `../components/`)

Large UI pieces already split: `MessageBubble`, `MessageComposer`, `JitsiCallModal`,
`Sidebar`, `RightPanel`, `MessengerDialogs`, etc.

## Hooks

- `useMessengerWebSocket` — WS connect + event dispatch
- `useKeyboardLayout` — mobile visualViewport keyboard

`MessengerApp.jsx` remains the orchestrator (state + loaders + actions + layout).
Further splits (ChatPane, useMessengerActions) can pull more out of it without
changing behaviour.

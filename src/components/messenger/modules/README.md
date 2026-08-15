# Messenger modules

Progressive split of `MessengerApp.jsx` into maintainable pieces.

| Module | Role |
|--------|------|
| `mergeConversations.js` | Stable list merge (no avatar remount) |
| `components/AddToContactsBanner.jsx` | Private-chat contact prompt |
| `components/GroupDescriptionBanner.jsx` | Group description strip |
| `components/JitsiCallModal.jsx` | Call UI (full / mini bar) |
| `components/Sidebar.jsx` | Chat list |
| `components/MessageBubble.jsx` | Bubbles |
| `components/MessageComposer.jsx` | Composer |

`MessengerApp.jsx` remains the orchestrator (WS, routing, state). Further extractions
hooks (`useMessengerWs`, `useMessengerCalls`) can move here without changing UI.

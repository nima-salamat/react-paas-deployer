# Messenger feature architecture

Messenger is organized by product domain. Each feature directory is the public boundary for that domain.

| Feature | Owns |
| --- | --- |
| `calls` | call UI, call lifecycle hooks, WebSocket call events, call message helpers |
| `composer` | message composer UI and draft state |
| `dialogs` | confirmation, search, crop, banner and message-related dialogs |
| `inbox` | sidebar, conversation home/header and conversation-list helpers |
| `media` | media players, galleries, video tools and attachment helpers |
| `messages` | timeline, message rendering helpers, cache and scroll behavior |
| `profile` | profile editing |
| `settings` | messenger appearance and settings panel |
| `shared` | generic messenger UI and shared low-level exports |

## Rules

New Messenger code should live in the feature that owns its behavior.

`MessengerApp.jsx` is the composition shell. It may orchestrate features, but feature implementation details should not be imported from internal `components/` or `modules/` paths.

Feature `index.js` files are the public API. Internal files can be split further without forcing the shell to change its import paths.

Keep cross-feature code small and dependency-light. Promote a helper to `shared` only when it is genuinely domain-neutral.

Legacy files under `components/` and `modules/` remain as implementation locations and compatibility targets while the codebase is migrated incrementally.

# Messenger modules

Code extracted from `MessengerApp.jsx` to keep the shell maintainable.

## Layout

```
messenger/
  MessengerApp.jsx              — shell + orchestration (state, handlers, layout)
  messengerUtils.js             — shared pure helpers
  api.js                        — API base URLs / unwrap helpers
  modules/
    composerDrafts.js           — localStorage drafts per conversation
    groupDescDismiss.js         — dismissed group-description banner state
    fileHelpers.js              — attachment / original-file helpers
    mergeConversations.js       — stable merge for chat list
  hooks/
    useKeyboardLayout.js        — visualViewport → shell size on mobile
    useMessengerWebSocket.js    — WS connect / reconnect / event dispatch
  components/
    MessengerDialogs.jsx        — forward / group / join / confirms / toasts
    CallChoiceDialog.jsx        — mobile voice|video call picker
    Sidebar.jsx, MessageBubble.jsx, MessageComposer.jsx, …
```

## Goal

Keep `MessengerApp.jsx` focused on wiring. Prefer new behavior in a module/hook/component
rather than growing the shell further.

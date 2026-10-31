# Inline Tarot and oracle results

User request: draw results must arrive at the bottom with chat messages, not in the page's top panel. Preserve three-card order, reversal and zoom.

Root cause: one `draw` component is placed before `turns`; cloud history currently omits each saved draw snapshot. Merely moving the singleton below the loop would make old results travel with later messages and overwrite earlier draws.

Plan: add a bounded public draw snapshot to its authenticated assistant history message (no schema, provider or payment change); preserve that metadata in client canonical turns; render it below the associated reply. While interpretation is pending/failed, show the newest uncommitted draw as an assistant result after existing messages. Reconciliation removes the pending duplicate when its canonical reply arrives. History paging must never show the latest draw from another page. Clear/account/persona boundaries still apply.

TDD: canonical metadata/merge/conflict/size, new draw before interpretation, normal follow-up, two different draws, failure/retry, history reload/pagination, expired receipts as display-only, owner changes, zoom/orientation. Run full source and frozen regressions, actual native screenshots, and deployment gates for the bounded history serializer. Ship a new development build only after verification.

References: [SillyTavern original message-media documentation](https://github.com/SillyTavern/SillyTavern-Docs/blob/main/Usage/User_Settings/uicustomization.md) describes per-message inline media; [TencentCloud original Mini Program chat UI](https://github.com/TencentCloud/chat-uikit-wechat) is a native reference. Reference only: no code, assets or dependencies copied; no external DOM-cloning extension installed. Existing native style and image component retained.

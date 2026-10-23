# Continuous oracle personalities

> **For implementer:** Use TDD: reproduce the blocked input and HTTP 409 first, then implement and run focused plus full regression checks.

**Goal:** Keep oracle personas available for continuous chat before and after a draw.

**Architecture:** Reuse the native composer and owner/persona-bound conversation store; keep explicit drawing separate from ordinary sends. Historical server draw facts are context, not a new prediction or a reusable authorization receipt.

**Tech stack:** Native WXML/WXSS, CommonJS client, Node ESM API and the existing SQLite conversation store; no new dependencies or schema migration.

The requested correction is an ongoing fictional recreational persona, not a one-shot draw form. The existing native and backend flows both gate all oracle turns on a draw receipt. Ordinary send must instead remain ordinary chat; only an explicit draw control generates a new result.

## Acceptance

1. Both eastern-oracle and tarot-reader accept chat before a draw and follow-ups after it, using the same conversation and server-owned personality.
2. The common keyboard-safe composer always sends text. A separate accessible draw toolbar selects the next spread and explicitly draws; choosing a spread does not discard the current artwork or history.
3. Initial interpretation and its retry preserve the exact receipt/question/idempotency identity. Chat retry is separate and never silently redraws. Unsent drafts survive role changes and reloads.
4. The backend permits no-draw chat, and supplies the latest server-recorded draw from the authenticated conversation as historical context when relevant. Expiry/restart does not erase a past draw fact. New interpretation receipts retain their current owner/persona/expiry checks; client-supplied cards remain forbidden.
5. Personality prompts answer the current topic naturally, with continuity and at most one optional follow-up, without forcing another full reading. No invented draws, certainty about the future, professional predictions, dependency claims, or changed academic/IELTS behavior.
6. Test text/draw/text, empty input, failed interpretation, failed chat, expired draw, spread changes, role/account isolation, clear/reopen, keyboard and responsive layouts. Run focused then full source/transformed tests and native acceptance.
7. Reconcile pending 1.0.56 before assigning another development version. Backend release requires a fresh exact-target readiness/rollback gate, prebuilt allowlisted artifacts and before/after verification; no source build or database migration.

GitHub-first reference: [SillyTavern](https://github.com/SillyTavern/SillyTavern) for persistent character-led chat. Its AGPL code is not copied or installed; this change uses the application's existing native conversation store and curated personas. UI checks follow ui-ux-pro-max touch targets, feedback, safe-area and keyboard guidance while retaining the app's existing theme.

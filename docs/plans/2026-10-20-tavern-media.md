# Tavern Reply Media Implementation Plan

> **For implementer:** Use TDD throughout. Write failing test first. Watch it fail. Then implement.

**Goal:** AI-selected original stickers and pictures are real durable Tavern messages, served from an expandable library.

**Architecture:** Extend canonical assistant messages with optional bounded media descriptors. Keep server authority and existing text transport; fetch immutable public media lazily and reuse local cache. No changes to academic Coach, grading, payment or model-provider selection.

**Tech Stack:** Native WXML/WXSS/JavaScript, existing Node AI API, private SQLite Tavern store, generated static image atlas/illustration assets.

## 1. Verify active source and catalog

- Read-only server identity/readiness and compare live hashes before choosing backend source at `D:/CodexWork/stem-runtime-tavern-memory-20261006`.
- Inspect and preserve unrelated worktrees. Create a scoped branch, not an in-place production build.
- Generate original source image atlases/illustrations under `D:/CodexWork/tavern-media-20261020`; inspect every frame, record exact prompts, hashes and accepted entries.

## 2. Server protocol and storage, test-first

- Add backend `server/tavernMedia.js` and `scripts/test-tavern-media.mjs`.
- RED: valid text with a known media ID is normalized; unknown/remote/oversized IDs are dropped without changing text; catalog candidate count is bounded and old content remains valid.
- GREEN: implement catalog resolution, bounded retrieval and structured output normalization.
- Extend `server/tavernConversationStore.js`, tests `scripts/test-tavern-long-memory.mjs`: persistence, replay and paging preserve exactly the same accepted media; old database rows need no data rewrite. Include quota accounting and rollback-compatible additive schema.
- Extend `server/aiApi.js` and `server/coachFeatures.js`: capability-gated prompt, one model call, server validation before canonical completion, immutable asset delivery. Test using isolated HTTP fixtures and no real user database.

## 3. Native client, test-first

- Extend `bundles/coach/tavernConversation.js` plus `scripts/test-tavern-media.mjs`: strict optional media validation, conflict detection and byte accounting; request capability; text-only compatibility.
- Update `bundles/coach/tavern.wxml`, `tavern.wxss`, `tavern.js`: image/sticker bubbles, correct reserved sizes, lazy image load, error fallback and allowed preview. Keep keyboard and history behavior from 1.0.48.
- Run `npm run test:all` and native WeChat screenshot/geometry scenarios in an isolated QA copy.

## 4. Release

- Inspect diffs and secrets; pin source/asset hashes and verify package headroom.
- Recheck exact server gate. Deploy only allowlisted code/assets with recoverable backups and no production build; rollback on failed health or acceptance.
- Verify AI choice, canonical history/replay and real asset fetch after deployment. Upload a clean next Mini Program development version only after verifying previous pending upload result. A pending confirmation is not a successful upload.

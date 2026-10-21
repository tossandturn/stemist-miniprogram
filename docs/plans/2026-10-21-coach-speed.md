# Academic Coach streaming and session warmup

> **For implementer:** Use TDD throughout. Write failing tests, observe failure, then implement.

**Goal:** Show usable academic answers before generation finishes, and remove avoidable foreground authentication waits without changing IELTS or Tavern media.

**Architecture:** Reuse the deployed `/api/ai/coach/stream` SSE contract through native chunked requests. Incrementally decode UTF-8, throttle complete mathematical previews, and accept only the terminal `done` as completion. Warm existing STEM sessions while the Coach page is visible; keep ownership, privacy, timeout and exam restrictions.

**Tech stack:** Native WeChat JS/WXML, Node VM tests, pinned esbuild package transform.

## Verifiable steps

1. Add `scripts/test-coach-stream.mjs`: real API helper under mocked native transport; byte splits, reset, terminal/error, cancellation, missing callbacks, identity changes, buffered compatibility. Run `node scripts/test-coach-stream.mjs` (initial FAIL, then PASS).
2. Add `utils/coachStream.js`; opt in through `utils/api.js` and `utils/coach.js`. Never put callbacks in JSON, retry a paid request automatically, expose reasoning, or persist partial output as completed.
3. Add `scripts/test-coach-prewarm.mjs`; bounded existing-session warmup in `utils/nativeSession.js` / `utils/coachSession.js`. Tests cover coalescing, stale owner, silent native callbacks, page lifecycle and IELTS isolation.
4. Integrate partial preview into `pages/coach/index.js` and `pages/stem/coach.js`; preserve answer/steps renderer. Add page regression tests for failed partial output, unload cancellation and history writes only on completion. Refine STEM full-answer instructions only.
5. Validate package transform parity and retain the 128 KiB source main-package headroom; do not lower release budgets. Run `npm run test:all` and clean candidate checks.
6. Use isolated native QA with synthetic math and graph input. Record meaningful first-visible-text and total timings separately, validate partial render on phone/tablet widths and failure states. Do not claim physical-phone network testing.
7. Reconcile confirmed 1.0.52 upload, assign next unused version, commit only scoped files, build immutable candidate, upload through official WeChat tooling. A confirmation-pending result is not upload success.

## References and boundaries

- https://github.com/wechat-miniprogram/api-typings/issues/233
- https://github.com/wechat-miniprogram/api-typings/issues/301
- https://github.com/Tencent/WeKnora/blob/main/website-docs/05-clients/04-miniprogram.md (buffers response; not a drop-in streaming implementation)
- https://api-docs.deepseek.com/api/create-chat-completion/

No copied third-party implementation. No production mutation planned. No IELTS provider or page changes. Tavern keeps its existing media/history contract. User-owned project config remains untouched.

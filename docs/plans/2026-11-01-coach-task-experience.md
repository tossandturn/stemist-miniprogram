# AI Coach Task Experience Implementation Plan

> **For implementer:** Use TDD throughout. Write the failing test, verify RED, implement the smallest change, and verify GREEN before the release checks.

**Goal:** Make academic AI Coach understandable: default low with thinking enabled and immediate replies; selectable high/deep thinking with optional three-day saved tasks; real preparation/upload/analysis/answer stages and honest ETA ranges.

**Architecture:** Extend the existing authenticated Coach job system. Keep upload, idempotency and model deadlines; do not add a queue service. Real task metadata powers every academic progress card. Only a student-selected saved high/max task enters the private task list and durable three-day history. Low and unselected high/max are immediate replies with bounded short reconnect recovery. The user's latest correction supersedes the earlier one-week proposal. Original photos/request text are not newly persisted; existing legacy rows retain their expiration.

**Tech Stack:** Native WeChat JS/WXML/WXSS, existing mini-runtime tests, Node.js/SQLite backend, current DeepSeek/Bailian thinking protocol. No dependency installation or model/payment/IELTS/Tavern changes.

## Approved scope and constraints

- Covers academic photo/text questions, hints, worked solutions and checking work, including both current academic page entry points.
- `auto` defaults to low for academic/steps/answers/check. Explicit saved high/max remains respected. PDF/adviser/Tavern scene defaults remain unchanged; max remains backward compatible.
- `saveTask` is an explicit boolean for new clients, default false. Only high/max may set true. Low has no save-task option; switching back to low clears the option. Once submitted, the captured choice does not change during recovery.
- Only an accepted saved task is advertised as available for later retrieval. Before server acceptance, do not promise that preparing/uploading will continue after leaving. Immediate mode has short reconnect recovery, not a saved task-list entry.
- Saved high/max task results and metadata expire after259200000ms (3days). Immediate replies must not be retained as saved tasks. Show server-provided expiry; no retroactive resurrection/extension of legacy rows. Old clients omitting saveTask retain the legacy24h recovery contract, excluded from the saved-task list.
- Ordinary questions target an estimated return within30seconds, adjusted by complexity and selected effort; this is not a universal promise or a new hard timeout.
- Display only actual phases and scalar timing/activity signals. Never expose or store hidden reasoning text, fabricate AI percentages, or present a countdown as guaranteed completion.
- ETA cohorts: same model/effort/image-or-text/helpIntent, recent20 successful AI jobs, minimum5 for calibrated P25–P90. Otherwise initial estimate. Exceeded estimate becomes an explicit longer-than-usual state, not a resetting countdown.
- State/identity/assessment permission checks remain server-authoritative. List responses contain metadata only, with bounded pagination; detail returns only the current owner's result after current permission checks.
- Keep the128KiB main-package safety headroom. Place the task-list service/page in the existing Coach subpackage and use reviewed build compaction if needed, never lower the gate.

## Task 1 — Academic default and labels

Files: `utils/coachEffort.js`, `components/coach-effort/index.js`, new `scripts/test-coach-task-defaults.mjs`, affected existing scenario tests.

1. Assert `readCoachEffort('answers')` and `readCoachEffort('check')` are low for an unconfigured owner; assert explicit high persists and PDF stays high.
2. Run `node scripts/test-coach-task-defaults.mjs`: expect RED against old scene defaults.
3. Change only academic defaults and add visible thinking-enabled notes.
4. Run new and existing effort suites; preserve owner/epoch, fixed retry choice, invalid-value and non-academic behavior assertions.

## Task 2 — Versioned task snapshots and honest progress

Files: `utils/coachJob.js`, `utils/operationProgress.js`, new `scripts/test-coach-task-progress.mjs`, existing upload/job/deadline tests.

1. Add fixtures for accepted/task stage/ETA, actual upload bytes, initial versus calibrated estimates, server clock offset, exceeded ETA, stale out-of-order snapshots, reconnect, terminal and legacy snapshots.
2. Expect RED: tracker does not understand `phase:'task'` snapshots yet.
3. Forward authenticated snapshots through the existing onStage callback, retaining job POST/GET semantics and original deadlines. Include captured saveTask in request identity; persist only bounded private IDs/hashes/expiry, not task answers/photos. Honor task.persistence.saved/retentionMs from the server.
4. Add an opt-in academic task mode to the existing tracker. Existing non-task consumers retain their contract. Emit current stage, elapsed/estimated text, fixed effort, accepted-task link and truthful leave/recovery hints.

## Task 3 — Current-page task card

Files: `components/coach-panel/index.{js,wxml,wxss}`, `pages/coach/index.{js,wxml}`, `pages/stem/coach.{js,wxml}`; associated page/visual/WXML tests.

1. Verify image preparation is visible before reading/compressing, upload shows confirmed bytes, tiny inline submissions use an indeterminate submitting stage, and saved-task navigation appears only after confirmed metadata. A save-task checkbox appears only for high/max and never submits automatically.
2. Add the task event binding/navigation and scoped tracker options to both academic entry points without changing IELTS calls.
3. Keep the answer modular renderer, optional source identification after answering, retry/help-intent and image preservation behavior.
4. Test loading, upload pause, network recovery, completion, failure, account change and unload; no hidden reasoning, fake progress or repeated model submission.

## Task 4 — Native task list and result

Files: new `bundles/coach/tasks.{js,json,wxml,wxss}`, `bundles/coach/taskData.js`, Coach hub entry, `app.json`, new `scripts/test-coach-task-page.mjs`.

1. Test strict metadata parsing, authenticated list/detail requests, bounded cursors, expiry, guest/login, ownership changes and late callbacks.
2. Build one page: paginated task cards and a selected-task result/progress view using the existing answer-content renderer. No automatic submission/retry/model call from opening history.
3. Refresh active tasks only while visible, bound auto-refresh, stop timers on hide/unload, and provide manual refresh on disconnected/expired/failed states.
4. Test375px phone, landscape phone and tablet device contracts, touch sizes, text wrapping and no horizontal overflow.

## Task 5 — Backend integration and release

The persistent STEM implementation task owns only `D:/CodexWork/coach-task-experience-20261101/backend`; root owns client, independent review and deployment. Backend contract: `stem-coach-task-list-v1`, `stem-coach-task-v1`, top-level `serverNow`, exact task schema agreed in the implementation handoff. Keep old individual task endpoints compatible.

1. Independently inspect its diff, SQLite additive migration/rollback compatibility, source hashes, timeout/retention/capacity semantics, permission checks, cohort exclusions and regression results.
2. Run full client suite, final-package suites and real client/backend integration tests. Preserve a code/data rollback; use a fresh exact-target read-only resource gate and zero-active-job check before an allowlisted STEM-only deployment.
3. Use isolated native QA against real production: low/high outbound settings, actual image/text progress, partial answer, leaving/reopening a live task, same-owner result retrieval, guest/other-owner denial and no duplicate generation. Preserve/restore native storage in RAM; no exported credentials or student content.
4. Freeze, reserve and upload only after acceptance; official developer upload is not experience designation or public publication. Report physical-device limits honestly.

## Reference assessment

- https://github.com/taskforcesh/bullmq/blob/master/src/classes/job.ts — structured progress and durable result/state are useful design references; do not import/copy the queue or add Redis.
- https://api-docs.deepseek.com/guides/thinking_mode/ — thinking enabled and effort are separate settings; hidden reasoning is not student-facing task content.
- UI-UX lookup recommended step indicators, loading feedback and clear estimates. Keep the repository's existing light-purple tokens and native controls instead of importing its generic operations-landing layout, new fonts or visual effects.

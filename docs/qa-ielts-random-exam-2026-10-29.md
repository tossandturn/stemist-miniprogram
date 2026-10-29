# IELTS random-exam acceptance — 2026-10-29

## Scope

Restore usable random assembly on top of 1.0.66. Listening, Reading, Writing Task 1, Writing Task 2 and Speaking are drawn independently from eligible Cambridge sources; this is cross-paper assembly by skill module, not random selection of a pre-existing complete test and not splitting individual questions/passages. Beginning a new attempt draws independently; restoring the same saved exam key keeps its sources fixed. The source book/test or speaking page is shown on each card.

The first exam catalogue use now waits for successful remote metadata. Restored/bootstrap metadata is not marked fresh. Concurrent refreshes coalesce; confirmed in-memory data can be reused for five minutes. Individual-task browsing stays offline-first. Writing `ready` and revision requirements are unchanged. Slow-network loading, failures, retry, duplicate taps, owner/epoch changes and cancellation have explicit guards.

## PASS

- Source regression first reproduced cold-start zero network requests followed by unavailable assembly. The fixed path fetches before selection. Tests cover old persisted catalogue, slow refresh, concurrent callers, expiry, network failure/retry, genuinely ineligible sources, random/same-test and late capability isolation.
- Deterministic cross-paper fixtures prove independent selection; another fixture has no complete same-test set but can still produce a random exam. Restoring does not redraw.
- Live public catalogue GET: version `04391eb757cf6978860f8c1d`; eligible pools observed: Listening 72, Reading 72, Writing 136, Speaking 72. Twenty local assemblies produced 20 distinct manifests. Each selected module in one sample was fetched through its real public task endpoint (200); Listening/Reading each contained 40 questions, writing sources were ready, speaking material existed. No production exam rows were created.
- Official WeChat simulator with real public catalogue: offline error/retry, held slow response, no premature create, exactly one request despite double tap, two different random combinations, fixed restoration, unchanged same-test flow, visible source labels. Exam-create responses were synthetic to avoid production student writes.
- Full `npm run test:all` and native WXML/WXSS compiler passed. Actual transformed output ran 6 exam/source suites, 10 chapter suites and 4 PDF suites. Existing Coach, downloads, identity and IELTS tests passed.
- Independent read-only source review found no P1/P2 blocker. Its suggested deferred-capability owner/cancel tests were added and passed.
- Main package: 1,963,687 bytes; headroom 133,465 bytes above the unchanged 131,072-byte minimum. Runtime SHA-256: `0e7ac730da5d00f9060ed7c2f6956b9795b27ae75bd8bde258b75cab4337ce16`.

## NOT VERIFIED / unchanged

Physical Android/iPhone/iPad, real server exam creation and completing/submitting/scoring an entire live exam are not claimed as tested here. Native UI acceptance uses synthetic exam-create capabilities; live reads are explicitly separate. No model, realtime speaking, server code/database, payment or quota settings changed. Existing 1.0.65/1.0.66 fixes are retained.

Artifacts: `D:/CodexWork/ielts-exam-cold-start-20261029/` — `live-catalog-result.json`, `native-acceptance.json`, native state/screenshot files and `full-tests-final.log`. Candidate runtime commit: `071aadc5d2211150b96c871e55896b08293068c3`.

Reference: [TanStack's official repository discussion about persisted stale data versus awaited refresh](https://github.com/TanStack/query/issues/8075). The implementation is a narrow extension of this app's existing loader; no external code/dependency copied.

**UPLOADED:** development 1.0.67. Official asynchronous upload task returned `status=success` and `result.success=true`, confirmed at 2026-10-29 16:36:50 Asia/Shanghai. Frozen commit `77f150afa945e050b9e902e7db917aea6bf89083`; runtime identical to native acceptance. No review/public release. Both local ledgers reconciled; user IDE configuration unchanged.

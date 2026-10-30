# Listening downloads acceptance — 2026-10-31 (Asia/Shanghai)

## Scope and pinned artifacts

- Client runtime: `afb17aabb899e383b541881bce93942ffe26e873`.
- Candidate: `D:/CodexWork/chapter-mistake-coach-20261029/development-1.0.78-ready-r2`.
- Runtime manifest: `e004dfbcd117d7913f41e08b07d0e02811e668bbcb0904d8417a6e7469d7fcb0`.
- Backend: `784b41eaf6e0a25c2747128159dcd6a665222b77`, four allowlisted files only. No production build, schema, environment, payment or model change.
- Immutable audio catalogue: `136cea8a86b3f22da7a0fc89`, 288 MP3 files / 72 listening tests / 18 books, 2,246,049,878 bytes. All copied-file hashes, sizes and MP3 headers verified. Original IELTS audio untouched.
- Evidence folder: `D:/CodexWork/listening-download-quota-20261031` (`verification.json`, source/frozen/backend/native receipts, screenshots, server and announcement receipts).

## Verification

- PASS — complete client `npm run test:all` (71,176 ms), including device/page/compiler, download, account, AI and exam regression suites. This is automated coverage, not a physical-device certification.
- PASS — 62 frozen-candidate suites and six backend suites. Shared ledger tests cover concurrency, final-slot races, Beijing midnight, membership authority/expiry, PDF/audio canonical identity, metadata/range failures, stale source before charge, cache separation, session expiry, late-account callbacks and the third-file reminder.
- PASS — native guest page, four 44 px buttons, no horizontal overflow; Cambridge 12 original Test 5 versus practice Test 1 labels and current-track focus preserved.
- PASS — real hosted PDF used slot 1; one MP3 used slot 2. Pause at 131,073 bytes and resume at the exact offset completed a SHA-verified 1,403,342-byte file without another charge.
- PASS — third different file returned HTTP 429 / `pdf_daily_limit_reached`; visible reset explanation and 44 px “查看会员” action. Membership navigation created zero orders and called no payment API.
- PASS — complete authorized audio cache reopened with zero file-network requests. Public playback returned 206 without consuming allowance; same-day PDF reuse still reported used=2.
- PASS — explicit local MP3 plus descriptive filename supplied to `wx.shareFileMessage`. System dialog was mocked; no files sent to contacts.
- PASS — final native runtime errors and unexpected HTTP failures both zero. QA credentials stayed in RAM; original storage restored and one test-owned audio cache file removed.
- PASS — main package 1,962,421 bytes / 134,731 bytes headroom (minimum remains 131,072), 376 runtime files / 42 pages. Original user-owned IDE config unchanged.

The final raw HTTP harness initially received 401 because its test token had expired while validation continued. Unlike the product controller, that harness had omitted `refreshNativeSession`; after invoking the existing refresh helper, the same-account third-file check returned the expected 429. Both results are retained; no new test account or entitlement was used to hide the failure.

## Deployment and content

- PASS — before/after asset and code readiness gates; verified private rollback files and SQLite backup retained. No original audio deletion or DB restore.
- Exactly one STEM restart: restart counter 70 → 71. The first immediate post-restart assertion failed and further mutation stopped; the individual failed check was not retained. Subsequent read-only reconciliation matched all deployed hashes and passed all resource/service checks. No retry restart was performed.
- IELTS service PID/restart count and server hash unchanged. Coach API hash unchanged. Final pre-announcement reconciliation: swap 6.16%, about 19.26 GB free, active AI job counts zero across the five explicitly checked stores.
- PASS — existing pinned membership notice updated in place: PDF questions/answers plus MP3 share two free files, each split MP3 counts once, online playback is free, same-day retry/resume and complete authorized cache do not re-charge. Other announcements and home placement preserved. Post-write resource gate PASS; no service restart.
- Old unmarked subject-download clients retain their existing compatibility behavior. New exact trusted requests opt into stricter shared limits; the audio endpoint is always protected. Global old-client enforcement flags remain unchanged. This is not a claim that all historical clients enforce the new policy.

## Release status and outstanding device checks

PASS — development **1.0.78** uploaded successfully at **2026-10-31 04:03 Asia/Shanghai** through the official WeChat CLI. Both development ledgers are reconciled to the exact runtime commit and manifest above. Official evidence: `D:/CodexWork/listening-download-quota-20261031/wechat-upload-receipt.json`. Trial designation is NOT VERIFIED; no review submission or public publication was performed. Set this development version as the trial version before phone acceptance.

NOT VERIFIED — physical Android/iPhone system file-share delivery, iPad touch and real mainland-phone download timings. Simulator measurements are not phone speed guarantees. No real purchase, refund or paid entitlement change occurred.

The UI/UX checks retained the existing native visual system, inline quota recovery, real progress, 44 px targets and pagination. GitHub-first references and interface attribution are in `listening-downloads-2026-10-31.md`; no third-party code/assets/dependencies were copied.

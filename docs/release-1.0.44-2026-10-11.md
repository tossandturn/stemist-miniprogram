# Development 1.0.44 — backend-driven native foundation

Final verification uses the live Windows clock: 2026-10-11T02:49:19.3106680+08:00.

## Delivered

- One native foundation update, as explicitly accepted by the user. Public configuration can change Home wording/order/secondary links, the four Coach menu entries' presentation, Tavern metadata and native information screens without another client upload.
- The first independent, dependency-free product-configuration service is deployed behind the existing STEM HTTPS origin. Existing authentication, attempts, scoring, camera/crop, audio and download behavior remains native or on its existing backend; this is not a claim that all legacy APIs are now separate microservices.
- Generic screens use preinstalled native text, notices, known-page navigation and public HTTPS copy actions. No downloaded executable JavaScript, HTML, templates or arbitrary network destinations.
- Strict producer/client validation, 128 KiB configuration bound, channel separation, ETag revalidation, seven-day public fallback cache and stale-response guards. Private storage and provider credentials are not part of configuration.
- Immutable revisions, expected-current publication and rollback; no public write endpoint. Publication lock recovery preserves live owners, including concurrent stale-reaper and killed-owner cases.
- Output-only esbuild 0.28.2 whitespace transformation retains source files, original icons and all offline IELTS question data. The existing source-package budget gate is unchanged.

New native components, permissions, interaction types or client defects still need ordinary WeChat client releases. Backend metadata alone does not create a supported AI persona or grant access to an API.

## Verification

- PASS: complete final `npm run test:all`, focused configuration checks, WXML/WXSS compilation, deterministic transformed package builds and zero dependency audit findings.
- PASS: 78/78 producer/client contract-parity cases; schema, malicious actions, controls/Unicode, corrupt/expired cache, 304, unavailable service and request races.
- PASS: backend CLI/store/HTTP integration, including actual child-process publish, rollback and serve through a directory junction/symlink.
- PASS: deployment/recovery helper verification and independent review. The final combined cutover and R2 recovery test selection passed 31/31.
- PASS: real public endpoint and WeChat simulator using the same frozen client for `foundation-v1 → foundation-v2 → foundation-v1`. Home, Coach and Tavern metadata changed; the generic guide appeared with three sections and three links; copy handler, native navigation and safe shares were checked; rollback removed that guide and restored original content. No client rebuild/upload occurred between these phases.
- PASS: offline cache fallback used a narrowly scoped simulated network failure, explicitly labelled as simulation. Live acceptance responses were not mocked. The clipboard handler was intercepted; no OS clipboard data was read/changed and no friend/Timeline message was sent.
- PASS: phone-width native visual inspection. Fixed the default native-button width to fill the generic link container (316.67px instead of 184px).
- NOT VERIFIED: physical Android/iPhone/iPad, landscape, microphone/camera hardware, Apple Pencil, or actual message delivery in this turn. Automated full-suite results are not a substitute for these checks.

## Release identity

- Uploaded runtime commit: `6833fee41819c2477a3644d5cbc88dc50fe121e3` (pushed).
- Frozen package: `D:\CodexWork\backend-driven-foundation-20261011T012618\native-release-final`.
- Package manifest SHA-256: `864352df87a5b7d5de726249607e31f24c89b775858c5d1bc87931ccf3d1c43d`.
- Runtime manifest SHA-256: `d5141cafc0bb43256cc66b0ecdc1846d219ee893685b63e4a10e6a2db5a83de6`.
- Source-package gate: main 1,946,994 bytes; 150,158-byte headroom against the existing 131,072-byte minimum.
- Official WeChat compiler/upload receipt: **success**, version **1.0.44**, main 1,974,276 bytes, total 2,326,436 bytes. Compiler overhead means the uploaded main-package headroom is **122,876 bytes**, not the source-package headroom; it remains below WeChat's 2 MiB limit. Do not report the source margin as the compiled margin.
- Upload receipt: `D:\CodexWork\backend-driven-foundation-20261011T012618\wechat-upload-1.0.44.json`.
- Development upload only: no review submission and no public release.
- User-owned `project.config.json` remains byte-identical: `a6d9c6a9cb8c4732f591272e9f18db86c12628cb2aa5fedecd9efb97ce5705fa`.

## Backend deployment

- Backend source: commit `1ad03a0`, pushed on the existing candidate branch.
- Active service artifact: `product-config-foundation-20261011-r2`; manifest SHA `0db186d123dcf6516fb147ea941d589986675c9f05c7a3e200c0fcd0d7ed30ce`.
- Service: `stemist-product-config.service`, loopback-only port 4323, enabled, MainPID 2896367, zero automatic restarts at acceptance.
- Only one exact public route was added: `/api/product/config`. Authorization/Cookie headers are stripped for this public endpoint. No additional Mini Program domain is required.
- Final release/trial/develop channels all point to `foundation-v1`; v2 is retained as an immutable rollback-tested revision but is not selected.
- Existing STEM and IELTS process identities stayed unchanged throughout: PID 2806638/restarts49 and PID1636220/restarts28 respectively. No production source/dependency build, existing-service restart, database migration or existing paper-data change was performed.
- Final server gate: 37/37 core checks plus all product-config checks PASS; MemAvailable 2,488,360,960 / 3,904,786,432 bytes, swap 163,028,992 / 2,084,564,992 bytes, disk 81.15% used with 9,227,665,408 bytes free, I/O wait 0.5% / 0% / 0.51%.

Two installation checks correctly triggered rollback before acceptance. First, CLI entry detection was corrected to resolve `current` symlinks. Second, public acceptance now waits boundedly for Nginx worker cutover instead of accepting an old SPA response. Both failed, newly created service trees were archived intact at the exact `stemist-product-config-failed-20261011t0218` and `stemist-product-config-failed-20261011t0226` paths. No student files were deleted. The final installation passed real payload/ETag/304 checks and a fresh after-gate.

## Evidence and future publication

Task artifacts: `D:\CodexWork\backend-driven-foundation-20261011T012618`.

- `native-qa/baseline-20261011T024148/report.json`
- `native-qa/updated-20261011T024521/report.json`
- `native-qa/rollback-20261011T024644/report.json`
- `deployment/service-final-after-01.json`
- `deployment/config-v2-publish-01.json` and `deployment/config-v2-after-01.json`
- `deployment/config-v1-rollback-01.json` and `deployment/config-v1-after-01.json`
- `mini-regression-upload.log`

Daily publications must validate the v1 contract, use the correct channel and expected-current CAS, and retain exact bytes for rollback. Existing data/announcement/ranking publication flows remain separate. The inspected operations scripts are task-local, not a public admin API; future server changes still require fresh readiness and rollback checks.

Research references and capability boundaries are documented in [backend-driven-foundation.md](backend-driven-foundation.md).

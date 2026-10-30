# Free hosted paper downloads

Historical implementation and receipts below are retained. The 2026-10-31 extension adds listening MP3 files to the same allowance and activates strict enforcement for compatible new client requests, while preserving old-client compatibility. See `listening-downloads-2026-10-31.md` and `qa-listening-downloads-2026-10-31.md` for the current rule and evidence.

User-confirmed rule: a signed-in free account may download two different hosted paper/answer PDFs per Beijing calendar day. A-Level, AP and IB share the allowance. The server identifies files by verified SHA-256. Same-day retry/resume does not consume again; a locally verified complete cache does not contact the server. Active members have no daily file-count limit.

## Client behavior

- Send the captured short-lived account bearer only to the exact STEM PDF endpoint allowlist. Never put credentials in URLs, UI state or cache records.
- Preserve partial files on authentication, quota and service errors. Expired login offers an explicit login action; cancellation/back remains available on the existing account page.
- A late old-token response cannot clear a renewed session; a late old-account response retires its own transfer and cannot alter a new account or replacement request.
- Distinguish daily allowance exhaustion from generic rate limiting. Do not automatically open payment or retry an exhausted allowance.
- Legacy AP/IB identifiers use the same Range/digest validation as current identifiers. Do not fall back to an unverified hosted PDF when a catalogue digest is known.
- Keep real byte progress and ETA, complete-cache-first behavior, storage-pressure temporary preview verification and source-version checks.

## Verification

- `npm run test:all`: PASS, including actual WeChat WXML/WXSS compilers and all download suites. The optional external local-paper fixture audit is skipped because that unrelated corpus is outside this checkout.
- `test:package-minification`: two deterministic builds, 348 files verified; four PDF suites execute against actual packaged modules. Main package is 1,965,232 bytes with 131,920 bytes headroom (minimum 131,072 unchanged).
- Separate backend tests cover atomic multi-connection grants, final-slot races, Beijing midnight, membership expiry, actual signed/native-cookie authentication, malformed authority and both CIE/AP/IB file routes.
- Physical Android/iPhone download and payment acceptance are not implied by these tests.

## Release boundary

Baseline is released 1.0.63, excluding the unfinished dual-platform payment candidate. The backend quota is a separate double-gated feature, default OFF. Do not enable general restrictions before compatible clients are available. No payment, pricing, refund, IELTS provider, question content or existing user data is changed here. Subsequent upload/deployment receipts must record their actual status; this source document is not proof of activation.

## Delivery receipt (2026-10-29, Asia/Shanghai)

- Development upload **PASS**: version **1.0.64**, runtime commit `59ef223669ad855f9487c27e24ed4d77ac5adb17`, runtime manifest `9373e895d04cde53a582ba5d2ccd00d518e2b6deb4f00a1721cdde823c6474f2`. Official upload returned success; no review submission or public release was performed.
- Backend code **DEPLOYED, QUOTA OFF**: `364aa47d74d456e452562de56038196361fc43fc`; exactly five allowlisted source files, preserved question catalogues, environment, databases and payment configuration. Verified code rollback retained.
- A transient resource gate failure stopped the first staging attempt before any remote file was created. After external resource recovery, fresh pre/post staging and activation gates passed. The one STEM restart initially encountered startup I/O/502, so further mutations stopped; read-only reconciliation then confirmed exactly one restart, unchanged IELTS process, full resource health and matching active file hashes. Do not blindly rerun the restart command.
- Public-domain acceptance **PASS**: CIE QP/MS and AP/IB samples each returned `206` for first/resumed byte ranges and `304` for matching ETag. Anonymous success and absence of quota headers confirm global enforcement remains OFF.
- Native UI **PASS with synthetic transport**: actual packaged component/controller rendered the third-file limit, verified cache with zero network, and explicit expired-login recovery. Screenshots were inspected. Real-device/live-enforcement acceptance remains **NOT VERIFIED**.
- Release ledger reconciled to **1.0.64** in both the candidate and original workspaces. The original user-owned `project.config.json` hash is unchanged. The unfinished Apple IAP candidate was not uploaded.
- Required rollout step: make the compatible client available to public users before enabling both server quota flags; do not infer public availability from a development upload.

## References and design checks

- Atomic counter inspiration: https://github.com/animir/node-rate-limiter-flexible (no code/dependency copied; a relative rolling window is not a Beijing calendar day).
- SQLite transaction API: https://github.com/nodejs/node/blob/main/doc/api/sqlite.md.
- Exact-path PDF compaction: https://esbuild.github.io/api/#minify. Keep names, leave other modules' rules unchanged, verify actual transformed behavior.
- UI/UX skill checks preserve existing visual tokens, real loading feedback, 44px login/retry actions, readable quota text and reduced-motion handling.

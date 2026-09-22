# Whole-paper AI marking delivery

Verified on 2026-09-23, using the live Windows/production clocks (Asia/Shanghai).

## Delivered behavior

- AI Coach → 整卷 AI 批改, in an ordinary native subpackage.
- One answer PDF or 1–20 ordered images; optional question-paper and mark-scheme PDFs.
- Backend image-to-PDF composition, asynchronous visual marking, owner-scoped history and report/source PDF downloads.
- Per-file upload recovery, stable idempotency, explicit draft cancellation, account-switch isolation and visible retention expiry.
- No-reference submissions are unscored advice. Reference-backed marks remain provisional, never official/formal progress.
- EXIF rotation, oversized embedded PDF images, malformed PDFs, timeout/restart and PDF-only retry boundaries are tested.
- PDF reports use compressed raster pages to avoid full CJK font embedding; selectable feedback remains available in the native page.

## Source and release identities

- Mini Program runtime: `9c27dcb3f158070524592c1decc17169a98bfc0c` on `master`, pushed.
- Review package: `stemist-miniprogram-review-1.0.17-9c27dcb`.
- Main package: 1,965,917 bytes; headroom 131,235 bytes (128 KiB minimum preserved).
- Marking subpackage: 36,063 bytes. User-owned `project.config.json` was preserved.
- Backend branch: `codex/whole-paper-marking`, source `f0f0632d4acabd060dcd5aab9d4406ecc74787d0`, pushed.
- Backend API release: `wp-api-20260922T181346Z-f0f0632`, activated. Original website `dist` was reused unchanged; API identity is recorded separately from frontend-build identity.
- Backend overlay manifest SHA-256: `e8e299a29fee5458d1553da8be03ab05d4167cbcddb80fd4f30993b1bc792ce0`.
- The earlier `2ac73a7` staging release was never activated; its PDF resource boundary was superseded by `f0f0632`.

## Verification

- Final Mini Program `npm run test:all`: PASS, including official WXML/WXSS compilation.
- Backend full existing suite: PASS before the final isolated PDF/EXIF guards; the full whole-paper focused suite and lint were rerun after those guards and passed.
- Cross-repository client service → real local HTTP API → image/PDF conversion → fixture model → report/download: PASS. Actual source-PDF pixels prove image order, and report body pixels are nonblank.
- Linux in-memory CJK report generation and render: PASS; 177,373 bytes, no provider call and no persistent write.
- Production readiness gates before/after Stage and Activate: PASS; existing data/config preserved, no production build/install, IELTS PID unchanged.
- Real configured-model acceptance: two synthetic AS Physics questions with uploaded references. Correct first answer received 2/2; arithmetic error in the second retained 1/2 for method. Total 3/4, completed in 24 seconds, provisional/non-official.
- Real report: 188,541 bytes, one A4 page; rendered and visually inspected. SHA-256 `12d579873367fc4010aef89ab60db5661c55145122cfea2a27f28a67a43c29e8`.
- STEM and IELTS public health checks after acceptance: HTTP 200.

## Remaining release boundary

The 1.0.17 Mini Program package has **not** been uploaded, submitted for review or published. The prior 1.0.16 upload task returned `Task not found`; no duplicate upload was issued. The current development version must be reconciled before proceeding under the WeChat upload workflow.

Native simulator phone layout was checked with synthetic data. Physical phone/iPad file pickers, mainland mobile-network performance and a representative real handwritten full paper are not yet verified by this delivery.

Future backend releases must retain the deployed whole-paper branch changes and pure-JS PDF dependency closure. The persistent STEM-thread handoff could not be delivered because the runtime's cross-thread messaging tool was unavailable; this document records the handoff without claiming a message was sent.

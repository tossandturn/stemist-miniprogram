# Listening audio downloads and shared allowance

> **For implementer:** Use TDD throughout. Write failing test first. Watch it fail. Then implement.

**Goal:** Export registered listening MP3 files and consistently explain the third-file limit; the user confirmed that audio and PDFs share two free different files per Beijing day, while ordinary playback stays free.

**Architecture:** Keep one existing server ledger keyed by verified SHA-256. A dedicated protected audio gateway uses immutable, registered source assets. A strict opt-in marker makes new client subject-PDF requests follow the same policy without silently switching global compatibility flags for older public clients. Put the audio library/controller in the existing curriculum subpackage and reuse the bounded Range/progress engine with a separate account-bound protected cache namespace.

**Tech Stack:** Native WeChat pages/components, existing CommonJS cache helpers, Node/SQLite STEM gateway, official WeChat file-share API. No new dependencies, no changes to IELTS scoring/models/payment.

## 1. Server policy and reminder

Files: backend `server/pdfDownloadPolicy.js`, `server/pdfDownloadQuota.js`, new `scripts/test-download-client-policy.mjs`; client `utils/pdfRangeCache.js`, `utils/pdfDownload.js`, `components/pdf-download-progress/index.*`, focused download-access tests.

RED: a request with `X-Stemist-Download-Policy: shared-files-v1` is authenticated and metered even with legacy global flags off; unmarked old requests retain compatibility. Two distinct PDF/audio hashes exhaust one ledger; repeat hash succeeds and a third hash returns a clear daily-limit response. Marker cannot grant identity or membership. UI shows exhaustion plus midnight reset/cache guidance and a user-invoked member-center action, never automatic payment/retry.

GREEN: validate the exact marker, retain canonical membership and transactional ledger; extend existing text/state. Keep 401 ownership safeguards and partial checkpoints.

## 2. Trusted audio catalogue and gateway

Files: backend new `server/ieltsAudioDownloads.js`, `scripts/test-ielts-audio-downloads.mjs`, small `server/stemApi.js` wiring.

Inspect the 72 registered listening tasks through the existing public native API, retain only audio metadata. Resolve only registered public source MP3s; preflight capacity before installing immutable copies into STEM-owned data. Validate size, MP3 header and SHA. Do not modify original IELTS assets or import private uploads.

RED: unknown IDs/path traversal rejected; metadata/304/416 do not consume; first valid byte range consumes once; retries and aliases with the same hash reuse; audio plus PDF share allowance; active members unlimited; source corruption fails before consuming. Catalogue supports book/task filtering and original file/part labels.

## 3. Native audio export

Files: new `bundles/curricula/ieltsAudio.{js,json,wxml,wxss}`, `bundles/curricula/audioDownload.js`; controlled extension of `utils/listeningAudioRangeCache.js`; links in `pages/ielts/home.*` and `utils/ieltsObjectivePage.js` / `pages/ielts/objective.wxml`; register route in app/build manifest.

RED: only trusted export origin receives bearer/marker, protected cache is owner/epoch/hash-bound, complete verified export cache bypasses network, uncharged playback buffers cannot bypass first export charge, partial resume/ETag/source changes/cancellation/storage errors are safe. Late account/track callbacks cannot update another task. Download and explicitly share local MP3 through `wx.shareFileMessage`; no claim of directly writing OS Downloads. Each separate source MP3 counts once; no automatic batch download.

UI keeps real byte progress/speed/ETA, cancel/resume, readable file labels and accessible >=44px buttons. Online player/captions remain independent and unmetered.

## 4. Acceptance / release

Run relevant backend quota/route/auth/concurrency tests; client full suite and frozen affected modules; synthetic native mixed PDF+audio third-file denial, cache/resume, guest/login/member action without charging, actual production MP3 integrity. Verify source and final native layout; clearly label physical sharing/device gaps. Maintain 128KiB main-package headroom, using a reviewed related-file minification allowlist only if needed.

Pin exact sources, pass fresh server readiness/rollback gates, install only allowed data/code, restart STEM only with no active AI work, verify both services and preserved Coach/IELTS hashes. Reserve next development version only after checking both ledgers; upload once and reconcile. Update membership announcement to mention audio after delivery. Global old-client quota flags stay unchanged until a separate public-client compatibility confirmation.

References: original MIT-licensed `wechat-miniprogram/miniprogram-demo` file-sharing example and official `wechat-miniprogram/api-typings` `ShareFileMessageOption` (local path + optional fileName). No code/dependency copied. Existing SQLite transaction and Range contracts retained.

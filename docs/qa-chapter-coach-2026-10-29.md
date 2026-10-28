# Chapter mistakes to AI Coach — development acceptance

Date: 2026-10-29 (Windows local clock, Asia/Shanghai).

## Delivered scope

- Chapter and legacy Topic Drill mistakes show an explicit `问 AI Coach` action. Correct, unsubmitted and unavailable results do not trigger AI. Full-paper exam pages and server authority are unchanged.
- Only the current question, its source images and current answer revision are prepared. QP-only source URLs, region geometry/version, owner and privacy epoch are checked. Original foundation questions retain their original/non-official label and all options.
- The app saves up to two labelled images internally, then sends them and the student answer to the existing complete-answer flow once. The student can preview all saved images. No photo-album permission is requested.
- Answers request separate final answer, worked steps and error/check sections. AI/reference feedback is not treated as official scoring authority.
- Real download bytes, cancellation, login recovery, stale context, storage rollback, expiry and logout cleanup are covered. Overlong content fails explicitly instead of silently omitting pages.

## PASS evidence

- `npm run test:all`: exit 0, including native WXML/WXSS compiler, privacy, membership, download, IELTS, Coach and chapter suites. Local external paper-catalog fixture audit reports SKIPPED because that dataset is not in this isolated checkout; no corpus completeness claim is made.
- Four new chapter suites: snapshot/source binding; actual draw/crop planning; two-photo/one-shot handoff; opt-in navigation/cancellation.
- Actual transformed packages: deterministic twice, 354 runtime files; 10 chapter/ownership suites plus 4 PDF transfer suites run against the built output.
- Main package: 1,965,082 bytes; headroom 132,070 bytes, above the unchanged 131,072-byte minimum.
- Frozen runtime SHA-256: `f61d9ad108036902236665a7bd969b8c8c6c8ea59029d1eaedebb5e719d7aa3d`.
- Official WeChat simulator, phone: chapter button visible, double tap opens once, native 2D canvas export and file copy, route-to-Coach, exactly one automatic request per entry, SSE completion and readable answer/steps/error modules.
- Objective case: one 1200×1000 image, 23,679 dark pixels and all 1,200,000 opaque pixels. Written case: two images, 1200×1000 and 1200×1600, each with non-uniform visible content; actual outgoing request contains both. Repeated onShow does not add a call.
- Independent read-only review: no remaining P1/P2 blocker.

Native QA found and fixed two issues before upload: percent-encoded question/entry parameters in real WeChat, and missing animation-frame callbacks from an offscreen canvas. Both now have regression tests.

## Explicit verification limits

Simulator images, user identity, grading and SSE answers are synthetic local QA fixtures. No real student data, paid AI call or production grade was created. Real phone/iPad rendering, actual provider answer quality and live source-image transfer on mobile data are NOT VERIFIED in this turn. Phone screenshots and device/unit layout checks are not claimed as physical iPad acceptance.

Evidence directory: `D:/CodexWork/chapter-mistake-coach-20261029/` — `full-tests-final.log`, `native-mcq-evidence.json`, `native-mcq-pixels.json`, `native-written-evidence.json`, `native-written-pixels.json`, `native-answer-modules.png`, and frozen package manifests. QA helper is outside the upload tree.

## Release boundary

Client-only change based on uploaded 1.0.64. Development upload is distinct from review/public release. No server restart/deployment, provider configuration change, IELTS random-exam fix, payment/IAP change or global download-quota activation is included. Original project IDE configuration remains user-owned and unchanged.

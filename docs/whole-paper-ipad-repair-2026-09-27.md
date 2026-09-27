# Whole-paper marking: iPad recovery and report integrity

Date: 2026-09-27, live Windows time (Asia/Shanghai).

## Changes

- Preserve selected PDF/images as bounded app-owned copies before submitting;
  never move or delete the original picker/camera file.
- Resume lifecycle-interrupted uploads on return for the same owner, privacy
  epoch and draft. Explicit pause stays paused. A late create response retains
  a reachable continue action.
- Bind every create/get/upload response to its original draft and operation.
  Switching to a new or historical task invalidates late replies. Keep the
  manifest fields frozen until creation settles, even after an explicit pause.
- Accept legacy `tempFilePaths` image selections. Wait for the native chooser
  callback instead of discarding it after an arbitrary five seconds; provide an
  explicit cancel action.
- Clean owned temporary copies after confirmed submission/cancellation and on
  explicit logout. Account changes during copy cannot revive private records.
- Reject empty completed report envelopes in the UI; suppress contradictory
  scores for incomplete/evidence-free results and label every score AI estimate.
- Keep submission reachable on portrait iPad and narrow landscape Split View;
  show the current job before the stored file list. Full-width landscape retains
  two columns. Preserve the original 128 KiB main-package headroom requirement.
- Download private reports in 64 KiB ranges with a strong version validator.
  Persist checkpoints only for confirmed local writes; interrupted downloads
  resume the same report instead of submitting it for AI marking again.
  Explicit pause remains paused, lifecycle return resumes, and cached/partial
  files stay bound to owner, privacy epoch, job, kind and PDF version.

## Verification

- `npm run test:all`: PASS, including native WXML/WXSS compilation.
- Report-state regressions: 6/6 PASS, after reproducing the former failures.
- Real local HTTP client -> backend -> image/PDF assembly -> job -> report:
  PASS (27 requests in the final run; inference is an explicit
  fixture, not a live AI claim).
- Download lifecycle: 4/4 PASS. Downloader regressions additionally cover
  interrupt-during-write, logout during file checks, truncated completion flags,
  concurrent same-owner requests, version changes and malformed ranges.
- Independent lifecycle, private-file ownership/cleanup, report and tablet
  contract review: no remaining reproduced P1/P2 in the reviewed snapshot.
- Official Developer Tools synthetic report UI: PASS; empty result rejected,
  two questions rendered, 390 px page without horizontal overflow. No student
  storage was seeded or real student files submitted by that UI fixture.
- Original `project.config.json` unchanged (SHA-256
  `a6d9c6a9cb8c4732f591272e9f18db86c12628cb2aa5fedecd9efb97ce5705fa`).

## Release boundaries

No physical iPad/Pencil is attached. Portrait, landscape and Split View behavior
have synthetic/state/style coverage, not real-device acceptance. Per-API WeChat
privacy declarations still require an effective platform configuration; general
consent alone is not proof of file-picker permission.

The earlier public production synthetic baseline reached AI completion with the
expected 3/4 estimate, but its PDF download timed out. The first repair candidate
also exposed real-provider response-schema failures and was rolled back before
retesting. Neither of those earlier runs counted as end-to-end acceptance.

The corrected backend commit `66182f628a1deed998b20aa01b3188f2043e3a35`
was deployed as a two-module overlay after fresh before/after resource and health
gates. All five HTTP health checks passed; the unrelated IELTS service was not
restarted. A verified prior release remains available for rollback.

Final real-model synthetic acceptance passed through public production HTTPS:

- Two ordered answer images + question paper + mark scheme: completed in 24 s,
  full journey 49 s, two question results, expected 3/4 AI estimate.
- One two-page answer PDF + question paper + mark scheme: completed in 27 s,
  full journey 43 s, two question results, expected 3/4 AI estimate.
- Both reports were deliberately interrupted after 65,537 downloaded bytes,
  resumed using the maintained Mini Program downloader over real HTTPS, and
  matched the server's strong SHA-256 ETag. Both final runs used zero model
  retries and zero network retries.
- Both PDFs were rendered and visually inspected: one A4 page, legible Chinese
  and English, no clipped feedback, correct question-level evidence and marks.
  These are synthetic QA answers, not actual student submissions.

The live download adapter used an isolated synthetic filesystem/account. It
does not replace native iPad file-picker, lifecycle or Apple Pencil acceptance.
Development-package upload, review submission and public publication are
separate actions; the upload receipt must record the final package hash.

Reference consulted: [Tencent's maintained upload implementation](https://github.com/Tencent/tdesign-miniprogram/blob/develop/packages/components/upload/upload.ts).
Range/version checks follow [HTTP Semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#name-range).

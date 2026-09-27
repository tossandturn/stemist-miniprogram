# Whole-paper marking: iPad recovery and report integrity

Date: 2026-09-27, live Windows time (Asia/Shanghai).

## Changes

- Preserve selected PDF/images as bounded app-owned copies before submitting;
  never move or delete the original picker/camera file.
- Resume lifecycle-interrupted uploads on return for the same owner, privacy
  epoch and draft. Explicit pause stays paused. A late create response retains
  a reachable continue action.
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
  PASS (27 requests after adding Range download; inference is an explicit
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

The public production synthetic baseline reached AI completion with the expected
3/4 estimate, but its PDF download timed out. This is **not** a full production
acceptance pass. Backend repair deployment, report-download acceptance and
development-package upload must be recorded separately when they actually pass.

Reference consulted: [Tencent's maintained upload implementation](https://github.com/Tencent/tdesign-miniprogram/blob/develop/packages/components/upload/upload.ts).
Range/version checks follow [HTTP Semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#name-range).

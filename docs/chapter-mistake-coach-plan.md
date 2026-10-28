# Chapter mistake to AI Coach

User request: after a chapter-practice mistake, let the student choose to automatically prepare/save the question image and ask AI Coach to solve it. One explicit tap initiates the flow; there is no default background call on every mistake and no photo-album permission.

## Scope and source

- Base: released 1.0.64 lineage (`9744e14` metadata head, runtime `59ef223`). Keep incomplete payment changes and the separately diagnosed IELTS random-exam bug out of this change.
- Existing chapter-practice page offers `问 AI Coach` beside a confirmed incorrect objective result or a marked written part that lost marks. Correct/unsubmitted/unavailable results do not falsely count as mistakes.
- New ordinary Coach subpackage preparation page reads only the selected session/question/answer revision, verifies the current owner/privacy epoch, and preserves original answers and scores.
- Use authoritative question-region images or original-foundation prompt/options. Never use a mark-scheme image, another question, an untrusted URL or a stale answer revision. Label full-page fallback with the exact question number.
- Save prepared images in the app-owned Coach folder, not the phone album. Compose at most two readable images, including a separately labelled student answer when present. Bound downloads, dimensions and total canvas height; fail explicitly rather than silently omit pages or shrink them beyond readability.
- Reuse `stageCoachEntry`, owned Coach photos and the existing Answers page. Carry question/source identity, student answer, result provenance and a focused request for the answer, steps and mistake explanation. Bind the auto-send nonce to this entry; repeated onShow does not send again.
- Support cancel, retry, download progress, source missing, canvas failure, storage failure, navigation failure and account/answer changes. No provider/model/backend or payment changes are intended.

## Acceptance / tests first

1. Wrong/correct/unsubmitted/unavailable objective results and partial written marks; original questions remain labelled original.
2. Only current question and answer images are selected. Validate region URL/geometry; reject MS/foreign/traversal URLs; preserve ordered multi-region content.
3. Preparation cancels after every asynchronous boundary on hide, unload, owner/epoch or answer revision changes; late callbacks cannot write a new account.
4. Image packing/export is bounded and contains every selected block; no blank placeholder is used as evidence. Downloads use real byte progress, not invented percentages.
5. Photo/context commit has rollback on storage failure; cleanup removes only newly owned generated files. Existing student photos/attempts/grades stay intact.
6. Exactly one automatic Answers request after successful preparation, with question/answer context and both images if needed. Wrong entry, old nonce, double tap and reopen do not auto-send.
7. Focused suites, all Mini Program regressions, transformed-package tests, 128 KiB main-package headroom, real WeChat compiler and isolated native UI/image-export QA.
8. Sync the verified branch and upload a new monotonic development version only after acceptance. No claim of real-device/provider acceptance without evidence.

## References / UI

- Official GitHub sample searched first: [WeChat canvas example](https://github.com/wechat-miniprogram/miniprogram-demo/blob/0fe5c7df8e90582dd0b89e283df7fe32e04413f9/miniprogram/packageAPI/pages/page/canvas/canvas.js). The installed application uses the newer 2D canvas path; no third-party code or dependency was copied.
- Keep STEMist's established purple/white tokens and native header/buttons. UI skill search favours accessible contrast, real loading feedback and 44px controls; its generic app-store landing layout and font suggestions do not fit this in-app workflow.
- Load only current-question assets with bounded caching; do not download full paper PDFs as part of this handoff.

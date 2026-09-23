# Whole-paper PDF picker repair

## Observed failure and scope

- The user confirmed that tapping "选择作答 PDF" opens no file chooser (before upload).
- The active Developer Tools page had no selected answers or existing job, was authenticated and editable, and displayed the old generic "文件选择失败，请重试。" message.
- The old catch discarded native `errMsg`. The exact device error and the live WeChat file-collection declaration are therefore **not verified**.
- The old picker always awaited a privacy query before invoking the native chooser. The fix prefetches privacy state and invokes the chooser directly from an already-authorized tap. A timing regression proves the old asynchronous boundary, not that every WeChat device enforces the same gesture restriction.

## Change boundary

- Keep explicit privacy consent and account/privacy-epoch isolation.
- Preserve the selection lock while the native chooser hides the page and while the returned file is inspected.
- On returning to the visible page without a native chooser callback, allow a five-second callback grace before restoring retry. Never time out time spent inside the chooser; late callbacks are isolated from subsequent selections.
- Show actionable selection failures beside the selection controls; cancellation remains retryable and is not an error.
- Keep PDF inspection, ordered upload, asynchronous marking and private-report APIs unchanged.
- No provider migration, server deployment, database change or public publication is part of this repair.

## Verification

- `npm run test:all`: PASS, including WXML/WXSS native compiler checks.
- Focused regression covers a selected PDF reaching queued submission, chooser hide/show, delayed inspection, consent required, failed/pending privacy query, cancellation/retry, oversize files, native failure and owner/epoch changes.
- Native automation initially read the failure state. Subsequent automation calls timed out after exercising the picker; one simulator refresh did not recover evaluation. Real-phone chooser and final submission acceptance remain **NOT VERIFIED**.

## Platform setup still required

For PDF selection, verify that the current Mini Program privacy guide declares collection of the user-selected files for answer/reference upload, AI marking and report generation. Existing camera/microphone declarations alone do not establish this. Do not replace an undeclared API failure with repeated consent prompts.

References: [WeChat file selection API](https://developers.weixin.qq.com/miniprogram/dev/api/media/image/wx.chooseMessageFile.html), [Tencent's upload component implementation](https://github.com/Tencent/tdesign-miniprogram/blob/develop/packages/components/upload/upload.ts).

## Upload receipt

- Development code **1.0.18** uploaded successfully through official Developer Tools on 2026-09-23.
- Runtime commit: `3342477`; frozen input: `D:/CodexWork/stemist-miniprogram-review-1.0.18-3342477`.
- Compiled total: 1,935,846 bytes; main: 1,893,256 bytes; marking subpackage: 42,590 bytes.
- Frozen-source comparison initially detected CRLF/LF differences only; normalized content comparison and the frozen package's picker regressions passed.
- Source pushed to `origin/master`. The user-owned `project.config.json` was excluded from commits.
- This confirms code upload only, not review submission, publication or real-phone acceptance. The phone must open the new development/experience package to exercise the repair.

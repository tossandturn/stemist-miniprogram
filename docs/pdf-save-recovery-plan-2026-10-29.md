# PDF save failure recovery

Scope: user screenshot, BPhO `2024_Nov_R1_S1_QP.pdf`, 422530 bytes. Baseline: uploaded 1.0.65, runtime hash `f61d9ad108036902236665a7bd969b8c8c6c8ea59029d1eaedebb5e719d7aa3d`.

Evidence: the public detail matches the screenshot. In the isolated official WeChat simulator, real GET Range returned 206, 262144 bytes, real write/read returned `%PDF-`, and the normal page completed both ranges and full verification. The exact device failure is not yet reproduced without fault injection; do not call it confirmed disk exhaustion.

Confirmed code defects: the filesystem adapter identifies space exhaustion only from English error text, ignoring official errno 1300202. Every callback failure is described as storage-full, including I/O, permission and read errors. The verified temporary-download path runs only on that text-derived space classification, so other persistent-cache write failures stop the student at 0% with no recovery.

Plan: tests first for errno-only quota, non-quota write failure, explicit read-error copy, verified temporary fallback, and preservation of private/partial/working files. Add narrowly scoped error classification and fall back only for persistent write/append/directory failures, with the existing HTTP, digest, owner and cancellation gates preserved. Never clear all Mini Program storage. Keep temporary-preview progress and completion wording accurate. Verify actual WeChat filesystem with injected native error callbacks, real public PDF downloads and content hash; then full regression, package headroom and development upload. No backend or model changes.

References: GitHub searched first, [official API typings](https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.api.d.ts) documents binary ArrayBuffer writeFile, errno 1300202 and downloadFile's temporary-file result without filePath. [Official demo](https://github.com/wechat-miniprogram/miniprogram-demo) contained no directly reusable recovery implementation in the bounded search. No dependencies or external code copied.

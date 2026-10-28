# PDF save recovery acceptance — 2026-10-29

## Fixed

The screenshot's BPhO file is `2024_Nov_R1_S1_QP.pdf`, 422530 bytes, SHA-256 `e7646de3d50dbdceea6953dfc9cd1c0223719066331d6f3cc2343f21c557dc7a` according to the live public catalogue. A healthy real WeChat filesystem can save it; the screenshot alone does not establish the user's device error code or disk exhaustion.

Confirmed defects: errno-only storage exhaustion was missed; unrelated filesystem errors incorrectly told users to free storage; non-quota persistent write failures had no temporary fallback. Official errno now takes precedence, only explicit quota evidence can trigger existing completed-public-cache reclamation, and write/append/mkdir failures use the verified temporary-download path. Private work, active files and resumable prefixes are preserved. Read and temporary API failures retain meaningful categories. Temporary viewing is labelled as not saved to persistent cache.

Live simulator testing also exposed overdue throttled progress overwriting a newer event. A new regression reproduced 300→200 bytes; immediate newer progress now cancels the pending older update and preserves the highest observed byte count.

## Evidence and results

- **PASS**: full `npm run test:all`, including actual transformed-package tests, chapter Coach regressions and official WeChat WXML/WXSS compilers.
- **PASS**: independent read-only review of storage recovery and privacy boundaries; progress correction additionally reviewed and tested locally.
- **PASS**: official WeChat simulator with the real public PDF, real filesystem and real `openDocument`, injecting only specified native errors/network interruptions. Baseline reproduces screenshot-equivalent 0% error with no fallback. Final candidate recovers I/O and errno1300202 quota failures; successful files exactly match catalogue size and SHA-256.
- **PASS**: failed append retains the 262144-byte prefix while the full temporary preview opens. Interrupted network retains the same checkpoint. Retry requests only `bytes=0-4` for identity validation and `bytes=262144-422529` for remaining content.
- **PASS**: complete cache reuse sends no network requests. Progress is monotonic within each transfer; switching to a separately labelled temporary download intentionally begins that new transfer at zero.
- **PASS**: no server code/configuration change, no production restart, no private-file/broad-cache cleanup, no payment/quota activation.
- **NOT VERIFIED**: exact errno on the user's device, physical Android/iOS/iPad behavior and hardware capacity. Controlled native-error injection verifies the recovery mechanism, not the precise origin of their screenshot.

Final candidate commit: `f4b4da2907a5845ea7c98a9c76515515c2ef2873`. Runtime SHA-256: `e61229f2d662ee5966478b84de3ee8a4cc6473a273b84fd493f5a164ef973777`. Main package 1,965,868 bytes, headroom 131,284 bytes; unchanged minimum 131,072 bytes.

Artifacts: `D:/CodexWork/pdf-save-recovery-20261029/`, including `native-acceptance.json`, `baseline-io.json`, `native-*.json`, `native-fs-probe.json`, `full-tests-final.log` and screenshot evidence. Tests used isolated guest project storage, never a real student's account. Probe files were exact newly created paths; injected API wrappers are restored after testing.

References: [WeChat official API typings](https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.api.d.ts) for errno, writeFile ArrayBuffer and downloadFile temporary paths; [official sample repository](https://github.com/wechat-miniprogram/miniprogram-demo), searched before implementation, with no third-party source copied.

**UPLOADED:** development 1.0.66, 2026-10-29 04:54:59 Asia/Shanghai, official CLI success. Frozen commit `aad9925a99021e932d287c4d7f088886ada443d3`, runtime identical to the final tested candidate. Both local release ledgers reconciled. No review/public release or backend mutation.

# Download progress contract

Updated from the Windows system date: 2026-10-07.

Every user-visible binary download uses `pdf-download-progress`, with state from
the existing PDF controller or `buildTransferProgress`. No timer invents a
percentage or remaining download size.

| Entry | Transport | Progress and recovery |
| --- | --- | --- |
| A-Level past papers / mark schemes / paper workspace | `pdfDownload` + `pdfRangeCache` | Measured bytes, ETA when sampled, verified cache, Range resume |
| AP / IB papers and mark schemes | Same controller | Same progress and cache contract |
| Whole-paper answer PDF, report PDF and temporary preview | `marking/reportDownload` | Permission check, download, verification, cache, open, pause/retry |
| IELTS single / full writing report | `writingReportDownload` | SDK byte progress, open, cancel/retry; retry is a new direct download, not Range resume |
| IELTS listening practice / full-exam audio | `listeningAudioCache` + `listeningAudioRangeCache` | Selected-track progress, full local cache, validated Range resume or bounded native fallback |

- Known total: bar width follows real bytes. Incomplete verification never claims 100%.
- Unknown total: an indeterminate bar plus measured received bytes; no guessed percentage.
- Failed or paused: retain received bytes, stop animation and discard stale speed estimates.
- Cache hit: identify cache reuse; do not simulate another download.
- Late callbacks cannot switch owners, tasks, tracks or disposed pages.
- Low-motion setting disables the indeterminate animation. Controls have 44px touch targets.
- Ordinary JSON API calls, local photo/file selection and automatic image rendering are not file-download actions.

## Evidence

- `test-download-coverage.mjs` inventories all binary network transports and their UI surfaces.
- `test-transfer-progress.mjs`, PDF/Range, listening, whole-paper and writing tests cover measured, unknown, terminal and lifecycle states.
- `test-download-progress-native.mjs` renders five **synthetic layout-only** states using the actual native component. It makes zero network/provider calls and accesses no student data. Screenshots and geometry are under the release-coordination download-progress folder.
- Native WXML/WXSS compilation and the full repository regression suite remain release gates. Simulator layout checks do not claim physical-phone network or iPad hardware acceptance.

## Package discipline

The 128 KiB main-package reserve is unchanged. The unused/unregistered legacy
`text-practice` component remains in source but is excluded from the upload.
The packager rejects any new registration or import of an excluded module.
Account authentication, every question, diagram and topic icon remain included.
`compact-wxss.mjs` removes only formatting whitespace and verifies the PostCSS
structure before/after; it does not alter selectors, values, comments or ordering.
Runtime line endings are fixed to LF for reproducible byte budgets on Windows.

## Primary references

- [WeChat official API typings](https://github.com/wechat-miniprogram/api-typings): `DownloadTask.onProgressUpdate`, `totalBytesWritten`, `totalBytesExpectedToWrite`, and `abort`.
- [WeChat official Mini Program demo](https://github.com/wechat-miniprogram/miniprogram-demo): native download task pattern.

No third-party runtime code or dependency was added. These changes improve
download visibility; they do not claim to increase a user's network bandwidth.

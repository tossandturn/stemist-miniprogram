# PDF slow-network and resume QA

Windows date verified: 2026-09-16, Asia/Shanghai.

## Fix

- Public PDF downloads now prefer bounded HTTP Range requests when the Mini Program file manager supports `writeFile` and `appendFile`.
- Each PDF keeps a scoped local partial file. A failed request leaves the written byte count and retry starts with `Range: bytes=<written>-`; the suffix is appended, then the completed file is opened and entered into the existing bounded cache.
- Existing `downloadFile` remains the compatibility fallback for older runtimes. Identity, privacy epoch, scope cancellation and cache validation are unchanged.
- Progress now says that bytes were retained and retry can resume. No fake progress or automatic infinite retry was added.

## Verification

- `node scripts/test-pdf-download-progress.mjs`: PASS, including 400/800-byte failure then `bytes=400-` suffix retry, append, open, cancellation and cache/identity boundaries.
- Production static endpoint probe: `206 Partial Content`, `Accept-Ranges: bytes`, `Content-Range: bytes 0-99/168403` for the Physics PDF; Range support is available on the current server.
- The legacy WebView redirect route is no longer included in the native upload package; the repository files remain untouched in source history, and `app.json` now exposes only native routes. This recovers package headroom without deleting question data or user records.
- `node scripts/build-native-package.mjs --check-only`: runtime budget remains enforced; no data or server files changed.
- The existing WeChat compiler checks remain PASS. Physical China mobile throughput and radio handoff still require device measurement; the implementation does not claim to remove carrier latency.

## Delivery

- The patch will be delivered as the next development version after the package budget and focused regressions pass. Review submission and online publication remain separate operations.

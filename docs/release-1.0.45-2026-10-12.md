# Development 1.0.45 — resilient paper downloads

Date source: the live Windows clock, Asia/Shanghai. Runtime changes were committed on 2026-10-11; final acceptance continued after midnight on 2026-10-12.

## Delivered implementation

- Public PDF downloads use a useful 256 KiB first request and measured adaptive ranges between 32 KiB and 1 MiB, with at most two active requests per file and four globally.
- The ahead-of-checkpoint transfer window is capped at 2 MiB. Only the ordered writer commits contiguous bytes. UI progress and persisted resume offsets never claim unwritten future ranges.
- Cancellation drains already-started writes, aborts active/queued requests, and preserves the contiguous prefix. Resume validates the source with a 5-byte probe, then requests the saved offset rather than downloading the prefix again.
- Strong ETag/If-Range, response ranges, PDF signature, exact length and full SHA-256 checks remain enforced. Completed legacy caches remain compatible and network-free; SHA bridge reads are bounded at 512 KiB.
- Full-span response buffers are reused for filesystem writes instead of copying another full response. No runtime dependency, cache-size increase, permission change, domain change or remote executable code was introduced.

Changed runtime: `utils/pdfRangeCache.js`. Tests: `scripts/test-pdf-range-cache.mjs`, new `scripts/test-pdf-transfer-pipeline.mjs`, and the `test:pdf-download` package script.

## Why client-only work was not sufficient

The same-file Windows HTTPS A/B still encountered slow public transport even after reducing request overhead. Guest Nginx and traffic-control inspection found no configured rate limiter. Host-wide counters increased by roughly 6.5–6.8 retransmitted segments per 100 outgoing segments in broad windows overlapping tests; these shared-host counters cannot alone identify a particular download or carrier.

The user then explicitly authorized a reversible, runtime-only BBR test. The existing kernel's root-owned BBR module was loaded without install hooks; only the TCP default changed from CUBIC to BBR. No service, qdisc, kernel package, firewall, routing, DNS or dataset was changed. Fresh full-host safety/health gates passed before and after the trial.

## Measured results

The following compares the **same frozen NEW client engine and same exact files**, two observations per board before/after the temporary network change. All after-files completed and matched their expected SHA-256. These are Windows direct HTTPS observations, **not physical-phone measurements or a guaranteed mobile speed**.

| File sample | Exact bytes | CUBIC observations | BBR observations |
| --- | ---: | --- | --- |
| CIE `0610_s25_qp_43.pdf` | 3,028,952 | Both reached the 60 s benchmark deadline incomplete | 3.924 s / 2.394 s |
| AP Physics 1 2023 international FRQ scoring standard | 1,070,392 | 35.670 s / 31.937 s | 1.092 s / 1.319 s |
| IB Physics SL 2025 Nov P2 TZ3 question paper | 1,049,783 | 29.427 s / 22.545 s | 0.891 s / 0.979 s |

No elapsed ratio is calculated from an incomplete CIE download. The pre-change A/B consumed 14,641,104 received bytes under a 30 MiB cap; the BBR NEW_ONLY control consumed 10,298,254 under a 15 MiB cap. There were no budget overruns, credentials, real-user storage or remote writes in either benchmark.

Synthetic equal-byte tests separately covered latency, per-connection bandwidth caps, a shared aggregate cap and a stalled segment. They passed exact bytes/hash checks, but their ratios are not mobile-network claims.

## Acceptance

- PASS: complete `npm run test:all`, including existing feature, cache, progress, ownership, integrity, native compilation and package-budget suites.
- PASS: independent code review, out-of-order completion, failed-span subdivision, global queue cancellation, two-request abort, append drain, legacy cache, tiny EOF, corrupt/mixed/missing validators and SHA failure.
- PASS: actual WeChat DevTools native pages, public server responses and real filesystem writes. No response bodies, successful download results or `openDocument` callbacks were mocked.
- AP: cancelled at 262,144 durable bytes, aborted both active ranges, then resumed with `bytes=0-4` validation followed by the saved byte. Exact 1,070,392-byte file opened successfully. Hot open added zero requests and took about 0.15 s through cache verification/open callback.
- IB: exact 1,049,783-byte file downloaded/opened, then hot-opened with no new network requests. Real progress, speed and estimated time were captured.
- CIE: a slow native run was deliberately cancelled at 2,162,688 bytes. After the network trial it resumed from that byte, completed the remaining 866,264 bytes in about 4.2 s, verified and opened the exact 3,028,952-byte PDF. A hot open added zero requests.
- A-Level: the exact 553,108-byte `9709_s25_ms_13.pdf` opened with three bounded requests, then hot-opened without network. This DevTools cold sample still took about 11.3 s, demonstrating that not every path becomes equally fast.
- PASS: visible progress/byte totals, remaining-time text and source-specific filenames were inspected in native screenshots. All temporary observers were restored.
- The Windows system proxy was enabled with a loopback proxy configured; it was not changed. Native DevTools timings must not be described as proxy-free mainland-phone timings. Physical Android/iPhone/iPad and carrier-specific speeds remain NOT VERIFIED.

## Release identity and status

- Runtime commit: `3fe529178c2d8ee8df15c01eb053d66dd3798f49`, pushed.
- Frozen package: `D:\CodexWork\paper-download-fix-20261011T230138\native-release-1.0.45`.
- Package manifest SHA-256: `e0b6e6c415ce1b7a1ff14c6c0318f3ec1714ac22da1cda06f992dd5da7776822`.
- Runtime manifest SHA-256: `e8bbfc7b9a4a1b221f85f88aa5e478906d485bc122ef68fcf7e67c22c3bfe21b`.
- Transformed source main package: 1,954,549 bytes; 142,603 bytes of headroom against the unchanged 131,072-byte source-package gate. Actual WeChat compiled size must be recorded separately from its upload receipt.
- Protected source `project.config.json` SHA-256 remains `a6d9c6a9cb8c4732f591272e9f18db86c12628cb2aa5fedecd9efb97ce5705fa`.
- Development upload: **SUCCESS**, 1.0.45, official tool completed at **2026-10-12T00:20:56.5217550+08:00**. Receipt: `D:\CodexWork\paper-download-fix-20261011T230138\wechat-upload-1.0.45.json`. No review submission or public release. This upload's sanitized receipt confirms success but does not contain compiled package sizes; source-package headroom above must not be presented as an observed compiled headroom.
- BBR boot persistence: **PASS**, explicitly authorized by the user after successful measurements. Two dedicated files were exclusively created; existing configuration was not overwritten. Read-only rollback eligibility confirmed exact bytes, root:root ownership, 0644 mode, single links and unchanged inode identities. The scripts' 12/10 local fixture tests and independent safety review passed. No reboot or destructive production rollback was performed or claimed as tested.

### Server after-gate and rollback coverage

At 2026-10-12T00:20:12.338263+08:00, all 37 core gate checks and all product-config checks passed. Available memory was 2,466,721,792 / 3,904,786,432 bytes, swap use 159,621,120 / 2,084,564,992 bytes (about 7.66%), disk usage 81.13% with 9,240,727,552 bytes free, and inode usage 14.69%. Three I/O-wait samples were 0% / 1.01% / 0%. Existing STEM/IELTS process identities and restart counters remained unchanged.

Created configuration, and no other system configuration:

- `/etc/modules-load.d/99-stemist-pdf-bbr.conf`: SHA-256 `56313e8e52505dab7950c343129d1723514c37d09857ab62a26763a27b1e49fa`.
- `/etc/sysctl.d/99-stemist-pdf-bbr.conf`: SHA-256 `5756e3df16911c1e35cf2582c4ec45f8e60616a676efa5e0e11842fefa9867f7`.

Task-local `network-readonly/bbr-persistence-rollback.py` defaults to a read-only check. Its explicit rollback transport removes only these exact matching files and restores the recorded CUBIC runtime default; it refuses unexpected content, permissions, inode replacement, target/kernel drift, or another congestion algorithm. Any future rollback still requires a fresh readiness gate. No in-use module is forcibly unloaded.

Final server gate receipt: `D:\CodexWork\backend-driven-foundation-20261011T012618\deployment\download-bbr-persist-after-20261012-002002.json`, SHA-256 `746f06a8603c62876df8f2b1307bfcd396f7945fe233ff80361bc802964ac8c5`.

## Evidence and source references

Task evidence: `D:\CodexWork\paper-download-fix-20261011T230138`.

- `full-regression.log`, SHA-256 `865392247c501a901a2deccd5fff822adf1787ecc7581b57402ea26b08f37daf`.
- `benchmark/synthetic-results.json`, `benchmark/real-results.json`, `benchmark/real-bbr-results.json`.
- `benchmark/independent-review.md`; `native-qa/*-observe.json` and native progress screenshots.
- `acceptance.json`: automated cross-check of all four native sample journeys, saved offsets, exact lengths, opened files and zero-network hot cache.
- `network-readonly/bbr-persistence-applied-20261012.json` and `bbr-persistence-rollback-check-20261012.json`: create-only deployment and read-only rollback eligibility; no destructive rollback was executed.
- `network-readonly/REPORT.md`, runtime trial receipts, and `https-cc-observe-native-alevel-20261012.json`. The latter overlapped the A-Level native transfer and observed BBR data-bearing HTTPS sockets, but remains a shared-host aggregate, not an individual phone trace.

Implementation ideas were checked against [aria2](https://github.com/aria2/aria2) (GPL-2.0 family) and [miniprogram-network](https://github.com/NewFuture/miniprogram-network) (Apache-2.0); no code was copied and no dependency installed. Network behavior was checked against [Google BBR documentation](https://github.com/google/bbr/blob/master/Documentation/bbr-quick-start.md), [Linux v6.8 IP sysctl documentation](https://github.com/torvalds/linux/blob/v6.8/Documentation/networking/ip-sysctl.rst), and [iproute2 ss](https://github.com/iproute2/iproute2/blob/main/man/man8/ss.8).

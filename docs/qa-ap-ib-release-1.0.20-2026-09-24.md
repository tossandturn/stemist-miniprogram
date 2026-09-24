# AP / IB release receipt — 1.0.20

Recorded using the live Windows date: 2026-09-24, Asia/Shanghai.

## Delivered

- Mini Program runtime commit: `0da5cdd7ef6835f22efdfbf3991397b1062f8ffd`.
- Backend runtime commit: `1d985ceedc322f29eb82c21369b1d5a47d220c10`, pushed on
  `codex/ap-ib-catalog` in the STEM repository.
- Backend release: `apib-20260924T104531Z-1d985ce`, activated successfully.
- Prior runtime `wp-hotfix-20260922T201335Z-d798a66` retained for rollback.
- Developer upload **1.0.20 succeeded**. This is not a WeChat review submission or
  public Mini Program publication; neither was performed in this turn.
- Frozen upload directory:
  `D:/CodexWork/stemist-miniprogram-review-1.0.20-0da5cdd`.
- Upload receipt:
  `D:/CodexWork/stemist-release-coordination/ap-ib-upload-1.0.20.json`.

Compiled upload sizes reported by WeChat: total 1,968,171 bytes; main 1,888,724;
curricula subpackage 26,118; marking subpackage 53,329. The raw main-package
reserve gate also passed: 1,965,548 bytes, 131,604 bytes of headroom.

## Data truth

- Live AP catalogue: 54 FRQ entries, 108 unique QP/MS files.
- Live IB catalogue: 334 QP entries, 333 candidate MS files.
- All 388 entries have `practiceReady=false`.
- All 775 file records have unconfirmed redistribution authorization. Live
  `downloadable=0`; no source PDFs were publicly rehosted or released by this turn.
- Only catalogue metadata/API were deployed. Acquired PDFs remain in the local
  source collection. They are not claimed to have been uploaded to the server.
- Official AP links can be copied. Candidate IB pairing and source variant labels
  remain visible, rather than being relabelled as fully verified exercise data.

## Verification

- `npm run test:all`: PASS after updating the two old four-entry/eight-public-page
  test expectations for the explicitly requested six-entry/nine-public-page UI.
- Includes existing student/CIE/IELTS flows, crop, PDF progress, privacy, auth,
  speaking transport mocks, calculator, package budgets, page links, sharing,
  responsive/device contracts, contrast and native WXML/WXSS compilation.
- Backend builder and curriculum catalogue tests: PASS, including synthetic
  licensed-file GET/HEAD/Range/If-Range/416, integrity invalidation, safe filenames,
  path traversal/symlink containment and unlicensed-file rejection.
- Existing backend CIE catalogue (4,000 fixture records), native auth and
  whole-paper marking API regressions: PASS.
- Independent source-classification, backend/frontend and release review: PASS;
  no remaining reproducible P0/P1/P2 after fixes.
- Frozen 241 runtime-file hashes verified against the packaging manifest.

Live public checks after deployment:

| Request | Result |
| --- | --- |
| AP catalogue | HTTP 200; total 54; 0 downloadable |
| IB catalogue | HTTP 200; total 334; 0 downloadable |
| IB Physics / HL / 2025 / P1A | HTTP 200; 5 matching source entries |
| AP Calculus AB / 2026 | HTTP 200; 1 matching entry |
| Unknown board | HTTP 400 |
| AP with IB course | HTTP 400 |
| Unreleased source-file ID | HTTP 404 |

Native Developer Tools acceptance used the real deployed endpoint, not a fixture:

- Tapped the actual AP and IB home cards; both opened the correct native page.
- AP loaded 20 items / total 54, then selected Calculus AB and 2026: one entry.
- IB loaded 20 items / total 334, then selected Physics / HL / 2025 / P1A: five
  entries. Reset and next-page actions produced page 2/17 with distinct item IDs.
- No page error. AP page width was exactly the 390-pixel viewport; the checked
  document action was 44 pixels high. Screenshot review showed no horizontal
  clipping and preserved the native bottom navigation.
- Safe AP share URL contained only board/course/year; unit tests also cover
  Moments and exclusion of search text/private identifiers.

Screenshots are local evidence, outside the runtime package:

- `D:/CodexWork/stemist-release-coordination/ap-ib-home-20260924.png`
- `D:/CodexWork/stemist-release-coordination/ap-catalog-live-20260924.png`
- `D:/CodexWork/stemist-release-coordination/ib-catalog-live-20260924.png`

## Server safety

Fresh readiness gates passed before staging/activation and after restart. Before
activation, available memory was 2,362,748 KiB and free filesystem space about
16.996 GB. Afterwards, available memory was 2,436,432 KiB and free space about
16.994 GB; swap 97,424 / 2,035,708 KiB, filesystem 72% used, max sampled I/O wait 1%,
no active build/backup jobs. STEM/IELTS loopback/public health checks returned 200.
IELTS PID was unchanged. Database path continuity was verified without reading
database contents. No server build/dependency installation occurred.

Deployment fixes retained in the local release coordinator: shared publisher
lock, pre-switch current check, no rollback over a superseding release, exact
three-file receipt/hashes, parent-directory containment and exact new-directory
inventory. A brief SSH timeout was followed by read-only archive/current checks;
the verified uploaded archive was reused rather than blindly repeating a deploy.

## Preserved / not verified

The user's dirty `project.config.json` remains unchanged, Git blob
`6f455e4cee8dcd3e2ded4f2acc353b44c514972b`, and was excluded from commits. The dirty
primary STEM worktree, original AP folder, existing paper source catalogues and
IELTS production configuration were not modified.

Physical phone/iPad network performance, hardware microphone/camera behavior and
real WeChat recipient sharing were not retested by this AP/IB change. Simulator
and mocked-transport tests do not establish those results. The earlier selected-
file privacy review state was not rechecked, and no new claim is made about it.

The remaining release gap is public PDF distribution authority and, separately,
question-level practice/marking integration. A successful developer upload does
not make those source-only records a fully usable question bank.

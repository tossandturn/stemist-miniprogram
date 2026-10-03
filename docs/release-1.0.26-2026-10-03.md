# Development release 1.0.26

The previous 1.0.2 upload used an incorrect version number. The maintained
history contains the verified 1.0.24 upload and the 1.0.25 final frozen package
at commit `ca1ca120d11c00786186c45d295e8985400ccb49`. This release continues that
sequence as 1.0.26. `releases/development.json` and
`scripts/upload-development.ps1` now reject version downgrades and retain the
official upload size receipt, exact maintained commit, and frozen manifest.

Changes:

- Preserve the existing student identity when UnionID is temporarily absent,
  changes for the same OpenID, or reconnects a rotated OpenID in the same AppID.
- Reject two existing student identities that conflict; never merge their data.
- Retain a stable conflict code through the STEM account bridge and present an
  actionable Chinese recovery message in the Mini Program.
- Deploy from the IELTS source whose normalized bytes match production exactly.
  The 5-line identity change preserves all native API routes. Using the older
  `ielts-trainer` branch as a whole-file replacement would lose native APIs.

Validation:

- Mini Program `npm run test:all` passed, including WXML/WXSS compilation,
  account isolation, profiles, announcements, crop, native IELTS, whole-paper
  marking, sharing, downloads and calculators.
- Current IELTS candidate `npm run check`, native WeChat integration (including
  Writing/report ownership checks), and internal-account authentication passed.
- STEM full `npm test` passed during this repair round; its focused identity
  and native WeChat entry tests passed.
- Server resource gates before and after activation passed. Exact deployed
  source hashes and loopback/public native configuration, catalog and AP
  availability checks passed.

Official development upload succeeded on 2026-10-03 at 12:50 +08:00. The frozen
runtime commit is `a6103b2f91523805bb5268aaf579cc3cd6d9fad3`; official total size
is 2,049,687 bytes and main-package size is 1,896,592 bytes. The receipt is
`D:/CodexWork/stemist-release-coordination/release-1.0.26-20261003/upload-receipt.json`.
Native simulator acceptance passed for live catalogs, AP/IB licensed download
buttons, announcements, profile controls, chapter generation, camera recovery,
whole-paper entry and a native canvas crop retaining all four synthetic colours.
Public HTTPS checks passed for 14 paper catalogs and a complete synthetic native
login/session/source-image journey.

The development upload is distinct from WeChat review submission or publication.
Device-only camera/microphone permissions and physical mainland-network latency
remain physical-device checks. Subject qualifications and re-filing remain
public-platform actions governed by the account's own notification.

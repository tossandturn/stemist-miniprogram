# WeChat profile acceptance — 2026-09-28

Windows clock/timezone: 2026-09-28, Asia/Shanghai.

## Behaviour

- Account page displays the confirmed nickname and avatar; authentication ID, username and roles remain unchanged.
- Explicit WeChat login offers optional profile confirmation when no nickname exists. Silent startup login remains silent.
- Native `chooseAvatar` and `input type="nickname"`; form submission is authoritative after native content checks. A selected temporary avatar is copied to a bounded data URL before saving.
- Authenticated profile persistence uses `/api/stem/profile`; login and renewal retain returned profile fields.
- Account UI is lazy-loaded in `bundles/account`. The previous `/pages/account/auth` URL redirects with a retry state if loading fails.

## Verified locally

- Failing nickname/avatar propagation regression reproduced before implementation.
- Independent review reproduced three edge failures; all repaired and regression-tested: late login navigation, failed-save input retention and visible old-account profile clearing.
- Additional delayed login tests reject replacement of a newer account or session.
- Full `npm run test:all` passed after the final runtime changes, including native WXML/WXSS compilation, auth, sharing, image pipeline, main/subpackage contracts, responsive rules and existing learning flows.
- Main runtime 1,962,091 bytes; headroom 135,061 bytes (128 KiB minimum maintained). Account subpackage 15,112 bytes.
- Official Developer Tools rendered the profile editor at 390 × 753 CSS px. Nickname input measured 52 px tall and save button 48 px; screenshot visually inspected. Tablet-class rendering also inspected at that same viewport; this is not an iPad hardware test.
- Native debugger initially retained a stale project file-list for the new subpackage. Clearing only its project-file-list cache and compiling restored the actual page implementation. No auth/storage caches cleared; user's project.config.json SHA remains unchanged.

## Remaining evidence boundaries

Native WeChat avatar selection, WeChat nickname keyboard suggestion and physical phone/iPad interaction have not been performed here. Simulation and compilation do not prove these platform/device behaviours.

Server deployment, authenticated production round-trip and development upload results are recorded separately after completion. A successful development upload does not mean review submission or public release.

Official contract: [WeChat avatar/nickname filling](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/userProfile.html).

## Deployment and upload verified

- Backend source: `b953652a8eccabebd7846632f13d08775d441c09`, branch `codex/stem-profile-apib-20260928`. Root independently reran profile and AP/IB catalogue tests. Candidate is layered on the exact deployed AP/IB stemApi source; the earlier Git-only baseline was rejected because it would remove AP/IB routes.
- Active release: `/home/ubuntu/alevel-physics/releases/wechat-profile-20260928T065858Z-b953652`. Only `server/stemApi.js` and new `server/stemUserProfile.js` changed at runtime; no server build or dependency installation.
- Verified rollback: `/home/ubuntu/alevel-physics/releases/study-label-20260927T182203Z-9871395`. A private on-server SQLite backup was verified before activation. Code-only rollback is compatible with the additive profile table; no existing records were rewritten.
- Fresh pre/post readiness gates passed. At 15:07 +08:00: memory available 2.61 GB of 3.90 GB, filesystem 14.69 GB available, swap 8.9%, maximum three-sample I/O wait 0.5%; five loopback/public health checks HTTP 200. STEM process stable; IELTS process unchanged.
- Actual production HTTPS acceptance passed: save and read 200, nickname/avatar restored on login and session renewal, body owner override rejected 400, account ID/username/roles unchanged, profile image not placed in credentials, avatar clear persisted. One isolated synthetic QA account, no provider calls or student-record changes; QA sessions logged out.
- Existing public AP and IB catalogue endpoints remain HTTP 200; unauthenticated profile reads are HTTP 401.
- Official Developer Tools upload succeeded for **1.0.24**. Frozen runtime source `d902d0b2153f3d5c0ca953eb0c19ac5e90393d17`; subsequent integration-test/docs commits do not change its 254 runtime file hashes.
- Upload size receipt: total 2,006,431 bytes; main 1,886,417; account 16,035; curricula 26,118; marking 77,861.
- Development upload only. Review submission and public release were not performed. Native chooser/keyboard and physical-device limits above remain explicit.

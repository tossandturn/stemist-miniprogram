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

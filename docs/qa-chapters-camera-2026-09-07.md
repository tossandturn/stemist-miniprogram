# Chapter loading and camera recovery

Date: 2026-09-07, Asia/Shanghai, read from the Windows system clock.

## Findings and fixes

1. The public syllabus inventory used the authenticated request default. An expired session with an unavailable renewal path could reject before the public chapter request was sent. The page then mislabeled all exceptions as a network problem. Inventory now uses an unauthenticated public request, preserving the learner's session and drafts. Domain allowlist, TLS, timeout and server errors remain distinguishable. Failed initial loading no longer renders an empty set of paper/count controls.
2. Camera readiness was tied to the page's `onReady`, before the conditional camera component mounted. Capture could therefore be enabled over a black/uninitialized preview. The camera now checks privacy, Mini Program and system camera permission; mounts only after authorization; creates its context after `initdone`; and enables capture only when that succeeds.
3. Camera start/capture hangs have bounded timeouts. Backgrounding unmounts the camera; returning reinitializes it. Stale initialization and capture callbacks cannot act on a new mount, cancelled page or changed account.
4. Camera failures have visible recovery actions. Settings require a user tap; privacy consent uses the real agreement button. An explicit System Camera action uses one rear-camera image with `sourceType: ['camera']`, never an album picker. Failure placeholders are compact so recovery controls fit above the fold.

These are reproducible client defects. The supplied handset screenshots did not include its low-level exception, so this is not a claim that the handset's exact hardware/permission cause was captured.

## Evidence

- Public production API: AS Physics returned HTTP 200, 11 topics, P1/P2 and 120 verified question groups. A2 returned HTTP 200 and its own 14-topic/P4 scope. No readiness threshold or source eligibility was changed.
- `npm run test:all` passed after final runtime changes, including WeChat WXML/WXSS compilation, camera lifecycle, public inventory and existing native/Calculator/IELTS regressions.
- Expired-login fixture: chapter retrieval made zero renewal calls and forwarded no bearer; the fixture identity and existing draft were unchanged.
- Official WeChat phone simulator: real production chapter loading, topic selection, a complete 10-question set and original question-image loading passed. The second run preserved both returned original-page references and loaded the visible first page on demand.
- Camera permission failure, generic startup failure and the explicit rear-camera-only API path passed with mocked hardware/permission states. Recovery controls had at least 44 px height and were fully visible in the first viewport.
- Camera tests made zero real camera-context calls. The system-camera mock returned no photo; these tests are not evidence of real sensor capture, crop quality or multimodal marking.
- Tests used memory-only storage fixtures. No real storage backup, clearing, seeding or restore was performed; the fixtures and SDK mocks were removed after returning to Home.
- Screenshots were visually inspected in `D:/CodexWork/stemist-qa-chapter-camera-20260907-232007/`.

## Preservation and release boundary

No server code/configuration deployment, source-bank rebuild, OCR promotion, PDF/image/audio replacement or database change occurred. The original IELTS source bundles have no diff. Local `project.config.json` remains user-owned and is excluded from the commit.

Runtime size before packaging: 214 files, 2,052,741 bytes, below the project's 2 MiB budget. Use the pinned package receipt for the final artifact size and SHA.

The Android handset's live preview, actual photo capture and return-to-crop still need a physical-device check of the new preview. Simulator permission/recovery evidence must not be presented as a physical-camera pass.

## References and test-tool notes

- [Official WeChat camera component](https://developers.weixin.qq.com/miniprogram/dev/component/camera.html)
- [Official camera and authorization API definitions](https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.api.d.ts)

Native selector queries use supported class selectors; SDK attribute selectors are not interchangeable with native `wx.createSelectorQuery` selectors. The test uses the official viewport tool for scrolling and never clears cache to obtain a passing state.

# Native Speaking permission and IELTS topic acceptance

Date source: Windows system clock, 2026-09-07, Asia/Shanghai.

## Scope

- Native Mini Program only; no server, source-bank, OCR, PDF, audio, image or database mutation.
- Preserve the user's local `project.config.json` and private IDE configuration outside the commit.
- Restore microphone access through the appropriate Mini Program, system or privacy-consent UI. Returning from settings does not automatically begin recording.
- Display semantic SVG topic icons for Listening, Reading, Writing and Speaking, using existing source IDs and the IELTSist taxonomy.

## Fixed behavior

- Query privacy and microphone authorization before creating capture, playback or a socket. Cancelled or late authorization after leaving the page cannot start media.
- Permission failure and connection setup retain the previous feedback and dialogue. Archive a completed session before committing a replacement; reject stale-revision writes and stop starting if storage fails.
- Preserve complete dialogue and unknown/legacy metadata, including existing audio-file references. Remove the 120-turn persistence truncation; render 12 turns at once and 20 history summaries per page.
- Open prior sessions read-only. Pick the highest revision when current and archived copies coexist, using timestamps only to break equal-revision ties. An older copy cannot overwrite a newer archive.
- Retry connection and retry scoring are separate operations.
- Topic labels contain display metadata only. Writing Task 2 classification uses the existing verified prompt boundary so text from the following Speaking page cannot misclassify the essay. The original extracted content is not rewritten.

## Local evidence

`npm run test:all` passed after the final runtime changes, including:

- Microphone privacy, Mini Program denial, system denial, first grant, cancellation, late grant and non-permission recording errors.
- 150-turn restoration; permission/connection/storage failure preservation; archive-before-replacement; stale revision rejection; legacy and duplicate-copy reads; bounded history pagination.
- Four-skill topic IDs and icons; 144 Writing tasks retained in single-task mode; 72 Task 2 entries in topic mode; unknown catalog version keeps tasks in Other topics.
- Source bundle contract: 291 published tasks, 5,760 question records and 3,060 image references; the original bootstrap and packed-task files have no diff.
- Existing STEM source routes, AS/A2 scope, 30-row catalog pagination, native photo input, Complex/Solver/SHIFT, device profiles, WXML/WXSS compilation and other regression suites.

`node scripts/test-speaking-permission-ui.cjs --output <new QA directory>` passed against the official WeChat phone simulator:

- Actual Start and settings-button taps produced the expected permission recovery states.
- The fixture retained 150 dialogue turns and the previous feedback; only 12 turns were rendered.
- Settings recovery made zero recorder, playback or socket calls and did not auto-start.
- Mini Program, system and privacy-denial screens were captured. No privacy-consent button was clicked.
- Writing and Speaking topic cards showed SVG icons and opened lists referencing the original published task IDs.
- All test storage used a memory-only shadow; no real storage backup, clearing, seeding or restoration was performed. No real microphone or AI call was made.
- After teardown, Home was restored, the fixture was absent and the original permission state was unchanged.

Phone screenshots were visually inspected under `D:/CodexWork/stemist-qa-speaking-20260907/`. Permission images explicitly contain simulated records; they are not production-account or physical-microphone evidence.

Runtime budget: 212 files, 2,035,203 bytes before packaging, below the project's 2 MiB limit. Topic labeling adds approximately 7.9 KB, not another question bank. Final pinned package receipt is authoritative for upload size and commit.

## Important limits

- Physical iPhone/iPad microphone grants, real audio quality, long conversation, interruption recovery and MP3 export are not accepted by this run. Phone/tablet profile tests are not physical-device screenshots.
- The present source bundle exposes three reviewed Speaking sets. The original source bank was not deleted, copied or expanded; publishing quarantined material requires its existing review pipeline.
- No microphone permission can be granted silently on behalf of a student. Consent remains a user action; a denied permission has a visible recovery path.
- Previously discarded dialogue from older versions cannot be reconstructed by this patch. It prevents new truncation and protects records that still exist.
- This is a preview-quality patch, not an upload for review or a production launch certification.

## Primary API references

- [WeChat authorization model](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/authorize.html)
- [wx.openSetting](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/setting/wx.openSetting.html)
- [wx.openAppAuthorizeSetting](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.openAppAuthorizeSetting.html)
- [Official WeChat API type definitions](https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.api.d.ts)

The official local WeChat skill and API definitions informed the consent/settings sequence. No global privacy listener is registered, avoiding interference with camera consent.

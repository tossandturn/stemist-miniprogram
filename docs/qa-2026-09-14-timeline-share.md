# Moments sharing development update

Windows date verified: 2026-09-14, Asia/Shanghai. Base: 2633e1b (1.0.12 runtime 459a4c3).

## Scope and contract

- Enable native `onShareTimeline` and `shareTimeline` menu on eight public pages: Home, study workspace, paper directory, chapter directory, IELTS home/library/vocabulary and calculator.
- Keep private answer/photo/record/speaking workspaces out of Moments sharing; existing friend sharing continues to use safe public landing routes on all 26 pages.
- Explicitly supply sanitized query, including an empty string where appropriate, rather than forwarding original page options. No session IDs, tokens, answers, photos, search text or personal titles enter the payload.
- Moments uses the configured app logo, not a screenshot. Friend sharing retains its existing fixed cover.
- Share hooks are reused through a page mixin; no global Page monkey-patch, backend change, new dependency or data migration.
- Fix study-workspace sharing to use its real `activeCategory`, preserving IELTS selection.

The API contract was verified against [Tencent's official Page typings](https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.page.d.ts): Moments provides title/query/imageUrl, not a custom path; its default image is the Mini Program logo. [Tencent CloudBase's sharing guide](https://docs.cloudbase.net/recipes/add-share-with-params-miniprogram) also documents the current-page and single-page-mode boundary. The primary WeChat documentation endpoint could not be opened in this research environment; no unsupported navigation workaround was introduced.

## Verification

- `node scripts/test-share.mjs`: PASS; friend share, eight Moments hooks, explicit menus, sanitized same-page queries and exclusion of private pages.
- `npm run test:all`: exit 0, including ownership/data retention, native pages, calculator and WeChat WXML/WXSS compiler regressions.
- `node scripts/test-timeline-live.cjs`: PASS in actual WeChat developer-tool runtime. Home, Speaking library and Physics chapter directory returned expected Moments payloads; each `wx.showShareMenu` returned `showShareMenu:ok`. Home was restored afterwards.
- No actual Moments post was sent. Physical-phone publishing and recipient single-page behavior are NOT VERIFIED; the user must confirm these with the new preview.
- Runtime budget: 235 files, 1,965,459 bytes, 131,693 bytes headroom (128 KiB minimum unchanged).
- The user's existing project configuration diff was preserved (`a60dd99f74b2f04725d99e9ff5758757f0269d2a`).

## Release boundary

This is the 1.0.13 development update, not review submission or online publication. Earlier intermittent backend connectivity remains outside this sharing-only patch and has not been declared resolved.

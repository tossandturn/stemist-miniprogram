# Native WeChat friend sharing

## Cause and fix

The user confirmed the missing entry was the top-right "share with a WeChat friend", not a PDF/report export. None of the 26 registered native pages previously defined `onShareAppMessage`.

Every page now defines the callback, lazily using one shared public-destination policy. Home explicitly enables `shareAppMessage` and has a native `open-type="share"` button. Timeline and file-export behavior were not added or changed.

Public entries share the matching calculator, IELTS module catalog, vocabulary library, paper catalog or validated STEM chapter route. Private pages share Home or a public module/route, never a local attempt/session, answer, score, user-generated title, photo, token, or arbitrary incoming query. Each callback returns a fixed, bundled 5:4 PNG so the platform does not use a screenshot of private student content.

## Verification

- `test-share.mjs` failed on missing Home callback before implementation, then passed for all 26 pages. It checks registered destinations, malicious/private state exclusion, fixed PNG dimensions and the Home button.
- Final `npm run test:all` passed, including all earlier calculator, vocabulary, speaking, practice, account/privacy and official WXML/WXSS compilation checks.
- Live official Developer Tools: `showShareMenu` returned success; Home, calculator, Speaking library and Physics chapter callbacks returned their expected public paths and the bundled cover. Home screenshot verified the visible share button. No contacts were selected and no messages were sent.
- The first automation request timed out during a newly opened simulator's startup. A rendered Home screenshot provided fresh evidence; one warm rerun passed. No cache or user-storage clearing was performed.
- Package budget passed: 236 runtime files, 1,962,527 bytes, 134,625 bytes headroom. The three unreferenced Markdown design-authoring documents are now excluded from generated upload packages (both builder and independent budget test agree); the originals remain in the repository. Runtime icons and third-party attribution files remain included.
- User-owned `project.config.json` diff hash stayed `a60dd99f74b2f04725d99e9ff5758757f0269d2a`; excluded from the commit. No server/data changes.

## Release boundary

These checks prove callback registration, native share-menu enablement and safe card generation, not delivery to another person's WeChat or that an existing online/review package has updated. Actual friend receipt/opening must be checked on the newly built version. This task does not send a message, submit review, or publish an online version.

## Primary reference

[Tencent CloudBase Mini Program sharing guide](https://docs.cloudbase.net/recipes/add-share-with-params-miniprogram) documents `onShareAppMessage`, registered `/pages/...` paths, `open-type="share"`, and fixed PNG/JPG covers instead of default screenshots.

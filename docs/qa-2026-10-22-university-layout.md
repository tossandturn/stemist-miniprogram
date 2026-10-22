# University directory layout repair — 2026-10-22

## Reproduction and cause

The real WeChat renderer at 390 px gave both ranking/course tabs **184 px** widths inside 141 px grid columns. The second tab extended to x = 349 although its container ended at x = 306, overlapping the Share control. The AP/IB/A-Level tabs had the same native-button sizing conflict. The old website buttons also retained a 184 px native width instead of their intended dimensions.

The old page only styled bare class selectors such as `.directory-tab`; those did not override the native button rule. The regression first failed against saved native geometry, then against missing explicit scoped button constraints.

## Fix scope

- Explicit page-scoped native button rules: width, max-width, min-width, margin and touch height for navigation tabs, course tabs, sharing, search, website copy and pagination.
- Separate rank/name and website/action rows. Full Chinese/English names wrap without line clamping. Long website hosts cannot push the copy action outside the card.
- Rank badge uses intrinsic width, including `=100` at enlarged font sizes. Search/share labels retain horizontal text instead of narrow vertical columns.
- Compact existing header and fewer nested filter panels bring the first university into view earlier; existing brand colors and native navigation remain.
- No ranking data, edition/source metadata, official URLs, API/auth, search algorithm, sharing route, AI model or server changes.

## Acceptance evidence

Artifacts: `D:/CodexWork/university-layout-20261022/`.

- `before-rankings.png`, `before-official.png`, `before-geometry.json`: native reproduction.
- `after-rankings-geometry.json`: tabs are 141 px with 8 px gaps; Share is separate; website buttons are 92 px and below the name block.
- `after-official.png`, `after-official-geometry.json`: AP/IB/A-Level controls fit; Cambridge's official URL is copied correctly in isolated QA.
- `native-acceptance.json`: native public directory, real element taps for tabs/copy/search, page handlers for picker/input/pagination; search narrows to one expected university, clipboard matches the displayed official URL, second page shows 20 rows, pagination clears the bottom navigation.
- `responsive-result.json`: 24 actual-template/CSS replays at widths 320/375/390/667/768/1024, normal and 2× text, both tabs. Includes long synthetic campus names/hostnames and tied rank `=100`; checks overlap, containment, readable name column, touch size, rank-text overflow and navigation clearance. Final screenshots were inspected; enlarged-rank overflow found during visual QA was fixed and retested.
- PASS `full-suite-result.json`: complete `npm run test:all` at 2026-10-22 16:42:33 Asia/Shanghai, including the new layout regression and existing native WXML/WXSS compilation and product tests.
- `project.config.json` user-owned SHA256 remains `A6D9C6A9CB8C4732F591272E9F18DB86C12628CB2AA5FEDECD9EFB97CE5705FA`.

The test app blocks login, payment, uploads and unrelated network routes; local storage and clipboard are isolated. Only the public university-directory GET is permitted. No private student data is read. A cold post-refresh automator timeout was checked via screenshot/console/current route before one retry; no upload was repeated.

The browser replay validates layout under an explicit native-style 184 px button default; it is not physical phone/iPad, OS text-size or screen-reader testing. Those remain **NOT VERIFIED**. The existing light theme is retained; no new dark theme is claimed.

## Reference and release

GitHub-first reference: [Tencent TDesign Mini Program](https://github.com/Tencent/tdesign-miniprogram), [cell long-text issue #2291](https://github.com/Tencent/tdesign-miniprogram/issues/2291). No dependency or third-party implementation was copied; the repair targets this app's measured native layout.

Previous 1.0.53 upload is now independently confirmed successful and reconciled. This layout repair uses the next version, 1.0.54; official upload confirmation and public release must be reported separately. No production restart or backend deployment is needed.

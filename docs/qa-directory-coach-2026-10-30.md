# University/course Coach entry and home refresh — QA

## Delivered behavior

- Every rendered university has a prominent AI discussion action before its secondary requirements/website actions. All three existing course systems (AP, IB, A-Level) have individual official-link and AI actions. QS and U.S. News remain visible tabs, not a dropdown.
- Home retains announcements first, then adds illustrated “大学排名与官网” and “我的学习账号” cards above the six learning entries. Two original SVG assets and existing brand colors are used; no additional UI dependency. The calculator remains free.
- The admissions chat receives an editable school/course-specific question containing public names, URLs and the selected ranking edition/source. It does not auto-send, open arbitrary external sites or replace the server system prompt. Existing remote content/config remains authoritative.
- Handoff references expire after 10 minutes and match nonce, account and privacy epoch. No draft or credential is put in the navigation URL. Explicit guest login can carry only the selected public context; another account cannot inherit a prior private draft.
- Existing unsent content is preserved. A conflicting entry disables sending until the user explicitly chooses the new question or keeps their current draft. Replacement confirmation checks the same account/current draft; undo is available. The shared IELTS teacher page/engine is unchanged.

## Evidence and outcomes

Evidence root: `D:/CodexWork/university-coach-ui-20261030/`.

- Full source `npm run test:all`: PASS. Actual final artifact runs 11 focused suites for the affected pages/config/entry/advisor and compatibility boundaries. A full-suite attempt on an earlier reduced artifact hit a source-only legacy `speakingTicket.js` test; that file is intentionally excluded from releases. It was not reintroduced merely to make the wrong suite pass.
- All 200 synthetic ranked rows and all three courses passed item-to-prompt mapping tests, including missing profile data, unknown IDs, navigation failure, no auto-send, draft conflict/cancel/undo, stale/cross-account/epoch entries and guest authentication return.
- Live public-data validation covered 102 QS rows and 108 U.S. News rows (210 ranking entries, not 210 unique institutions), plus all three courses, without AI calls.
- 48 WXML/CSS browser-replay cases cover directory, official courses, home and adviser context at small phone, landscape phone, tablet portrait/landscape, normal and 2x font sizes with reduced motion. Replay uses native box-sizing/button-default equivalents; it is not physical hardware testing. Fresh native simulator screenshots and geometry additionally verify real controls and navigation at width 390.
- Real configured AI through the native client completed a school query and a course query. Initial guest entry and authentication produced no stream request; explicit send produced exactly one. Native authenticated conflict testing preserved the old draft and issued zero additional AI requests.
- A live reply incorrectly described MIT undergraduate admission as department-based. The official [MIT majors FAQ](https://mitadmissions.org/help/faq/majors/) and [international admissions FAQ](https://mitadmissions.org/help/faq/international-admissions/) contradict that claim. The starter was tightened to distinguish undergraduate/graduate and university/school/major application mechanisms, to treat a URL as a source pointer rather than read evidence, and to ask only three brief intake questions first. This is a bounded prompt improvement, not a factual-accuracy guarantee or a new browsing capability. Preserve failed-probe evidence; transport completion alone is not semantic acceptance.
- Main-package headroom remains 133,645 bytes, above the unchanged 131,072-byte gate. Reviewed, name-preserving minification is restricted to home and product-config code; source and packed behavior tests pass. No images/data were removed to pass the gate.

## Scope and limitations

No backend code deployment, restart, model switch, payment change, admissions-fact publication or question-bank change is part of this UI release. Official sites continue to use clearly labelled copy-link actions; no claim is made that arbitrary external websites can be embedded in WeChat.

Physical phone, real WeChat scan login, physical iPad and assistive-technology behavior have not been newly verified. Model output is probabilistic and specific current policies need official evidence. Development upload, experience designation and public release are separate states; record the official upload receipt before claiming upload success.

References and design decisions are in [the implementation plan](plans/2026-10-30-directory-coach-ui.md). Product `ui-ux-pro-max` guidance informed target sizes, hierarchy, spacing, wrapping and safe-area checks; existing product tokens were preserved.

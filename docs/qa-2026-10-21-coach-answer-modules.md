# Coach answer/steps modules — 2026-10-21

This supersedes the previous display-only interpretation. A complete, explicitly labelled response now renders an independent **答案** card first and an independent **解题步骤** card below it. The verification section remains inside the latter. Both cards are visible by default; no extra tap is needed to find the answer.

- No extra AI call, provider change, hidden-reasoning disclosure, server deployment or student-history mutation.
- A concept-level conclusion does not replace an explicit final answer: the actual final result is selected and the concept remains in the explanation.
- Explicit question-part headings keep their answer and steps together. Ambiguous multiple answers without part labels remain lossless in their original order, rather than guessing correspondence.
- Hints, clarification requests and legacy unstructured records do not get invented answers. Grading reports retain their previous section order; only the STEM Coach enables the module adapter. IELTS and Tavern stay on their existing rendering path.
- A narrowly allowlisted package override compresses local identifiers only in `utils/academicAnswer.js` and `utils/nativeMath.js`, retaining function names. Source/package output parity is tested. Other scripts remain whitespace-only; no dependencies or package safety limits changed.

## Verification

Artifacts: `D:/CodexWork/coach-modules-20261021/`.

- `scripts/test-coach-answer-modules.mjs`: red before implementation, green after; final answer first, separate steps, verification, hints, ambiguous legacy and multi-question correspondence.
- `scripts/test-academic-package.mjs`: red before the targeted packaging override, green after; output and function-name parity plus non-targeted transform isolation.
- `npm run test:all`: exit 0; `full-suite.log` and `full-suite-result.json`.
- Actual WeChat simulator replay in a network/payment/login/storage-isolated QA copy: `final-answer.png`, `final-physics.png`, `final-hint.png` and bottom-of-response screenshots. The answer and steps are separate visible cards, not just headings in one text block.
- 16 responsive rendering/geometry cases at 375, 667, 768 and 1024 CSS pixels using the real parser and component CSS: PASS. These are not physical-device tests. Physical phone/iPad and accessibility-device acceptance remain NOT VERIFIED.
- The user-owned `project.config.json` hash is unchanged. No IELTS-specific page, model configuration, auth or backend code changed.

Research: [Tencent TDesign Mini Program](https://github.com/Tencent/tdesign-miniprogram), MIT, reviewed for typed response-content presentation. No code copied or package installed.

## Version state

The previous 1.0.50 upload was confirmed successful from task `confirmation_upload_2981297b-5b7f-428e-a514-fb56738bad0d`; it contains the earlier formula/section repair, not this two-card refinement. The next candidate is 1.0.51. Consult `releases/development.json` for its actual upload state. No public release was performed.

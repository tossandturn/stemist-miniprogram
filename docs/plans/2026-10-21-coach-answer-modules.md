# Answer and steps as separate modules

> **For implementer:** TDD, then native screenshot verification.

**Goal:** Correct the earlier interpretation: the worked response itself has an answer card followed by a separate solution-steps card, not merely section typography.

**Architecture:** Reuse the safe academic rich-text parser. A presentation adapter groups explicitly labelled final answers and their explanation within the same question. Keep hints, unstructured legacy text and ambiguous multi-answer records lossless; never fabricate a result. Only STEM Coach opts into the module adapter; IELTS, Tavern and grading-report ordering stay unchanged.

**Tech stack:** Existing native Mini Program components and deterministic JavaScript. No provider switch, extra model request or server mutation.

1. Add failing scripts/test-coach-answer-modules.mjs: answer first; one steps card including verification; hint does not get an answer; multiple question parts stay correctly paired; unstructured/ambiguous content retained.
2. Add modularAnswer adapter in utils/academicAnswer.js and opt-in property on answer-content, wired only from STEM coach-panel. Style both modules as distinct cards with clear headings.
3. Recover package headroom by narrowly enabling identifier compression with preserved function names only for the two pure math/presentation helpers. Extend package tests for source-vs-package output and name parity; preserve the 128 KiB budget and all other JS transforms.
4. Native replay of the same real synthetic response; independently inspect answer/steps cards and question labels. Re-run responsive checks and full suite.
5. Query existing 1.0.50 task before any new upload. It returned upload success on this turn; save that receipt. Prepare next version 1.0.51 only after verification. No public release.

Reference: https://github.com/Tencent/tdesign-miniprogram (MIT), distinct typed message content rather than a single undifferentiated text block. No source copied or dependency added. Solution steps here mean the student-facing worked solution, not hidden model reasoning.

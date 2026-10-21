# STEM Coach answer formatting acceptance — 2026-10-21

## Outcome and scope

- Fixed the native presentation layer, not model routing or response content. No backend deployment/restart, new AI requests, provider changes, or student-data writes were needed.
- Academic rendering is explicitly enabled on STEM Coach, STEM practice feedback, STEM paper feedback, and the academic whole-paper result page. IELTS-specific pages and the Tavern are not opted in.
- The legacy `answerContent` output was compared against the pre-change Git HEAD on 16 fixtures: exact JSON parity. Shared link sanitization is reused unchanged. The user's dirty `project.config.json` is preserved (SHA-256 `A6D9C6A9CB8C4732F591272E9F18DB86C12628CB2AA5FEDECD9EFB97CE5705FA`).

## Reproduced defects

- `nativeAnswer` discarded inline/display delimiters before paragraph parsing, then inferred formulas from text patterns. Indented list equations and multiple-line equations therefore used inconsistent styles.
- `\sim` appeared verbatim in a real synthetic physics answer. The parser's one-character unbraced arguments mishandled commands such as `90^\circ` and `\frac\pi2`.
- Alignment, matrix and cases environments were flattened into punctuation-delimited text.
- Markdown list markers and headings lacked consistent answer-section hierarchy.

## Changes

- Preserve formula boundaries; group adjacent equation rows; render native fractions, powers, roots and common math symbols; retain real matrix/cases/alignment rows.
- Keep original section order, including multiple question parts. Steps have separate markers, final answers have a distinct panel, checks have a divider. No invented answers, scoring or completion statements.
- Constrain long equations/tables to their own horizontal scroll regions. No equation-image service, remote font dependency, KaTeX bundle or additional provider call.
- Keep prose identifiers and prices literal, including `source_id`, `$5`, and text inside `\text{...}`. Safe text nodes only; links retain the existing credential filter and explicit copy/native navigation contract.
- Bound source, sections, blocks, recursion and math nodes. Unsupported TeX is retained rather than silently changed into a different expression; this is not a claim of complete TeX compatibility.

## Evidence

Task artifacts: `D:/CodexWork/coach-format-20261021/`.

- PASS: focused `scripts/test-academic-answer.mjs` (red before implementation, green after), legacy rendering regression and 16-case exact legacy parity.
- PASS: `npm run test:all`, exit 0; full output in `full-suite.log` and receipt in `full-suite-result.json`. Includes existing IELTS, auth, ownership, exam answer permissions, crop, downloads, calculator, route, WXML/WXSS and package checks.
- PASS: native WeChat simulator replay of actual synthetic DeepSeek math/physics/hint responses from the prior API acceptance. Captured before/after, matrix/cases/fraction example and result tail. QA copy blocks network, login, payment and persistent storage; no real student drafts were changed.
- PASS: 16 isolated browser visual/geometry cases at 375×812, 667×375, 768×1024 and 1024×768, using the real rich-text nodes and component CSS. No page overflow; long equations scroll inside the answer; the final content can clear fixed navigation. These are responsive-render tests, not native tablet or physical-device tests.
- PASS: unchanged 128 KiB source package safety allowance; exact pinned package receipt is recorded separately at release.
- NOT VERIFIED: physical Android/iPhone/iPad rendering, large system font settings and VoiceOver. No claim of physical-device acceptance or public release.

## Research

Reviewed original GitHub projects [mp-html](https://github.com/jin-yufeng/mp-html) (MIT) and [katex-mini](https://github.com/rojer95/katex-mini), plus the [mp-html LaTeX plugin documentation](https://github.com/jin-yufeng/mp-html/blob/master/docs/advanced/plugin.md). The documented approximately 300 KB LaTeX plugin plus fonts does not fit this main-package budget without a larger architecture change; no code was copied or dependency installed.

## Release

Client rendering fixes require a new Mini Program package. This record is not an upload receipt. See `releases/development.json` for the actual assigned version and pending/success state.

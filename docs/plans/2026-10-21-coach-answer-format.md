# STEM Coach answer presentation repair

> **For implementer:** TDD: reproduce with real synthetic QA responses, add failing assertions, then implement.

**Goal:** Correct native formula layout and readable answer modules without changing IELTS or provider routing.

**Architecture:** Keep the current legacy renderer as the default. Opt STEM Coach into a bounded academic renderer that retains math delimiter boundaries, recognizes Markdown sections/lists, and lays out equations without changing their meaning. Preserve the existing link sanitizer, no HTML interpretation or remote formula service.

**Tech Stack:** Native WeChat components, rich-text safe nodes, JavaScript; official WeChat development-tool automation.

## Investigation / references

- Root hypothesis: nativeAnswer removes display/inline delimiters before block parsing. Formula-block guessing misses most multi-line responses, and Markdown headings/lists become ordinary paragraphs.
- GitHub references: https://github.com/jin-yufeng/mp-html (MIT) and https://github.com/rojer95/katex-mini. The mp-html LaTeX plugin documents roughly 300 KB plus fonts: unsuitable for the current tight main-package budget without a larger routing change. No code copied or package installed.
- Real synthetic DeepSeek response fixtures: D:/CodexWork/stem-deepseek-20261020/native-result.json. No student data.

## Tasks

1. Reproduce: D:/CodexWork/coach-format-20261021/capture.cjs in the network/storage-isolated QA project. Save before screenshots.
2. Add scripts/test-academic-answer.mjs: preserve display blocks, inline subscripts, steps/headings, nested/shorthand fractions, aligned equations, matrix/cases layout, currency/prose, links/security, bounded malformed/long input. Verify red using node scripts/test-academic-answer.mjs.
3. Implement utils/academicAnswer.js and opt-in component integration. Keep utils/nativeAnswer.js and default IELTS rendering behavior intact except a reusable sanitizer extraction if needed.
4. Add explicit academic opt-in only at STEM page call sites. Use headings actually present in the response; do not label an old answer from a newly selected pending mode. No fabricated result/score and no content reordering across subquestions.
5. Verify same fixtures natively on phone and tablet; inspect rendered formula baselines, fractions, long-equation horizontal scrolling, section spacing and bottom-nav clearance. Run npm run test:all and a clean package-budget build.
6. Review scope/diff and protected project.config.json hash; commit/push only task files. Upload the next unassigned development version via the official confirmation flow. Report pending/success accurately; no public release.

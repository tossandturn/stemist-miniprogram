# University ranking tabs and six-part admissions analysis

> **For implementer:** Use TDD: first reproduce the ranking picker and dropped analysis metadata, then validate the smallest compatible change.

**Goal:** Replace the QS/U.S. ranking dropdown with visible tabs and add structured international-undergraduate A-Level, IB, AP, language, competition and research/project analysis.

**Architecture:** Extend the existing public profile contract with optional sourced `analysis` metadata. Preserve ranking IDs, original reviewed summaries, logos, immutable cache keys and old-client behavior. Precompute public analysis so opening a profile does not require a model call or expose a key.

**Tech stack:** Existing native WXML/WXSS, CommonJS client and Node ESM public-data builder; no new dependencies or provider routing changes.

## Steps and acceptance

1. Add failing tests in `scripts/test-university-admission-analysis.mjs` for visible QS/U.S. tabs, dataset-driven switching, preserved deep links, six analysis dimensions and invalid/missing sources.
2. Extend `bundles/curricula/universityProfiles.js` normalization without rejecting existing profiles that have no analysis. Treat official text and AI planning advice as separate fields; reject incomplete/duplicate dimensions and unsupported source references.
3. Update `bundles/curricula/universities.js`, `.wxml`, `.wxss`: explicit ranking tabs, accessible touch targets and a consistent six-module detail panel, with readable source/status labels and existing copy links.
4. Add backend analysis validation and reviewed content inputs. Preserve the base source catalog. The build combines independent admissions reviews/AI guidance with old profile facts and produces new content-addressed JSONs.
5. Research primary university sources for academic numbers and English requirements; retain exact course/year/applicant limits. A* counts must match the grade string. AP prerequisites and SAT/ACT combinations cannot be dropped. Credit-transfer thresholds are not entry requirements.
6. For competition and research, distinguish required materials from optional evidence and AI advice. Do not invent a mandatory medal, publication, paid programme or guaranteed admission formula. Missing verification must be explicitly labelled, not presented as an official absence of requirements.
7. The user explicitly selected official facts plus qualitative AI advice. Do not publish AI competitive score ranges, ranking-derived numeric cutoffs or guessed award/research prerequisites.
8. Run profile compatibility/all-alias tests, full source/transformed client tests, responsive replay and native simulator paths. Preserve user-owned `project.config.json` and unrelated backend work.
9. Publish only immutable public data additions plus atomic index/provenance updates, keeping old cached assets. Fresh resource/rollback gates are mandatory; no restart, database or model change. Reconcile 1.0.57 before assigning the next development upload and follow the official confirmation workflow.

Reference: [Tencent TDesign Mini Program Tabs](https://github.com/Tencent/tdesign-miniprogram/blob/develop/packages/components/tabs/type.ts) for visible, evenly spaced navigation; reference only, no dependency import. Sources for admissions claims stay with each profile.

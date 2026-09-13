# Native vocabulary learning parity repair

## Cause and scope

The native Mini Program used the correct shared vocabulary snapshot but reduced the website's focused study workspace to a 20-row dictionary. Subject-pack navigation, card advancement, fuller knowledge fields and Notebook source identity were missing. New/unseen entries were incorrectly included in the due count. This repair changes the native presentation and study flow, not the source definitions or corpus.

Public production source bytes matched the local web originals: 304 IELTS Core entries and 2,913 professional entries, shared version `v1-68e798a26bcb965d`. The native catalog contained all 3,217 IDs. Source fields were checked against the original data. No duplicate corpus, new image set or generated pronunciation was introduced.

## Changes

- Default: alphabetic IELTS Core study cards; optional recall mode conceals the meaning until the student reveals it. Again/Know it records the same existing owner-scoped spaced-review data and advances. End-of-deck completion is explicit.
- Word packs: IELTS Core, IGCSE and A-Level subject directories. Stage and source topic-label filters remain inside the selected subject. Competition/admissions keep an honest pending state. Explicit term-ID entry stays scoped until the user changes packs.
- Full source knowledge: definition, concept, example/translation, formula and conditions, method steps, exam focus, common mistake, worked example and collocations. Formula content uses the existing native answer renderer.
- Browser-style global word search and optional bounded 20-row dictionary remain available, but are not the default learning surface.
- Unseen words are no longer overdue. Existing progress records and saved entries are retained; account/privacy changes invalidate pending callbacks and clear the private visible card.
- Existing website Notebook marker and `Vocabulary:<subject>` source are used for saved words. The server's 3,000-character field limit is respected with valid structured JSON retaining canonical identity; complete source detail remains local/in the immutable corpus. Failed sync keeps the local save and exposes retry. Review progress is explicitly local, not falsely advertised as cross-device synchronized.
- Index cached once, current/next word details loaded on demand, same-chunk requests coalesced, two-chunk LRU. No complete corpus is placed in page data.

## Verification and boundaries

- `test-vocabulary-study.mjs`: cards, pack boundaries, default IELTS scope, hidden recall, rating/advance, due semantics, legacy progress retention, account/stale-response guards, source detail preservation, Notebook round-trip and offline retry.
- Final `npm run test:all` passed after the WXML expression compatibility and save-retry changes, including the official WXML/WXSS compiler.
- Opt-in `test-vocabulary-source-parity.mjs --public-live` passed: all 3,217 native index IDs/word/meaning/subject/bank fields match current public originals, source-byte version matches, and 177 full entries across three chunks match every original field.
- Runtime budget passed: 237 files, 1,962,742 bytes, 134,410 bytes headroom against the 2 MiB budget (minimum 128 KiB). User-owned project configuration remained unchanged.
- Official Developer Tools phone simulator plus production API: 304-entry Core card -> recall/reveal -> next card -> A-Level Physics (280 AS/A2 entries) -> full knowledge -> save -> GET Notebook verifies the same canonical source ID. Used an isolated QA account; original simulator storage was restored. No production service/configuration changes.
- Screenshots in `D:/CodexWork/stemist-qa-vocabulary-20260914`: IELTS card, recall card, Physics card and full knowledge. Visual review caught a page-wide button style leaking into AI Coach; it was narrowed and the full live flow rerun successfully.
- One initial automation attempt encountered a blank/uninitialized simulator. One official refresh restored the current Home page; no cache clearing or user-data deletion was used.
- Web browser UI inspection timed out; parity conclusions come from current website source and live public data, not a claimed live web screenshot. Native phone screenshots and tablet responsive contracts do not certify physical iPad/phone touch or maximum-font behavior.
- This is a card-based learning/recall repair, not a claim of Baicizhan's image-choice/audio/spelling feature set. Shared source wording is unchanged; content-quality revisions are a separate source task.

## References

- [IELTS Core source](https://ieltsist.com/data/ielts-core-vocabulary.json)
- [Professional vocabulary source](https://ieltsist.com/data/alevel-stem-vocabulary.json)
- [Shared native index](https://ieltsist.com/data/native-vocabulary/v1-68e798a26bcb965d/index.json)
- Website implementation: `D:/CodexWork/ielts-trainer/public/app.js`, vocabulary pack, study, meaning and Notebook functions. Read-only; unrelated dirty backend files were not changed.

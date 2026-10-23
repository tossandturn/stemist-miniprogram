# AI Coach question-source acceptance

Backend-only feature; existing client runtime is unchanged. The 1.0.58 upload is verified successful, and no 1.0.59 package was created for this feature.

Completed academic replies append `题目出处`. Current supported provenance is the released/source-eligible CIE/CAIE bank. Example tested from both canonical text and the original paper image: **2024 年 2–3月 · 9702/22 · 第 2 题**. The source is assembled by the backend, not model memory. Unknown/ambiguous, short or changed-value questions do not inherit a guessed year or previous source. AP/IB-specific provenance and exhaustive source coverage are not claimed.

PASS: existing Coach service/failure/image-flow tests and academic formatter/module/package tests. PASS: real-provider answer through current native `coach-panel`/`answer-content`, source visibility, and switching to an unconfirmed answer without retaining the prior source. A QA-only selector ID was added for inspection; no rendering logic or styles were changed. PASS: 24 responsive cases at 320–1180 px with standard/doubled text; source metadata wraps and formula scrolling remains intentional.

Backend runtime `9cacc6ec3b6497da6cec5b913308c8b2c88074ad` deployed with verified rollback and pre/post health. Fifteen backend Coach/auth/stream/provider/Tavern suites pass. Deployed middleware plus real configured model, isolated from production user state: text first delta 3.93 s / completion 5.10 s; original-paper image first delta 6.96 s / completion 8.90 s. Both identify the same correct source. These timings are QA samples, not guarantees.

NOT VERIFIED: physical phone/tablet, broad photo-recognition recall, other-board source adapters, and formal WeChat review/public release. No original user photos, account state, provider keys, authentication keys or learning records were copied. The user's `project.config.json` was preserved.

# Native data integration acceptance

Checked on 2026-09-08 (Asia/Shanghai). Production data and the native simulator journey are now verified below. Physical-device and full-network-performance acceptance remain separate.

## Source reuse

- STEM reuses the existing library/catalog and source-backed released questions. Subject, IG/AS/A2, route, topic and physical paper identity remain separate. No PDFs, OCR corpus, account data or source-page cache is bundled with the Mini Program.
- Paper year/season filters run server-side before a maximum 30-item page. Cambridge spring/summer/autumn-winter and competition round/form labels are separate. Older API versions can still show the unfiltered catalog but cannot silently pretend to apply unsupported filters.
- IELTS consumes the same Cambridge sources plus the website's 24 public Writing and 146 public Speaking tasks. Stable IDs, content, theme labels and original topic emojis remain aligned. Cambridge Writing Topics include both Task 1 and Task 2; public Writing topics are Task 2 only. Public topics do not enter Cambridge mock exams.
- A metadata version update does not invalidate unchanged locally packed Cambridge details. New public details load on demand. Theme cards render at most 20 per page. Partial server responses cannot erase a known catalog.

## Exact source questions

- Versioned practice policy retains the 6 source / 12 reviewed per-topic gates. Only server `apiReadyQuestionIds` count toward a set; raw OCR IDs and duplicate topic memberships do not inflate availability.
- `native-source-region-v1` preserves approved QP pages, image dimensions, normalized regions and binding-specific URLs. The client validates route/question/page identity and draws only the current question, with tap-to-open source pixels. Internal part key `main` is not student-facing copy.
- The pinned Space handoff was tested against actual artifacts and PDFs: 12 unique newly released questions, seven exact PNG pages (1,400,582 bytes), existing five plus new twelve = 17 topic questions. Actual local HTTP assembly of 15 mixed-source questions passed the Mini Program validators. Formal progress remained disabled for this study-only set.
- A phone simulator displayed the real Space PNG through a local, read-only source endpoint and retained the crop geometry. The screenshot is local candidate-data evidence, not proof of a production update or Apple/Android hardware behavior.

## Verification

- `npm run test:all`: passed, including account isolation, photo-only STEM input, direct multimodal transport, camera lifecycle, practice, IELTS, calculator, scoped filters, icons, pagination, native navigation and WXML/WXSS compilation.
- Focused regressions cover released-vs-formal selection, exact source regions, old bundle preservation, public-topic updates and incomplete-catalog rejection.
- Phone simulator: server-derived chapter counts, source question display and public Speaking topic icons/pagination checked. The Speaking fixture rendered 20 cards per page; 146 source tasks group into 142 themes, not 146 distinct themes. User storage was mocked only in memory and restored; the simulator was refreshed afterwards.
- Phone/tablet classification and portrait/landscape layout contracts passed automated checks. Actual iPad viewport/hardware checks remain separate.
- Native source display and AI official-reference hydration are separate gates. AI response success is not established by a status endpoint, a unit-test provider or a visible question image.

## Publication boundary

Do not claim that all 2017–2025 OCR material is already classified or released. The following is one bounded released batch, not full-corpus completion or a formal-score promotion.

## Production data delivery

- Mini Program runtime: `ad26b0fe2167a48b98c57539d9293b84aec0fdb1`; GitHub Actions run `34183297608` passed.
- STEM backend overlay: `6e65cf4957c2c00a4348df484dc5c77022de17b3`, followed by the disk-seeding fix `3cc7e4d1df98285ab11d7eb27dd448e36184d8e7`. This is an allowlisted backend overlay, not a claim that the entire website frontend was replaced.
- IELTS backend overlay: `8cac7771efbeabb2135a62f047995f7be89a2f3b`.
- Data receipt: `7a0988b91212b863d970a2cb14ad6916917879d3fa0436d8cc6e703382b08e92`. Forty unique source questions (Space 12 + Mathematics 28) were atomically appended to the existing library. Forty unique questions contribute 41 topic memberships; these metrics are not interchangeable.
- Original PDFs, existing catalog data, student records, credentials and the production package/lock files were preserved. Code rollback and whole-batch withdrawal remain available independently.

| Topic | Before | Current practice questions | Verified assembly |
|---|---:|---:|---:|
| 0625 Space physics | 5 | 17 | 15 |
| 0580 Algebra and graphs | 5 | 13 | 10 |
| 0580 Coordinate geometry | 1 | 10 | 10 |
| 0580 Geometry | 4 | 10 | 10 |
| 0580 Mensuration | 5 | 11 | 10 |

All five assembled sets remain study-only: `formalProgressEligible=false`. Existing review gates are unchanged. Other chapters still have shortages, including some 0580 topics; no whole-subject completion claim is made.

### Live acceptance

- Native simulator, without catalog/network mocks: Space selection -> 15-question set -> released source-region image -> saved-session restore; Mathematics topic counts; 2025 AS Physics spring filter (3 papers) and summer filter (15 papers); original public Speaking topic icons -> task detail. All four flows passed. Test storage was isolated in memory and restored afterwards.
- IELTS opt-in `X-STEMist-Catalog: native-topics-v1` returns Listening 72, Reading 72, Writing 168 and Speaking 149. The 146 public Speaking tasks group into 142 themes, rendered at most 20 per page. Public-task details and original emojis were verified. Legacy clients still receive the original 3 Cambridge Speaking sets and do not mix public topics into mock exams. Cache variation is explicit.
- Production-origin HTTP verification: all five inventories and assemblies passed; all 49 selected image URLs returned complete image bytes with correct source dimensions, maximum origin image time 22 ms. Warm inventory requests were 4–44 ms and set assembly 42–96 ms in this run.
- Windows public-network check: inventory and assembly passed; 45/49 image bodies completed within a 15-second bound, while four timed out after HTTP 200. This is a recorded performance failure, not a full green certificate. The same source image that timed out in the bulk check subsequently displayed correctly in the native simulator. Origin success does not establish real-device network performance.
- Tampered source-image binding returned 409; unauthenticated marking returned 401 without a score. This negative test does not establish production authenticated AI marking accuracy.
- Post-change service/readiness checks passed: both services online with stable restart counts, both health endpoints 200, adequate memory/disk/swap and no sustained I/O pressure. No production build or dependency installation was used.

A new preview package is needed for the native catalog opt-in. An already installed older preview cannot be assumed to use the new catalog contract. Preview generation and delivery must be reported from their actual tool results, separately from these data checks.

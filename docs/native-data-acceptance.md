# Native data integration acceptance

Checked locally on 2026-09-08 (Asia/Shanghai). This is not a production-release or physical-device certificate.

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

Local code and tests are ready for final review. Production deployment, a new preview package, target-version 0580 batches and actual AI marking must be reported separately with their verified commit/artifact identities. Do not claim that all 2017–2025 OCR material is already classified or released.

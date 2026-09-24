# AP / IB native entry implementation

## Approved scope

Add separate AP and IB first-level home cards beside A-Level, IELTS, competition
and calculator. Keep the five global navigation tabs. Use native pages and the
real server catalogue, not Cambridge fallback routes or embedded webpages.

## Delivered structure

- `/bundles/curricula/index?board=ap|ib`: isolated native subpackage.
- `/api/stem/curriculum-papers`: courses, levels, years, sessions, paper codes,
  search and bounded pagination; server-backed counts.
- Separate QP/MS metadata, verified/candidate/missing pairing states, stable file
  identity, safe filenames and existing native download progress/cache/resume.
- Friends/Moments share public filter context only, never account/job/search text.
- Explicit source-only states; no fabricated Start Practice action.

## Actual source coverage

AP: 54 FRQ QP/MS pairs (108 unique files), available within 2017–2026. The 70
official downloaded files provide 35 pairs; cover-based reclassification of the
user's AP Physics folder contributes 19 more. Reports, statistics, student samples,
practice exams, uncertain scans and duplicate files are excluded. The preliminary
155 exam-related local-file count was not a usable-paper count. AP MCQ/full-exam
coverage is not claimed; the available years vary by course.

IB: 667 locally downloaded PDFs (990,774,379 bytes), 334 QP entries and 333 candidate
MS associations, within 2016–2025. AA/AI mathematics begin in 2021. Physics HL
November 2016 P3 has no source MS. Source variant labels are not silently converted
into canonical examination zones. Original user files remain unchanged.

Acquisition and audit evidence: `D:/CodexWork/ap-ib-source-discovery`.
Backend source: `D:/CodexWork/stem-ap-ib-paper-entry`, commit `1d985ce`.

## Publication boundary

Public redistribution authorization for the source PDFs is unconfirmed. All 775
files remain `rightsStatus=unverified`, so the live API exposes **zero download
URLs**; AP official source links can be copied. This release is a browsable source
catalogue, not a fully available AP/IB question bank. All `practiceReady=false`.
File download plumbing was exercised with licensed synthetic fixtures, not by
bypassing this gate. Source-paper pairing does not establish OCR, AI marking or
copyright approval.

Primary sources:

- [College Board permission instructions](https://privacy.collegeboard.org/copyright-trademark/request-instructions)
- [IB third-party licensing](https://ibo.org/become-an-ib-school/ib-publishing/licensing/)
- [User-supplied IB source hub](https://ibmaster.cn/en/past-papers-hub)

## Verification and release

Full `npm run test:all` passed, including native package budget, existing student
journeys, privacy/auth, sharing, PDF/crop, IELTS, calculator, page bindings and
WeChat WXML/WXSS compilation. Backend catalogue/source builder and existing CIE,
native-auth and whole-paper API tests passed. Independent source/API/frontend/
release review found no remaining reproducible P0/P1/P2 after fixes.

The exact three-file backend overlay was deployed after bounded server readiness
checks. It adds metadata/API only: no production build, dependency install or PDF
publication. Prior runtime remains available for rollback; IELTS was not restarted.
Live public API and native Mini Program catalogue acceptance are recorded in the
release receipt. Physical phone/iPad network/hardware performance is not proven by
simulator or mocked-transport tests.

Development upload, WeChat review submission and online publication are distinct
states; see the final QA receipt for the actual upload result.

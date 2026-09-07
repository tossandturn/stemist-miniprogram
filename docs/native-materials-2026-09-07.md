# Native material navigation and loading

Date: 2026-09-07, Asia/Shanghai.

## Source boundary

The Singapore originals stay in their existing locations. No parallel editable
question bank, duplicate PDF archive, OCR run or bulk readiness promotion was
created. The native API projects the existing governed catalogs into compact
pages. Existing IELTS source IDs, page URLs, audio URLs and section boundaries
remain authoritative. Original-paper counts do not mean every question has
reviewed topic mapping or marking support.

## Changes

- STEM/competition catalogs download 30 summaries per request, rather than a
  multi-megabyte subject JSON followed by client-side slicing. The old bulk
  download path is removed, including any timeout fallback to it.
- Only the current 30 cards enter page data. Six page queries and 60 recently
  listed paper details are cached for one minute, with source-version
  invalidation. Deep links fetch one paper, not an entire subject.
- AS/A2 and the selected mathematical combination survive Practice, Papers,
  exam and legacy-link entry. Late responses cannot replace a newly chosen
  subject or stage. Ambiguous combinations require a student selection.
- The server reuses the project's year-aware exam definitions: a variant such
  as 65 is component 6, not Paper 65. It then checks the route's components,
  rather than trusting the old catalog's broad courseRouteIds array.
- Historical Maths S1/S2 keep their original file numbers while mapping by
  their actual content. Legacy M2 is not relabeled S1; an original without a
  supported current-route match stays available for PDF reading.
- IELTS Reading/Listening topics have 14 source-backed semantic categories,
  distinct local vector icons, book/search filtering and passage/section
  counts. Selecting a category opens its actual source units, not question
  types or an unbounded list. Phone and tablet use bounded adaptive grids.
- Public question-image metadata is separate from authenticated marking
  metadata. It contains no answers, marks, provenance grants or binding
  signatures. Images must belong to the requested paper; current question
  images load lazily, track successful decoding, and can be retried.
- The paper workspace reserves an opaque sticky header for the upper-right
  Coach, so scrolling a question into view does not put the floating button
  on top of the scanned text.
- Read-only paper metadata is served before learning-database initialization.
  Cold unauthorized requests return 401 immediately without creating/seeding
  the database. A regression checks that no SQLite file is created.

## Performance and acceptance

Local before/after examples:

| Payload | Before | After |
| --- | ---: | ---: |
| Mathematics subject download / first page | 4,257,106 bytes | about 19 KB |
| Physics subject download / first page | 3,952,461 bytes | about 18 KB |
| Cold read-only unauthorized response in Vite preview | about 3.6 s | about 2 ms |

The initial deployment checks automatically rolled back when the cold 401
check timed out. The cause was unconditional learning-database initialization,
not the catalog or image API. Moving read-only handlers before that work fixed
the reproduction; no authentication or timeout requirement was removed.

Backend commits `7104fb6`, `f1dfc8c`, `9be566a` were pushed and the final
allowlisted API changes deployed with verified source hashes and rollback
coverage. No production source build, dependency install or Nginx edit ran.
Before/after readiness passed: services online, filesystem 52% used, about
2.4 GiB available memory, swap below 4%, and sampled I/O wait 0-1%.

Public HTTPS checks passed across 14 subject/exam catalogs: 4,888 active
question-paper entries, including first and last pages. The final first-page
sample had a median around 0.27 s and a maximum around 3.37 s. These are request
timings from this Windows connection, not phone FPS or a latency guarantee.
The corrected A2 P3+S2 scope has 249 matches instead of 583 broad legacy matches;
the original archive was not reduced.

Verification:

- Mini Program `npm run test:all`: pass, including Complex/Solver regressions.
- STEM backend `npm test` and lint: pass; latest classification change also
  passed its native catalog/context tests and lint.
- Native 4,000-record fixture: 30 downloaded/rendered entries, 50 page changes,
  bounded memory, scoped detail caching and no bulk retry fallback.
- Official WeChat phone simulator: topic directory, source Reading passage,
  retained A2 Maths combination, visible next-page control, competition archive,
  and decoded Physics question image all passed actual element interactions.
- Screenshots and JSON receipts are in the local QA artifacts directory
  `native-materials-runtime-20260907`, outside the shipped Mini Program.

Physical iPad/phone hardware, poor-network image loading and unrelated AI,
camera or speaking workflows are not certified by this directory-focused run.
Existing device/responsive contracts passed; no simulated device flag is
represented as a real tablet viewport test.

## Technical reference

The [official WeChat recycle-view explanation](https://github.com/wechat-miniprogram/recycle-view#背景)
identifies large setData transfers and excessive rendered nodes as major
long-list costs. This implementation uses bounded server/client pagination;
it does not add another list dependency or create another source archive.

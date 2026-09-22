# AI Coach whole-paper marking

Requested flow: one completed paper as a PDF, or an ordered image set assembled into a PDF by the backend; asynchronous AI marking; readable and downloadable marking report.

UI: a native ordinary subpackage at `bundles/marking/index`, reached from AI Coach. Preserve the current purple/light product system. Use one primary Submit action, visible upload stages, 44px controls, reorder/remove/preview images, optional original paper and mark-scheme PDFs, task history and recoverable failures.

Inputs: completed answer PDF or up to 20 ordered images. Source paper and marking standard may be attached as reference PDFs. A paper label and subject/stage context help the examiner. These inputs are task context, never evidence of official scoring authority.

Processing: authenticated upload, reuse successfully uploaded assets after interruption, stable client request identity, persistent server-side job, source PDF creation, bounded vision marking and structured result validation. Preserve original user files. Do not silently present a provider failure as a zero score.

Report: question/sub-question feedback, page evidence, earned/max marks only where supported, totals limited to assessed work, unassessed items and review flags, strengths, priority mistakes and revision recommendations. Mark the report as AI-assisted. Missing source/mark scheme must be clearly reflected in evidence limitations.

Verification: wrong file signature, size/page limits, page ordering, one-source-mode validation, duplicate submit, upload retry, stale account/page callbacks, persisted job restore, unauthorized access, malformed AI output, restart recovery, generated PDF content and native phone/tablet layout. Upload and phone preview are distinct from review/publication.

Reference note: the user-provided xhslink short URL returned HTTP 404 during access. COURSEMO's official product description was reachable at https://www.coursemo.com/product/app/ but does not establish the details of the missing note. Implementation follows the user's explicit flow.

## Executable acceptance

- `node scripts/test-whole-paper-client.mjs`: bounded file reads, correct MIME, ordered 1-based answer slots, reference order, idempotent submission, per-file resume, account/epoch isolation, stale-poll rejection, cancellation, score authority, report paging and private local-copy lifecycle.
- `node scripts/test-whole-paper-integration.mjs --backend <reviewed-local-STEM-worktree>`: the actual client service calls a local HTTP STEM API; two generated images are assembled and rendered into vision inputs; an explicitly synthetic model fixture returns feedback; both PDFs are authenticated downloads. The report must actually render nonblank body pixels. This is not live AI evidence.
- `node scripts/qa-whole-paper-ui.cjs`: after navigating to the marking page with the official Developer Tools CLI, inspect a synthetic completed report without overwriting account storage. Actual phone-width geometry and screenshot; not a physical-device test.
- `npm run test:all`: existing student regression suite, main/subpackage contracts and official WXML/WXSS compilation.

The main package still leaves 128 KiB beneath the project 2 MiB limit; the marking subpackage is counted separately. Uploaded files and generated PDFs are never packaged. The original user-owned `project.config.json` is not modified by this work.

Reports use clearly labelled AI estimates, missing-page/question warnings and human-review flags. Download names include the report title and task identity. When the backend supplies a rasterized PDF to avoid full-CJK-font download overhead, the UI explicitly notes that the PDF text is not selectable; the native report remains selectable.

Deployment requires Linux-compatible PDF generation, a configured licensed CJK font, bounded resource use, passing production readiness, and a real authenticated model run. Local mocked-model acceptance alone does not satisfy this gate.

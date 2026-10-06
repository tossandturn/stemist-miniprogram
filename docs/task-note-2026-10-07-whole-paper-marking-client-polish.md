# Whole-paper marking client polish task note

Date source: Windows system time, 2026-10-07 Asia/Shanghai.

## Scope

This task changes only the native Mini Program whole-paper marking client and its focused tests. It does not change the backend, provider routing, global utilities, `app.json`, the original checkout, or WeChat upload/deployment state.

## Reproduced evidence

- The supplied phone screenshot shows the native navigation title `AI Coach · 整卷批改`, followed by a second large page-level `返回` control and `整卷 AI 批改` heading. `bundles/marking/index.wxml` renders that duplicate page header through `stemist-header`.
- `setJob()` currently puts a failed job message into both the job card and the page-level `error`, which reproduces the duplicated red failure message below the card.
- `expiresAt` is displayed by string replacement as UTC, and the template always appends `请及时下载报告` even when `reportPdfPath` is absent.
- Every retry click creates a fresh `retry-<uid>` request ID and ignores the retry response before making a second status request. A client timeout can therefore leave acceptance uncertain and make another click use a different retry identity.
- A polling/network failure overwrites the same page-level `error` used by the job failure. It is not presented as a separate stale-status warning and can obscure which failure is authoritative.
- Failed jobs hide terminal elapsed time because progress metadata is rendered only while queued/processing. Analysis uses an indeterminate track, but the ETA text does not tell the student that it comes from same-page-count historical jobs.

## Design

1. Derive all student-facing job state from `status`, `failureCode`, `progress`, validated `result`, `sourcePdfPath`, and `reportPdfPath` in a small display-only helper.
2. Map timeout, empty/invalid AI output, temporary provider failure, report generation failure, worker restart, cancellation, and unknown failures to safe Chinese copy. Never expose provider names, endpoints, raw messages, or stack traces.
3. Render one failure card with one primary recovery action. Retryable failures retry the same job; non-retryable failures start a new task. A retry whose HTTP outcome is unknown switches to status confirmation and reuses a deterministic per-job/per-attempt request ID.
4. Keep refresh/network failure independent from the last confirmed job state, with its own concise stale-state notice and refresh action.
5. Format valid ISO expiry timestamps as explicit Beijing time. Reject invalid and epoch-like values. Mention report download only when a report file actually exists; otherwise distinguish a retained source PDF from a retained task record.
6. Preserve actual server phases, page counts, total elapsed time, and history-backed ETA. Use determinate width only for page-preparation stages; never fabricate an analysis percentage.
7. Remove the redundant page-level header because the native navigation bar already supplies back navigation and the page title. Keep every interactive target at least 44 px and reserve the phone bottom-nav safe area.
8. Keep AI outputs explicitly advisory: show `AI 估分` only through the existing provenance-gated report state and state that it is not a formal score.

## Public implementation references

- BullMQ retry semantics and failed/stalled state separation: <https://github.com/taskforcesh/bullmq/blob/master/docs/gitbook/guide/retrying-failing-jobs.md>
- BullMQ structured progress: <https://github.com/taskforcesh/bullmq/blob/master/src/classes/job.ts>
- bull-board exposes retry only when retries are allowed: <https://github.com/felixmosh/bull-board/blob/master/README.md>
- Lucide accessibility guidance: visible labels, non-color status cues, and 44 x 44 minimum targets: <https://github.com/lucide-icons/lucide/blob/main/docs/how-to/accessibility.md>

## Verification contract

- Focused display-helper and page lifecycle tests must fail before implementation and pass after it.
- Existing whole-paper client, progress, report, download, tablet-layout, WXML binding, compiler, package-size, and full client suites must remain green.
- Real WeChat DevTools screenshots and physical phone/iPad behavior remain for root-task acceptance; this task does not claim those checks passed.

## Implemented behavior and local evidence

- Retry identity is persisted per owner, privacy epoch, job, and processing attempt. A lost retry response or 409 immediately triggers canonical GET reconciliation; repeat POSTs reuse the same ID until GET confirms queued/processing/completed or a newer attempt.
- A restored job with unknown status retries status reads after 4/8/16/30 seconds, then stops automatic recovery and leaves a manual action. Late owner/epoch/page-generation responses cannot update the new view.
- Failure copy distinguishes timeout, empty/invalid AI output, temporary AI unavailability, report-only failure, worker restart, cancellation, and unknown failure. A validated result without a report is shown at step 3 even if an older server emitted a generic failure code.
- Valid expiry times are rendered in Beijing time. Invalid and 1970-like timestamps are hidden. Report-download wording appears only when the validated report state and report path both exist.
- Focused display/progress tests, the existing whole-paper client suite, `test:coach`, page/WXML bindings, responsive/contrast checks, and the WeChat WXML/WXSS compiler passed in the isolated clone.
- The isolated clone's byte-exact package checks are not authoritative because global `core.autocrlf=true` materialized unspecified runtime text as CRLF (for example, a 271-byte topic-icon Git blob became 272 bytes). No main-package runtime file is changed by this branch; the marking subpackage is 100,024 bytes. Root will rerun the protected LF-preserving packer after integration without lowering the 128 KiB gate.

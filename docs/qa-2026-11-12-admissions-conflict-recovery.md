# Admissions 409 recovery — 2026-11-12

## Evidence and limits

Root reported a historical Nov 6 session with 136 requests and one `/api/ai/admissions/stream` HTTP 409; the rest were 2xx/304. Status alone does not identify that historical conflict subtype or prove its cause. This work reproduced a separate current-client defect using the actual native request wrapper and string error response. No production request or user conversation was modified.

## Root cause / fixes

1. Chunked native requests use `dataType:text`. A pre-stream 409 JSON error arrives as a string, so the shared request wrapper retained HTTP status but lost its structured error code. The advisor only marked explicit revision/pending-result codes for rebase; unknown 409 and busy conflicts retained the old `expectedRevision`. Even a manual latest-history refresh could leave the pending request at its stale revision.
2. The advisor page now treats an unclassified 409, explicit stale revision, generated-result pending and turn-in-progress as a state-reconciliation boundary. It makes at most one same-conversation recovery read per failed submission/retry action. It never automatically submits another `/stream` request. The existing turn ID, text, effort and optional directory target remain bound; drafts are kept. If the server has committed the exact pending pair, it displays that result rather than regenerating it. If recovery fails, pending state remains durable and another explicit retry must fetch state before sending.
3. Rebase intent remains until the next explicit send, so a history refresh before the other request finishes does not permanently discard the ability to rebase later. An explicit retry that has already read state does not read again after another 409; there is no polling loop.
4. The exact-ID completed-turn replay path may correctly return the current conversation revision unchanged. The client previously rejected that response after rebase. It now permits equality only when the authenticated response says `replayed === true`, and still requires all conversation/turn IDs, roles and message/answer content to match. New turns must advance revision; no rollback is accepted.

The recovery endpoint is the existing `conversations/resume` with the current explicit conversation ID. It retrieves canonical state and may finish a previously generated receipt under the existing server contract; it does not initiate another model generation or create a new conversation. Generic `utils/api.js` and authentication files were deliberately not edited.

## RED / GREEN

- New real-transport test first failed: recovery reads remained 1 instead of 2 after a string 409.
- New completed-replay test first failed with “回复与当前问题不匹配” when replay revision equalled the refreshed revision.
- Both passed after the scoped fixes.
- New tests also pass: in-flight result committed before recovery; recovery network failure; newer unsent draft survives; late previous-owner recovery cannot populate new account; repeated busy conflicts cause no automatic sends; explicit retry reuses the same turn ID.
- Existing admissions, sources, IELTS teacher and teacher recovery, directory handoff and effort-forwarding tests passed. Shared advisor changes cover IELTS teacher too; no other role behavior is intentionally changed.

## Changed files

- `bundles/coach/advisorPage.js`
- `bundles/coach/advisorConversation.js`
- `scripts/test-admissions-conflict-recovery.mjs`
- `package.json` (`test:admissions` includes the new regression)

This is a client fix and needs a new Mini Program package. No UI layout was changed. Native real-device network recovery and production concurrency are separate acceptance steps; passing local controlled HTTP/status fixtures does not prove them.

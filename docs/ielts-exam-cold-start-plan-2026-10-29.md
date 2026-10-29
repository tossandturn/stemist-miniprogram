# IELTS mock-exam cold start

Fix the previously diagnosed random/same-test assembly regression on top of uploaded 1.0.66. Preserve writing sourceAvailability/sourceRevision gates, all existing attempts, shared identity, the offline-first individual-skill routes and speaking/provider configuration.

Root: newExam and examChoices read loadIeltsContent's immediate bootstrap snapshot. The bootstrap lacks required verified Cambridge writing metadata. A five-second background refresh cannot satisfy an already rejected exam assembly and does not refresh the exam screen.

Implementation: give the catalogue loader an opt-in requireFresh mode. The first exam use must await a successful current-process remote catalogue fetch, and concurrent consumers share the existing request. A successfully fetched, non-stale in-memory catalogue may be reused within the existing five-minute policy; restored/offline metadata never masquerades as current. Errors propagate with a retryable catalogue message. The exam screen exposes preparation/error/retry states, prevents premature/duplicate start and suppresses late updates after exit. newExam checks cancellation/identity before dispatch and before local persistence; it cannot undo an already dispatched server creation.

Verification: cold bootstrap; restored legacy cache; slow/in-flight refresh; fresh reuse and expiry; network failure/retry; genuine empty/unverified source pools; random and same-test; stale owner/epoch and page exit; unchanged offline task browsing. Run source and actual transformed-package tests, full client suite, native compiler and isolated native UI acceptance. Only the catalogue GET may be live; use a synthetic exam-create response for UI tests rather than create production student attempts.

GitHub-first reference: [TanStack's own discussion of restored stale data and awaited refetch](https://github.com/TanStack/query/issues/8075) confirms the distinction between returning cached data and waiting for current data. This is a plain WeChat loader, not TanStack: reuse the existing pending promise and make a narrow opt-in change; no dependency or source copying.

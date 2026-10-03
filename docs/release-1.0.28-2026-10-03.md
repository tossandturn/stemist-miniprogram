# Development release 1.0.28 - private report allocation recovery

Full-function acceptance after the 1.0.27 upload found a real PDF-input marking
job completed successfully but its report failed with `download_storage_failed`.
The native filesystem contained the large public AP PDF alongside private files.
This was not accepted as a complete product pass.

The marking downloader can reclaim only registered, completed public PDFs from
the controlled `pdf-cache` namespace. Partial/resumable public files, active
validation/transfers (including concurrent readers), private inputs, photos and
earlier private reports are preserved. If allocation remains unavailable or the
private-report count is reached, an authenticated native temporary download is
verified against the current report's byte count, PDF header and SHA-256 ETag.
It is labeled as temporary, never claimed as a completed persistent checkpoint,
and never causes a second AI grading run.

The existing short-lived direct speech, profile, AI scoring/self-scoring,
evidence/readiness, sharing, and AP/IB provenance contracts remain unchanged.
Server Coach deployment from 1.0.27 is retained; no server mutation is required
for this client-only repair.

`test-marking-storage-pressure.mjs` first reproduced the old failure, then
passed for public-cache recovery, partial/active/private preservation, concurrent
readers, count limits, unavailable native writes and corrupt temporary-file
rejection. The full maintained `test:all` and real local HTTP marking integration
passed after the fix. Native live PDF-input report acceptance and the official
upload receipt are recorded separately after the frozen candidate is tested.

As with 1.0.27, development upload is not WeChat review submission or online
publication. Physical Android/iOS/iPad permission, microphone, viewer, network
and account-platform approval states are not inferred from fixtures or simulator.

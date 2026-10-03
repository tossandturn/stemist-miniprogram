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

## Final frozen acceptance and upload

Final runtime commit: `08ff5d02900e3ac1e7b366b7214cd1c7577d22df`.
The exact frozen project passed full maintained regression/native compilation,
then real native PDF-input marking and source/report downloads: two results,
3/4 AI estimate, 21,308-byte source PDF and 225,184-byte report. Real native
AP/IB QP/MS representative downloads all reached 100% with expected bytes and
hashes. Only their document-viewer callback was a declared simulator fixture.

Official WeChat development upload succeeded at 2026-10-03 17:09:48 +08:00.
Official total size: 2,072,709 bytes; main package: 1,915,488 bytes. Receipt:
`D:/CodexWork/stemist-release-coordination/release-1.0.28-20261003/upload-receipt.json`.
The complete scoped verification and remaining physical/platform checks are in
that directory's `RESULT.md`. Test-harness/documentation commits after the upload
do not change its frozen runtime bytes. Review submission/publication remain
false, and the original IDE configuration remains unmodified and uncommitted.

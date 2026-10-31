# Coach image upload recovery implementation plan

> **For implementer:** Use TDD throughout. Write failing test first. Watch it fail. Then implement.

**Goal:** Avoid whole-image retries after a lost upload acknowledgement, show actual transfer progress, and preserve single-generation Coach recovery.

**Architecture:** Upload authenticated, owner-bound base64 chunks with acknowledged offsets and a short-lived image reference; submit that reference through the existing resumable job protocol. Legacy servers are supported only when capability discovery explicitly returns404; network failures never trigger an unbounded full-image fallback. The student model, default low, IELTS, Tavern and membership are unchanged.

**Latency adjustment after production timing (2026-11-01):** Prepared attachments totaling at most 96 KiB keep the existing one-request job path. Larger totals use resumable uploads. The bound applies to all attachments combined, and no extra compression is performed for routing. This avoids capability/init/chunk/complete round trips for small photos while retaining bounded recovery for large photos; it does not promise faster model reasoning or physical-phone latency before device testing.

**Tech Stack:** Native WeChat JavaScript/WXML/WXSS, existing SHA-256 helper, Node test harness; backend integration by the authorized persistent STEM implementation task. No new dependencies.

User approved the design and a client repair-package upload in this conversation. Original dirty checkout remains untouched; this isolated client starts from3490f95/current1.0.79 source. Previously deferred membership-copy edits are not silently included.

## Tasks

1. Create `scripts/test-coach-image-upload.mjs`. Assert uploader exists, then use the real uploader with a fake transport to lose an accepted chunk acknowledgement, query offset, and continue without resending that chunk. Assert every chunk<=65536 characters, only references in the final job payload, real confirmed-byte progress, bounded retries, expiry restart, cancellation, owner changes and metadata-only local storage. Run `node scripts/test-coach-image-upload.mjs`: RED before module, GREEN after implementation.
2. Create `utils/coachImageUpload.js`. Protocol`stem-coach-image-upload-v1`: capabilities, PUT initialization, GET offset/status, POST /:id/chunks, POST complete, scoped DELETE of least-recent unused receipt on bounded eviction. Record no photo/question/token in local receipts; preserve them across interrupted attempts only within their owner+privacy epoch+expiry. Use only documented wx.request methods; official typings omit PATCH, so the server keeps PATCH only as a compatibility alias while native clients require advertised POST chunks. Reference: https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.api.d.ts .
3. Extend `utils/coachJob.js` with optional image-payload preparation only immediately before an actual POST. Already-known jobs are queried before any upload, cancellation/deadline applies during transfer, and the fingerprint/ID remains based on the original question. Wire the preparer in `utils/api.js` only for academic jobs. Add `scripts/test-coach-upload-job.mjs`: lost job ACK must never regenerate or reupload, text path unchanged, capability404 legacy fallback, transient failures fail boundedly.
4. Extend `utils/operationProgress.js` and `components/coach-panel/index.wxml`/`index.wxss` for actual uploaded bytes, transfer throughput and ETA. Model generation must not receive a timer-invented percentage. The upload label must not say the AI is analysing or falsely claim no reupload is required while only a partial file exists. Add deterministic progress tests before changes.
5. Add the new owner-bound receipt prefix to `utils/session.js` cleanup and test logout/account changes. Retain drafts on auth expiry according to the existing contract. Test all original Coach/image/stream/effort/progress/privacy suites.
6. Review backend contract/security tests independently, run cross-transport integration tests and real native interrupted-upload replay. Synthetic images only; restore user storage after QA. Run full client tests and packaged tests; preserve128KiB package headroom and original developer-tools project.
7. Deploy only allowlisted backend files after fresh gates, pinned source/hash checks, verified rollback and zero active AI jobs. Preserve newer Bailian/provider/bilingual/quotas. Verify old and new client paths. Reserve the next actual available version only after tests, upload the repair package once, distinguish developer upload from user-controlled trial/formal publication.

## Acceptance boundaries

- Weak-network simulation must demonstrate that acknowledged chunks are not sent again, and incomplete uploads never invoke the AI.
- Uploads are private bounded memory with15min TTL, not a new permanent student-image database. A backend restart may require a new upload; an already-committed Coach result remains recoverable independently.
- No automatic payment/refund, no provider migration, no arbitrary timeouts widened, no unrelated changes.
- Physical mobile weak-network behavior remains NOT VERIFIED until actual device acceptance; simulator and injected fault results must be labeled.

## References

- https://github.com/tus/tus-node-server
- https://github.com/tus/tus-resumable-upload-protocol/blob/main/protocol.md

References inform acknowledged offsets, expiry and idempotency only; this restricted native JSON protocol is not advertised as a full tus implementation and imports no external code.

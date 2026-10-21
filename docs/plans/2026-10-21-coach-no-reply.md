# STEM Coach no-response recovery

**Goal:** Bound the entire STEM request and image preparation, preserve input on failure, reduce camera-photo transfer size, and verify a real response still reaches the two answer modules.

**Evidence:** current server health/resource checks passed read-only, provider configured as DeepSeek. Workstation direct TCP connection timed out while the existing proxy path succeeded. Nginx recorded one `/api/ai/coach` 408 at 20:32:23 +08:00, without a response body; no matching detailed error stage was available. This suggests a transfer/connection failure but does not conclusively identify the user's phone route. A live isolated Mini Program text request completed in 6.853 s, and a subsequent request in 1.570 s after session renewal. No provider or service restart was justified.

## Tests then fixes

1. `test-coach-request-deadline.mjs` reproduced no independent deadline when SDK callbacks never arrive. Add a 55 s text / 60 s image deadline covering auth renewal and dispatch; abort the request and ignore late callbacks. Do not dispatch after an expired auth wait. IELTS route unchanged.
2. `test-coach-image-budget.mjs` reproduced camera-resolution files sent without size scaling. Add opt-in STEM Coach proportional max-edge 2048 px resizing at existing quality, no upscaling or source-file mutation, and 12 s preparation deadline. Preserve default IELTS/image behavior.
3. `test-coach-network-package.mjs` exercises the real transformed helpers. Apply a fixed allowlist compression override with CommonJS output and preserved function names, without changing other modules or the 128 KiB budget.
4. Use a separate memory-storage Mini Program with only auth/status/Coach network routes allowed. Test actual text/photo success, a full 55 s no-callback failure and a successful retry. Do not access or overwrite real student drafts/history.
5. Full regression, pinned clean artifact and next development upload. Reconcile the existing 1.0.51 task first; no public release or remote server mutation.

Additional reproduced root cause: `current()` becomes false after a 401 clears the session or another identity change. Both Coach pages then skipped their loading cleanup, so a finished/failed request left the spinner active indefinitely. `test-coach-auth-wait-recovery.mjs` failed on the old code. Clear only the still-owned request's wait state, keep stale-account answers/photos hidden, and expose reauthentication for 401; never mutate an unloaded page or a newer request.

Research: Tencent's [image API reference](https://intl.cloud.tencent.com/zh/document/product/1219/57745) documents `compressedWidth` / `compressedHeight`; GitHub reference search did not identify an applicable drop-in fix for this project's custom request wrapper. No third-party dependency installed.

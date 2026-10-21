# Coach stuck-wait recovery — 2026-10-21

## Findings

Two deterministic client defects were reproduced before fixing:

1. A 401 clears the session, or identity changes while a request is in flight. The Coach pages correctly reject the stale answer, but `finally` was gated solely on `current()`, leaving `loading=true` indefinitely. The new recovery clears the still-owned wait state, keeps stale-account content hidden and shows the sign-in action for expired authentication. Unloaded pages and newer requests remain protected.
2. The client relied exclusively on the WeChat request callbacks. An absent callback had no independent lifetime limit. STEM requests now have a 55-second text / 60-second image deadline including session renewal, abort the request on expiry, ignore late success/401 callbacks and do not dispatch after an already-expired auth wait.

Camera-resolution STEM photos now opt into proportional max-edge 2048px scaling at the existing quality; small images are not enlarged and original files are not overwritten. A 12-second preparation limit prevents image SDK stalls. Default IELTS/photo consumers retain their previous dimensions and quality behavior.

## Live evidence, not historical health claims

- Fresh read-only server checks: stable services, free memory approximately 2.18 GiB, swap 9.55%, filesystem 82.45% used, all three I/O wait samples below 20%, no active build/backup jobs, both public services returned 200 from the host. No server config write, restart, provider change or deployment occurred.
- Workstation direct connection to the business domain timed out before TCP connected; the existing per-command local proxy path returned HTTP 200 in 3.74 seconds. This does not prove the phone's exact network route or establish that its network is repaired.
- A bounded Nginx read found a Coach HTTP 408 at **20:32:23 +08:00**, zero response bytes. No matching detailed error stage was available; do not claim a particular upload/ISP cause as confirmed.
- 1.0.51's upload success was independently verified from its existing task. The response-module change itself was not shown to break successful rendering.

## Acceptance

Artifacts: `D:/CodexWork/coach-no-reply-20261021/`.

- `test-coach-request-deadline.mjs`: missing callback, full deadline, request abort, late 401, expired auth wait, normal success, image budget and IELTS route isolation.
- `test-coach-auth-wait-recovery.mjs`: both Coach pages, 401 and identity swap, no stale private answer/photo, no active spinner, visible reauthentication.
- `test-coach-image-budget.mjs`: 4032×3024 → 2048×1536, no upscaling, preparation timeout and unchanged default image behavior.
- `test-coach-network-package.mjs`: transformed CommonJS helpers preserve exported names, request fields, timeouts, late-result isolation and image scaling behavior. Only two additional allowlisted helper files use this override; the 128 KiB main-package safety allowance remains unchanged.
- Full `npm run test:all` output and exit status: `full-suite.log`, `full-suite-result.json`.
- A separate native test project uses memory-only storage, blocks payment/uploads/unrelated routes and submits only synthetic questions via normal WeChat authentication. No real user drafts/history were read or overwritten.
- Real text request: **6,853 ms**, valid rendered answer. Subsequent real request: **1,570 ms** after an 8,601 ms session renewal.
- Real full 55-second no-callback test: waiting stopped, request abort count 1, original question retained, retry enabled. Retry returned a valid answer in **2,094 ms** after session renewal (`native-deadline-result.json`, `native-retry-result.json`).
- Real synthetic graph photo request: **6,430 ms**, HTTP 200, 43,877-character request body, valid **50 m** answer and steps (`native-photo-result.json`).
- Simulated 401 through the native request chain: loading false, no stale answer/image, visible login recovery (`native-auth-recovery-result.json`). This is not a physical phone test.

## Boundaries

IELTS-specific pages, providers, model settings and services were not modified. No business data, payment settings, secrets, user project config or source photographs were changed. Physical Android/iPhone/iPad and the user's exact direct-network route remain **NOT VERIFIED**. Upload/release state is tracked separately in `releases/development.json`.

Reference: Tencent's official [image API documentation](https://intl.cloud.tencent.com/zh/document/product/1219/57745) for proportional compression dimensions. No dependency installed.

## Development upload

1.0.52 is pinned to `f4683bc21c24138aa00964448329ff67a6cdea7b`. Official task `confirmation_upload_d0c77943-da7f-4384-8eb6-47ea2b375ae5` returned **pending confirmation**, not successful upload. Source main-package size 1,966,001 bytes, 131,151 bytes headroom. On continuation, query this exact task before attempting another upload. No public review/release was performed.

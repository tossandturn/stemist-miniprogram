# Coach access and source previews

Scope: mandatory privacy/login entry; detailed academic steps and safe native diagrams; source-backed admissions research with in-conversation official excerpts and static webpage previews.

## Verification

- Full `npm run test:all`: PASS, including packaged-runtime determinism, native WXML/WXSS compiler, login refusal/return/expiry, diagrams, adviser recovery, membership and combined PDF/audio quota regressions.
- Source previews: bounded server source identities only; no arbitrary browser URL input, no client provider keys, account/epoch and disposal fencing, generated local image cleanup, source metadata survives history merge. IELTS teacher behavior unchanged.
- Preview media is explanatory material, not a PDF/audio export: it does not call download-quota or export APIs.
- Previous frozen candidate native simulator: consent, explicit login, effective exit, protected deep link return, session expiry, inline canvas and PNG zoom PASS; task bootstrap data checksum unchanged.
- Final frozen client `4a4a5ddbfec48b7ec04f43b2efcfdee716e2ad90`: all tests and 10 additional packaged regression suites PASS. Main package 1,946,679 bytes, headroom 150,473 bytes.
- Native simulator: 9 final cases PASS, including rendering the actual model answer as answer/steps/diagram, actual 24-character source nonce references, an automatically loaded real official-page PNG, zoom and expiry. Fixture storage and API mocks restored.
- Production backend `efd03b545b636878f5306db9d75dba8c39167a6f` is active and hash-verified. Final resource/health gate PASS. IELTS service and payment configuration unchanged; no database schema migration or student-data restoration.
- Actual official Search/direct-read/fallback/model/history/source-preview flows passed for Imperial Mechanical Engineering and MIT undergraduate/AP policy. Wrong-owner source retrieval returned 404; unauthenticated public source-preview and adviser-resume requests returned 401. Public fixed questions used isolated test databases, not student conversations.
- Plain Chinese translation remained `not_requested` for research and returned without searching. Actual academic model output included a validated force diagram; the client rendered its plain headings into separate answer and step sections.
- Official development upload **1.0.86 succeeded**. This is not a public Mini Program release, review submission, or verified experience-version designation.

## Delivery boundaries

Official page text is untrusted source material, not instructions. A static webpage capture is labelled as such; blocked rendering becomes a clearly labelled original-text excerpt, never a fabricated screenshot. The answer can finish before screenshot work. Historical conversations do not trigger mass screenshot fetching.

No new database schema or payment behavior is intended. Physical phone, iPad, camera, microphone, Pencil and Apple purchase verification are not established by simulator tests. Public Mini Program review/release is separate from uploading a development package.

## Operational notes

The isolated screenshot runtime uses a digest-pinned Playwright 1.64.1 image, no network, non-root execution, a read-only root and only its hash-verified public runtime mounted read-only. All initial capabilities remain dropped. The upstream seccomp profile has exactly one reviewed additive `chroot` syscall allowance so Chromium can restrict itself in its own user namespace; no host security policy or sysctl was changed. Original and derived profiles are retained for rollback.

Real acceptance found and fixed missing production source-registry artifacts, known UTM links being wrongly discarded, direct-read/Fetch failover, long-page requirement prioritization, and official FAQ versus transfer/credit-policy separation. An initial startup probe briefly returned 502; subsequent bounded health/resource checks passed without another restart for that event.

The existing full question-content rebuild remains blocked by local reviewed-content/asset completeness. No unreviewed question assets, source-content manifests or production question-bank release were changed in this code-only rollout.

## References

- https://api-docs.deepseek.com/guides/search/
- https://github.com/wechat-miniprogram/miniprogram-demo (MIT, reference only)
- https://playwright.dev/docs/docker
- https://github.com/microsoft/playwright/tree/v1.64.1 (Apache-2.0 runtime; notices retained with the isolated renderer)

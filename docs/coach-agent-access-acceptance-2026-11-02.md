# Coach access and source previews

Scope: mandatory privacy/login entry; detailed academic steps and safe native diagrams; source-backed admissions research with in-conversation official excerpts and static webpage previews.

## Verification

- Full `npm run test:all`: PASS, including packaged-runtime determinism, native WXML/WXSS compiler, login refusal/return/expiry, diagrams, adviser recovery, membership and combined PDF/audio quota regressions.
- Source previews: bounded server source identities only; no arbitrary browser URL input, no client provider keys, account/epoch and disposal fencing, generated local image cleanup, source metadata survives history merge. IELTS teacher behavior unchanged.
- Preview media is explanatory material, not a PDF/audio export: it does not call download-quota or export APIs.
- Previous frozen candidate native simulator: consent, explicit login, effective exit, protected deep link return, session expiry, inline canvas and PNG zoom PASS; task bootstrap data checksum unchanged.
- Latest source-preview UI and live production research/capture still require release acceptance. Do not infer public availability from local tests.

## Delivery boundaries

Official page text is untrusted source material, not instructions. A static webpage capture is labelled as such; blocked rendering becomes a clearly labelled original-text excerpt, never a fabricated screenshot. The answer can finish before screenshot work. Historical conversations do not trigger mass screenshot fetching.

No new database schema or payment behavior is intended. Physical phone, iPad, camera, microphone, Pencil and Apple purchase verification are not established by simulator tests. Public Mini Program review/release is separate from uploading a development package.

## References

- https://api-docs.deepseek.com/guides/search/
- https://github.com/wechat-miniprogram/miniprogram-demo (MIT, reference only)
- https://playwright.dev/docs/docker
- https://github.com/microsoft/playwright/tree/v1.64.1 (Apache-2.0 runtime; notices retained with the isolated renderer)

# Oracle personas: continuous chat acceptance

## Student-facing change

Both 西方塔罗 and 东方玄学 now behave as ongoing fictional chat personalities. The same composer supports chat before drawing, follow-ups, ordinary topic changes and draft restoration. An explicit adjacent 抽牌/抽签/再抽 button is the only draw action. Choosing the next spread preserves the current artwork and conversation. Existing card images, reversed orientations and viewer remain unchanged.

The native page previously discarded ordinary input for divination personas and routed every send to interpretation. The API also rejected any message without a live receipt. Both root causes were reproduced by failing tests. A further regression reproduced a stale interpretation leaving `loading=true`; the finalizer now releases the composer on success, failure or rejected completion.

The server keeps exact historical draw facts in the existing authenticated conversation store, separately from the expired receipt's authorization to start a new interpretation. It preserves account/persona binding and clears historical draw access when that conversation is deleted. No model switch, schema migration or academic/IELTS change.

## Evidence

Evidence folder: `D:/CodexWork/tavern-persona-20261023/`.

- `full-suite-result.json` and `packaged-suite-result.json`: full source and transformed Mini Program suites.
- `backend-suite-result.json`: 18 focused suites, including JSON/SSE, expired receipts, restart persistence, three-card names/positions/orientations, isolation/clear, DeepSeek routing, media and existing Coach boundaries.
- `native-acceptance.json`: official WeChat native input/button interactions for both personas, chat/draw/chat, expired-state continuation, failure/retry with the same logical turn ID, explicit new draw, three-card selection and restored draft. Responses are clearly labelled synthetic QA fixtures. Only public artwork access is allowed; actual user authentication/history/payment APIs are blocked.
- `responsive-result.json`: 48 actual WXML/CSS replays, two oracle roles, 320/375/390/667/820/1180 px, normal/2x fonts and open/closed keyboard-height fixtures, reduced motion. Checks message-area, composer, send/draw targets and horizontal overflow. Final screenshots are inspected; long composer placeholder/redraw labels were shortened after enlarged-font inspection.
- `live-model-result.json` and `live-model-review.json`: eight synthetic questions against the real existing DeepSeek provider. Follow-ups correctly recall 魔术师正位 and 乾; both roles switch to ordinary conversation without requiring/redrawing cards. This is targeted continuity verification, not a guarantee of all future wording or a handset speed benchmark.
- `deployment-tests.json`: nine safety checks for stale/resource gates, checksum/traversal rejection, activation, no overwrite, protected files and exact rollback.

Physical phone/iPad keyboards, accessibility services and the complete authenticated production account journey remain **NOT VERIFIED**. Native simulator + synthetic API checks, real-provider probes and deployed-file/health checks are reported separately.

## Operational notes

The local skill path was corrected using the catalog root, without installing plugins. An artwork test's missing local Sharp path was resolved using the already bundled dependency and its supported path argument. The first isolated QA preparation failed its synthetic owner/nonce validation and was retained unused; only the completed `-qa-v2` project was opened. A native automation fixture attempted to spread a frozen proxy object; it now injects only the explicit expiry-state flag, while actual timestamp expiry is covered by API/unit tests. Cold automator timeouts were inspected by reading the current route before one retry, not treated as product failures.

No secrets, real user conversations or login-profile details are retained in test evidence. The CLI readiness receipt is minimized to gate fields. No global memory/hook configuration or user-owned error log is modified.

## Release

Backend runtime commit `e01416b666339c779f3efc9cf27059af496b6976` is a four-file, no-migration overlay. Fresh strict gates passed before upload, activation and the single STEM restart. The first post-restart sample exceeded the I/O-wait limit, so no further mutation occurred. A subsequent read-only stabilization gate passed with I/O wait 0%, 0%, 0.5%, swap 9.58%, unchanged non-target service PIDs/restart counts, matching protected/new hashes and verified rollback. STEM and IELTS HTTPS health returned 200. See `gate-after-stabilization.json` and `operation-verify.json`.

1.0.56 was independently confirmed uploaded successfully and reconciled before assigning the next version. The new frontend is intended for 1.0.57; the actual upload result must be appended, and pending confirmation is not upload success or public publication. User-owned `project.config.json` remains unchanged at SHA256 `A6D9C6A9CB8C4732F591272E9F18DB86C12628CB2AA5FEDECD9EFB97CE5705FA`.

Final runtime commit: `ef441d433280e317190e725043f1d1e48fc69367`. Clean candidate: `D:/CodexWork/tavern-persona-20261023-candidate`; runtime manifest SHA256 `8c19aeea7fd7a349b93d814e943eec30abc38bd3335f83039e94e1e0f84b7d26`. All 327 runtime files and the four changed native-tested files were checked before upload. Main source-package size/headroom remain 1,966,007/131,145 bytes; no server artwork or QA fixtures enter the package.

Official 1.0.57 upload task `confirmation_upload_978ec41e-3a0e-4dbe-a08f-c8a6f8e7f413` returned **PENDING user confirmation**, not upload success. Confirm inside WeChat Developer Tools. Per `wechatide-skill`, do not actively poll or reissue before user continuation; query this existing task first on resumption. No review submission/public publication was performed.

References: [SillyTavern](https://github.com/SillyTavern/SillyTavern) informed persistent personality-led interaction; no code/dependency was imported. `ui-ux-pro-max` informed a separate accessible draw action and keyboard-safe common composer while preserving the established native design.

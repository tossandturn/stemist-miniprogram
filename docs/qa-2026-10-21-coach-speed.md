# Academic Coach speed acceptance — 2026-10-21

## Scope

- Academic text/photo Coach uses the existing authenticated `/api/ai/coach/stream` endpoint. Native `onChunkReceived` incrementally decodes UTF-8 and SSE; the same request can be consumed buffered on older native implementations.
- Complete sentences/lines outside unfinished formula, emphasis and code delimiters are shown at a bounded 120 ms cadence. Provider reasoning is not part of this endpoint's text deltas. `reset` discards the previous provider's provisional text.
- Only a valid terminal receipt can complete the turn. Interrupted output is explicitly labelled before the answer, never written as a completed submission/history. Original input remains retryable. No automatic second paid AI request.
- STEM Coach pages warm an existing near-expiry session while visible. Renewals coalesce, stop scheduling on hide/unload, and have a 25 second independent watchdog. Ordinary callers retain the original 45 second expiry threshold; no new account is created by warmup.
- Simple worked solutions ask for the answer, necessary steps and one check, without repeated concept/method boilerplate. Complex questions retain conditions, derivation and units. Exam restrictions remain enforced by the server.

IELTS model, pages, prompts and transport are unchanged; shared session and formatting defaults retain regression coverage. Tavern media/history and PDF asynchronous marking are not switched to this academic streaming path. No production server/configuration/model change was required.

## Actual native + production API observations

Isolated WeChat developer-tool app, normal `wx.login`, synthetic inputs only, memory-only auth/storage. Upload/payment and unrelated write routes are blocked. Submission uses the component's public submit event, not a physical touch or a phone-network test. First visible time is the first meaningful answer `setData` callback, not HTTP headers or the SSE `meta` frame.

| Input | First meaningful visible answer | Complete |
| --- | ---: | ---: |
| Equation, run 1 | 1,568 ms | 2,265 ms |
| Velocity–time graph | 2,630 ms | 3,300 ms |
| Equation, run 2 | 3,127 ms | 3,665 ms |
| Equation after prewarm | 1,718 ms | 2,157 ms |
| Final runtime equation smoke | 1,369 ms | 1,566 ms |

The equation returned x = 4; the graph returned 50 m. All five HTTP calls completed with 200, multiple actual chunks, and nonempty canonical answers. These are small diagnostic samples, not a production percentile, same-condition before/after speed ratio, or a promise of phone latency. The Singapore network leg still exists.

Prewarm evidence: a synthetic near-expiry hint triggered normal WeChat renewal before submit; the observed 386 ms renewal finished before the next 2,157 ms Coach run. No additional auth call was made inside that submission. Another idle renewal took 555 ms. No credentials were saved in QA artifacts.

## Failure and rendering checks

- Native synthetic mid-stream disconnect: provisional x = 4 and a step remain visible, spinner terminates, warning precedes answer, retry is offered. No new paid AI call is issued by the fault injection.
- Unit tests: one-byte UTF-8 splits, multiline math, reset, missing terminal, malformed/oversized events, buffered compatibility, 401, owner/privacy change, delayed preview ownership, unload cancellation, independent total timeout, renewal coalescing/watchdog and late-auth isolation.
- PASS: `npm run test:all` on source (2026-10-21 23:22:39 Asia/Shanghai) and transformed-module runtime (23:23:06); final receipts are in the task artifact folder below. Both modes preserve existing IELTS, Tavern, paper/download, photo and renderer regressions.
- Responsive replay: 24 cases using actual rich-text nodes and component CSS at 375, 667, 768 and 1024 px, including streaming preview/final answer and long formulas; no page overflow or hidden answer tail. Isolated Chrome rendering is not iPad hardware testing.
- Native screenshots include graph formula rendering, final equation and labelled partial failure. No external assets or new dependencies are added.

## Release evidence

- Task artifacts: `D:/CodexWork/coach-speed-20261021/`.
- Timing receipts: `real-live-results.json`, `final-runtime-live-result.json`.
- Test receipts: `full-suite-result.json`, `packaged-suite-result.json`, `responsive-result.json`.
- Native screenshots: `photo.png`, `final-answer.png`, `partial-failure-final.png`.
- The main-package safety budget remains 128 KiB below 2 MiB. Scoped identifier compression retains names/property names and is behavior-tested; no global property/syntax mangling.
- The user-owned `project.config.json` stays unchanged (SHA256 A6D9C6A9CB8C4732F591272E9F18DB86C12628CB2AA5FEDECD9EFB97CE5705FA).
- 1.0.52's previous upload is confirmed successful and reconciled in `releases/development.json`. The next upload must use 1.0.53, the clean candidate and official confirmation workflow; a pending confirmation is not success.

## Reference attribution

- Native chunk event contract: [WeChat API typings #233](https://github.com/wechat-miniprogram/api-typings/issues/233), [#301](https://github.com/wechat-miniprogram/api-typings/issues/301).
- [Tencent WeKnora Mini Program reference](https://github.com/Tencent/WeKnora/blob/main/website-docs/05-clients/04-miniprogram.md) was inspected; its documented buffered parser was not copied as a streaming solution.
- [DeepSeek chat completion](https://api-docs.deepseek.com/api/create-chat-completion/) documents incremental SSE. This change consumes our existing server contract, never puts provider credentials in the client.

Remaining NOT VERIFIED: physical phone 4G/5G/Wi-Fi, physical iPad, production latency distribution and public-release acceptance. No public review submission or release is performed by this development upload.

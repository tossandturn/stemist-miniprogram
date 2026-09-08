# Stemist Mini Program

Photo-first WeChat Mini Program entry for the unified IELTSist + STEM product.

The product and interaction baseline is documented in [`docs/mini-program-product-design.md`](docs/mini-program-product-design.md) and the executable v2 spec in [`docs/mini-program-redesign-v2.md`](docs/mini-program-redesign-v2.md). The current four-entry home shell and calculator sourcing decision are recorded in [`docs/calculator-integration.md`](docs/calculator-integration.md). The mini program reuses the production products' Today, Practice, AI Coach, Progress, Account and Notebook vocabulary instead of introducing a separate visual system. Long runs are recorded in the dated `docs/run-log-*.md` checkpoints.

## Product scope

- Home: exactly four primary entrances — A-Level subjects, IELTS, competitions/admissions, and a Casio-style scientific calculator.
- Calculator: native international fx-991CW key arrangement, LCD menus and fraction display; local scientific arithmetic, nine variables, f/g functions, real quadratic/2-variable equations, one-variable statistics, tables, ratio and signed 32-bit base conversion. This is not Casio firmware or a complete official emulator. [Current CW scope and QA](docs/calculator-cw-qa-2026-09-06.md).
- Competitions/admissions open the past-paper catalog directly. There is no competition Topic generator or readiness gate in this entrance.
- STEM Topic practice is native: select syllabus chapters/components/count, assemble from the existing API, display the current question's original image pages, capture/crop an answer and restore local progress. Full-paper and competition workspaces are now native too. Original PDFs open through `wx.openDocument`, not a website. See [native migration and acceptance](docs/native-migration-plan-2026-09-06.md).
- STEM route selection reads the server's syllabus inventory and, when signed in, saves a provisional photo-attempt summary to the shared STEM attempts API (the original photo is not persisted there).
- IELTS: native catalog, Listening/Reading source images, audio player, question-by-question text answers, local recovery and server objective scoring. Same-Test, Random Exam, Vocabulary, records and membership have native pages. The existence of these pages is not a claim of complete web feature parity; remaining acceptance work is explicitly listed in the migration document.
- IELTS Writing: original task images, typed essay or cropped photo with durable local storage, transcription confirmation, asynchronous feedback, saved results and native PDF report download.
- IELTS Speaking: native recorder, PCM WebSocket input and WebAudio output through the existing Qwen service. Transcript and feedback restore locally. Real-device voice acceptance is still outstanding.
- AI Coach remains available for STEM, Listening, Reading and Writing; Speaking keeps its dedicated realtime Qwen examiner instead of being forced through the text Coach.
- No Apple Pencil in the Mini Program. Full PDF annotation and PencilKit remain in the iOS app.
- Phone and iPad are explicit layouts: phone uses a single column and bottom navigation; iPad uses a wide top navigation and two-column workspaces with a portrait fallback.
- Practice now has a real route selector, server-backed inventory, IELTS skill entry points and a separate Past papers catalog. Progress reads local submissions plus authenticated STEM attempts; Notebook stores route-scoped private notes and synchronizes them when signed in.
- Secondary navigation is a shared five-item component (Today / Practice / AI Coach / Progress / Account). AI Coach is fixed at the upper-right on every page; it is not a sixth bottom-nav item.

## Run locally

1. Install WeChat Developer Tools.
2. Import this directory.
3. Replace `appid` in `project.config.json` with your Mini Program app ID.
4. Configure the required request, download and socket HTTPS/WSS domains for STEM/IELTSist in the Mini Program console. There is no WebView business-domain dependency in the current learning routes.
5. Run `npm run test:all` for the full local contract suite. When the sibling STEM checkout is present, `npm run test:route-mirror` compares every client route ID with `src/data/routeRegistry.js`. On Windows with WeChat Developer Tools installed, `npm run test:wechat` compiles every WXML/WXSS file with the installed compiler.

The client never contains an AI provider key. STEM uses `/api/ai/coach`; IELTS Coach uses its own native account session with `/api/help/chat`. API origins are allowlisted. `wx.login` exchanges a one-time code through `/api/auth/wechat`; the server never returns the WeChat `session_key`. Expired native sessions are renewed through WeChat or the app's own password-login session. Credentials issued to this app stay in private runtime storage and are cleared on logout; they are never packaged or logged.

`/api/auth/native-session` exchanges a validated STEM identity for a separate bounded IELTS session. Ordinary IELTS API calls never receive the STEM bearer. Old own-site links are resolved to native pages; `pages/webview/index` is a compatibility redirect, not a WebView.

Developer Tools `develop`/`trial` builds set `globalData.debugMode` so every product surface stays visible for QA; this is a feature-visibility flag, not a forged account or bypass token. Real AI and cloud writes still require the server-issued WeChat session.

### Optional simulator automation

The installed WeChat Developer Tools includes a local `wechatide` automation CLI. After allowing the `Codex` client in the Developer Tools security/CLI prompt, the simulator can be refreshed and inspected without changing the project files:

```powershell
D:\微信web开发者工具\wechatide.cmd auth -c Codex
D:\微信web开发者工具\wechatide.cmd -c Codex simulator_refresh --project D:\CodexWork\stemist-miniprogram
D:\微信web开发者工具\wechatide.cmd -c Codex simulator_screenshot --project D:\CodexWork\stemist-miniprogram --path $env:TEMP\stemist-simulator.jpg
```

If CLI authorization is not enabled, use the Developer Tools Compile button; the repository's `test:wechat` command still validates every template and stylesheet locally.

For actual native-page clicks and recovery checks, use `scripts/test-devtools-native-ielts.cjs` and `scripts/test-devtools-native-modules.cjs` against the automation endpoint on port 9420. Install the official `miniprogram-automator` SDK outside the upload tree and set `WECHAT_AUTOMATOR_MODULE` to its absolute module directory. Production API/AI smoke scripts are explicitly opt-in and are not run by the unit suite.

Run `node scripts/build-native-package.mjs --check-only` to validate the exact runtime whitelist without creating an artifact. It requires at least 128 KiB of headroom below the 2 MiB main-package budget. After committing reviewed runtime files, `node scripts/build-native-package.mjs --out D:\CodexWork\stemist-native-upload-<commit>` creates a clean upload directory and hash manifest, excluding QA scripts, documents, raw banks and OCR outputs. It does not overwrite the original IDE project configuration.

## Photo pipeline

The native `camera` page captures exactly one image using `wx.createCameraContext().takePhoto`. Only an unavailable-camera development environment falls back to a camera-only media picker. The crop page exports a bounded JPEG. The Coach page converts it to a JPEG data URL only at submit time, sends it to the server, and renders explicit loading/error/retry states. The server remains responsible for provider credentials, image limits, provenance and AI scoring.

## Current integration notes

- All API and WebSocket traffic must use configured HTTPS/WSS domains.
- The native identity adapters are deployed. The latest production check reports `wechatConfigured: false`; the Mini Program AppID/AppSecret must be configured securely on the account server before WeChat login can pass real acceptance. Do not put the secret in client files, Git or chat.
- Local data is reused through source catalogs and versioned assets. OCR completion is not permission to release unreviewed questions; source images, stage isolation and the 6/12 Topic gates remain intact.

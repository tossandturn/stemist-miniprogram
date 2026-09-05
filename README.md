# Stemist Mini Program

Photo-first WeChat Mini Program entry for the unified IELTSist + STEM product.

The product and interaction baseline is documented in [`docs/mini-program-product-design.md`](docs/mini-program-product-design.md) and the executable v2 spec in [`docs/mini-program-redesign-v2.md`](docs/mini-program-redesign-v2.md). The current four-entry home shell and calculator sourcing decision are recorded in [`docs/calculator-integration.md`](docs/calculator-integration.md). The mini program reuses the production products' Today, Practice, AI Coach, Progress, Account and Notebook vocabulary instead of introducing a separate visual system. Long runs are recorded in the dated `docs/run-log-*.md` checkpoints.

## Product scope

- Home: exactly four primary entrances — A-Level subjects, IELTS, competitions/admissions, and a Casio-style scientific calculator.
- Competitions/admissions open the past-paper catalog directly. There is no competition Topic generator or readiness gate in this entrance.
- STEM: the web product's Topic/paper/progress/Notebook capabilities remain reachable; the mini-program input path is one photographed question through the native rear-camera page, crop before AI Coach review.
- STEM route selection reads the server's syllabus inventory and, when signed in, saves a provisional photo-attempt summary to the shared STEM attempts API (the original photo is not persisted there).
- IELTS: complete IELTSist workspace map — Dashboard, four skills, Same-Test, Random Exam, Vocabulary, Mine/Account, Subscription and AI Coach. Listening/Reading native quick notes use IELTSist `/api/help/chat`; full audio, paper, timer and report controls open through the allowlisted IELTSist WebView.
- IELTS Writing: typed essay or one-question photo upload, then IELTSist AI feedback; the full Cambridge writing workspace remains one tap away.
- IELTS Speaking: opens the existing IELTSist Qwen speaking experience in `web-view`.
- AI Coach remains available for STEM, Listening, Reading and Writing; Speaking keeps its dedicated realtime Qwen examiner instead of being forced through the text Coach.
- No Apple Pencil in the Mini Program. Full PDF annotation and PencilKit remain in the iOS app.
- Phone and iPad are explicit layouts: phone uses a single column and bottom navigation; iPad uses a wide top navigation and two-column workspaces with a portrait fallback.
- Practice now has a real route selector, server-backed inventory, IELTS skill entry points and a separate Past papers catalog. Progress reads local submissions plus authenticated STEM attempts; Notebook stores route-scoped private notes and synchronizes them when signed in.
- Secondary navigation is a shared five-item component (Today / Practice / AI Coach / Progress / Account). AI Coach is fixed at the upper-right on every page; it is not a sixth bottom-nav item.

## Run locally

1. Install WeChat Developer Tools.
2. Import this directory.
3. Replace `appid` in `project.config.json` with your Mini Program app ID.
4. Configure `stem.ieltsist.com` as a business/server domain and enable HTTPS checks before release.
5. Run `npm run test:all` for the full local contract suite. When the sibling STEM checkout is present, `npm run test:route-mirror` compares every client route ID with `src/data/routeRegistry.js`. On Windows with WeChat Developer Tools installed, `npm run test:wechat` compiles every WXML/WXSS file with the installed compiler.

The client never contains an AI provider key. STEM requests use the server-side `/api/ai/coach` endpoint; IELTS quick Coach requests use the allowlisted `https://ieltsist.com/api/help/chat`; both use bounded 55s/60s client budgets. API origins are allowlisted to STEM/IELTSist production or loopback developer runs. Entry cards and Account call `wx.login` and exchange the one-time code through `/api/auth/wechat`; the IELTSist account service keeps the WeChat identity mapping server-side and never returns `session_key`. The existing username/password screen remains a recovery path and stores only the short-lived `accessToken` in `stemistSessionToken`.

IELTS quick pages are stateless convenience surfaces. Account history, official reports, vocabulary notebooks, subscriptions and full timers are opened in the allowlisted IELTSist WebView, where the one-time handoff establishes the real IELTSist session cookie; a STEM bearer token is never treated as an IELTSist cookie.

Developer Tools `develop`/`trial` builds set `globalData.debugMode` so every product surface stays visible for QA; this is a feature-visibility flag, not a forged account or bypass token. Real AI and cloud writes still require the server-issued WeChat session.

### Optional simulator automation

The installed WeChat Developer Tools includes a local `wechatide` automation CLI. After allowing the `Codex` client in the Developer Tools security/CLI prompt, the simulator can be refreshed and inspected without changing the project files:

```powershell
D:\微信web开发者工具\wechatide.cmd auth -c Codex
D:\微信web开发者工具\wechatide.cmd -c Codex simulator_refresh --project D:\CodexWork\stemist-miniprogram
D:\微信web开发者工具\wechatide.cmd -c Codex simulator_screenshot --project D:\CodexWork\stemist-miniprogram --path $env:TEMP\stemist-simulator.jpg
```

If CLI authorization is not enabled, use the Developer Tools Compile button; the repository's `test:wechat` command still validates every template and stylesheet locally.

For actual page clicks, inputs and geometry checks, enable the Developer Tools automation endpoint on local port 9420 and run `node scripts/test-devtools-journeys.cjs`. Install the official `miniprogram-automator` SDK outside the upload tree and set `WECHAT_AUTOMATOR_MODULE` to its absolute module directory. The script's default points to this workstation's QA-only install. See [current QA status](docs/mini-program-qa-status.md) for tested paths and remaining real-device checks.

## Photo pipeline

The native `camera` page captures exactly one image using `wx.createCameraContext().takePhoto`. Only an unavailable-camera development environment falls back to a camera-only media picker. The crop page exports a bounded JPEG. The Coach page converts it to a JPEG data URL only at submit time, sends it to the server, and renders explicit loading/error/retry states. The server remains responsible for provider credentials, image limits, provenance and AI scoring.

## Current integration notes

- `stem.ieltsist.com` and `ieltsist.com` must be configured as WeChat business domains; the Mini Program account cannot be personal if it uses `web-view`.
- All API and WebSocket traffic must use configured HTTPS/WSS domains.
- Add a dedicated WeChat identity adapter that exchanges `wx.login` code on the server and maps the result to the existing IELTSist account. Never send `session_key` to the client.

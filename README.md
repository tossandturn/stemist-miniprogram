# Stemist Mini Program

Photo-first WeChat Mini Program MVP for the unified IELTSist + STEM product.

The product and interaction baseline is documented in [`docs/mini-program-product-design.md`](docs/mini-program-product-design.md). The mini program reuses the production products' Dashboard/Today, Practice, Account and AI Coach vocabulary instead of introducing a separate visual system.

## Product scope

- STEM: one question per capture, rear camera only, crop before submit, AI Coach review.
- IELTS Listening / Reading: typed answer and review text fields.
- IELTS Writing: typed essay or one-question photo upload, then AI feedback.
- IELTS Speaking: opens the existing IELTSist Qwen speaking experience in `web-view`.
- AI Coach remains available for STEM, Listening, Reading and Writing; Speaking keeps its dedicated realtime Qwen examiner instead of being forced through the text Coach.
- No Apple Pencil in the Mini Program. Full PDF annotation and PencilKit remain in the iOS app.
- Phone and iPad are explicit layouts: phone uses a single column and bottom navigation; iPad uses a wide top navigation and two-column workspaces with a portrait fallback.

## Run locally

1. Install WeChat Developer Tools.
2. Import this directory.
3. Replace `appid` in `project.config.json` with your Mini Program app ID.
4. Configure `stem.ieltsist.com` as a business/server domain and enable HTTPS checks before release.
5. Run `npm test`, `npm run test:device`, and `npm run test:pages` for the repository contracts. On Windows with WeChat Developer Tools installed, run `npm run test:wechat` to compile every WXML/WXSS file with the installed compiler.

The client never contains an AI provider key. `utils/api.js` calls the server-side `/api/ai/coach` endpoint. The MVP includes an account screen that uses the existing `/api/auth/login` and `/api/auth/register` contract and stores only the short-lived `accessToken` in `stemistSessionToken`. A production WeChat release should replace or augment this with a server-side `wx.login` exchange and never send `session_key` to the client.

### Optional simulator automation

The installed WeChat Developer Tools includes a local `wechatide` automation CLI. After allowing the `Codex` client in the Developer Tools security/CLI prompt, the simulator can be refreshed and inspected without changing the project files:

```powershell
D:\微信web开发者工具\wechatide.cmd auth -c Codex
D:\微信web开发者工具\wechatide.cmd -c Codex simulator_refresh --project D:\CodexWork\stemist-miniprogram
D:\微信web开发者工具\wechatide.cmd -c Codex simulator_screenshot --project D:\CodexWork\stemist-miniprogram --path $env:TEMP\stemist-simulator.jpg
```

If CLI authorization is not enabled, use the Developer Tools Compile button; the repository's `test:wechat` command still validates every template and stylesheet locally.

## Photo pipeline

`wx.chooseMedia` captures exactly one image. The crop page exports a bounded JPEG. The Coach page converts it to a JPEG data URL only at submit time, sends it to the server, and renders explicit loading/error/retry states. The server remains responsible for provider credentials, image limits, provenance and AI scoring.

## Current integration notes

- `stem.ieltsist.com` and `ieltsist.com` must be configured as WeChat business domains; the Mini Program account cannot be personal if it uses `web-view`.
- All API and WebSocket traffic must use configured HTTPS/WSS domains.
- Add a dedicated WeChat identity adapter that exchanges `wx.login` code on the server and maps the result to the existing IELTSist account. Never send `session_key` to the client.

# Stemist Mini Program

Photo-first WeChat Mini Program MVP for the unified IELTSist + STEM product.

## Product scope

- STEM: one question per capture, rear camera only, crop before submit, AI Coach review.
- IELTS Listening / Reading: typed answer and review text fields.
- IELTS Writing: typed essay or one-question photo upload, then AI feedback.
- IELTS Speaking: opens the existing IELTSist Qwen speaking experience in `web-view`.
- No Apple Pencil in the Mini Program. Full PDF annotation and PencilKit remain in the iOS app.

## Run locally

1. Install WeChat Developer Tools.
2. Import this directory.
3. Replace `appid` in `project.config.json` with your Mini Program app ID.
4. Configure `stem.ieltsist.com` as a business/server domain and enable HTTPS checks before release.
5. Run `npm test` for the repository contract check.

The client never contains an AI provider key. `utils/api.js` calls the server-side `/api/ai/coach` endpoint. The MVP includes an account screen that uses the existing `/api/auth/login` and `/api/auth/register` contract and stores only the short-lived `accessToken` in `stemistSessionToken`. A production WeChat release should replace or augment this with a server-side `wx.login` exchange and never send `session_key` to the client.

## Photo pipeline

`wx.chooseMedia` captures exactly one image. The crop page exports a bounded JPEG. The Coach page converts it to a JPEG data URL only at submit time, sends it to the server, and renders explicit loading/error/retry states. The server remains responsible for provider credentials, image limits, provenance and AI scoring.

## Current integration notes

- `stem.ieltsist.com` and `ieltsist.com` must be configured as WeChat business domains; the Mini Program account cannot be personal if it uses `web-view`.
- All API and WebSocket traffic must use configured HTTPS/WSS domains.
- Add a dedicated WeChat identity adapter that exchanges `wx.login` code on the server and maps the result to the existing IELTSist account. Never send `session_key` to the client.

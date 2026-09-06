# Stemist Mini Program Engineering Rules

## Product boundary

This repository is the WeChat Mini Program entry for the unified STEM Studio + IELTSist student product. Read `docs/mini-program-product-design.md` before changing a page or adding a route.

- STEM is photo-first: one question, rear camera, crop, then AI Coach.
- IELTS Listening and Reading use text workspaces.
- IELTS Writing supports typed text or one photographed handwritten page.
- IELTS, academic subjects and competition journeys must use native Mini Program pages. Reuse server APIs, not embedded webpages. Speaking uses the native recorder/audio pipeline and the existing Qwen service.
- AI Coach must remain available for STEM, Listening, Reading and Writing.

## Architecture

- Reuse `components/stemist-header`, `components/coach-panel`, and `components/text-practice` for shared UI and interaction states.
- Use `utils/device.js` and `utils/page.js` for device classification, rotation updates, drafts and local state.
- Use `utils/inventory.js` for server-backed syllabus counts; never hardcode or infer question totals in a student-facing screen.
- Use `utils/attemptSync.js` for the authenticated STEM photo-attempt summary; do not send original image data to the attempts endpoint.
- Use `utils/ieltsObjectivePage.js` for Listening/Reading, native source services for paper practice, and `utils/ieltsLearning.js` for authenticated IELTS calls. `skillPage.js` is legacy compatibility only.
- Keep STEM route IDs in `utils/stemRoutes.js` aligned with the source STEM route registry. Client route context is a focus hint, never an authorization source.

## Device contract

- Phone: single column, bottom navigation, keyboard-safe actions.
- iPad/tablet: wide navigation, two-column workspace, portrait fallback, no Apple Pencil assumptions.
- Validate both phone and iPad paths after layout changes; do not use width alone to classify a landscape phone.

## Security and data

- Provider keys, cookies, session keys and databases never enter this repository or client bundle.
- Use server-side `/api/ai/coach` and existing auth contracts; handle 401, timeout and provider failure as explicit retryable states.
- Never treat client-supplied route labels as permission or official-score evidence.
- Keep `project.private.config.json` and local AppID changes out of commits.

## Verification

Run before pushing:

```powershell
npm test
npm run test:device
npm run test:image
npm run test:pages
npm run test:wechat
```

Real camera, microphone, domain allowlists and iPad/phone device checks remain required before release. Do not equate compiled native pages with complete web-feature or hardware acceptance.

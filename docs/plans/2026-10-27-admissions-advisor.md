# Admissions Advisor Implementation Plan

> For implementer: use TDD. Add a focused failing test, run it, implement, then rerun relevant regressions.

**Goal:** Add an independent fifth AI Coach entry, 留学申请顾问, for international undergraduate application planning, background analysis, document coaching, and application emails.

**Architecture:** Keep existing academic, IELTS, PDF marking and Tavern behavior unchanged. Add a text-first native page in the existing Coach subpackage. Reuse authenticated requests, SSE rendering, keyboard geometry and the server-owned conversation persistence engine, with a separate admissions namespace and database root. Never put credentials or user profiles in URLs or sharing metadata. Do not automatically import grades, photographs or Tavern history.

**Tech stack:** Existing native WXML/WXSS/JavaScript, Node ESM, SQLite conversation engine and the configured STEM academic provider. No new dependencies.

## Scope and content

- Four starter chips fill the composer, never automatically send: application planning, background analysis, document revision, application email.
- Clear AI identity; no claim of being a real agency or admission officer, no offer guarantee or invented admission probability.
- Distinguish official requirements, qualitative AI advice, unknowns and next steps. Do not invent grades, deadlines, sources, achievements or research. Ask at most three relevant missing-profile questions while still giving useful provisional guidance.
- Writing uses supplied facts; mark placeholders and changes. Remind users to follow application-system AI rules where relevant. Do not claim an AI draft is submission-ready or human-authored.
- First slice accepts text, including pasted drafts. No new PDF or photo admission-document upload path.
- User can continue, restore, copy a reply, retry a failed turn, page older history and explicitly clear the cloud conversation. Account/privacy epoch isolation is mandatory.

## API contract

All endpoints share the existing detailed-Coach signed-login/owner-isolation policy and call its authorization hook. Identity is never client-supplied. Source review confirmed that the existing hook validates a supplied academic attempt, but does not perform a global entitlement or active-exam lookup for no-attempt roles. This slice neither changes payment policy nor claims new membership/global-exam enforcement; academic worked solutions/marking are directed to existing learning tools.

- `POST /api/ai/admissions/conversations/resume`: `{conversationId?}` -> `{conversation,messages,nextBefore}`.
- `GET /api/ai/admissions/conversations/:id/messages?before=...&limit=40`: same envelope.
- `DELETE /api/ai/admissions/conversations/:id`: `{deleted:true,conversationId}`.
- `POST /api/ai/admissions/stream`: `{conversationId,clientTurnId,expectedRevision,message}` -> standard `meta`, `delta`, `done` SSE. Success includes `{mode:'ai',providerStatus:'connected',answer,clientTurnId,conversation,turns:[user,assistant]}`. Failure is explicit and retryable, never a fabricated answer.
- Persona is fixed server-side as `admissions-advisor`. Client cannot supply system prompts, context, history, identity or other personas. Message maximum 12,000 characters with no silent truncation.
- Same clientTurnId replays committed results. Durable generated-result receipts recover a failed history commit without another provider call; total durable-storage failure is explicitly indeterminate and blocks client resending until reconciliation or explicit clear. This is not an unconditional exactly-once guarantee across all storage failures. Keep requests bounded to the existing text deadline. Incomplete streams are not complete answers.

## Task 1: backend (separate implementer)

Files: `D:/CodexWork/stem-runtime-tavern-memory-20261006/server/admissionsAdvisor.js`, minimal wiring in `server/aiApi.js`, isolated reuse support in `server/tavernConversationStore.js`, tests `scripts/test-admissions-advisor*.mjs`.

1. Add tests for auth, fixed role, prompt/output contract, ownership, forbidden fields, resume/delete, replay and failed/partial generation.
2. Run `node scripts/test-admissions-advisor-api.mjs` and observe failure because the new route does not exist.
3. Implement the contract above, using configured provider and persistence. No production/student data access.
4. Run the new tests plus existing Tavern memory, Coach stream and answer/source tests.

## Task 2: native client

Files: `bundles/coach/admissions.{js,json,wxml,wxss}`, `bundles/coach/admissionsConversation.js`, `bundles/coach/mode-icons/admissions.svg`, `bundles/coach/index.{js,wxml,wxss}`, `app.json`, `scripts/test-admissions-advisor.mjs`, existing four-mode assertions, package scripts and product design docs.

1. Test fifth-entry navigation and survival after a legacy four-card remote config refresh.
2. Test draft, streaming, canonical completion, failed retry using the same turn ID, history paging, clear confirmation, auth/privacy changes, storage errors and keyboard geometry.
3. Build the page with an always-visible keyboard-safe composer, separate role history and no auto-send.
4. Keep original four cards/config schema intact; show the fifth as a full-width extension with a small original SVG icon. No main-package imports of subpackage code.
5. Run `node scripts/test-admissions-advisor.mjs`, `npm run test:all`, package budget/WeChat checks. Preserve dirty `project.config.json`.

## Task 3: acceptance and release boundary

- Inspect fresh phone/tablet views, including keyboard-open and long reply; mark physical-device behavior unverified unless actually tested.
- Review source changes for cross-account leaks, secrets, duplicate billing and claim accuracy.
- Production deployment is a separate phase and requires the current strict server readiness gate. Never change IELTS, database contents or provider credentials. Upload/publication status must be stated accurately.

## References and design decisions

- https://github.com/LibreChat-AI/docs/blob/main/content/docs/features/agents.mdx — role instructions, conversation isolation and recovery reference only; no copied code or dependencies.
- https://www.ucas.com/applying/applying-to-university/writing-your-personal-statement/a-guide-to-using-ai-and-chatgpt-with-your-personal-statement — AI may assist ideation/structure/checking; a personal statement must remain truthful and follow the destination policy.
- ui-ux-pro-max suggested generic marketing layouts, which do not fit this established native app. Retain STEMist tokens and native system fonts; apply its touch-target, loading feedback and safe-area guidance.

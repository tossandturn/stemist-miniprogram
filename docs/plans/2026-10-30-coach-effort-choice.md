# Student-selectable Coach thinking effort

> **For implementer:** Use TDD throughout. Write failing test first. Watch it fail. Then implement.

**Goal:** Let students explicitly choose low / high / max for AI Coach. On 2026-10-31 the user refined the earlier low-default decision: academic answers and casual chat should have different defaults according to use. Keep low for fast interactions, high for full solutions/review, max opt-in only.

**Architecture:** A small shared native selector stores an account/epoch-bound preference. Each new request snapshots that preference; retries retain the original request setting, while new requests at another effort cannot replay an old-effort result. The backend accepts only the three official DeepSeek levels, clones the configured provider per request and applies bounded time/output budgets. No model/key/environment replacement and no IELTS specialist writing or realtime-speaking change.

**Tech Stack:** Native WeChat components, CommonJS client helpers, Node ESM STEM APIs, SQLite whole-paper jobs, existing official DevTools CLI.

## Approved product decisions

- Scenario defaults: steps/Tavern/short adviser questions low; full answers/check-work/PDF high; adviser planning, essay analysis and long input high. This is deterministic local intent selection, not private-user profiling. Separate owner/epoch-bound preferences per purpose. Labels include 按场景推荐, 快速 · low, 深入 · high, 极致 · max. Manual overrides win, recommendation shows the actual level before sending, and max is never automatic. Thinking remains enabled; these are not accuracy guarantees.
- Selector is visible before sending in academic help/answers/check-work, Tavern including draw interpretation, admissions advisor, IELTS teacher and whole-paper grading. IELTS's independent specialist learning/marking/voice interfaces stay unchanged.
- No automatic resubmission on changing the preference; loading and unresolved retry/receipt states lock the selector. A whole-paper job keeps its initial selection through upload/retry/history.
- Invalid values fail with a clear 400; unsupported configured providers fail explicitly rather than silently ignoring the selection. Old requests without the field keep existing behavior and hashes.
- Higher effort may take longer. Use bounded server/client deadlines with room to deliver/save the answer; no infinite retries or unbounded token settings. Hidden reasoning is not rendered.
- Respect the existing 128 KiB main-package headroom. If needed, apply proven local build minification to a small allowlist and test source plus frozen files; do not relax the limit.

## Task 1 — Canonical server policy

Create `D:/CodexWork/coach-recovery-20261029/backend/server/coachEffort.js` and `scripts/test-coach-effort.mjs`.

Test contract first:

```js
assert.equal(coachEffort(undefined), null)
for (const level of ['low', 'high', 'max']) assert.equal(coachEffort(level), level)
for (const invalid of ['medium', '', null, {}, 9]) assert.throws(() => coachEffort(invalid))
const provider = { name: 'deepseek', model: 'deepseek-flash', reasoningEffort: 'low' }
assert.equal(withCoachEffort(provider, 'max').reasoningEffort, 'max')
assert.equal(provider.reasoningEffort, 'low')
```

Run `node scripts/test-coach-effort.mjs`: expected RED, then GREEN after implementing exact enum/provider/budget functions. Integrate into `server/aiApi.js`, `server/advisorConversationEngine.js` and canonical request hashes. Include JSON and SSE, unsupported/invalid cases, old-client hashing, request isolation and actual provider-body assertions.

## Task 2 — Whole-paper job contract

Modify `server/wholePaperMarking.js` and `server/wholePaperAi.js`; add focused job tests. Persist a nullable effort column with an idempotent additive migration, bind it into new-job idempotency, preserve old records, expose the selected setting safely and reuse it on retry. Keep grading/source/ownership rules unchanged. Deploying the migration requires a verified database backup; rollback code ignores the additive column.

## Task 3 — Native preference and controls

Create `utils/coachEffort.js`, `components/coach-effort/index.{js,json,wxml,wxss}` and client tests. Scenario-specific low/high defaults, independent overrides, owner/epoch isolation, storage failure, cancelled selection, loading lock and redraw are covered before wiring.

Integrate `components/coach-panel/index.*`, `utils/coach.js`, `utils/api.js`, `utils/coachJob.js`, `pages/coach/index.wxml`, `pages/stem/coach.wxml`, `bundles/coach/advisorPage.js`, `advisorConversation.js`, Tavern page/conversation/divination helpers and `bundles/marking/index.js` / `service.js`. Capture the setting in new pending turns/jobs and preserve it on retries; do not read a newly changed preference when replaying an existing request.

## Task 4 — Acceptance and delivery

Run focused source and backend tests, full Mini Program suite, frozen artifact tests, original-template visual/geometry checks, and isolated native low/high/max requests. Assert request settings and final valid results, not just HTTP 200. Include changing level, interrupted polling, role switching, existing draft/job recovery, phone/tablet layout and package budget.

Inspect the final diff and secret patterns. Pin/push exact source commits; use the shared-server readiness gate, allowlisted artifacts, exact backups and isolated STEM restart. Verify production request behavior and protect IELTS. Reserve the next version only after checking both release ledgers; upload one immutable development artifact, separately record trial designation and formal-release status.

## References and fit

- [DeepSeek's original harness provider guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/providers.md): reference for capability-based selectors and forwarding the exact chosen value. No copied code, dependency or license-bearing asset.
- [Official model capability contract](https://api-docs.deepseek.com/api/list-models/) and [thinking mode](https://api-docs.deepseek.com/guides/thinking_mode): low/high/max are the supported official API levels; do not invent medium or copy self-hosted vLLM mappings.

Task evidence stays in `D:/CodexWork/coach-effort-choice-20261030`. Do not edit user-owned `.learnings/ERRORS.md` or expose private provider configuration.

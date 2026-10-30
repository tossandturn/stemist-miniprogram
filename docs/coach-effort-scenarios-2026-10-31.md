# AI Coach — scenario-aware thinking effort

## Product behavior

The student's latest request separates academic work from casual conversation. Defaults are visible recommendations, not accuracy promises:

| Purpose | Recommended default |
| --- | --- |
| Step hints / ordinary academic question | low |
| Complete solution / checking work | high |
| Whole-paper marking | high |
| Tavern, including tarot and oracle follow-up | low |
| Admissions or IELTS teacher: short question | low |
| Admissions/IELTS teacher: planning, essay review, analysis, or input >=800 characters | high |

The adviser classifier is a small local deterministic intent heuristic. It does not infer demographics, read private histories, or send an extra classification request. It can be overridden. The picker offers **按场景推荐**, **快速 · low**, **深入 · high**, **极致 · max** and displays the resolved level before send. Max is always opt-in. Student choices are independently retained for each purpose and bound to the current account/privacy epoch. Logout clears them.

New requests capture the effective enum. Pending academic jobs, adviser/Tavern turns, and whole-paper jobs retain it through interruption, retry and restoration. A preference change never resubmits or changes an existing request. The same photographed question restored after navigation stays locked to its original setting. A genuinely different question/purpose can use a new setting.

Only the existing server-side DeepSeek provider receives the optional field. No key, model, environment, payment, free-download rule or independent IELTS writing/voice service was changed. Old client requests retain their prior semantics. Higher effort permits a larger bounded reasoning/output budget; hidden reasoning is not rendered.

## Verification to date

- Backend request-body, exact enum, provider isolation, replay, long lease and additive PDF schema tests: 50/50 PASS. Deployment a5185e11e37a679ad744e118ad87d8de84b294d2 passed the server gate before/after; IELTS service stayed unchanged.
- TDD scenario, preference isolation, manual override, reset, stale picker ownership/scope, pending snapshots and restored-photo regression tests pass. Full final source/frozen/native acceptance is recorded separately after the final artifact is pinned.
- Six live synthetic image requests through the WeChat simulator's production client API completed. Comparison values below are single observations, NOT a latency SLA, controlled benchmark, or proof that a higher level is more accurate.

| Synthetic image | low | high | max |
| --- | --- | --- | --- |
| Velocity-time graph, three subquestions | 8.765 s | 5.928 s | 7.911 s |
| Check a worked linear equation | 5.655 s | 5.673 s | 7.679 s |

All graph answers gave 3 m/s², 72 m, 8 m/s. All equation checks confirmed x=4 with substitution. Cache, provider and network variation prevent attributing these differences solely to effort. High was not slower in this small sample; max provided no necessary improvement. These samples do not certify complex proofs or all photographs.

Evidence: `D:/CodexWork/coach-effort-choice-20261030/comparison.json` contains only synthetic prompts/results and stage timings. QA credentials stayed in runtime memory and were not exported. Physical Android/iPhone selection, keyboard and long-request network behavior remain NOT VERIFIED until device acceptance.

## Packaging and references

The 128 KiB main-package headroom remains enforced. A small build-only minification allowlist extends to the new helper and existing capture/paper-list pages; their source behavior/data is unchanged and frozen regression tests are required.

- Original reference: [DeepSeek harness provider guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/providers.md).
- Capability contract: [DeepSeek thinking mode](https://api-docs.deepseek.com/guides/thinking_mode/) and [chat completion API](https://api-docs.deepseek.com/api/create-chat-completion/).
- No third-party code/assets/dependencies copied. Existing DeepSeek configuration and attribution remain intact.

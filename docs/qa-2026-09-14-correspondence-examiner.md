# Question correspondence and speaking examiner release QA

Windows date verified: 2026-09-14, Asia/Shanghai. Candidate baseline: a241d07.

## Changes

- Cross-topic study uses the server's versioned capability and the union of explicit reviewed-ready source IDs. Each selected topic must contribute eligible questions. The minimum study size remains 6; formal progress still requires 12 reviewed groups in each selected topic. No question counts are invented.
- Practice and full-paper pages bind original paper ID, original question number, reviewed crop bounds and A-D labels. Old saved practice sessions can refresh display metadata without replacing answers. Missing reviewed bounds remain visibly full-page rather than receiving guessed crops.
- IELTS direct speaking uses capability-gated Part 1 / complete Part 2 cue / 60-second preparation / 120-second protected long turn / one rounding exchange / Part 3. Ordinary Part 2 pauses do not commit. Reconnect preserves remaining time rather than granting another 120 seconds.
- An explicitly submitted feedback request may finish while its same-owner page is hidden, after live capture/playback stop. Disposed pages, changed identities/privacy epochs and newer session revisions cannot receive stale results.
- Objective context/sync/network failures remain pending and surface one retryable error, not a fabricated self-assessment requirement. Only a successful unavailable-key result requests self-assessment. Empty objective reports contain explicit zero counts. An empty Part 2 long turn can explicitly retry from the cue card rather than looping on an expired deadline.
- The release builder excludes two unused legacy modules and checks that no included literal import needs them. Share-cover PNG recompression preserves identical decoded filtered pixels. Source files and question data remain in the repository; the 128 KiB runtime headroom gate is unchanged.

## Completed evidence

- `npm run test:all`: exit 0. Covers native flows, ownership, drafts, scoring, crops, permission, sharing, audio loading, calculator, page/binding and WeChat WXML/WXSS checks.
- Additional speaking retention, stage-resume and direct capability validation regressions: exit 0.
- Final runtime budget: 235 files, 1,965,589 bytes, 131,563 bytes headroom; no WebViews.
- Live STEM API and native UI: selected Physics topics 01 and 02, P1 only, counts 7 and 5, generated six questions. Each generated question had verified focus and four labeled options. Actual topic selection and objective submission succeeded without camera/AI calls.
- Live pinned `cie-9702-9702_m25_qp_12`: original Q1 and Q2 displayed different reviewed crops even though they share a source page; selected A then D, submitted objective score 1/2, AI count 0. Screenshots in `D:/CodexWork/stemist-qa-mapping-examiner-20260914`.
- STEM production release `20260914-cross-focus-47ddea8` passed pre/post readiness and four health checks. Existing production selection ordering was preserved. Full release/hash evidence remains in `D:/CodexWork/stemist-release-coordination/stem-assembly-handoff.md`.
- Real Qwen background-noise baseline: complete synthetic voiced answer transcribed, one audio response returned; audio clock running. This did not use a physical microphone or write student practice records.
- Actual builder taps confirmed 12 available questions, P1 only, 6 selected, two chapters and enabled Start. The button opened the six-question practice. Screenshot: `D:/CodexWork/stemist-qa-mapping-examiner-20260914-ui/builder-7-plus-5-ready.png`.
- Final full `npm run test:all` after the MCQ pending-state and empty-long-turn fixes: exit 0.
- IELTS two-file candidate `c14059fc83b6` deployed with verified backup/CAS, one IELTS restart, unchanged STEM PID and passing post-change readiness/four server-side health checks. Full evidence: `D:/CodexWork/stemist-release-coordination/ielts-examiner-handoff.md`.
- Real Qwen new-policy semantic test: five audio responses, valid short Yes accepted, genuine clarification answered without topic change, complete Historic Places cue card delivered in one response, and Part 3 followed the candidate's education-versus-preservation funding idea. Synthetic text input, no physical microphone. Receipt: `D:/CodexWork/stemist-qa-mapping-examiner-20260914/speaking-policy-live.json`.
- Real Qwen manual audio buffer test: voiced synthetic answer plus extended silence, exactly one commit at 120.013 seconds, full transcript and one spoken rounding response received. This verifies the 120-second transport boundary, not 120 seconds of continuous human speech or phone echo cancellation.

## Observed failure and recovery boundaries

During acceptance, one full-paper run fell into the previous generic self-required path; a later topic submit explicitly timed out. An isolated native-context diagnostic still returned 40 questions. Six bounded local HTTPS probes produced five TCP connect timeouts before TLS and one STEM 200; server-origin health remained 200. This led to the pending-state correction above, with timeout -> pending two questions -> explicit successful retry covered by regression tests. Subsequent real Qwen policy and 120-second tests passed, but earlier mainland-path instability is not erased by those passes.

The final repeated native MCQ journey stopped at isolated QA registration (`registration_network`) before opening a paper. Therefore end-to-end external stability and final-version production MCQ scoring remain NOT PASSED, despite the earlier successful objective run and current unit/contract tests. Development-package delivery is for device verification, not approval to submit review or publish online.

## Examiner policy basis

The source-backed server strategy follows the [official IELTS speaking format](https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-speaking): familiar-topic Part 1, complete cue card and protected long turn in Part 2, related abstract discussion in Part 3. Short valid answers and meaningful clarification are distinct from acoustically unclear input. It avoids empty praise and invented student positions.

The native manual WebSocket path follows [Alibaba Cloud Realtime](https://help.aliyun.com/en/model-studio/realtime) and [client events](https://help.aliyun.com/zh/model-studio/client-events). The existing product's 15-minute automatic-finish gate is retained; it is not the official overall test duration.

## Pending release gates

- Physical phone/iPad camera, microphone, echo/quiet voice, network transitions and long-session audio remain NOT VERIFIED by synthetic or simulator tests. Do not describe a development upload as review submission or online publication.

## Development delivery receipt

- GitHub `master` push succeeded: `459a4c3c041dd27a8d4c681f2d173b239952252e`.
- Frozen package: `D:/CodexWork/stemist-miniprogram-review-1.0.12-459a4c3`; per-file SHA-256 manifest is the sibling `-manifest.json`.
- Official WeChat `upload`, version `1.0.12`: `ok:true`, `success:true`, uploaded size 1,885,483 bytes.
- Official `auto_preview`, Home page: `ok:true`, `success:true`, preview size 1,881,503 bytes.
- The user's original `project.config.json` remains uncommitted and unchanged by this task. Its existing diff hash remains `a60dd99f74b2f04725d99e9ff5758757f0269d2a`.
- Neither review submission nor online publication was performed. Intermittent external connectivity remains a release blocker; this is a development test delivery.

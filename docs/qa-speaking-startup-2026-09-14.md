# Native Speaking silent-start investigation

## Confirmed versus unconfirmed

The reported handset symptom is "cannot speak / no response". No current phone screenshot or response to the startup-state clarification was available during this run. The exact handset failure is NOT CONFIRMED FIXED.

Public runtime configuration returned HTTP 200 with the expected realtime model. Two bounded, authenticated domestic Qwen tests using the actual native transport/turn engine and synthetic 16 kHz PCM completed three candidate/assistant turns and received audio response events. The real Developer Tools WebAudio context reported running and its clock advanced. These checks do not use a physical microphone or prove audible output on the user's phone. No student speaking record was created; isolated QA auth/storage was restored.

## Reproduced code gaps and repair

- A `session.updated` WSS acknowledgement formerly marked the session active and started its clock before the recorder confirmed startup. The engine now activates from recorder `onStart` or an actual PCM frame, once per connection generation. Candidate audio remains gated until the page saves its session and the examiner begins.
- A recorder that produced no PCM formerly remained apparently active indefinitely. An 8-second first-frame guard now stops and identifies missing microphone data.
- The initial response had no turn timeout. It now has the same bounded 30-second response deadline; failed/cancelled/incomplete provider responses are surfaced instead of being treated as a successful end of turn.
- A never-resolving audio resume could leave startup pending forever. Resume is bounded to 5 seconds; user cancellation also rejects the pending start and releases the context.
- A paused playback clock could keep candidate capture gated forever. A 3-second playback-progress check attempts one resume, then stops with a specific playback message if the clock remains stuck.
- Recorder interruption events now stop the session explicitly. All added handlers and timers are removed on close/recovery, retaining previous transcript/history.

## Evidence

- New `scripts/test-speaking-startup.mjs` initially failed because `onReady` ran on a socket acknowledgement before recorder startup. It passes after repair and covers no frames, late start callback/real-frame fallback, opening timeout, failed response, suspended resume, cancellation, frozen playback clock and recorder interruption.
- Full `npm run test:all` passed. The complete native-speaking suite was rerun after the final candidate-audio gating adjustment and passed.
- `scripts/check-speaking-live.cjs --run-production` passed before and after the main changes; synthetic candidate speech was transcribed and the model returned speech. The legacy harness now supplies idle PCM as a real started recorder would, rather than omitting all frames while the examiner speaks.
- A first post-change automation navigation timed out. A bounded runtime read confirmed Home and no lingering QA state before a successful rerun. This tooling failure was not counted as a successful speech test.
- Package budget passed: 1,965,393 runtime bytes, 131,759 bytes headroom; no WebViews. This is close to the project headroom threshold, so future features must not bypass the budget.
- No server deployment, provider/model change, allowlist change, production restart, secret exposure or corpus modification.

## Phone acceptance still required

Open the new preview, tap Start, and report the visible phase: microphone startup, waiting for examiner, examiner speaking, or natural answer. If it stops, capture the complete status/error and timer. A real spoken full answer, audible reply, interruption recovery and a full scoring/recording session remain separate handset acceptance gates. Do not advertise this resilience patch as completion of all those checks.

## References

- [Alibaba realtime PCM formats and event lifecycle](https://help.aliyun.com/en/model-studio/qwen-audio-realtime-user-guides)
- [Alibaba response and audio server events](https://help.aliyun.com/en/model-studio/qwen-audio-realtime-server-events)
- [Tencent audio source documentation](https://proxy-hk.tencentcloud.com/document/product/1219/68037) (platform reference; not a substitute for real WeChat handset tests).

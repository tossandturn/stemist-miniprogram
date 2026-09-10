# Domestic direct speech and stable crop

## Changes

- Native Speaking obtains an authenticated short-lived contract from `/api/speaking/direct-session`, then connects directly to the allowed Beijing Qwen WSS endpoint. No automatic relay fallback; permanent provider keys never enter the client.
- Client validates endpoint, `st-` token, expiry, PCM 16 kHz input/24 kHz output, fixed input transcription, native session/update and audio-capable response templates. Token exists only for the WSS handshake and is not placed in page data, saved sessions or logs.
- Audio uses native `input_audio_buffer.append`/`commit`; replies use the server-supplied examiner templates and unique event IDs. Reconnection reissues a credential, keeps prior dialogue/elapsed time, stops old playback, and rejects stale callbacks/account changes.
- Temporary-key TTL does not terminate an established connection and tokens are reusable during their TTL. Client 20-minute limit is not a server billing boundary. A dedicated model-restricted key, provider budget, and backend issuance rate limits remain required.
- Crop gestures no longer echo native x/y/scale events through setData. Resize does not reset the photo; explicit reset recreates only the native transform node. No inertia/overscroll rebound. Async cancellation reaches the final copy/save gate in both topic and paper photo stores; old photos/results are preserved.

## Evidence

- `npm run test:all` passed, including native WXML/WXSS compilation, direct credentials/lifecycle, account/privacy boundaries and crop geometry/cancellation.
- Real simulator fixture: drag moved 35 px horizontally and 20 px vertically relative to the crop stage, zero post-release drift; pinch enlarged width approximately 243.44 to 486.88 px and stayed stable. Synthetic image only, no student storage writes.
- Independent review identified late crop-save and text-only examiner-template acceptance; regression tests now reject both. Four cancellation cases cover paper/topic and compression/copy phases.
- Backend executor's real, dedicated-key smoke: temporary token issued, domestic WSS opened and session.updated received (including input transcription). No audio sent, response requested or student record written.

## Remaining acceptance

- Actual WeChat socket domain must be configured; never disable domain checking to claim readiness.
- Backend code/config deployment and a real authenticated Mini Program handshake must be verified independently of the local upstream smoke.
- Phone/tablet microphone audio, examiner playback, full conversation and final marking still require real-device acceptance.
- Complete two-way recording/MP3 export is an existing unimplemented feature, not part of this transport switch. Saved dialogue remains available; do not claim complete audio-recording evidence.

## Primary references

- [Qwen temporary keys](https://help.aliyun.com/en/model-studio/generate-temporary-api-key)
- [Qwen realtime API](https://help.aliyun.com/en/model-studio/realtime)
- [Qwen realtime authentication](https://help.aliyun.com/en/model-studio/realtime-token-authentication)

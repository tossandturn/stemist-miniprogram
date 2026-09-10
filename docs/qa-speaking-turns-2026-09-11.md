# Native Speaking turn repair and examiner behaviour

## Findings and fixes

The screenshot alone does not prove acoustic echo. Source inspection reproduced a definite defect: the old per-frame amplitude gate removed quiet phonemes and most within-answer pauses, with no pre-roll. The words `Future` and `Rear` were also consistent with an examiner-tail/fragment scenario, which is covered explicitly below.

- Keep up to 256 ms / 8 KiB pre-roll; once speech starts, stream continuous PCM including quiet syllables and within-turn pauses. Idle silence stays local.
- Use a 2.8-second pause for a developed answer and 4 seconds for a short fragment. Reject isolated noise shorter than 250 ms by clearing the upstream buffer.
- Block capture while examiner output plays and for 350 ms after its end. Select `voice_communication` only when the platform reports it available; otherwise retain `auto`, including iPad/headset routing. Capability discovery falls back after 500 ms.
- Wait for ASR completion before the next response request, with a 3-second audio-only fallback. Duplicate item IDs and late transcription do not issue another response. Brief ASR is a clarification hint, not an automatic rejection of valid Yes/No answers.
- Finish commits an in-progress final answer and retains its transcript before assessment. Incoming audio cannot restart playback while feedback is being prepared.
- The server examiner is neutral-warm, asks one question at a time, and repairs unclear audio on the current question without praising, quoting unreliable ASR, inventing a meaning, or changing Part. Each turn receives current elapsed time rather than a timestamp frozen when the token was issued.

## Verification

- Final `npm run test:all`: exit 0, including native speaking, auth, record retention, crop/photo input, catalogue filters, AI/self assessment/report contracts, native math, calculator, device classification and WeChat WXML/WXSS compilation.
- Added deterministic continuous-PCM checks for pre-roll, soft syllables, thinking pauses, playback tail, noise rejection, ASR ordering/duplicates/fallback, final-answer preservation and timer cleanup.
- Real native catalogue smoke: A-Level 711 papers / 30 rendered rows; competition 133 / 30; IELTS Listening and Reading 72 each; Writing 168; Speaking 218. Speaking displayed 20 topic cards with 20 icons. No errors. Counts are this run's observations, not hardcoded inventories.
- Real authenticated domestic Qwen WSS / model test through the actual native engine with locally generated PCM: a complete two-sentence response and the fragments `Future.` / `Rear.` were transcribed. Both final fragment responses were exactly one neutral repair plus one question about the current subject, with no praise or Part transition. Audio response events were received.
- Initial live trials exposed generic praise and two-question repairs; both were retained as failures to improve before the final successful trial. Developer-tool payload/reload timeouts required a frozen-source rerun; they are not treated as successful model tests.
- The live QA uses synthetic speech, substitutes microphone/output hardware, and writes no student practice record. It does not certify physical phone/iPad acoustic echo cancellation, a real 15-minute conversation, or a new end-to-end final-score request.

## Backend delivery

Backend changes were reviewed and pushed to `codex/native-ielts-production`: `8bd398d79a567afda33bacb38df6f836a343e833`, then `f62d4935a64fff0c1ded3b4d78694216ce69ccb0` after live behaviour review.

Production first received two policy modules; the second iteration updated only `server/qwenRealtimeAccess.cjs`. Each change used fresh readiness checks, matching old-file hashes, a verified rollback source, and one IELTS-only restart. No paper data or student records were changed. Final post-change gate passed: available memory 66.8%, swap 4.9%, disk 67% with over 20 GB free, inode 11%, I/O wait 0/0/0, services and containers stable, local/public HTTP 200. Runtime policy checks passed 15/15.

Final active hashes:

- `qwenRealtimeAccess.cjs`: `98f61f6ac59258f7be9890c3cf5de41ed86e1cd57dd0cd27e30b2201da6b2534`
- `qwenDirectSession.cjs`: `7c4a9cc42440c0f9ce147de1862d4c8c9374534102481b9e05d3fc1ab0a0aaf5`

## Primary references

- [Alibaba Qwen Realtime manual commit and response protocol](https://help.aliyun.com/en/model-studio/realtime)
- [IELTS Speaking format](https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-speaking). The product retains its existing 15-minute practice target; this is distinct from the official 11–14-minute test duration.
- [Tencent audio input source API](https://proxy-hk.tencentcloud.com/document/product/1219/68037)
- [Android voice communication input source](https://developer.android.com/reference/android/media/MediaRecorder.AudioSource#VOICE_COMMUNICATION)

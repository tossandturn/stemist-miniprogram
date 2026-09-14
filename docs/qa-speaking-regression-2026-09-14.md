# September 11 Speaking regression repair

## Reproduced cause

Compared the pre-change `d34c793`, September 11 `fdc8ade`, and repaired native engine with identical PCM: two seconds of voiced input followed by approximately -44 dBFS, 125 Hz nonzero background. The previous version submitted one answer; September 11 submitted none and continued appending audio; the repaired version submitted one answer. Command: `node scripts/test-speaking-regression.mjs --compare-history`.

The September 11 change lowered the speech/last-voice threshold from .008 to .004. Background between those levels therefore continuously reset `lastVoice`, preventing the silence interval and commit. Earlier tests used digital-zero silence, so did not cover this regression. This is a confirmed code regression, not proof that every reported handset failure has the same cause.

## Narrow repair

- Restored the prior .008 activity threshold. Continuous within-answer PCM and pre-roll remain, so quiet portions of an already-started answer are not cut out.
- Restored system-default `auto` microphone/headset routing instead of selecting Android `voice_communication` merely because it is advertised. This is a compatibility restoration; no physical device failure of that mode was proven here.
- Added one "正在听你说话…" state update when candidate speech starts, not frame-by-frame UI updates.
- Preserved direct domestic WSS, full-answer buffering, ASR/clarification handling, startup safeguards, history, calculator, vocabulary and sharing changes. No broad rollback, server deployment or source-data changes.

## Verification

- Final `npm run test:all` passed, including original soft-syllable/pre-roll/hesitation, privacy, retention, startup, calculator, vocabulary, sharing and WeChat compiler suites.
- Historical comparison: previous commits 1 / September 11 commits 0 / repaired commits 1. CI runs the current regression assertion without requiring deep Git history; historical comparison is explicit opt-in.
- Real authenticated native-engine WSS test with a full generated answer plus the nonzero background completed a candidate transcript and a spoken follow-up. Separate clean three-answer test passed with three candidate turns, three examiner turns and audio for each answer, not merely audio from the opening.
- Two preliminary tests that added the same background to isolated one-word clips failed their exact transcript-count assertion. Event traces showed all three commits and response cycles, with empty short-clip ASR and clarification replies, not a stuck transport. Those failures are retained as limitations; the original clean three-clip test remains strict, and `--room-noise` specifically tests a developed full answer. No claim of reliable one-word recognition under that background.
- All live input was synthetic; the host WebAudio clock advanced, but physical phone microphone, speaker routing, real room noise and full 15-minute scoring/export remain NOT VERIFIED. QA auth/storage restored, no student conversation record written.
- Runtime size 1,962,231 bytes with 134,921 bytes headroom. User project-config diff hash unchanged: `a60dd99f74b2f04725d99e9ff5758757f0269d2a`.

## Delivery boundary

Use the new preview to check the repaired engine. Old development/experience/online packages do not become new builds merely because the Git source changed. No review submission or online publication is performed by this repair.

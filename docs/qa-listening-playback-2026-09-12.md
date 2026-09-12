# Listening playback buffering repair

## Behaviour

Entering a Listening task downloads only the selected track without playing it. Playback starts from the complete local temporary file; progress reflects actual bytes, and cancelling the waiting-to-play intent never starts audio later. Selecting a track or leaving cancels an outstanding download. Pause, seek and replay reuse the prepared file. Late callbacks cannot resume a hidden page.

Public audio cache entries are keyed by canonical URL and source version, reused within the app session, checked for file existence, and pinned while a page holds them. Unpinned LRU entries are pruned beyond four files / 64 MiB. A download is limited to 32 MiB and requires HTTP 200 plus a nonempty complete file. Current server audio metadata has no files over that limit; maximum observed was 19.02 MiB. Only temporary files created by these downloads are removed. Original audio and student data are untouched.

Caption playback remains cache-only. No realtime transcription was introduced. Preparing audio can still take time on a poor connection; the change avoids relying on continuous cross-border delivery while the student is listening, not the initial transfer itself.

## Evidence

- Final `npm run test:all`: exit 0, including native Listening/Reading, question navigation, timers, caption performance, photo/AI, reports, calculator, phone/iPad profiles and WXML/WXSS compilation.
- Added playback tests: only-current-track preparation, true progress, no autoplay before user intent, cancelled intent, local-file start/seek, cache reuse, late hidden-page events, partial-response rejection, shared downloads and active-file-safe LRU eviction.
- Real Developer Tools runtime used the canonical Cam14 Test 2 Section 1 source: approximately 3.53 MiB prepared in 3,389 ms; local playback advanced to 17.85 seconds with zero waiting events.
- A second run used the existing file (preparation 4 ms, explicit second cache acquisition 2 ms), advanced to 17.86 seconds, and again reported zero waiting events. Audio was muted during the test, and no student practice record was created.
- The first automation polling channel timed out after playback completed; a separate runtime read verified the completed state. The final script includes one bounded final-state read on transport failure and subsequently exited 0. These are Developer Tools measurements, not a physical handset or whole-track endurance certification.

## Backend

Read-only probes found valid MP3 headers, byte ranges and immutable caching. Windows direct public-link samples were sometimes slower than the 8–16 KB/s required for 64/128 kbps playback; these are workstation-network observations, not phone measurements. Source-server reads were fast.

An independent backend inspection found that `serveStatic` read the whole MP3 before delegating to the streaming Range handler. Commit `8f832e3489783c69a41fe00e8819e173e66e781a` moves the audio branch before `fs.readFile`. The main task reviewed the diff and reran source-byte-range tests successfully. Only `server.js` was deployed, with matching old-hash checks, rollback coverage and one IELTS restart. Post-change resource/health gates passed. Public-link throughput remained a separate limitation.

Active server SHA-256: `82566c5804f0ca51fd0f479ed89e5006b8e5a88b5a6069b3631eace40c35f79a`.

## API references

- [Tencent audio events and buffered playback](https://proxy-hk.tencentcloud.com/document/product/1219/68037)
- [Tencent download completion and progress semantics](https://proxy-hk.tencentcloud.com/document/product/1219/68026)

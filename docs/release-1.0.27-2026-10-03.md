# Development release 1.0.27 - AP/IB download and live acceptance

The 1.0.26 native downloader used an open-ended Range request. A failed first
response could lose the entire in-memory PDF while the UI claimed progress had
been saved. Native simulator reproduction of an IB original reached timeout
with zero saved bytes. Earlier HEAD/Range probes and visible download buttons
did not test the actual native download/filesystem/viewer handoff.

The shared PDF controller now uses bounded 128 KiB chunks with persistent
checkpoints. Each segment verifies Content-Range, Content-Length, type, total
and strong ETag. AP/IB catalog byte count and SHA-256 verify the completed file.
Different files/accounts have separate named paths. Retry and page re-entry
recover saved offsets; background return and restored connectivity resume
interrupted downloads, while explicit cancellation remains stopped. Transient
segment errors have two bounded retries and shrink to 64/32 KiB on weak links.
Corrupt or changed source data cannot be appended or opened. Same-owner token
renewal no longer interrupts a public transfer; account/privacy-period changes
still reject old results.

Storage recovery removes only old files owned by the public PDF cache. Student
photos, drafts, private reports and unrelated storage are preserved. If those
protected files leave persistent storage full, a verified native temporary
download can preview the PDF without deleting them or losing the checkpoint.
The cache holds at most four PDFs/eight MiB, except that the current larger PDF
can be kept by itself. Download messages claim saved progress only after real
persistent bytes exist.

Verification includes binary fixture failures and corruption, full native
regression and compilation, then real AP/IB network transfers and filesystem
checks in the official simulator. Only the document-viewer callback is mocked
where the simulator cannot supply a physical WeChat viewer; that scope is
reported separately. Physical iOS/Android document viewing and mainland-network
timings are not inferred from simulator results. Four real transfers covered AP
and IB originals and mark schemes. An 8,772,538-byte AP Calculus BC mark scheme
resumed from byte 6,946,821 after cancellation/controller recreation and opened
with its expected size/hash. All resumed requests used finite ranges.

## Backend Coach repair

Live acceptance exposed a Coach fallback outage that unit checks alone missed.
The nominal Qwen Coach endpoint was an alias of the unavailable gateway, not an
independent provider. Coach now falls through to the existing separately
configured official Aliyun text/vision service, keeps provider keys server-side,
reserves time for fallback and emits only sanitized status/timing metadata.
Responsive Coach requests disable hybrid-model thinking; formal Writing marking
configuration and source-evidence guards are unchanged. Node prefers IPv4 to
avoid the failed outbound address-family path observed on the production host.

The correct native IELTS source was deployed at commit
`dc3057b64876d6e265b956c2484b4492935c5452`, normalized SHA-256
`fe16bd602cba374950cccd5e8db689b39eade7ee61b742c2c41903af763a1ada`.
All native API routes remain present. STEM source and whole-paper backend were
not replaced. Server resource and rollback gates passed before/after activation
and at the final 15:36 +08:00 read-only check.

Official provider references consulted for the responsive request contract:
[hybrid thinking](https://help.aliyun.com/en/model-studio/deep-thinking),
[OpenAI-compatible Qwen API](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions).

## Acceptance

- Full maintained Mini Program `npm run test:all`: pass, including native
  compilation, owner isolation, privacy, crop, sharing/timeline, calculators,
  vocabulary, announcements, native IELTS, marking and downloads.
- Focused speaking/listening tests: pass, including continuous PCM, quiet
  speech/pre-roll, hesitation, ASR ordering, stage timers, retained answers,
  reconnect cleanup, local listening buffers and Range resume.
- Official simulator P1 chapter builder and real option submissions: pass;
  12 source-backed available questions, six generated, A-D correspondence and
  official deterministic marks checked without a camera.
- Native production Reading submission and cloud record: pass. Section 2
  opens Q14 with 13 questions; partial practice does not claim a full-test band.
- Native production profile save/read/relogin/refresh and owner rejection:
  pass using an isolated synthetic account.
- Real Coach request: HTTP 200, mode `ai`, nonempty answer in 7,586 ms. General
  vocabulary is used so an intentional missing-passage guard is not confused
  with provider failure.
- Real direct Qwen examiner: Part 1 short valid answers and clarification,
  complete Part 2 cue/preparation and answer-led Part 3 passed with audio.
  Three synthetic PCM answers were correctly transcribed; every answer received
  voice output, and unclear fragments requested clarification. No microphone
  or student speaking record was used.
- Real production whole-paper multi-image upload -> queue -> AI -> report
  download: pass. Two generated answers with supplied QP/MS yielded the expected
  3/4 AI estimate and two question results. The generated PDF was rendered with
  Poppler and visually checked for readable scores, criteria and evidence.
- Local client -> real HTTP backend -> image/PDF assembly -> report integration:
  pass with the exact production whole-paper module; local inference is an
  explicitly labeled deterministic fixture, not live AI.

The release version continues from 1.0.26 as 1.0.27, using the maintained
incrementing upload wrapper and frozen source manifest. The official upload
succeeded on 2026-10-03 at 15:10:39 +08:00. Runtime commit:
`d091d7c35667a8e22e97d087c35bf4c03ee1197e`. Official total: 2,066,057 bytes;
main package: 1,912,830 bytes. Original `project.config.json` was neither
overwritten nor committed.

Evidence directory:
`D:/CodexWork/stemist-release-coordination/release-1.0.27-20261003`.
The successful development upload is not WeChat review submission or public
publication. Physical Android/iOS/iPad camera/microphone, file-picker/viewer,
mainland Wi-Fi/mobile latency, and the account's qualification/re-filing/privacy
approval status remain device/platform acceptance items, not inferred passes.
No OCR/pending/quarantined data was promoted to READY in this release.

Later full-function acceptance found that a PDF-input job could complete on the
real model but its private report download could fail when the public cache had
already consumed local storage. Development 1.0.28 addresses that cross-feature
allocation issue; do not use the earlier image-only pass as a claim that every
storage-pressure path in 1.0.27 passed.

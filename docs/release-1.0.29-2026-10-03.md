# Development release 1.0.29

The announcement center now precedes all learning entries on Home. The entry
remains visible when no notices exist or a preview fetch fails; it never invents
announcement contents, dates or counts. Existing brand, routes and device rules
are retained. Native geometry placed it at y=84 before the learning heading at
y=269.84 in the 390x753 phone simulator. Tablet-class screenshots at that same
viewport are clearly not physical iPad tests.

Photo Coach has a corrected failure contract. HTTP 200 with `mode: offline` or
an unconfirmed provider no longer counts as a successful student submission,
clears the draft, or disables retry. Text and photo remain available; timeout
warnings are Chinese and do not misleadingly ask for a new question when the
failed request already contained an image. A later successful retry alone adds
the AI conversation and submission record. The failure was reproduced before
the fix, and regression checks cover the same-input recovery path.

The current STEM image service succeeded on real synthetic-image requests in
8,416 ms before the client patch and 6,885 ms against the final frozen package.
The answer matched image-only evidence. No real student photograph was sent.
This does not prove network timeouts can never recur; it disproves a permanent
image-provider outage during this check. Production backend source/configuration
was not changed for this release. Read-only server resource/rollback checks passed.

Full `npm run test:all`, native compilation, announcement empty/offline states,
owner boundaries, photo retry/draft retention and native Home geometry passed.
Test material in screenshots was a local page fixture, not a published notice.

Official upload succeeded on 2026-10-03 23:48:19 +08:00. Frozen runtime commit:
`ab7572b3d07945a5ce9860bf8beca2a3b5f8a06c`; project
`D:/CodexWork/stemist-miniprogram-review-1.0.29-ab7572b`. Official total package
size is 2,073,717 bytes; main package is 1,916,496 bytes. Receipt and acceptance:
`D:/CodexWork/stemist-release-coordination/release-1.0.29-20261003`.
The original personal IDE configuration is preserved. This is a development
upload, not review submission/publication or physical-device acceptance.

Background corpus work continues in the existing STEM implementation task.
The first bounded batch completed five paired jobs / 147 pages and is being
verified/repaired structurally. OCR completion is not aicheck or READY. The AP
answer-table layout differs from the existing IB parser; its initial 136 groups
with zero answers were correctly held while the parser is repaired. No readiness
thresholds were lowered and no incomplete input was promoted in this UI release.

Primary protocol reference consulted:
[Aliyun vision API](https://help.aliyun.com/en/model-studio/qwen-vl-compatible-with-openai).

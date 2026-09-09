# Native paper automatic assessment and report

## Delivered behavior

- Submitting saved paper photos starts sequential AI marking through the existing authenticated source-context, attempt, capability and handwriting APIs.
- Only questions whose AI marking could not complete expose self-assessment. Successful AI marks cannot be overwritten by self-assessment.
- Native report includes separate AI/self totals, per-question and per-part feedback, pending counts, and feedback-derived revision priorities. It is saved in the owned local draft and reopened with the paper; this is not a new server/PDF report endpoint.
- Whole-paper coverage requires authoritative total marks AND an exact question count/number coverage. Unknown coverage remains explicitly partial; omitted/ungraded answers are not zero.
- Pause stops new requests but retains the current returned result after owner/epoch/attempt/revision validation. Completed parts and strictly valid legacy results are not automatically regraded. Original legacy values are preserved.
- P1/P2/etc. are native server-backed filters, composed with stage, route, year and season before pagination. Unknown competition components remain unknown.

## Verification

- `npm run test:all`: exit 0, including WXML/WXSS compilation.
- New tests: `test-paper-auto-assessment.mjs`, `test-paper-component-client.mjs`.
- Independent read-only review found three P1 issues (paused-result loss, partial-report label, legacy regrading). Focused regressions reproduced failures before fixes; reviewer verified all three fixed.
- Report rendering sends at most 10 question rows per page; no full catalog/binary paper payload enters the bundle.
- User-owned `project.config.json` was not edited; its diff hash remains `a60dd99f74b2f04725d99e9ff5758757f0269d2a`.

## Release limits

- Developer-tool automation navigation repeatedly timed out. One explicit simulator refresh and one subsequent bounded fixture attempt did not recover it. No report screenshot/phone/iPad visual acceptance is claimed; no user storage was cleared.
- Unit tests use mocked AI transport. Real photos, provider grading, camera/microphone permission and phone/iPad network acceptance remain required before review.
- A response lost before receipt is still subject to the existing backend's lack of result idempotency; do not claim exactly-once billing across network loss/process termination.
- Existing authentication/network and WeChat privacy-publication blockers are not fixed by this feature. No WeChat audit submission is included.

# Whole-paper marking: picker diagnosis and visible submission

## Confirmed native blocker

An actual Developer Tools button tap on the current Mini Program returned:

```text
errno: 112
chooseMessageFile:fail api scope is not declared in the privacy agreement
```

The page was authenticated; `getPrivacySetting` had returned no need for authorization. This proves that an already-consented general privacy guide does not establish that the guide declares the protected file API. Repeated consent or changing model provider cannot repair this missing platform declaration. The prior gesture hypothesis was not the confirmed cause.

The platform privacy guide must declare user-selected files for answer/reference upload and AI report generation. Platform settings cannot be changed through source code. Browser control currently has no reachable tab connection; the user was asked for the declared item and its review/effective status.

The user subsequently confirmed that the privacy-guide change is **under review**. The current native request still fails with 112; no claim is made that uploading a newer code package makes the declaration effective.

## Flow acceptance

- Submission action directly follows file selection instead of being buried beneath optional reference/note fields.
- No-file state explains why submission is unavailable.
- Optional information can be expanded without being a mandatory step.
- Current upload/queued/processing/completed/failed state is derived from the real job contract; do not invent queue position or completion time.
- Generated report and recent jobs remain discoverable.
- Privacy consent stays explicit and private file ownership remains isolated.

## Executed integration

`node scripts/test-whole-paper-integration.mjs --backend D:/CodexWork/stem-whole-paper-candidate` passed against the reviewed `d798a66` local backend.

The real client service and local HTTP API handled ordered images and a two-page PDF through binary upload, submission, asynchronous completion, and readable report PDFs. The generated source was 18,370 bytes; the image-input report was 186,630 bytes; the PDF-input report was 181,538 bytes. Both model calls were deterministic fixtures, **not live AI**, and no production records were created.

## Final verification

- Final `npm run test:all`: PASS, including native WXML/WXSS compilation, phone/tablet layout contracts and privacy/owner guards.
- Repeated local PDF integration: PASS (PDF-input report 181,539 bytes on the final run).
- Independent review: no remaining reproducible P0/P1/P2 issue in the scoped diff. Completed feedback without a PDF is labelled completed marking, not a generated PDF report.
- Native Developer Tools UI fixtures: empty, selected PDF, queued, processing and completed all passed at 390 x 753 CSS pixels. These were synthetic display states, not actual production submissions; account storage and uploads were untouched and the original page state was restored.
- Empty/selected primary button is visible at y=575..622; queued, processing and completed status cards are visible at y=278..509, above phone navigation. Fresh screenshots were visually inspected.
- Existing user-owned `project.config.json` remains outside commits, fingerprint `6f455e4cee8dcd3e2ded4f2acc353b44c514972b`.
- Actual phone file selection remains blocked pending effective platform declaration; tablet behavior has contract coverage, not new real-device acceptance.

Screenshots: `D:/CodexWork/stemist-release-coordination/marking-empty-20260924.png`, `marking-selected-20260924.png`, `marking-queued-20260924.png`, `marking-processing-20260924.png`, `marking-completed-20260924.png`.

## Development upload

- **1.0.19 uploaded successfully**, runtime commit `7616a78`, through the official Developer Tools upload action.
- Frozen input: `D:/CodexWork/stemist-miniprogram-review-1.0.19-7616a78`; normalized runtime comparison and frozen picker regression passed.
- Compiled bytes: total 1,946,585; main 1,893,256; marking subpackage 53,329.
- Code pushed to `origin/master`; no backend deployment or source-data changes.
- This is a development-code upload, not WeChat review submission or online publication. The privacy declaration remains under review according to the user, and native file selection is not yet accepted.

## Reference-video boundary

The original `https://xhslink.cn/o/Yo7JwIjnxd` remains inaccessible through web fetch; browser navigation timed out and browser inventory reported no reachable connection. The video has not been viewed. The user was asked to attach it; UI changes are based on observed product defects and the user's stated workflow, not an invented description of the video.

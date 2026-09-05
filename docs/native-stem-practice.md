# Native STEM practice

Updated: 2026-09-06 (Windows local date, Asia/Shanghai).

## Scope

The user requires native Mini Program functionality, not a website opened in `web-view`. The first migrated journey is:

`A-Level → chapters → topic/component/count selection → assembly → current question images → camera → crop → saved answer → authenticated AI marking`

Native pages: `pages/stem/topics` and `pages/stem/practice`. The current competition entrance remains papers-only. Full-paper/exam workspaces and the full IELTS workspace/speaking experience have not yet been migrated; do not present the entire app as native.

## Implementation

- Reuse `/api/stem/routes/:routeId/syllabus-topics` and `/api/stem/practice-sets`. Assembly is explicitly a public backend capability; stale bearer credentials are not forwarded to this public request.
- Use exact component-specific question IDs to count unique questions. Preserve the server's 6-question set minimum and 12-reviewed-groups-per-topic floor. No pending/OCR-only content is promoted.
- Route, stage, subject, selected components/topics, unique questions, source completeness and total marks are checked before opening the set. Invalid JSON or transport errors are not rendered as an empty question bank.
- Page data contains only the current question, image URLs, answer preview and compact navigation/feedback. Answer keys and marking schemes do not enter pre-submission page data. No PDF renderer, HTML workspace or full question bank is mounted.
- Camera/crop returns carry session ID, question ID and privacy epoch. Crop completion copies the photo to app-private storage before acknowledging save. Replacing a photo invalidates that question's previous feedback only after the copy succeeds.
- Native drafts are owner-bound. Explicit logout invalidates pending writes, removes private records and deletes only their exact app-owned photo copies. Expired login retains the draft behind a reauthentication action.
- AI marking persists a server-owned submitted attempt, requests canonical per-part capabilities, then submits the answer photo with the returned grant. Grants and base64 are not stored. Partial valid results survive failures. No client result updates formal progress.
- AI Coach stays available at the upper right. Its general route-scoped chat is not misrepresented as a formal source-bound marking result.
- Phone uses one column and compact horizontal question navigation. iPad landscape uses question/answer columns and tablet navigation; portrait reverts to one column. Physical iPad geometry remains to be verified.

## Evidence and limits

Verification performed on the Windows host on 2026-09-05:

- A real default-network request generated 10 questions and opened the native runner in 7,497 ms, but an image failed; another default-network inventory call failed. This is not an unqualified network pass.
- With a QA-only loopback relay connecting to the same Singapore production host using TLS hostname verification, the real WeChat flow passed: three AS Physics chapters → 35 unique questions → 10-question assembly → complete original image pages → exact question camera binding → camera cancel → cold page restore. Repeated runs had zero runtime exceptions.
- Example assembly-to-runner times were 9,119 ms and 8,773 ms. Runner page data was 1,505 / 1,329 bytes. Those are measured samples, not latency guarantees or proof that every source route is ready.
- The relay forwards only public inventory/assembly/question-image paths; no credentials or private APIs. It is QA tooling outside the product and is never committed or enabled in the shipped client. The app's original API base is restored after each run.
- Singapore read-only readiness passed at 23:53:23 +08:00: 2,508/3,724 MiB available/total memory, 27.84 GiB free, 48.51% filesystem use, zero sampled I/O wait, no build/backup jobs, all relevant services stable.
- Three localhost production assembly samples returned 201 with 10 questions in 80 / 70 / 60 ms; each response was 101,170 bytes. Most observed waiting is outside the assembler itself. Native rendering removes the embedded webpage overhead but does not fix the host's intermittent network/proxy route.
- `scripts/test-native-practice.mjs` covers eligibility, response validation, render payload size/boundaries, public transport, ownership/logout races, duplicate generation, canonical marking order, durable photo replacement and reauthentication.
- `scripts/test-devtools-native-practice.cjs` is live production read/assembly QA with no provider request. It checks actual native buttons, images and routing; an optional QA origin exists only for controlled diagnosis and is restored.
- On 2026-09-06, the full `npm run test:all` suite passed, including 12 new native-practice cases and the installed WeChat WXML/WXSS compiler over all 20 pages.
- `scripts/test-devtools-native-photo.cjs` additionally passed the actual native camera handoff, crop/canvas JPEG export, app-private filesystem copy and cold page photo restoration using a synthetic image in the DevTools runtime. It performed zero provider calls and removed its own temporary image and draft. This is distinct from a physical camera sensor test.

Not yet claimed: physical camera capture/permission flows, real iPad portrait/landscape touch verification, a real signed-in AI-provider grading call from this native runner, or full native migration of all modules. No production server build, restart or deployment was made for this client-only migration.

## Rerun

```powershell
npm run test:all
node scripts/test-devtools-native-practice.cjs
```

The live script requires an already-open authorized DevTools automation endpoint and the official `miniprogram-automator` SDK installed outside the upload tree. It preserves prior native drafts and does not alter account credentials.

## Reference

The implementation follows WeChat's [runtime data-update guidance](https://developers.weixin.qq.com/miniprogram/dev/framework/performance/tips/runtime_setData.html): keep renderer data bounded and relevant, avoid unnecessary repeated updates, and preserve a responsive interaction path. The original documentation was read through the public reader fallback because the primary browsing tool could not open it.

# AI Coach segmented timing

The academic photo paths record numeric-only `__coachTiming` in page memory: image preparation, request preparation, POST acknowledgement (upload + authentication + network round trip, NOT pure upload), first display-ready answer, polling waits and total request duration. Server timings are attached to the private existing job result. Nothing new records photos, question text, credentials or private reasoning, and no debug text is added to the student UI.

Server inference measurements distinguish headers, first substantive chunk, first reasoning-chunk arrival, first answer, output completion and output duration. These are application-observed offsets, not provider-internal queue/compute measurements. Client and server clocks are never directly subtracted. Replayed jobs retain their original server timings and are labelled `replayed` on the client.

Targeted changes:
- Small upright images already within 2048 px / 768 KiB keep their original supported bytes, avoiding another native compression. Unknown orientation/metadata, oversized images and unsupported source formats retain the existing conversion path. IELTS preparation is unchanged.
- Polling accounts for the previous network round trip instead of adding an extra fixed second after it. It keeps a bounded minimum pause and existing recovery backoff; stable task IDs still prevent duplicate generation.
- Academic complete answers keep answer/steps/check and necessary reasoning; the server prompt avoids unnecessary alternative methods and repeated summaries. No model/reasoning-effort/time-limit or membership changes.

Validation evidence is held in the task-local timing acceptance report. Native developer-tool tests are not physical-phone acceptance, and model latency varies with question complexity and provider load.

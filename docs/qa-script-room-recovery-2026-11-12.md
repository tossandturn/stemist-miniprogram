# Script-room transient failure recovery

## Evidence boundary

The reviewed historical WeChat analysis session contains three room-detail request 502 responses and three 429 responses at the root script-room path. That report exposes request category, URL, status and duration, not the HTTP method or business error code. The old 429 cause is therefore unknown: do not identify it as a list rate limit, personal three-room limit or a network disconnection without more evidence.

Current server inspection: GET list and GET room do not call the per-owner mutation rate limiter. POST create/join/actions do. Known business 429 codes distinguish per-user active-room count, site capacity, action rate, in-flight AI jobs, conversation/message/puzzle/image limits. The previous global active-room threshold shared the personal three-room error; backend now reports `script_capacity` for global capacity and `script_room_limit` only for the actual personal limit.

## Reproduced and fixed

1. HTTP 502 after an action cleared its original idempotency key. A later send could create another command even if the original had committed. The failing test reproduced loss of `__pending`. All uncertain network/408/5xx responses now keep the original payload and request ID until explicit retry resolves it. A successful retry clears only the exact submitted draft; text edited while waiting is retained.
2. Room polling retried every three seconds indefinitely. It now uses 3/6/12/24/30-second bounded backoff, pauses after six consecutive failures, and has an explicit “重新同步” control. A 429 uses a conservative 60-second read retry interval and does not claim disconnection. Proxy/domain/TLS/cancel errors pause instead of repeatedly hitting a known bad connection. Hidden pages stop timers; switching accounts retains the existing private-data clearing fence.
3. A late successful GET could overwrite a newer action response. Adoption now rejects lower revisions for the same room. Transient failure preserves the displayed room, messages, draft and puzzle input.
4. Creation retry retains the same opening request ID; polling only reads the known room ID and never creates a new room. Opening is single-flight, and repeated create/join/resume taps cannot stack duplicate navigation pages.
5. Directory and existing-room list refresh independently. A catalog failure no longer prevents retrieving existing rooms; a list failure keeps the last successful same-account room list instead of replacing it with empty data.
6. Known 429 codes show the matching next step. A personal room limit offers return to the list to continue/finish/leave an old room. Unknown 429 says only that requests are temporarily restricted. No user content, tokens, server details or raw platform error is logged by the new helper.
7. Independent review reproduced a late error UI write when a 409 revision-refresh GET outlived page unload or account change. A second alive/owner fence after that awaited read now prevents destroyed-page writes and clears the former account's private room. Both deferred-read cases have explicit regression tests.

No automatic mutation retry, room recreation, login, account switching, room closure or clue publication was added. Draft retention here is page-memory retention during transient failures, not a claim of persistence after process termination or explicit logout.

## Checks

- New `scripts/test-script-room-recovery.mjs` passes in source and packaged-transform mode.
- Existing `npm run test:script-rooms` passes in source and packaged-transform mode, including private/public channel display, invite/login return, image retries, account fences, appearance, hierarchy and reduced-motion contracts.
- Backend `test-script-capacity-errors.mjs`, room API and 1–4-player store journeys pass. The capacity fixture is an isolated synthetic database, not production or a copy of customer data.
- Syntax and `git diff --check` pass. An intermediate test-only missing brace was corrected and the exact test rerun; no false passing result is inferred from the shell's final command exit status.
- UI uses the existing error region and native text-button style; the new recovery action is textual and the error region has alert semantics. Fresh screenshots, phone/iPad network transitions and WeChat device execution still need parent release acceptance. This is not a production availability guarantee.

## References

- [RFC 9110, HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110): ambiguous completion does not make a new non-idempotent request safe. This client relies on its existing server receipt keyed by the original request ID.
- [RFC 6585, 429 status](https://www.rfc-editor.org/rfc/rfc6585): rate limiting is an application response, not proof of network failure. The historical business code is unavailable, so the diagnostic remains explicitly unknown.

The UI skill's error-recovery guidance informed the explicit next action and bounded retry state. Existing theme, component hierarchy, touch-target CSS and safe areas are preserved.

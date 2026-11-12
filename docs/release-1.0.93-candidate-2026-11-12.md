# 1.0.93 client repair candidate

Not yet uploaded or published at creation of this note. The user authorized the document's full repair scope and a client fix package. Backend deployment is separately gated.

- Preserve explicit consent and guest Home browsing. Renew same-account sessions before protected-page entry; network failure does not revoke consent or erase drafts. Nickname/avatar remain optional native controls, not silently obtained by wx.login.
- Classify real We分析 failures: proxy tunnel failure, timeout, cancellation and application refusal. One-time login-code retry uses a fresh code. SDK missing callbacks cannot leave the login spinner indefinitely.
- Guard every initial/replayed response against owner, privacy epoch and cancellation changes. Refresh 401 once; replay only read-only requests. Payments, writes and streams are not automatically repeated.
- Stop ordinary announcement-list access from probing admin APIs. Show cached public notices promptly; trust only server-derived management capability.
- Explain the exact daily PDF/audio quota failure using published membership terms; other 429/401/5xx responses do not trigger a purchase prompt.
- Preserve the original script action ID after ambiguous 502 responses, bound poll backoff and add manual synchronization. Preserve same-account room/draft; reject stale revisions and late responses after leaving.
- Recover admissions 409 by retrieving the same conversation once; retain draft/turn identity and do not automatically resend a model request.
- Same-account token refresh no longer interrupts native written-answer grading. Real source/mark-scheme eligibility remains mandatory.

Verification: complete existing `npm run test:all` returned exit 0. Additional auth 30, announcement/quota 8, script recovery, admissions conflict recovery and vocabulary timeout recovery tests pass; key suites were repeated through the actual package transform. Independent reviews found and verified fixes for two late-response races. Final package source headroom remains above the unchanged 128 KiB threshold.

This is not a claim of a repaired physical iPhone being tested, WeChat review approval, public release, or universal real-paper AI marking coverage. See the focused QA reports for actual device and provider boundaries.

# Whole-paper independent acceptance, 2026-09-28

Live Windows date/timezone: 2026-09-28, Asia/Shanghai.

## Reproduced and repaired

While a create request is pending, hide then immediately show the page and let
the original request reject. The old code silently discarded the error after
the lifecycle generation changed, while retaining an auto-resume marker and a
misleading promise that upload would continue. The submit action remained
manually usable, but the state never resolved on its own.

The smallest repair consumes only a matching original lifecycle-resume marker
and shows the actual safe error plus a manual retry action. It performs no
automatic provider/create retry. Explicit pauses and replacement draft, history
job or account continue to ignore stale replies. Tests cover all five cases.

## Verified

- New lifecycle failure regression reproduced RED before the fix, GREEN after.
- Root independently reran `npm run test:all`: PASS, including native compile.
- Real local HTTP integration: PASS, 27 requests; AI is a declared fixture.
- Fresh public production HTTPS / real configured AI: a two-page synthetic
  answer PDF with question paper and mark scheme completed in 23 seconds with
  the expected 3/4 estimate for two questions. Full journey took 24 seconds.
- Maintained report downloader was interrupted after 65,537 bytes and resumed
  to 237,572 bytes, SHA-256
  `92b43740c07e88732134d6d2d01ad1f5a6378bb53416b09c66f4bc2a9ccf114a`.
  Zero model retries and zero network retries in this final run.
- Official Developer Tools rendered twenty answer rows with a reachable
  46.5 px submit button, queue/processing/failed states and unscored incomplete
  feedback. Device class was explicitly overridden to tablet at the actual
  390 px simulator viewport; it is not a physical tablet test.
- Exact deployed backend and rollback hashes matched. Fresh bounded resource
  gate and all five public/loopback HTTP health checks passed. No server runtime
  modification was needed for this frontend-only follow-up.

## Limits and release distinction

The native chooser and physical iPad/Pencil were not exercised. The runtime's
general privacy check returned `needAuthorization:false`; that alone is not
proof that the per-file API declaration is effective. No real student files or
history were seeded. Production test credentials remained in memory only.

This follow-up is intended for development package 1.0.23. Record the official
upload receipt separately; upload is not review submission or public release.

# Unified Cambridge listening downloads

User request: put matching audio directly underneath listening question/answer PDFs on the Cambridge downloads page. Retain separate audio-library deep links for compatibility; do not create another quota or auto-download/play media.

Design: one existing paper card contains title, question PDF, answer PDF/progress, then matching audio tracks with per-file size, download, progress/retry and explicit Save to WeChat. Phone stays one column; tablet retains the existing adaptive grid. Use current tokens, >=44px buttons and wrapping labels. No new design system, dependency or media assets.

Data: join only listening groups by exact sourceId/taskId plus original book and Test. Do not conflate practiceTest numbering with printed Test numbers. Preserve exact server file IDs/hashes/names and the current shared two-distinct-files/day quota (PDF + MP3), same-file retry/cache rules and member allowance. Current public catalogue inspection:72 listening groups,288 tracks,72 exact matches,0 missing.

Implementation / tests:

1. RED: exact matching and sorting; no cross-course/cross-Test matches; page places tracks below PDFs without initiating transfers; independent catalogue failure/retry and late-response protection.
2. GREEN: small matching helper and page wiring reuse current PDF/audio controllers. Lock filters while a transfer or audio share is active; pause on hide, dispose on unload, clear foreign-owner state.
3. UI checks: text labels, audio below answers, ready/share state only beside the selected file, quota/login recovery, narrow-phone and tablet layout.
4. Run full regression + WeChat compiler + final-package tests. Verify against real production catalogues and a bounded synthetic-account download journey, including shared quota exhaustion/cache behavior. Restore native storage after QA. No service deployment or restart is needed for this client-only change.
5. Freeze a reviewed package and upload a new development version only after acceptance. Do not claim experience designation, public release or physical-device validation without evidence.

Reference review: https://github.com/wechat-miniprogram/miniprogram-demo (official native API examples). Existing project download controllers already provide stronger quota, hash, cancellation and resume guarantees; reuse them, do not copy external code or install dependencies.

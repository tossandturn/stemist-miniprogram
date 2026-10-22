# University logos and international undergraduate references — 2026-10-22

## Delivered scope

The user selected general international-undergraduate conditions, with official programme/course entry links, rather than mathematics/physics-specific offers. Existing rankings, editions, ties, campus identity and AP/IB/A-Level official links remain unchanged.

- 210 ranking rows map to 184 distinct institution profiles.
- 168 reviewed institution images; 16 clearly non-logo school-name initials where artwork was unavailable or unsuitable.
- 38 school/system-specific source-reviewed overviews; 146 explicitly labeled general preparation guides, not verified institution-specific thresholds.
- 145 official programme/course entry links. Every profile retains an official school/reference source.
- Structured academic, language, test or materials sections state their scope, checked date and sources. Minimum eligibility and competitive guidance are not guaranteed offers; course and intake differences are explicit.

The native page reserves a small aspect-preserving image frame, supports reverse artwork without recolouring it, and expands one compact admissions panel at a time. Source links copy to the clipboard. Search, ranking switching, pagination and sharing retain their existing behavior. Images are not bundled in the Mini Program.

## Backend separation and cache behavior

The separate public `/data/university-profiles/v1/` namespace contains an index, immutable content-addressed profiles/images and provenance. Later content/links/artwork changes can be deployed on the backend; new native interaction types still need a client update.

Index freshness is five minutes. Offline metadata and each individual detail record expire after seven days; the detail cache holds at most 20 records and is bound to the API origin. A regression test first reproduced and then fixed an edge case where updating the cache container could extend an older record's age. Concurrent requests coalesce, navigation invalidates stale responses, and failures provide an explicit retry. The AP/IB/A-Level official-links entry makes no enrichment request.

## Acceptance evidence

Evidence directory: `D:/CodexWork/university-profiles-20261022/`.

- `full-suite-result.json`: complete source `npm run test:all`.
- `packaged-suite-result.json`: complete transformed-runtime `npm run test:all`.
- `client-data-result.json`: all 184 actual backend profiles normalize through the client contract.
- `responsive-result.json`: 72 actual WXML/CSS replays at 320/375/390/667/820/1180 px, normal and 2x text, covering collapsed, overview, generic guide, loading failure, broken images and official-links states. Screenshots were inspected.
- `public-acceptance.json`: all 354 public HTTPS files return 200 with expected bytes, hashes and content types.
- `native-acceptance.json`: real public backend in the official WeChat native simulator; MIT sources and programme clipboard URL, Cambridge SVG mark and requirements, explicit offline error and successful retry, QS/U.S. News alias identity, official AP link and share route, and no enrichment fetch for the official-links-only entry.
- Native screenshots include `native-mit-requirements.png`, `native-cambridge.png`, `native-profile-offline.png` and `native-official-links.png`.
- The QA app blocks private authentication, history, uploads, payments and unrelated requests; storage/clipboard are isolated. It is marked **QA-ONLY. NEVER UPLOAD** and is not the release package.

A first native test tried to open a result before the asynchronous search-render callback had completed. The harness now waits for the rendered result and uses the real native button; this was a test sequencing issue, not evidence of a production failure. An interrupted public HTTP-200 body is no longer reusable in the research/audit helper cache; the resumed audit checks full bytes rather than status alone.

These are source, responsive replay and official native-simulator tests. Physical phone/iPad, OS text-size, assistive-technology behavior and mainland mobile throughput remain **NOT VERIFIED**. Simulator/network timings are not advertised as handset performance.

## Backend deployment receipt

- Data commit: `d586912ffd96755fce098598b36cc3a564d7f052`.
- Pinned artifact: `university-profiles-20261022-d586912.tar.gz`.
- SHA256: `79204e44a7275cc2b06021b0e0661ddf3afc28c0f1939a9702a6bb9b7bb7b325`.
- Activated: 2026-10-22 21:55:15 Asia/Shanghai (13:55:15 UTC).
- 354 files, 3,761,694 unpacked bytes. Server filesystem and public HTTPS checks passed.
- Fresh read-only gates passed before upload, after upload, before activation and after activation. Post-activation available memory was 2335 MiB and swap 9.5%, within the current strict gate. Protected files and service PID/restart records remained unchanged.
- New static namespace only: no application restart, dependency install, production build, database, model, payment or IELTS change. An exact-scope rename rollback is recorded.

Public index: https://stem.ieltsist.com/data/university-profiles/v1/index.json

## Release boundary

The previous 1.0.55 upload was independently confirmed successful and reconciled in `releases/development.json`; it is not uploaded again. This change uses the next version, 1.0.56. A clean, committed runtime candidate must match the tested transformed files before upload. User-owned `project.config.json` remains unchanged with SHA256 `A6D9C6A9CB8C4732F591272E9F18DB86C12628CB2AA5FEDECD9EFB97CE5705FA`.

Upload confirmation, upload success, review submission and public publication are separate states. Record the actual receipt after requesting the official upload; pending is not success.

## Sources and rights

GitHub-first references: [Hipo university domain registry](https://github.com/Hipo/university-domains-list) for identity structure and [Tencent TDesign Mini Program](https://github.com/Tencent/tdesign-miniprogram) for native image/layout patterns. No new dependency was installed.

Admissions statements use per-profile university-owned sources. Artwork provenance, original hashes, portability transformations and public-domain/CC0 attribution where applicable are in the backend source catalog and public provenance. Campus photos, social-media icons, magazine/faculty brands, consortium marks and campaign slogans were rejected. Missing or clearly restricted artwork is not replaced by invented logos. Institution identification does not imply partnership or endorsement.

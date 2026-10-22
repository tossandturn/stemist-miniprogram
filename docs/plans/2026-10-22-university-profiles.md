# University logos and admissions overview implementation plan

> **For implementer:** Use TDD throughout: validate a failing contract test before production implementation. Preserve existing ranking identities, aliases and ties.

**Goal:** Add recognizable institution images and sourced international-undergraduate admissions overviews to the existing university directory.

**Architecture:** Keep ranking data untouched. A separate public server-backed enrichment index maps ranking IDs to verified official visual assets and lazily loaded admissions profiles. Native cards reserve a small logo frame, degrade to a clearly non-logo initial on failure, and expand one compact requirements panel at a time. Profiles carry official sources, a checked date and explicit qualification/course/year boundaries; minimum eligibility is not represented as a guaranteed offer.

**Tech stack:** Existing Node data validation/build scripts, native WeChat WXML/WXSS and public static JSON/image delivery. No new provider, SDK, production dependency or paid logo service.

## Scope and acceptance

1. Inspect all current QS/U.S. News entries and preserve campus identity. Merge aliases only when the official institution identity agrees; do not merge separate Rutgers/UC campuses.
2. Research GitHub-first implementation patterns, then use university-owned pages for branding and admissions claims. Record actual retrieved URLs and hashes. Do not invent logo paths, scrape restricted/private material, or use a generic logo API as institution evidence.
3. Build a resumable, bounded retrieval helper under the task evidence directory. Discover official page icon/logo links, preserve bytes/aspect ratio and source provenance. Verify all delivered assets visually and structurally; failed retrieval uses a non-brand fallback rather than a false logo.
4. Write backend tests for profile/index identity, required sources, dates, safe URLs and payload limits, invalid numeric/unsupported claims and missing assets. Implement the smallest separate data contract and validate the complete generated release.
5. Summarize international-undergraduate academic qualifications, English language and test/document policies from official sources. Clearly distinguish school-verified details from general preparation guidance, and never infer a SAT/IELTS/AP/IB cut-off for a school that does not publish it. Unverified details are not labeled verified.
6. Add client service/cache tests and page tests for lazy expansion, failed/retried metadata and images, stale requests after changing ranking/page, official source copy and no loss of search/pagination/share behavior.
7. Implement the logo frame and compact admissions panel within the existing curricula subpackage. Include source/date, not a large wall of caveats or a separate redesigned app.
8. Run focused and full source/transformed suites, actual WXML/CSS responsive replay and isolated official-WeChat native checks. Check 320px, phone landscape and tablet, 2x fonts, failed/missing images and expanded long content.
9. Deploy only a pinned allowlisted public-data/artifact update after fresh read-only exact-target resource/rollback gates. No source build, IELTS/model/payment/DB change. Verify public hashes and unchanged services.
10. Resolve the previous 1.0.55 upload status before any next assignment. Package a clean candidate, retain user-owned project configuration, and use the official upload confirmation workflow. Pending is not success.

References: [Hipo university domain registry](https://github.com/Hipo/university-domains-list) (MIT; identity pattern only), [Tencent TDesign Mini Program](https://github.com/Tencent/tdesign-miniprogram) (native image placeholder/layout reference; no dependency installed).

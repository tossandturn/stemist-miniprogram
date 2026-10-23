# University admissions acceptance — 2026-10-23

## Delivered

- Visible QS World / U.S. university tabs replace the dropdown; search, pagination, sharing and existing AP/IB/A-Level official links remain available.
- Six admissions modules: A-Level, IB, AP, language, competition, research/projects. Official facts and qualitative AI advice have separate fields and visual treatment.
- No AI competitive score ranges. Unverified information remains explicitly unverified, never “not required”. Eligibility floors, course offers, language recommendations and exemptions are not collapsed into one score.
- Hidden floating AI shortcut on this reading page to prevent text obstruction. The bottom AI Coach navigation is unchanged.
- Profiles are precomputed, small, lazy-loaded and cached. They do not require a model request when opened.

## Coverage boundary

210 ranking rows map to 184 institutions. All profiles contain the six-part structure; 55 institutions have at least one sourced dimension (86 reviewed dimensions). The other 1,018 dimensions are explicitly unverified with qualitative preparation advice, not school-specific numeric claims. Existing 168 logos and 145 official programme links are preserved.

The full admissions requirements of all 184 schools have **not** been verified. Course, intake year and applicant-background differences still require the linked official source. No human review or official endorsement is claimed.

## PASS

- Full source `npm run test:all` and transformed/packaged equivalent.
- Backend directory/profile contracts, six-module/source validation, all aliases, exact artifact hashes and allowlists.
- 184 profiles accepted by both the saved 1.0.57 normalizer and the new normalizer; old clients retain their legacy sections.
- 72 responsive geometry cases: 320–1180 px, portrait/landscape, standard and doubled text, long names, error state and broken-image fallback.
- Official native simulator: real ranking-tab taps, cross-ranking MIT aliases, six modules, Oxford subject/test combinations, source copying, offline error and retry, AP official route without unnecessary enrichment calls.
- The same native journey repeated against deployed public data; private login, user history, payment and upload calls blocked in the isolated QA project.
- Server public HTTPS: all 184 new profile files plus all 184 old cached files, 368 hashes/MIME types verified. This is not a physical-phone speed benchmark.
- Deployment transaction tests reject traversal, duplicates, missing data, bad schema and mismatched hashes; simulated mid-promotion failure restores the old index and provenance while preserving immutable cache files.
- No service restart, database, IELTS, model, payment, question bank or dependency changes. Original user `project.config.json` hash unchanged.

## Release status

- Client runtime: `cd797792ad2305b0843e32dc296009c2f76e2efb`, pushed on the existing feature branch.
- Backend public data: `a6c043a908f13d8dabc3c92ff5f060004fd2b705`, pushed and **DEPLOYED**. Readiness and post-deployment health pass; original files are recoverable.
- 1.0.57 upload reconciled from official successful receipt.
- **1.0.58: upload verified**, task `confirmation_upload_ded0f1c4-21a8-4cc2-bee8-783fc44d9599`, reconciled from the official successful receipt during the following Coach-source task. No public release/review submission.
- Clean candidate main runtime: 1,966,007 bytes; 131,145 bytes headroom. Native-tested changed files exactly match candidate hashes.
- **NOT VERIFIED:** physical phone/tablet and platform approval/publication.

## Diagnostics and references

Initial simulator automation timeout was resolved after verifying the correct project/current page; no refresh loop or private state inspection. A local proxy interruption lost the deployment reply, so the next operation was read-only reconciliation, not another deployment. Server activation receipt, index hashes, unchanged service processes and public/native checks confirmed the transaction succeeded. A local bulk HTTPS run hit a transport error; it is not counted as a pass. The subsequent server-public check and local native public-data journey are separately labelled above.

UI reference: [Tencent TDesign Tabs](https://github.com/Tencent/tdesign-miniprogram/blob/develop/packages/components/tabs/type.ts), original MIT repository, reference only.

Representative primary admissions sources: [Oxford qualifications](https://www.ox.ac.uk/admissions/undergraduate/courses/admissions-requirements/international-qualifications), [Cambridge qualifications](https://www.undergraduate.study.cam.ac.uk/apply/before/accepted-qualifications), [Stanford testing](https://admission.stanford.edu/apply/first-year/testing.html), [Penn international applicants](https://admissions.upenn.edu/how-to-apply/international-applicants), [King's entry requirements](https://www.kcl.ac.uk/study/undergraduate/how-to-apply/entry-requirements). Every published factual module retains its supporting source IDs.

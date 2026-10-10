# Development 1.0.43 — official courses and university directory

Verified on the live Windows clock: 2026-10-10T23:52:09.2678506+08:00.

## Delivered

- Homepage secondary entry: 大学排名与官网. The six primary study entries are unchanged.
- Official course links for [AP / College Board](https://apstudents.collegeboard.org/), [IB](https://www.ibo.org/), and [Cambridge International A-Level](https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/). AP/IB and A-Level workspaces have contextual entries.
- [QS World University Rankings](https://www.topuniversities.com/qs-top-uni-wur), 2027 edition: 102 institutions whose published rank is at most 100, including ties and the [official corrections](https://www.topuniversities.com/rankings-release-summaries/world-university-rankings-2027-release-summary).
- [U.S. News National Universities](https://www.usnews.com/best-colleges/rankings/national-universities), 2027 edition: 108 institutions with rank at most 100, including all nine institutions tied at 100. This is not the global ranking or the liberal-arts-college ranking. [Publisher edition announcement](https://www.prnewswire.com/news-releases/mit-claims-no-1-spot-in-us-news-2027-best-colleges-rankings-302885278.html).
- Chinese/English and official-domain-alias search, 20 records per page, pagination returns to the top, official-homepage/source/methodology copying, safe friend/Timeline share parameters, explicit loading/error/retry/cache states.
- Phone visual review reduced redundant controls and placed AP/IB/A-Level selectors in one row. External sites are copied for opening in a browser, not embedded in an unapproved WebView.
- Rankings are fetched from the backend-maintained public JSON, not packaged in the Mini Program. Validated offline fallback is limited to seven days.

## Verification

- PASS: full `npm run test:all` on final runtime source, WXML/WXSS compile, package gate, focused source/data tests.
- PASS: actual combined data against backend validator and client service/page; 420 CN/EN lookups, aliases, all 210 record-to-website mappings, ties, pagination, three official course identities.
- PASS: final WeChat simulator using the real public endpoint, not a request mock. QS pages 20/20/20/20/20/2; U.S. News pages 20/20/20/20/20/8; no missing or duplicate records. Five native search cases, eight clipboard-handler checks with the OS clipboard intercepted, four safe-share checks, reachable homepage entry, and four screenshots.
- PASS: 45 offline deployment/recovery tests and independent review. Fresh 37-check server gates passed for upload, stage dry-run, stage, activation dry-run, activation, and post-activation. One SSH upload timeout was inspected read-only and resumed with a fresh gate; no active release was changed during that failure.
- NOT VERIFIED: physical Android/iPhone/iPad behavior and actual friend/Timeline message delivery. No messages were sent; no real clipboard contents were read or changed.

## Data provenance limits

QS ranking rows come from its official ranking and correction pages. Official university website identities were checked; 23 QS homepages blocked or failed automated direct HTTP access, so identity validation is not a guarantee of reachability from every device.

U.S. News direct crawler access was restricted. Of 108 rows, 81 were verified through publisher/institution primary sources, two through institution-affiliated reports, and 25 through agreeing public reporting. Full rows agreed across [Poets & Quants](https://poetsandquantsforundergrads.com/news/u-s-news-best-colleges-ranking-2027-mit-ends-princetons-long-run-at-the-top/2/) and [PrepsReview](https://www.prepsreview.com/us-university-rankings.html). Do not describe all 108 rows as independently fetched from the publisher. All official homepage identities were checked; 14 needed official-index fallback for automated reachability.

Research implementation references: [Hipo university-domains-list](https://github.com/Hipo/university-domains-list) and [Tencent WeUI](https://github.com/Tencent/weui-wxss), discovery/pattern references only; no third-party implementation code was copied.

## Deployment and upload identity

- Uploaded runtime commit: `6465052c660be32e0156f6e78efee12c78844cb0`.
- Frozen package: `D:\CodexWork\university-directory-20261010T205620\native-release`.
- Package manifest SHA-256: `4e90ef8e7c27e571d91f421e95910c19228eeb71060c59ebd8a88cdca5a7219d`.
- Official WeChat upload returned `success: true`, development version **1.0.43**; main package 1,951,296 bytes, total 2,290,610 bytes.
- Upload receipt: `D:\CodexWork\university-directory-20261010T205620\wechat-upload-1.0.43.json`.
- Live native report: `D:\CodexWork\university-directory-20261010T205620\native-qa\live-evidence-20261010-01\native-acceptance-report.json`; SHA-256 `e7b77d5e93d5c5f498d88c0fcf715367279f279955c2ed6834ace1bdba9f9a96`.
- Backend artifact: [university-directory.json](https://stem.ieltsist.com/data/university-directory.json), 63,473 bytes, SHA-256 `20386e81158ef03d195517ce7ad40fe87225d20a4b17fe9e6dc01f14469e75d7`, HTTP 200, JSON, `Cache-Control: no-cache` from both loopback and public endpoints.
- Server release: `stem-university-directory-20261010t214545-a5ed0dd`; runtime commit remains `a5ed0dd8b07dd863ac5fa9be75f1516f2f1c27f7`. Only `public/data/university-directory.json` was added; zero existing release-tree entries changed or disappeared. Existing paper assets, curriculum catalogs, runtime data and syllabus scope were preserved. No production source build occurred.
- Candidate manifest SHA-256: `ef08d394bea8c6624d19e00b423b647e9928bfc2670e75049a44db53e5e4d275`.
- Stage receipt SHA-256: `f4f509bd66aa64caa96eae8ceb7604364d9d65497eb26f10b646e1bab2b168ff`; activation receipt SHA-256: `c5cadc7dd2c685d227a2192eb86b8eead9fe40e78d4193a1ee4fb87deb4eb90c`.
- Post-activation gate: 2026-10-10T23:47:06.064823+08:00, 37/37 PASS, swap 7.984%, unchanged IELTS PID/restart identity. Only `alevel-physics` restarted, without `--update-env`. Previous immutable release is retained for rollback.
- Backend source/data preservation commit: `c6da9c7` on `codex/stem-profile-apib-20260928`.
- Original user-owned `project.config.json` SHA-256 remained `a6d9c6a9cb8c4732f591272e9f18db86c12628cb2aa5fedecd9efb97ce5705fa`. The two pre-existing backend builder-script edits were not changed or committed.

No WeChat review submission or public Mini Program release was performed.

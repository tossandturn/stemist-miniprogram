# University directory native page plan

Date: 2026-10-10

## Scope

- Add one native page under the existing `bundles/curricula` subpackage with two views: `大学排名` and `课程官网`.
- Keep the six primary home entries unchanged. Add only a secondary `大学排名与官网` navigator, contextual official-link access on the AP/IB curriculum page, and a compact A-Level official shortcut in its existing practice workspace while the package gate remains green.
- Read the public, server-maintained `GET /data/university-directory.json` contract without authentication. Do not package ranking records in the Mini Program.

## Data and safety

- Require `stemist-university-directory-v1`; exact `ap`, `ib`, and `alevel` official identities; exact `qs-world/world` and `usnews-national/us-national` ranking identities; 100–150 complete top-100 rows; canonical tie labels; distinct item IDs; and safe bounded text fields.
- Pin course organizations to their official hosts and ranking provenance to the official QS and U.S. News hosts. University website hosts remain open but must pass the same strict public-HTTPS validation.
- Accept only canonical HTTPS URLs with public DNS hostnames, no credentials, query, fragment, port, local address, or traversal segment.
- Cache only a normalized response. A failed request may use a revalidated cache no older than seven days, and the page must label that state explicitly.
- Display hosts and copy URLs through `wx.setClipboardData`; report success only from its `success` callback. Never route these external sites through `web-view`.

## Interaction

- Ranking picker, Chinese/English name search, and 20-row client pagination preserve the server-provided `rankLabel`, including ties.
- Metadata shows edition, scope, verification date, source host, methodology host, and directory update date.
- Share paths include only allowlisted `tab`, `ranking`, and `board` values. Loading, empty, error, retry, and cached states remain explicit on phone and tablet.

## Verification

- Synthetic service/page fixtures cover schema and URL rejection, distinct campuses, ties, pagination, bilingual search, cache fallback/expiry, clipboard callbacks, safe sharing, routing, and no-WebView policy.
- Run focused tests, page/share/responsive/contrast/WebView/compiler suites, and `node scripts/build-native-package.mjs --check-only` without changing `project.config.json`.

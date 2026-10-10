# Backend-driven native foundation

## Product boundary

This foundation implements the user-approved one-time native update. The client still contains reviewed native components and capability handlers. Public JSON selects their presentation; it cannot execute JavaScript, HTML, CSS, provider calls or arbitrary routes.

After this client is deployed, these changes are backend-only:

- The six Home entries' wording and order, plus secondary links.
- The four AI Coach menu labels, descriptions and order.
- Tavern public metadata and categories, with original identity, conversation, exam and entertainment guards preserved.
- Information screens composed of native text, notices, known page links and public HTTPS copy actions.
- Existing server-owned announcements, question catalogs, download assets, chapter data, ranking data and AI service logic remain server-owned.

New native interactions, permission requests, widgets or client defects still require a normal WeChat client release. This first configuration service is not a claim that every legacy business API has already been extracted into a microservice.

## Protocol

`GET /api/product/config?channel=release|trial|develop&capability=1` on the existing STEM HTTPS origin. The dependency-free service has its own process, immutable publication store and channel pointers. No public write endpoint is exposed.

Client `utils/productConfig.js` and backend `services/product-config/schema.mjs` validate the same `stemist-product-config-v1` contract. Exact keys, known capability IDs, packaged icons, valid screen references, strict copy-only URLs and a 128 KiB limit are required. Existing private credentials, images, attempts and scores never enter this public configuration.

Public caches are channel-separated, retained for at most seven days and conditionally revalidated with ETags. Invalid, incompatible or unavailable responses preserve a valid recent version or restore bundled defaults. Request generations prevent older replies overwriting a newer state. Private storage is neither read nor cleared by the loader.

Publication uses validated immutable revisions, expected-current compare-and-swap and atomic pointers. Rollback moves only the selected channel pointer to a retained valid revision; no process restart or client rebuild is required. New Tavern persona metadata must not be published until its backend persona is supported.

## Verification and packaging

- `npm run test:product-config`: client schema, channel/cache/304/failure/race behavior and native integration.
- `npm run test:package-minification`: exact esbuild 0.28.2 output-only whitespace transform, deterministic output/hash receipts and offline IELTS preservation.
- `npm run test:all`: includes both focused checks through `pretest:all`, then the existing full regression suite.
- Physical-device acceptance remains separate from automated and DevTools checks.

The package preserves source files and student content. Its artifact receipts include source/output hashes and the transform version. The existing 128 KiB main-package headroom gate is unchanged.

## Implementation references

[A2UI](https://github.com/a2ui-project/a2ui) informed the declarative-data/trusted-component boundary; it is not installed and no WeChat compatibility claim is made. [Official WeChat native examples](https://github.com/wechat-miniprogram/miniprogram-demo) informed native page boundaries. [esbuild](https://github.com/evanw/esbuild/releases/tag/v0.28.2) is the pinned development-only output transformer. No third-party runtime implementation was copied.

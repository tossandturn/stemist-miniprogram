# Native membership entry (disabled-payment candidate)

The account page links to `/bundles/account/membership`. The shared authority owns
the `stemist-membership-v1` plan: CNY 28.80, 30 days, manual renewal, no automatic debit.
All existing users are included when the server eventually enables enforcement.

## Client boundaries

- The account page reads `GET /api/membership/catalog` from the existing IELTSist
  authority; the content-open gate uses the reviewed STEM same-origin proxy for
  that public catalog/status contract. Private order calls use the existing
  IELTS native-session exchange.
- Price is represented as integer fen. The client does not submit amount,
  currency, duration, OpenID, provider choice or user ID to checkout.
- Provider platform eligibility is server-owned. Unsupported WeChat capabilities
  disable purchase; iOS is not assumed to use the ordinary JSAPI payment channel.
- `wx.requestVirtualPayment`/`wx.requestPayment` success only means the native
  flow returned. Only an owner-bound server `fulfilled` result plus active
  entitlement displays membership success.
- Local storage contains only an owner-scoped idempotency key, order ID and
  payment-attempt state, never payment signatures, AppKey or sessionKey.
- Guests see only the public, non-payable catalog. A logged-in test buyer may
  read the owner-bound private catalog; checkout remains off unless its
  two-hour Android virtual-payment canary is valid. Server recovery reuses the
  exact idempotency key; a recovery with an order ID is query-only and can
  never launch native payment again.
- `launched`, `submitted` and `unknown` attempts only query the server; only a
  clearly cancelled attempt can explicitly retry the same order. Logout clears
  private pointers; a later same-owner login restores unresolved orders from the
  authenticated server list as unknown, never as a fresh payable order.
- Delayed responses and native callbacks cannot change another owner/epoch.
- Server `membership_required` responses offer a single, user-confirmed route to
  the membership page without discarding the current draft or granting access.
- Every managed PDF/image/audio cache open first obtains a fresh or bounded
  owner/privacy-epoch membership decision. A guest may open it only after a
  fresh public catalog explicitly says enforcement is disabled; an authenticated
  user uses `GET /api/membership/status`, with a positive proof capped at 30
  seconds and never beyond entitlement expiry.
- The status authority owns entitlement versions and plan migration. The Mini
  Program preserves a bounded non-empty string version (including the current
  ISO `updated_at`) or a legacy non-negative integer as an opaque value. Access
  accepts only the reviewed all-access plans `all-access-month`, `day`, `week`,
  `month`, and `year`; an unknown plan or malformed version fails closed.
- Protected STEM downloads use the latest STEM bearer at the actual network
  dispatch. IELTS task details, generated pages and Listening audio use the
  separate IELTS native-session bearer; neither credential is put in a URL,
  rendered data, cache key or log.
- Protected images are downloaded to owner-bound temporary paths before WXML
  rendering or preview. PDF Range/resume/ETag/SHA and Listening Range/resume
  remain intact. Account/privacy-epoch changes cancel work; active audio is
  stopped before its app-managed owner cache is reclaimed. User-exported files
  are outside that cleanup.
- `401 identity_required`, `403 membership_required`, and membership-authority
  `503` failures remain distinct and fail closed when enforcement is enabled.

## Current release boundary

This candidate is not uploaded and no real payment has been attempted. Checkout
and enforcement remain OFF. The public upload package now keeps only the
sanitized IELTS catalog: `utils/ieltsTaskBootstrap.js` and its decoder are
source-only generation fixtures and are explicitly excluded from the runtime
package. Opening a complete IELTS task for the first time therefore requires an
authenticated network response; there is deliberately no offline full-task
fallback that bypasses membership authority.

Provider activation, end-to-end callback/query/refund recovery, protected-media
acceptance in a real Mini Program, and a bounded real order remain release
prerequisites. Older installed packages, app caches and files a user already
exported cannot be represented as revoked DRM. Activation must keep enforcement
OFF until upgrade/cache migration and physical-phone validation are complete.

## Verification

- `npm run test:membership`
- `npm run test:pdf-download`
- `npm run test:native-ielts`
- `npm run test:package-minification`
- `node --no-warnings scripts/test-membership-cross-repo.mjs --identity-backend <reviewed-worktree>`
- `node scripts/test-membership-native-live.cjs --output <new-QA-directory>`
- `npm run test:all`

Native visual checks use synthetic page data only, not a paid account or a real
payment. The 390x753 simulator first-viewport purchase area is 48px high and
fully above bottom navigation after moving feature descriptions below checkout.
This is not a physical-phone/iPad/IAP acceptance claim.

The Windows checkout fix adds a targeted LF attribute for topic SVGs. It preserves
all 17 original Git hashes and the existing IELTS packed-data assertions.

Primary reference: [Tencent CloudBase virtual-payment integration](https://github.com/TencentCloudBase/skills/blob/main/skills/cloudbase-wechat-integration/references/virtual-payment.md).

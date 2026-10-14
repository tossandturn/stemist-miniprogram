# Native membership entry (disabled-payment candidate)

The account page links to `/bundles/account/membership`. The shared authority owns
the `stemist-membership-v1` plan: CNY 28.80, 30 days, manual renewal, no automatic debit.
All existing users are included when the server eventually enables enforcement.

## Client boundaries

- The catalog comes from `GET /api/membership/catalog` on the existing IELTSist
  authority; private status/order calls use its existing native-session exchange.
- Price is represented as integer fen. The client does not submit amount,
  currency, duration, OpenID, provider choice or user ID to checkout.
- Provider platform eligibility is server-owned. Unsupported WeChat capabilities
  disable purchase; iOS is not assumed to use the ordinary JSAPI payment channel.
- `wx.requestVirtualPayment`/`wx.requestPayment` success only means the native
  flow returned. Only an owner-bound server `fulfilled` result plus active
  entitlement displays membership success.
- Local storage contains only an owner-scoped idempotency key, order ID and
  payment-attempt state, never payment signatures, AppKey or sessionKey.
- `launched`, `submitted` and `unknown` attempts only query the server; only a
  clearly cancelled attempt can explicitly retry the same order. Logout clears
  private pointers; a later same-owner login restores unresolved orders from the
  authenticated server list as unknown, never as a fresh payable order.
- Delayed responses and native callbacks cannot change another owner/epoch.
- Server `membership_required` responses offer a single, user-confirmed route to
  the membership page without discarding the current draft or granting access.

## Current release boundary

This candidate is not uploaded and no real payment has been attempted. Checkout
and enforcement remain OFF, and the provider registry is intentionally empty.
Merchant/virtual-payment eligibility, OfferID/product/AppKey, iOS IAP, complete
callback/refund handling, protected download acceptance and a small real order
remain release prerequisites. Public answer bundles and previously cached files
must not be represented as a completed content paywall.

## Verification

- `npm run test:membership`
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

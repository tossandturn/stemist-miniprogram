# Android single-account membership trial

User approved an experience-version test and explicitly selected Android. Keep general commerce and membership enforcement OFF. Existing offer is CNY 28.80, 30 fixed days, no automatic renewal. Native payment confirmation belongs to the human. Do not activate iOS/IAP, charge/refund autonomously, inspect unrelated account data, change AI/learning routes, or publish publicly.

## Scope and sequence

1. Reuse and adapt the reviewed membership module in `D:/CodexWork/membership-rollout-20261014/miniprogram/bundles/account/membership*`, not the old full Mini Program checkout.
2. Add the native membership page to the current `bundles/account` subpackage and connect My/account and the existing IELTS subscription entry. Preserve 1.0.62 optional login/profile and cancellation fixes. Preserve the old activation-code route as a clearly secondary option if needed; do not pretend activation-code testing verifies payment.
3. Private membership APIs use the existing dedicated IELTS native session, never a STEM bearer on unrelated endpoints. The server owns user identity, price, product, duration, platform, canary eligibility, order status, and entitlements. Default OFF/malformed/unavailable state never opens native payment.
4. Trial/develop users can copy ONLY their own verified canonical account ID (`ielts:<id>`) from a successful owner-checked membership status response. Label it as a test account identifier, not an OpenID/token. Never infer the human's test account from a developer-tool account or username. Until the human identifies the test account, prepare the client and keep checkout disabled.
5. Consent before creating an order: show actual CNY price, 30 days, manual renewal, real-charge warning in test mode. No purchase on page load, redirect, polling, or retry callback. Keep bounded UI and request timeouts, owner/privacy/visibility guards, safe back fallback, and resume/reconciliation without duplicate charge or order.
6. Native payment success is not membership fulfillment; show confirming until authenticated backend confirms. Preserve unknown/pending references by owner, never store payment signatures/parameters, and reconcile after reentry. A canceled payment may resume ONLY the same server-owned order, within authorized canary limits; investigate the old candidate's overly restrictive private-catalog recovery logic rather than reopening general checkout or inventing a second order.
7. Backend first audits the already implemented canary/checkout contracts. Main alone performs any SSH/configuration/activation, with fresh exact-scope resource gate, safe backup/rollback, narrowly allowlisted changes, and before/after acceptance. Local source is not proof of mixed production deployment. Payment AppKeys stay server-side and out of tool output; no public checkout/enforcement enablement.
8. Client package headroom must remain >=131072 bytes; current headroom 133594. Keep purchase code in account subpackage. Preserve dirty user `project.config.json` SHA256 `A6D9C6A9CB8C4732F591272E9F18DB86C12628CB2AA5FEDECD9EFB97CE5705FA`.
9. Run focused RED/GREEN tests, client full suite, transformed/package tests, isolated native pages with synthetic identity/network/payment, and independent review. Next version is 1.0.63 only after ledger recheck. Upload development build and, when platform controls allow, designate it as the experience version; report those as separate states. No public submission/release.

## Verification cases

Guest, unavailable/off/expired canary, wrong owner/platform, iOS blocked, malformed response/amount, consent missing, rapid double tap, delayed login/checkout response after back, native cancel, network loss/unknown outcome, reentry/recovery, paid-before-fulfillment, fulfilled, refund, no entitlement fabrication, no cross-account references, server expiry and one-order limit, authoritative test account ID, and safe root back.

## References

- Existing local `MEMBERSHIP-PROTOCOL.md`, `identity-livebase/docs/membership-integration.md`, and exact candidate tests.
- Tencent original implementation guidance: https://github.com/TencentCloudBase/CloudBase-AI-Toolkit/blob/main/config/source/skills/cloudbase-wechat-integration/references/virtual-payment.md
- Official client API: https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestVirtualPayment.html

Experience version is a client distribution channel, not proof of sandbox payments. Android real-order acceptance and iOS IAP are separate gates. Do not import an external library or copy a whole historical repository.

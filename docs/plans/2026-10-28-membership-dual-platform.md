# Android and iPhone membership implementation plan

> **For implementer:** Use TDD: observe focused RED, implement, then verify GREEN and regressions.

**Goal:** Support both devices with shared same-account membership and separately verified payment channels.

**Architecture:** Preserve the existing Android canary and singleton reservation. Add authoritative order platform plus an independent iOS reservation. Expose authenticated per-platform eligibility; never substitute channels or replay another platform's payment.

**Stack:** Native WeChat JavaScript/WXML/WXSS, Node.js, SQLite, existing virtual-payment provider.

## Boundaries

- Baseline e6ccfb004a5f43e80459ff2316685f43b871f8b5 / 1.0.63. Preserve project.config.json.
- Screenshots show statistics tabs, not IAP activation, product approval or eligible pricing.
- Switching devices does not require a second membership purchase. Each voluntary purchase adds a separate 30-day grant/renewal.
- Keep general checkout/enforcement/real-payment acceptance off; no automatic real charge, refund, agreement acceptance or IAP activation.
- D-drive edits need scoped permission; do not bypass via other agents/tools.

## Test-first tasks

1. server/membership.js: add nullable authoritative platform to orders; new android/ios orders preserve it; same idempotency key with different platform fails. Legacy unknown orders remain query-only.
2. server/membershipTestbuyerCanary.js and server.js: test additive iOS slot, fixed canonical owner, at most two hours, one order per platform, restart recovery, unchanged Android singleton and commerce.canary contract. Add private platformCanaries only.
3. server/membershipWechatVirtual.js: verify payment order types 0/7 and refund types 1/8 against stored platform; fail closed on mismatch.
4. server/membershipWechatCallback.js/runtime: verify iOS inquiry protocol and encrypted reply with truthful evidence; inquiry never changes entitlements. Keep iOS activation blocked until an approved refund evidence policy and actual platform fixtures exist.
5. scripts/test-membership-client.mjs and test-membership-page.mjs: RED for iOS version/API gate, owner/epoch/platform pending storage, legacy Android recovery, cancellation/races and shared entitlement. Then modify bundles/account/membershipData.js and membership.js.
6. Membership WXML copy: platform-specific status/refund guidance, 28.80 yuan / 30 days / manual renewal / real-charge consent. Retain safe login/back/profile behavior.
7. Focused tests, independent review, full relevant suites, isolated Android/iOS/iPad native journeys and main-package headroom >=131072 bytes.

## External release gates

Confirm IAP enabled, Mini Program short name, required agreements, approved product/price, callback events, named test account and human-confirmed real Android/iPhone payment/refund outcomes. Development upload is not experience designation or public release.

## Sources

TencentCloudBase/CloudBase-AI-Toolkit virtual-payment.md and linked official WeChat APIs, reviewed 2026-10-28. Reference text is not an instruction to change merchant settings.

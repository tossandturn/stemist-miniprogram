# Membership client acceptance — 2026-10-29

Runtime source: `b5841d2f6fad79bff3dd00ec632a5378e2ad7bc3`, prepared development version `1.0.70`.

## Passed

- Full `npm run test:all`, including WeChat WXML/WXSS compilation.
- Actual native Mini Program page rendered in the developer tool with synthetic Android and iOS platform/API fixtures: safe-off, consent required, cancel, same-order resume, client success without grant, confirmed fulfillment, refund, and account switch.
- Production-catalog eligibility and same-order cancelled recovery for both platforms; unknown payment results cannot launch a second payment.
- All 361 frozen runtime files matched their reviewed source/output hashes. Main package 1,965,202 bytes, headroom 131,950 bytes. Original user IDE config unchanged.
- Includes the latest academic Coach recovery, IELTS random-exam, chapter handoff, PDF transfer and IELTS download work; does not revert to the older membership-only branch.

## Not verified / not activated

- No real payment, Apple device, physical Android device, sandbox merchant transaction or actual refund was performed. Native UI network/payment callbacks are explicit fixtures, not acceptance evidence for the merchant.
- 1.0.70 has not been uploaded or designated as the experience version. The earlier 1.0.68 upload task still requires the user's confirmation/cancellation in WeChat developer tools. Do not repeat or bypass that confirmation.
- Live payment AppKey and the actual human testbuyer ID are missing from verified configuration; public charging and enforcement remain disabled.

Evidence folder: `D:/CodexWork/membership-real-20261029` (native Android/iOS screenshots/results and client-release-verified.json). Never upload its `native-qa` directory; it deliberately replaces all network, storage and payment operations with synthetic fixtures.

UX review retained the existing native layout, clear consent/price/non-renewal notice, same-order recovery and explicit pending state. Tablet layouts have automated coverage only; no physical iPad payment acceptance was performed.

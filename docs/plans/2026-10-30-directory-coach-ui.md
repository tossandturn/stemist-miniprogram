# University/course Coach entry and discovery refresh

## User request and scope

Give every existing university and official course entry an AI Coach conversation action that brings the selected school/course into the prompt. Make the university directory and learning-account entry prominent. Improve hierarchy, spacing, iconography and visual consistency without changing rankings, admissions facts, payment rules, calculator free access or unrelated AI roles.

## Design

- Home keeps announcements first. Two high-visibility, labelled feature cards immediately below lead to “大学排名与官网” and “我的学习账号”; six existing learning entries remain. No automatic login barrier. Remote secondary links still work without a duplicate directory link.
- Directory retains separate visible QS and U.S. News tabs (not a dropdown), full school names/logos, official links, requirements panels, pagination and source dates. Every school has a clear “和 AI Coach 聊聊” button. All current AP/IB/A-Level official cards receive their own discussion action.
- Reuse the existing admissions-advisor text chat. Bring only public, displayed school/course metadata into a bounded, editable starter prompt: name, official URL, ranking edition/source where applicable. Explicitly distinguish official facts from unverified specifics and suggestions; no invented score thresholds, deadlines, application history or admission probabilities. The request is user text, never a replacement system prompt.
- Entry handoff is bounded by nonce, age, account and privacy epoch; consume once. Do not automatically send, erase old conversations, overwrite an existing unsent draft or reuse another account's entry. Guest login may carry only the explicit public selection, never another account's draft. Cancellation and failed navigation preserve existing content.
- Maintain the existing violet/light brand, native buttons, safe areas, original vector illustrations, readable type, 44 px targets and clear loading/error states. No added component dependency or external icon/font request.

## Implementation and acceptance

1. Capture current public home and directory; inspect native page/auth/draft contracts.
2. Failing handoff and per-card tests, then implement sender and admissions-only receiver without changing the shared IELTS teacher engine.
3. Refresh home/directory layouts and accessible action names. Keep public URLs copyable; do not claim arbitrary official websites can open inside WeChat without a configured business domain.
4. Verify every school across both datasets and all three courses. Exercise no auto-send, draft conflict, guest login/cancel, account switch, stale/tampered entry, missing profile, slow load and navigation failure.
5. Source plus frozen-package regression; native mobile smoke and public screenshots, phone/tablet/landscape geometry where tooling supports. Retain 128 KiB main-package headroom; targeted minification is acceptable with packed-code tests, weakening the gate is not.
6. Commit/push verified changes; reserve next native version only after checking the release ledger, build a fresh immutable package, upload development version with receipt. Never overwrite uploaded 1.0.73. Report experience/public-release and real-device status separately.

## References

- [Tencent TDesign Mini Program](https://github.com/Tencent/tdesign-miniprogram), MIT: native action hierarchy, grid/button separation, consistent tokens. Reference only; no dependency added.
- [Official WeChat Mini Program examples](https://github.com/wechat-miniprogram/miniprogram-demo): native navigation and registered-page patterns. Keep current page/API architecture rather than embedding websites.
- Local `ui-ux-pro-max`: accessible touch targets, native button width overrides, safe-area clearance, name readability and mobile-first hierarchy. Existing product tokens take precedence over unrelated generated palettes.

Content changes remain backend-driven; this addition of native actions/layout requires a new client package. No backend provider/configuration mutation is planned unless end-to-end inspection proves it necessary.

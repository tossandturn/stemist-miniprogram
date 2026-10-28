# WeChat login and optional profile review fix

## Request and scope

User supplied a WeChat review rejection: cancel/back during login is ineffective. They request WeChat authorization/login as the primary path and assurance that it supports future membership. Implement the client fix, preserve existing identities/records, test and upload a development candidate; do not enable payment/enforcement, merge accounts, submit public review, or promise review approval.

## Root-cause hypothesis from current source

`bundles/account/auth.js` opens profile onboarding from `onShow` and after WeChat login. The `navigateTo.complete` callback records onboarding only if the account page is still active and its version unchanged. Normal navigation calls `onHide`, invalidating both conditions before completion; returning from profile can immediately reopen it. Existing tests do not model that lifecycle order. Account root back has no fallback; profile root back redirects to account and can reenter the same loop. Profile back/skip is disabled while saving.

## Product contract

1. WeChat one-click login is the primary path (`wx.login` -> existing server exchange -> stable internal user ID). Do not imitate a native authorization dialog, use deprecated profile APIs, auto-read avatar/nickname, or require a phone number.
2. Visitors may browse without signing in. Silent calls may refresh an existing session, but must not create a new guest identity. Explicit login alone starts a new exchange. Cancel/back prevents a late explicit exchange from storing a session, showing a toast, or navigating. Keep bounded WeChat login/network timeout and single-flight behavior with retry after cancellation.
3. Login success stays on account/returns appropriately without opening profile. Profile editing is explicitly user-initiated, optional, and separate from login/member eligibility. Remove the auto-onboarding path rather than repairing its prompt marker and retaining forced navigation.
4. Back/cancel/skip always works, including root entry, failed profile load, avatar processing and saving. Use navigateBack for a real previous page and a safe home fallback on failure/no stack. Do not redirect root profile back into another compulsory login/profile gate.
5. Expose a visible "暂不登录，返回浏览" on the guest account state. Keep existing IELTSist account login as a secondary recovery path to avoid orphaning old memberships; no new native username-registration promotion and no automatic account merge.
6. Preserve signed owner IDs, privacy epochs, auth-response validation, session refresh, account-change fencing, history and member access policy. Cancellation must not clear unrelated private drafts or mutate another account. Existing auth/profile endpoints and payment configuration stay unchanged.
7. Copy distinguishes identity from profile: avatar/nickname optional and not the membership key. No claim that wx.login automatically obtains profile or phone data. Explain login purpose briefly and retain privacy policy access.

## Implementation bounds

Frontend implementer may edit `bundles/account/auth.*`, `bundles/account/profile.*`, small account-navigation helper in that bundle if justified, `utils/wechatAuth.js`, `utils/auth.js` for backward-compatible password-attempt cancellation, comments/initial states in `app.js` if necessary, focused auth/profile tests, and package test registration. Preserve `project.config.json` exactly. Main owns docs, native fixtures, release ledger, commit and upload. Do not touch role prompts, downloads, learning data, real-time speaking, payment candidate branches or server settings.

Independent review confirmed that the retained password login also needs cancellation before cookie/token adoption, not merely late-UI suppression. Extend the same back/cancel contract to it without changing existing password-account identity semantics.

Route the existing explicit sign-in entry in `pages/ielts/home.js` (and any reachable `pages/index/index.js` explicit entry) to the central account page so it cannot start an unowned, uncancellable login promise. Silent home/bootstrap behavior remains non-blocking and guest-preserving. These small route changes and their regression tests are approved scope.

Keep the main-package >=131072-byte headroom gate: new page/UI code stays in the existing account subpackage; shared auth changes must be small.

## Acceptance

- RED: lifecycle hide-before-navigation-complete loop, root back failure, save-pending exit, no automatic profile on login/reopen, guest silent no-login, canceled code/request cannot establish session, successful explicit retry after cancel, auth/account-switch races.
- GREEN: old identity/session/privacy/profile tests retained except obsolete forced-onboarding assertions; complete client suite and transformed-package checks; native WeChat compiler and isolated simulator journey using synthetic account/storage/network.
- Independent backend read-only audit confirms existing OpenID/AppID -> internal user and membership mapping. Do not claim account binding, live payment, public review, physical-device authorization or server state was newly verified when not tested.
- Candidate next version 1.0.62 only after checking ledger still ends at 1.0.61 with no pending upload. Upload is not public release.

## Sources

- https://github.com/wechat-miniprogram/miniprogram-demo — official MIT reference; inspect native login/profile examples, no code or dependency copied.
- https://github.com/wechat-miniprogram/api-typings — official API contract reference.
- https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html
- https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/userProfile.html

Official developer pages could not be fetched in this environment; do not invent a guarantee of compliance. The user's supplied rejection is direct evidence of the failed cancel/back journey. Existing design tokens/native controls take precedence over generic UI recommendations.

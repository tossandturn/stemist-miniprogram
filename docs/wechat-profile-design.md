# WeChat profile confirmation

Scope: account display only. Keep the canonical account ID, username, roles, SSO and learning records unchanged.

- Use WeChat's native `chooseAvatar` button and `input type="nickname"`. The student confirms the values once; do not claim to silently retrieve them from `wx.login`.
- Collect the nickname from form submission, not a cached input event: WeChat can asynchronously clear rejected nickname input.
- Optional profile setup after explicit WeChat login; silent startup sign-in and learning must stay unblocked. Existing accounts can use the visible account-page edit action.
- Persist the approved display name and a bounded avatar in authenticated STEM profile storage. Never store only a temporary WeChat image path. Keep profile bytes out of identity tokens.
- New profile editor is a lazy account subpackage. Preserve the existing main-package performance budget and purple/native design tokens.
- Verify save/relogin, denied or cancelled selection, missing/oversized image, timeout/retry, form content clearing, logout/account switch, page unload and phone/tablet layouts. Native WeChat chooser behavior still requires physical-device verification.

Primary source: [WeChat avatar and nickname filling](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/userProfile.html), inspected 2026-09-28. It documents temporary avatar paths, native content checks and form-submit collection.

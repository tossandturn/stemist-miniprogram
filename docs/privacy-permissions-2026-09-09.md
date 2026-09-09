# Privacy and device permission repair

- Account now exposes **隐私与权限**. The page reads actual WeChat privacy and scope states; opening it never grants consent, captures a photo or starts recording.
- When privacy consent is required, the shared component starts unchecked. Only the native `agreePrivacyAuthorization` button followed by an authoritative `getPrivacySetting` confirmation may continue. A checkmark alone is not an authorization flag. No local consent flag is persisted.
- Camera and microphone are requested separately through explicit buttons. Existing denial routes to WeChat/system settings; privacy declarations missing from the management platform are reported as configuration errors rather than repeated requests to agree.
- The camera permission card is before the viewfinder; blocked permission states do not show a large empty preview. Phone controls stack vertically; tablet landscape may use two columns. Touch controls are at least48px.
- Tests cover unchecked/checked behavior, absent native approval, late callbacks after detach, separate scopes, undeclared privacy APIs and first-screen layout. All-suite and native WXML/WXSS checks pass.
- Desktop WeChat runtime at verification reported privacy agreement already accepted, while camera and microphone scopes were not enabled. This is not evidence of the user's phone permission state.
- The unchecked-layout screenshot is a temporary page-state fixture only. No privacy grant or device permission was changed. The real state is restored by a fresh permission query.
- Actual phone camera/microphone capture remains to be validated by the device owner. The earlier automatic real-device-debug `abort` remains distinct from development-version upload and is not proven fixed by these changes. No backend or production service was changed in this patch.

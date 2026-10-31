# Tarot and eastern-oracle message images — 2026-10-31

The top-level draw panel has been removed. Each completed interpretation renders its own original draw below that reply. A new draw appears at the conversation tail while interpretation is pending; completion replaces that provisional render without duplicating it. Later chat and draws preserve earlier images in place. Three-card order, upright/reversed orientation and zoom reuse the existing artwork component.

Historical snapshots are bounded, field-whitelisted and attached only to the authenticated assistant reply. They can be displayed after receipt expiry but cannot authorize reinterpretation. A history page starting at an assistant still retrieves the corresponding original draw. No history is inferred from AI prose.

## Acceptance

- PASS: new frontend/backend tests first reproduced missing per-turn pictures, then passed after the fix.
- PASS: full client `npm run test:all` (74,482 ms), 20 frozen package suites, 10 backend suites (including shared advisor/IELTS-teacher regression).
- PASS: actual native simulator screenshots and bounds for Tarot and eastern oracle. Images below their own reply, no horizontal overflow, three-card targets at least86px wide. Reversed-card preview remains180degrees. Ordinary follow-up does not relocate or repeat earlier pictures.
- PASS: real production draw + AI interpretation for both personas, then removal of the synthetic account's local role cache and cloud reload. The exact original draw returned on its reply in both cases. No runtime errors or pending duplicate images.
- PASS: isolated QA storage restored and synthetic login closed. Two small real-provider requests; no student data, token or cookie exported.
- PASS: backend allowlisted history serializer deployed with code/SQLite backups and passing before/after gates; exactly one STEM restart71→72. Coach API, download/quota modules and IELTS process/source unchanged. No database schema, environment, model, payment or original media change.
- PASS: frozen runtime `c1a4f071e8ecc4b4ab6e68df27c5a7d257977f73`, manifest `d2c8c36a73a1f1d77153ab1339f1d2d588cad84b492cbf9707631a2fd92ccb8e`, main headroom134731bytes (minimum131072 unchanged),377 runtime files. Original user IDE configuration unchanged.

Operational evidence: `D:/CodexWork/tavern-inline-draws-20261031/verification.json`, source/backend/frozen receipts, native geometry, live cloud restoration and server deployment receipts. Direct/proxy SSH was initially unavailable; no mutation occurred until a fresh direct readiness check passed. The first DevTools automation timeout was reconciled read-only before starting QA, and a premature cloud check was followed by bounded async readiness verification rather than replaying the paid AI request.

UI/UX checks kept the existing chat visual language, fixed image geometry,44px controls and keyboard-safe composer. GitHub original message-media references are retained in `plans/2026-10-31-tavern-inline-draws.md`; no code, assets or dependencies copied.

## Release boundary

PASS: **1.0.79** uploaded through the official WeChat CLI at **2026-10-31 13:22 Asia/Shanghai**; both development ledgers reconciled to the pinned runtime and manifest. Receipt: `D:/CodexWork/tavern-inline-draws-20261031/wechat-upload-receipt.json`. Trial designation remains NOT VERIFIED; review/public publication were not performed. Physical phone/iPad gestures remain NOT VERIFIED; native phone screenshots and automated responsive/device contracts are the evidence here.

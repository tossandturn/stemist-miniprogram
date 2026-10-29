# Calculator remains free

The user confirmed that the existing Casio-style learning calculator is free to everyone. This is independent of membership status and PDF download quotas. Guest use remains available without login; an unavailable background session refresh must not block entry.

Inspection found no membership/authentication gate in the calculator page. Both CW and CN X calculation modes run locally. No calculator runtime change or client upload was needed. Added `test-calculator-free-access.mjs` to the calculator test command to preserve this product rule. It executes the actual home-entry and calculator Page logic with unavailable login/network/payment services, for a guest and an account without membership. Both models calculate correctly with no payment/quota calls or auth redirect. The same regression passes against the frozen 1.0.73 package.

Backend-only presentation changes:

- Home calculator detail: “免费开放 · 科学计算 · 历史记录”.
- Pinned free/member announcement now explicitly says the calculator requires neither login nor membership, consumes no paper/answer download allowance, and remains available after membership expires.
- Product-config revision `calculator-free-v1-20261030` preserves the entire Tavern personality revision and all other entries/configuration. No membership price, enforcement flag or payment setting was changed.

Verification: `npm test`, device, image, page, WeChat, calculator and calculator-page suites passed. Native 1.0.73 simulator guest entry through the actual homepage and calculation in both models passed with zero calculator network/payment/quota calls. Test storage was restored. This does not represent a new physical-phone verification.

Publication used fresh server gates, one exact announcement row, expected-current configuration CAS, verified recoverable copies and no service restart. The trial publication's immediate post-check failed; subsequent channels were stopped. A bounded read-only recheck passed, confirmed the intended trial revision and unchanged service/code identity; later channel publications passed their own pre/post checks. Do not infer the exact transient cause from that later passing sample.

Evidence and receipts: `D:/CodexWork/calculator-free-20261030/`. GitHub-first reference checked: [official Mini Program examples](https://github.com/wechat-miniprogram/miniprogram-demo); no external code, dependencies or calculator implementation was imported for this rule clarification.

# Claxer CASIO-FX-991-ES-PLUS keypad port

- Upstream: https://github.com/Claxer/CASIO-FX-991-ES-PLUS
- Revision: `c80addc72aa02fa7bb33104fff25cdc348fa5d05`
- License: MIT; see `LICENSE` in this directory.
- Imported on: 2026-09-05 (Asia/Shanghai)

Stemist adapts the upstream project's scientific-key grouping and familiar
four-column control layout into declarative mini-program metadata. No Casio
logo, proprietary ROM, remote font, Electron runtime, HTML document, or
upstream expression executor is included.

The upstream web implementation evaluates the display string with the
JavaScript `Function` constructor. That code is intentionally excluded.
`utils/calculator.js` provides the local allowlisted tokenizer and parser used
by the mini program.

# fx-991CW native calculator QA

Date: 2026-09-06 (Windows local clock, Asia/Shanghai).

This is the initial CW acceptance record. The user's subsequent report exposed
additional defects; see [expanded retest and repairs](calculator-cw-retest-2026-09-06.md)
before relying on the initial result as a production-quality claim.

## What changed

The four-column general-purpose keypad has been replaced with the international
fx-991CW arrangement: ON/HOME/SETTINGS/BACK/OK/cursor/SHIFT/VARIABLE/FUNCTION/
CATALOG/TOOLS, two rows of six scientific keys, and four rows of five numeric
keys ending in FORMAT and EXE. The graphite body and LCD are rendered natively
in WXML/WXSS; calculations do not use a webpage or remote calculator service.

The instrument follows the official key layout while preserving 44px hit
targets. Round visual keycaps sit inside the larger native hit areas. On the
tested 390×753 viewport, all 48 keys passed width/height checks and EXE ended
at approximately 719.17px, with the bottom of the instrument outside the action.

## Implemented behavior

- Arithmetic, implicit multiplication, precedence, powers/roots, scientific
  exponent input, trig/inverse/hyperbolic functions, log/ln/base-a logarithm,
  nCr/nPr, factorial, percent, degree-minute-second and DEG/RAD/GRAD.
- Fraction/mixed-fraction templates; stacked fractions in the LCD; FORMAT
  decimal, simple fraction, mixed fraction and engineering notation; fixed/
  scientific settings. Very small nonzero values cannot be rounded into a
  false zero fraction.
- Nine variables A–F/x/y/z, bounded f/g definitions with grammar checking and
  recursion guard, accurate Ans continuation and variable/function history context.
- HOME workspaces: Calculate; one-variable Statistics; Table (maximum 45 rows);
  real quadratic and two-variable simultaneous Equation; Ratio; Base-N conversion
  with signed 32-bit/two's-complement boundaries.
- Scope is explicit in TOOLS → About. Complex, Matrix, Distribution, Spreadsheet,
  full firmware behavior and QR online functions are not claimed or presented
  as working placeholder modes. The floating STEMist Coach remains separate.

## Verification

- `npm run test:all`: full local suite and installed WeChat WXML/WXSS compiler.
- `npm run test:calculator-page`: the original 10 state/cursor/Ans/memory/history
  regressions plus the new CW tests (`npm run test:cw`).
- `node scripts/test-devtools-cw-calculator.cjs`: 11 real WeChat simulator steps,
  zero runtime exceptions: key geometry, SHIFT inverse trig, fractional display,
  FORMAT + Ans continuation, variables, quadratic roots, table, statistics,
  signed Base-N, registered function execution, cursor editing and error/off/on
  recovery (geometry and related operations are grouped in those 11 steps).
- Simulator evidence: `D:\CodexWork\qa-artifacts\stemist-calculator-20260906\cw-phone.png`.
  It was captured by the bundled `wechatide simulator_screenshot` command after
  entering 1/2 + 1/3 through the native fraction controls and showing 5/6.
- All live calculator QA temporarily backs up/restores the prior calculator
  history and state in the app runtime. It does not clear the learner's account,
  practice drafts, photos, notebook, or local AppID configuration.

## Adaptation and remaining limits

The iPad layout keeps the same bounded-width instrument, with history beside it
in a wide landscape viewport and below it in a narrow/split viewport. Phone
layout has a narrow-screen gutter fallback instead of shrinking hit areas.
The actual live geometry result above is **phone DevTools**, not physical iPad
or an iPad simulator run. Physical-device geometry, keyboard and large-font
settings still need dedicated acceptance. This implementation uses JavaScript
numeric precision and does not claim complete equivalence to Casio's firmware.

## Sources

- [Official international product and front-view key positions](https://www.casio.com/intl/scientific-calculators/product.FX-991CW/)
- [Official menu/key behavior](https://support.casio.com/global/en/calc/manual/fx-570CW_991CW_en/before_using_the_calculator/getting_started.html)
- [Official FORMAT reference](https://support.casio.com/global/en/calc/manual/fx-570CW_991CW_en/changing_calculation_result_format/using_the_format_menu.html)
- [Official signed 32-bit Base-N reference](https://support.casio.com/global/en/calc/manual/fx-570CW_991CW_en/using_calculator_apps/base-n_calculations.html)
- [GitHub reuse/license decisions](calculator-integration.md)

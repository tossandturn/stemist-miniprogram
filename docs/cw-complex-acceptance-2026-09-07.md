# Complex implementation and QR removal

Date: 2026-09-07, Asia/Shanghai.

## Delivered scope

- QR networking and its SHIFT x label/placeholder are removed. The x key stays.
- HOME -> Complex; SHIFT 9 enters i. Expressions use the existing native LCD,
  template editor and physical key grid, including powers and square roots.
- Supports a+bi and polar input, four arithmetic operations, integer powers,
  square roots, absolute value, conjugate, argument, real and imaginary parts.
- DEG/RAD/GRAD apply to polar input and angle output. FORMAT converts the current
  result; SETTINGS -> Complex Result selects the default rectangular/polar form.
  Number Format applies Norm/Fix/Sci to complex components.
- Ans, variables and M preserve complex values. Calculate/Solver do not silently
  coerce non-real values to zero. Calculate and Complex keep separate drafts and
  history views, including an unfinished draft behind history navigation.
- Calculation is local. No AI provider, remote script, ROM or QR endpoint is used.

The behavior and test examples follow the
[Casio fx-570CW/991CW Complex manual](https://support.casio.com/global/en/calc/manual/fx-570CW_991CW_en/using_calculator_apps/complex_number_calculations.html).
This is a STEMist double-precision learning implementation, not Casio firmware.
It does not claim symbolic/exact complex radicals or the original engine's
precision. Integer powers satisfy -1e10 < n < 1e10; other complex powers and
complex trigonometric/logarithmic arguments report unsupported real-parameter
errors. Zero division and argument of zero remain errors.

## Regression evidence

Commands, all exit 0 after fixes:

- `node scripts/test-cw-complex.mjs`
- `node scripts/test-cw-complex-page.mjs`
- `npm run test:calculator-page`
- `node scripts/test-wechat-compile.mjs`
- `npm run test:all`
- `git diff --check`

Focused tests caught and fixed Number Format initially having no effect and
switching modes discarding a draft behind the history cursor. Invalid saved
mode results now produce a recoverable message instead of throwing on entry.

## Official WeChat runtime acceptance

`node scripts/test-cw-complex-devtools.cjs` passed 10 checks using actual element
taps and rendered LCD menus in the official phone simulator (390 x 753 CSS px).
The script backs up and restores only the calculator's two local storage keys;
it never exports the previous contents.

1. HOME -> Complex and one-shot SHIFT 9: `2+3i`.
2. Physical power-template entry: `(1+i)^4+(1-i)^2 = -4-2i`.
3. CATALOG Conjugate: `2-3i`.
4. CATALOG Argument: `Arg(1+i) = 45` degrees.
5. Polar entry and FORMAT: `2 angle 45`.
6. Switching the angle setting updates the same value to radians.
7. Native square-root input: `sqrt(-4) = 2i`.
8. Calculate rejects a non-real stored variable without corrupting Ans.
9. Reopening restores the Complex expression, result and variable.
10. QR is absent; all 48 physical key targets remain at least 44 x 44 CSS px.

Screenshot/receipt directory (not shipped in the Mini Program):
`D:\CodexWork\qa-artifacts\cw-complex-runtime`.
HOME, rectangular, power-template and polar screenshots were visually inspected.

This does not certify physical iPhone/iPad hardware or unrelated paper, login,
speaking or camera flows. Existing device/responsive contracts run in the full
suite; they are not a substitute for a real tablet viewport test.

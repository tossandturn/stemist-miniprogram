# fx-991CW Solver implementation and acceptance

Current work: 2026-09-07, Asia/Shanghai (Windows system date).

## Scope

The user requested the missing core SOLVE function and asked for GitHub research
before implementing it. The reference is the international fx-991CW, not an ES
PLUS layout, and not the newer regional CW+ model. This is a native Mini Program
implementation of the documented operation, not a Casio ROM or official emulator.

## Research and reuse decision

| Public project | Checked evidence | Decision |
| --- | --- | --- |
| [Claxer/CASIO-FX-991-ES-PLUS](https://github.com/Claxer/CASIO-FX-991-ES-PLUS) | MIT; last push shown by GitHub API: 2026-08-22 | Retain the existing attributed declarative key metadata; it does not supply the CW Solver flow. |
| [KaXiO-Laboratory/CasioEmuX](https://github.com/KaXiO-Laboratory/CasioEmuX/blob/stable/README.md) | GPL-3.0; Windows nX-U8 emulator; README explicitly excludes ROMs | Not a drop-in native Mini Program engine; no ROM or emulator code imported. |
| [Akhinoor14/fx991ex](https://github.com/Akhinoor14/fx991ex) | React/Electron/Capacitor project; GitHub license metadata is null | License not established for reuse; no source imported. |
| [mackodes/Scientific-Calculator](https://github.com/mackodes/Scientific-Calculator) | GPL-3.0; browser project; last push 2024-07-27 | Not imported as the CW engine. |

Behavioral reference: [Casio CW Equation / Solver manual](https://support.casio.com/global/en/calc/manual/fx-570CW_991CW_en/using_calculator_apps/equation_calculations.html).
The manual specifies Newton approximation, selectable target and initial value,
one solution per execution, a left-minus-right check, and continue/exit behavior.

## Implemented operation

`HOME → Equation → Solver → equation → EXE → Solve Target → initial value → EXE → Execute`.

- Enter `=` through `CATALOG → Equation → =`; omitted `=` means the expression equals zero.
- Keep the instrument keypad and LCD. No coefficient form or bottom-sheet replacement.
- Solve for A–F, x, y, or z when actually present in the expression.
- Keep other variables at stored values. `VARIABLE → name → Edit value` edits a parameter in the LCD.
- Honor Degree, Radian and Gradian settings, functions, fractions and implicit multiplication.
- Display the decimal result and actual L−R residual; retain the original equation.
- Return to initial value, change it, and execute again to find a different root.
- Separate Calculate and Solver drafts. Restore equations and values after navigation.
- Never overwrite Calculate Ans with a Solver result. Update the selected variable only after convergence.

## Numerical and performance boundaries

`cwSolver.js` is an original local implementation built on the existing safe
expression parser. It performs finite-difference Newton steps with bounded step
size, damping and bracket fallback. No eval, Function, HTTP, AI or new runtime dependency.

Success is not based on residual alone: small nonzero residuals additionally need
a local sign bracket and a sufficiently small Newton correction. Exact isolated
roots are accepted separately. Flat equalities, non-isolated plateaus, poles,
underflow and invalid domains must not be presented as unique solutions.

Each UI slice allows at most 6 iterations or approximately 6 ms, then yields to
the event loop. A batch stops at 40 iterations and can continue, up to a total
320-iteration cap. Backgrounding, leaving, HOME/OFF and Cancel invalidate pending
callbacks. This is not a proof that every solvable equation converges, nor a claim
of bit-for-bit equivalence with proprietary Casio firmware.

## Verification

- `scripts/test-cw-solver.mjs`: linear/polynomial/trig/log/exponential/fraction/parameter cases,
  positive/negative roots, scaling, syntax and domain errors, false-root and performance guards.
- `scripts/test-cw-solver-page.mjs`: LCD/menu/key sequence, parameters, repeat calculation,
  restoration and cancellation; source-driven mocked Mini Program runtime.
- `scripts/test-cw-solver-devtools.cjs`: actual native element taps in WeChat Developer Tools.
  Isolates only calculator state in app memory and restores it in finally.
- Existing calculator/natural-input suites and the full Mini Program suite were rerun.

Real DevTools acceptance returned x = 1.4142135623746899 for x²−2=0 from 1,
L−R = 4.510614104447086e−12 after 4 iterations. From −1 it returned the negative root.
x²+1=0 from 0 displayed failure with no result; returning to edit the initial value worked.
Screenshots live in `D:\CodexWork\qa-artifacts\cw-solver-runtime` and are not packaged.
The additional 60-second Windows GDI capture encoded successfully but contained
black frames when inspected. It is not accepted as recording evidence. The actual
WeChat tap assertions and official simulator screenshots are the valid UI evidence.

Phone simulator acceptance is distinct from real-device acceptance. This work
does not mark the rest of the calculator as fully equivalent to all CW apps:
complex/matrix/vector/distribution/spreadsheet and additional Equation/Statistics
modes remain separate parity work. No missing function should be labeled complete.

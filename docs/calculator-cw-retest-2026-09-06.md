# CW calculator: expanded student-flow retest

Date: 2026-09-06, Asia/Shanghai (Windows local clock).
Scope: the existing native calculator in `stemist-miniprogram`. No server,
account, paper content, OCR or iOS deployment was changed by this repair.

## Why another pass was necessary

The initial implementation at `0f22453` passed selected examples, but that did
not prove symbol boundaries, cursor rendering, history editing, late callbacks
or scrollable form usability. The user's report prompted independent failing
cases, not simply a rerun of the previous successful examples.

## Confirmed defects and repairs

| Student operation | Before | Repair |
| --- | --- | --- |
| Set E=5; key 2, E, 3, EXE | `2E3` parsed as 2000 | Symbolic keys retain their boundaries; result is 30. Keyboard-typed scientific `2E3` remains valid. |
| Key e / Ans / π next to digits | Scientific-token collision or unknown identifier | Symbol boundaries remain explicit without changing implicit-multiplication grouping. |
| `6÷2(1+2)` or `6÷2π` | Omitted multiplication used generic equal precedence | CW divisor grouping is preserved; the first is 1. Explicit `6÷2×3` remains 9. |
| Move cursor left in `12+34` | Screen marker stayed at the end | Marker is rendered at the same source position as insertion; function tokens are atomic. |
| Up/down in a fraction | Could replace unfinished input with history | Fraction navigation changes numerator/denominator; history browsing preserves the unfinished draft. |
| Edit recalled history / redefine f | Hidden old variables/functions could still be used | Actual edits or explicit definition changes invalidate the replay environment. |
| Leave while browsing history | Unfinished input could be lost | Pending input and replay state survive a page restart and are recoverable with DOWN. |
| Native keyboard closes after a keypad tap | Late blur could move the cursor back | Editor-generation guards prevent stale input/blur from changing new state. |
| Close one form and quickly open another | Old keyboard/input events could move or overwrite the next form | Workbench-generation guards isolate form lifetimes. |
| Long table / keyboard-constrained form | `max-height` did not establish the required scroll viewport | Fixed, bounded scroll height; results scroll into view; compact keyboard layout retains fields and close action. |
| Close/reopen Table | Parameters reset to defaults | Local calculator form drafts retain the last entered parameters. |
| Rapid keypad input / immediate leave | One synchronous state write per key | Writes are debounced and flushed on hide/unload; disposed-page events cannot write over restored state/history. |

## Evidence

- Live baseline reproduction: E=5 with physical 2/E/3 keys produced 2000.
  The same actual key sequence after repair produced `2(E)3 = 30`.
- For cursor=2 in `12+34`, the old visible cursor x coordinate was approximately
  100.08px while the expression started at 43.67px. After repair it was 65.67px,
  exactly after the rendered `12` prefix (22px), not after the full expression.
- `test-cw-adversarial.mjs` adds 21 independent numerical, lifecycle, persistence
  and layout cases. Phone/tablet size checks are metadata fixtures, not devices.
- `test-devtools-cw-adversarial.cjs` runs ten expanded native simulator flows.
  It scrolls menus before tapping clipped items, compares actual caret geometry,
  reaches row 45 / x=44 / y=1936 in the rendered Table, and verifies cold restore.
- A 330px keyboard-height event is injected for layout checking; no physical
  keyboard or iPad was used. That evidence must not be relabelled as device QA.
- The original 11-step CW simulator journey remains a separate regression suite.
- Both live scripts back up and restore only calculator history/state. The new
  tests use explicit fixtures and do not depend on the learner's saved defaults.
- Existing history is preserved, not silently rewritten. Results produced by
  affected old key/precedence paths should be recalculated with the corrected
  input. An old `2E3` string cannot reliably reveal whether it came from the
  variable key or a deliberately typed scientific literal.

## Test harness repairs

WXML `block` nodes meant a direct-child selector could miss visible text. The
probe confirmed the cursor and text existed; descendant queries now inspect the
rendered text. Repeated navigation to the already-open Home page could also
stall the automation response; the harness reuses that page. Waits are bounded,
and test state is restored on failure. These are harness changes, not product
defects counted as repaired student features.

## Commands

```powershell
npm run test:all
node scripts/test-devtools-cw-calculator.cjs
node scripts/test-devtools-cw-adversarial.cjs
```

Optional `CW_RETEST_SCREENSHOT_DIR` captures actual WeChat simulator evidence.
The local evidence directory is
`D:\CodexWork\qa-artifacts\stemist-calculator-20260906\retest`.

## Remaining acceptance boundaries

This is still a learning implementation, not complete Casio firmware. Physical
iPad, real soft-keyboard/large-font behavior and all other mini-program modules
are outside the confirmed device coverage of this pass. Passing these cases
does not mean every possible product interaction has been exhaustively tested.

## Primary references

- [Casio input rules and omitted-multiplication grouping](https://support.casio.com/global/en/calc/manual/fx-570CW_991CW_en/inputting_expressions_and_values/basic_input_rules.html)
- [WeChat scroll-view fixed-height requirement](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html)

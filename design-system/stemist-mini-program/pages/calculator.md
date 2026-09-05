# fx-991CW learning calculator override

Approved request: replace the rejected four-column generic calculator with a
native Casio-style calculator for international high-school students.
Reference model: international fx-991CW (not ES PLUS or the regional 2nd edition).
Date: 2026-09-06, Asia/Shanghai.

## Visual and interaction spec

- The surrounding STEMist header and upper-right Coach remain unchanged.
- This module deliberately overrides the white-card master: graphite instrument
  body, light green LCD, amber second-function legends, round charcoal keys.
- Preserve the official control arrangement: ON/HOME/cursor cluster, SETTINGS/
  BACK/OK, SHIFT/VARIABLE/FUNCTION/CATALOG/TOOLS; two six-column scientific rows;
  four five-column numerical rows ending in FORMAT and EXE.
- Do not hide scientific keys behind a separate expandable keyboard. Portrait
  phone keeps the instrument intact; tablet keeps the same key positions at a
  bounded instrument width, with history as a separate side panel.
- Minimum hit area 44px and spacing 8px. Key legends may be visually smaller,
  but the entire key cell is interactive. Do not scale the whole UI to fake fit.
- All visible keys must do something supported; no invented official licensing,
  solar/battery state, QR service or claim of complete Casio firmware emulation.
- This is a STEMist learning implementation with Casio key conventions, not a
  Casio-issued emulator. Put the scope/attribution in an About menu, not a wall
  of implementation text on the student's screen.

## Implementation / tests

1. Extend the safe parser for multi-argument fractions/log/root/combinatorics,
   variables and bounded f/g functions. No eval, Function, ROM or remote script.
2. Add CW keypad metadata, menu/navigation state, result formats and template
   inputs; preserve old Ans, memory, cursor and history behavior.
3. Implement Calculate, Table, Equation, Statistics, Ratio and Base-N workspaces
   with explicit supported ranges, not placeholder icons for missing apps.
4. Render the native WXML/WXSS instrument; verify actual button geometry and
   mathematical operations in the WeChat runtime, then run the full suite and CI.

## Primary sources

- [Casio product / front view](https://www.casio.com/intl/scientific-calculators/product.FX-991CW/)
- [CW user guide](https://support.casio.com/global/en/calc/manual/fx-570CW_991CW_en/)
- [Key behavior](https://support.casio.com/global/en/calc/manual/fx-570CW_991CW_en/before_using_the_calculator/getting_started.html)
- [FORMAT](https://support.casio.com/global/en/calc/manual/fx-570CW_991CW_en/changing_calculation_result_format/using_the_format_menu.html)

Existing MIT key metadata from Claxer remains attributed, but its ES PLUS layout
is not treated as the CW layout. A fresh GitHub search found that the MIT repository
2505022-coder/basic-calculator at 9d419a5d14097d100a46e1172bf330bfcdddabd9 only
contains an archive with license/git configuration, not calculator source; it
cannot provide the requested implementation. Unlicensed same-name projects and
BrentFarris's QR parser are not imported as calculator engines.

# Calculator touch cursor

Windows date: 2026-09-07, Asia/Shanghai.

## Behavior

- Tap the LCD expression to move its insertion caret. Digit halves resolve to the nearest valid stop; fractions, nested fractions, roots, powers, log bases and empty slots use their own semantic rows.
- Natural-math touch selection works in Calculate, Complex and the Solver equation editor. It does not change Solver's separate initial-value controls or native keyboard fields.
- Tapping a previously calculated expression edits that expression; the next digit does not silently begin a new calculation. Moving the caret does not change the expression, Ans, memory, variables or calculation history.
- Arrow keys and SHIFT remain available. Cursor and expression use the existing saved-state format and restore after leaving.
- Dragging still scrolls. Multi-touch, long press, cancellation and delayed measurements after navigation, typing, scrolling or a newer tap cannot steal the caret.

## Implementation

The existing native layout pass emits a logic-only hit map from the same slot tree as the renderer. It is not sent through `setData`, persisted, fetched from a server, or recalculated for every possible cursor position. Coordinate taps perform one bounded selector query. Short-expression `min-width` must not be treated as a font scale.

WeChat touch client coordinates and `boundingClientRect` are viewport-relative; page-coordinate events subtract the viewport scroll offset. The content rect accounts for nested LCD scrolling. Coordinate-free element activation, as emitted by DevTools, resolves a glyph from the current layout; it never accepts an externally supplied cursor index. Render revisions reject stale events.

## Verification

- `npm run test:all`: passed, including WXML/WXSS compilation and existing Solver, SHIFT, Complex, source-data and phone/tablet-profile regressions.
- New `test-cw-touch-cursor.mjs`: passed numeric/symbol boundaries, nested templates, empty slots, both coordinate systems, scrolled/offset rects, result editing, Complex/Solver equation editing, out-of-order callbacks, hidden pages, gestures and persistence.
- New opt-in `test-cw-touch-devtools.cjs`: passed official WeChat phone simulator element taps and precise coordinate event dispatch, numerator/denominator/power editing, physical keypad continuation, swipe rejection, and leave/reopen restoration (`125+34`, cursor 3, original calculation history retained).
- DevTools test storage was memory-only. No real account, calculator history, media or network operation was used. The fixture and SDK mocks were removed afterwards.
- Screenshots were visually inspected in `D:/CodexWork/stemist-qa-cursor-20260907/`: fraction caret, power caret and restored caret. These are simulator screenshots, not physical iPad/finger evidence.
- Local Node benchmark: 481 characters, 100 layout-and-hit-test samples, median 1.79 ms and P95 3.06 ms. This is not a phone frame-time measurement.

No server, source bank, IELTS data, original image/audio, calculator evaluation engine or local AppID configuration was changed. Physical phone/iPad touch and scroll behavior remains a device acceptance item for the preview build.

## Primary references

- [Official WeChat touch event types](https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.event.d.ts)
- [Official WeChat selector-query API definitions](https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.api.d.ts)

These definitions established client/page coordinate semantics. The official local WeChat automator skill governed the isolated runtime tests and screenshots; no cache-clearing workaround was used.

# fx-991CW SHIFT 操作与外观修复

基准：国际版 fx-991CW，不混用 ES/EX 的 SHIFT CALC 键位。保留 STEMist 品牌和独立解析器，不声称 Casio 官方授权或完整固件仿真。

## 已修复

- 官方 `SHIFT + (` 等号映射进入 Solver 方程编辑，能够直接输入 `x²=2` 并求解。
- SHIFT 改为全局、单次修饰键；Solver 的选择目标、初值、运行中、结果和失败页面不会吞掉它。`SHIFT + AC` 可关机，OFF 状态只响应 ON。
- 下一键自动取消 SHIFT，重复按 SHIFT 取消；离开页面或触摸 LCD 菜单选择也清除临时修饰状态。
- 菜单中的 SHIFT 方向键不会再修改藏在菜单后面的算式；左右键按菜单层级操作，翻页与当前可见列表行数一致。
- 副功能覆盖反三角、π/e、A–F/x/y/z、带分数、n 次根、倒数、log/ln、逗号、负号、INS、度分秒与临时小数输出。
- 负号与二元减法分别编码，指数优先级不被破坏。度分秒的官方输入序列显示 `2°30′0″`，FORMAT 可转换成 `2.5` 再切回，不再默认变成 `5/2`。
- 对照官方正面图重做部分键帽图形、组合方向键及翻页摇杆；黄色副功能标注更清楚，开启 SHIFT 后显示实体机式黑底 S 并强调副功能键。48 个原生键的触控区域保持至少 44×44px。

## 当前边界

`SHIFT + x` 的 QR 联网功能与 `SHIFT + 9` 的 Complex 复数模式尚未实现。本轮补齐对应的真实标注和明确失败态，不会静默输入普通 `x` 或 `9`。矩阵、分布等未完成模式仍不宣称可用。

## 测试与复现

- `npm run test:all`：完整回归通过，包含新增 `scripts/test-cw-shift.mjs`。
- `scripts/test-cw-shift-devtools.cjs`：通过微信官方工具实际点击 390×753 模拟器中的按键，没有用私有求解方法替代关键按键序列。
- `SHIFT → sin → .5 → EXE` 得到约 30°。
- `HOME → Equation → Solver → x → x² → SHIFT → ( → 2 → EXE` 后选择目标和初值，得到约 1.4142135623746899，残差约 4.51e-12。
- 结果页 `SHIFT → AC → ON` 通过。
- `2°20′30″ + 0°9′30″` 的实体按键序列得到 `2°30′0″`。
- 48 键的真实宽高和水平边界通过检查。正常态、SHIFT 态、Solver 结果和度分秒截图在本机 `D:/CodexWork/qa-artifacts/cw-shift-runtime-20260907/`；测试结束恢复原有计算器状态和历史。
- 手机模拟器点按与已有设备分类/响应式契约通过，不等同于真实 iPad、最大字体或 VoiceOver 全量验收。

## 官方参考

- [国际版 fx-991CW 正面图](https://www.casio.com/intl/scientific-calculators/product.FX-991CW/)
- [SHIFT 标注、状态与菜单规则](https://support.casio.com/global/en/calc/manual/fx-570CW_991CW_en/before_using_the_calculator/getting_started.html)
- [度分秒输入与格式转换](https://support.casio.com/global/en/calc/manual/fx-570CW_991CW_en/changing_calculation_result_format/sexagesimal_conversion.html)

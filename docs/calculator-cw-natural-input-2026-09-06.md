# CW 自然输入修复与验收

日期：2026-09-06，Asia/Shanghai；项目：stemist-miniprogram。
基线提交：c6300ad38602e1e237cac5979b8a1600f4af6c02。

## 本轮修正

用户截图中的 Fraction 底部表单不符合 fx-991CW 的数学输入方式。
此前测试虽然验证了分子/分母表单能计算，但没有验证真实按键交互，
所以不能作为操作还原的验收证据。

分数、带分数、根号、任意次根、指数、对数底数、排列组合和度分秒现在
使用 LCD 内的数学输入格与计算器按键。普通数学输入不打开表单或系统
键盘；可选文本键盘只保留在 TOOLS 中。UI 仍是原生 WXML/WXSS。

输入树由原始算式派生，空格、上下层与光标共用同一份结构。已有算式、
变量、Ans、历史与未完成草稿不做破坏性迁移。新增的 mixed(a,b,c) 由本地
安全解析器计算，不使用 eval、远程代码、ROM 或额外第三方依赖。

## 按键契约

| 学生操作 | 预期 |
| --- | --- |
| 分数 → 7 → ↓ → 3，或 7 → 分数 → 3 | 屏幕显示上下排列的 7/3 |
| 分母输入完成后 → | 离开分数，继续运算 |
| SHIFT + 分数 → 2 → → → 1 → ↓ → 3 | 带分数 2 1/3 |
| √ → 9 → → → + → 1 | 根号外继续输入，结果 4 |
| SHIFT + √ → 5 → → → 32 | 五次根号 32，结果 2 |
| (1+1) → xʸ → 2+2 | 指数整体为 2+2，结果 16 |
| 2 → xʸ → 3 → → → x² | 对整个 2³ 平方，结果 64，而非 512 |
| 位于分数前，SHIFT + DEL → √ | INS 把右侧整个参数纳入根号 |
| SHIFT + ←/→ | 跳出当前模板的左/右边界 |
| EXE / SHIFT + EXE | 正常结果 / 本次小数结果，保留精确 Ans |
| FORMAT | 修改结果显示，不修改数值或后续计算设置 |
| 空分母 → EXE | 定位未填写的输入格，不把它当作零或生成历史 |

## 验证结果

- `npm run test:all`：通过，包括原生练习、账号、Coach、设备、相机、页面
  契约与 Windows 本机的微信 WXML/WXSS 编译器。
- 新增 `scripts/test-cw-natural-input.mjs`：20 项通过。
- 既有计算器回归：页面 10 项、CW 核心 12 项、独立反例 21 项通过。
- 微信 DevTools：原有完整流程 11 组、独立反例流程 10 组通过，均未捕获
  运行时异常。自然输入脚本 9 组通过，验证真实按键、上下格、INS、指数、
  符号边界及恢复；该轮运行时异常为 0。
- 实际窗口 390×753；48 个按键均不小于 44px，EXE 底部 719.17px。
- 截图发现结果出现后上方算式的分母被裁切；已调整两行排版，并增加
  对输入 glyph、结果区与 LCD 边界的真实几何断言。
- 调试重编译期间旧 Page 句柄可能失效；自动化启动阶段重新读取当前页，
  使用有上限的等待和阶段诊断，不以无限重试隐藏失败。

真实 DevTools 截图保存在本机，不进入小程序上传包：

`D:\CodexWork\qa-artifacts\stemist-calculator-20260906\natural-input\`

- `fraction-inline-slot.png`：分母为空时的原生输入格。
- `two-fractions-editing.png`：连续输入两个分数。
- `nested-fraction-editing.png`：嵌套分数与内部光标。
- `exponent-editing.png`：指数中的 2+2。
- `fraction-standard-result.png`：完整的 1/2+1/3 与 5/6 结果，无裁切。

## 验收边界

本轮修复的是 Calculate 的数学输入和结果切换，不等于完整 Casio 固件
兼容认证。Statistics/Table/Equation 等已有工作区仍有与真机不同的
表格/表单编辑方式；复数、矩阵、分布和 Spreadsheet 未补齐。Standard
目前保留可可靠表示的简单分数，其余显示数值，不伪造精确根式或 π 表达式。

本轮实机软件验证是微信手机模拟器；设备分类/键盘预算契约覆盖手机与
iPad，但没有把它当作物理 iPad、最大字体或真机微信的验收结论。
测试在完成或失败后恢复用户计算器本机状态和历史，不改变 AppID、账号、
项目配置、后端或生产服务器。

## 官方依据

- [自然数学输入与 INS 参数捕获](https://support.casio.com/global/en/calc/manual/fx-570CW_991CW_en/inputting_expressions_and_values/inputting_an_expression_using_natural_textbook_format.html)
- [分数输入序列](https://support.casio.com/global/en/calc/manual/fx-570CW_991CW_en/basic_calculations/fraction_calculations.html)
- [幂、根式及倒数](https://support.casio.com/global/en/calc/manual/fx-570CW_991CW_en/basic_calculations/powers_power_roots_and_reciprocals.html)
- [Standard、Decimal 与 SHIFT EXE](https://support.casio.com/global/en/calc/manual/fx-570CW_991CW_en/changing_calculation_result_format/standard_and_decimal_conversion.html)
- [对数底数的输入方式](https://support.casio.com/global/en/calc/manual/fx-570CW_991CW_en/advanced_calculations/function_analysis.html)

# 计算器优化验收

系统日期：2026-09-05，Asia/Shanghai。

## 交互与视觉

- 手机默认显示常用键；函数和记忆按需展开，历史单独查看。iPad 横屏使用函数/数字双栏，不按手机宽度等比放大。
- 主色收敛为浅灰和紫色，仅 AC 使用轻量警示色。复用紧凑版共享 Header，保留右上角 AI Coach。
- 算式和结果分开；光标按钮可编辑算式中间，长结果可横向查看。
- SHIFT 会显示即将执行的第二功能，用完自动复位。
- 连续计算使用完整精度 Ans，而不是屏幕上舍入后的文字。
- M+/M− 计算当前算式；无效算式不更改记忆。历史保留当时的 Ans 输入，避免重放算出不同结果。
- 算式、答案、角度单位和记忆可恢复；清空历史需要确认。

## 验证

- `npm run test:all`：PASS，包括 10 项新计算器页面行为回归、数学解析器和微信 WXML/WXSS 编译。
- `node scripts/test-devtools-calculator.cjs`：6 段真实 SDK 操作 PASS，运行异常 0。
- 390×753 开发者工具窗口：20 个常用按键均至少 44×44px，等号底边为 596px，无须滚动即可点击。
- 实际点击验证精度延续、光标插入/删除、SHIFT、M+ 和定义域失败状态。
- iPad 设备规则/横竖屏 CSS 已检查，但没有把手机模拟器结果视为 iPad 真机验收。

## 参考与边界

参考 Casio 官方的 [Ans 和独立记忆说明](https://support.casio.com/global/en/calc/manual/fx-570ESPLUS_991ESPLUS_en/basic_calculations/memory_functions.html)及[历史重放说明](https://support.casio.com/global/en/calc/manual/fx-570ESPLUS_991ESPLUS_en/basic_calculations/calculation_history.html)。这是 Stemist 的科学计算工具，不是官方模拟器，也不声称覆盖 Casio 的全部矩阵、复数、方程等模式。保留上游按键元数据的 MIT 许可证；不引入动态代码执行或远程计算服务。

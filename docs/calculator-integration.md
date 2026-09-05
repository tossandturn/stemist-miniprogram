# 计算器入口与公开项目审查

审查日期：2026-09-05（Asia/Shanghai）

## 结论

小程序的第四个首页入口是 **Casio 计算器**。按键分组已从 MIT 许可的公开项目 `Claxer/CASIO-FX-991-ES-PLUS` 以声明式数据形式导入，许可证、上游地址与固定提交号保存在 `third_party/claxer-casio-fx-991-es-plus/`。实现仍采用 Stemist 原生页面和本地安全表达式解析器，不把第三方网页、ROM 或 Electron 包塞进小程序，也不把页面包装成 Casio 官方产品。

已接入的能力：四则运算、括号、幂、阶乘、百分比、平方根、三角函数与反三角函数、log/ln、π/e、Ans、记忆寄存器、DEG/RAD、历史记录。算式只在本机计算，不发送给 AI 或服务器。

最新交互与验收见 [计算器优化验收](calculator-qa-2026-09-05.md)：常用键一屏可达、科学函数按需展开、光标编辑、精确 Ans 连续运算、记忆计算与历史上下文恢复。

## GitHub 审查记录

| 项目 | 许可证 / 活跃度（审查时） | 处理决定 |
| --- | --- | --- |
| [Claxer/CASIO-FX-991-ES-PLUS](https://github.com/Claxer/CASIO-FX-991-ES-PLUS) | MIT；公开的 Casio fx-991ES Plus 风格界面；审查提交 `c80addc72aa02fa7bb33104fff25cdc348fa5d05` | 已导入按键分组与 SHIFT 第二功能的声明式映射，并保留 MIT 许可证。原项目用 `Function()` 执行用户算式且引用外部字体，因此不导入其执行器、HTML、字体与 Electron 代码。 |
| [mondalsurojit/Casio-fx-991ES_Plus](https://github.com/mondalsurojit/Casio-fx-991ES_Plus) | MIT；公开的 HTML/CSS/JS 原型 | 仅参考 DEG/RAD、历史和科学函数。源码使用 `eval`，不直接引入。 |
| [jlenoble/casem](https://github.com/jlenoble/casem) | MIT；老旧的 Casio 模拟器 | 不适合微信运行时和当前产品 UI；不引入 ROM/桌面依赖。 |

## 安全与许可证边界

- 不执行用户输入的 `eval` / `Function()`，避免把算式变成任意 JavaScript。
- 不加载 Google Fonts、远程脚本、第三方 iframe 或外部计算服务。
- 当前 `utils/calculator.js` 是独立解析器；运行包仅包含上游的安全按键元数据移植与许可证，不包含其动态表达式执行器。公开链接和固定提交号保留在本文件中，便于复核来源。
- 页面文案使用“熟悉的科学计算器按键布局”，不暗示官方授权或官方模拟器。

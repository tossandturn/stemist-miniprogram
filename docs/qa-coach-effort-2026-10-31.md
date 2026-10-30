# Coach 思考强度与场景默认值验收

## 结论

自动化及原生模拟器验收 **PASS**。后端已部署；客户端候选版本 **1.0.77** 待官方上传回执确认。开发版上传不代表已设体验版、提交审核或正式发布。

默认分工：步骤提示、酒馆 low；完整解答、检查作答、整卷阅卷 high；申请顾问／雅思老师的简短问答 low，规划、文书／作文分析或长输入 high。学生可逐用途选择 low/high/max 或恢复“按场景推荐”。手动选择优先，不跨用途串档；max 不自动启用。

## 固定版本

- 客户端运行时代码：`b06809ef0782a2db4766b2d8eab3437518be398a`。
- 候选包：`D:/CodexWork/chapter-mistake-coach-20261029/development-1.0.77-ready-r2`。
- 运行时清单 SHA256：`c6ac4d2aa431bf980bd5d4bcb01911d064f58bf9b47bdd793318238c163d0766`。
- 主包 1,964,334 字节；余量 132,818 字节，仍满足 128 KiB 门槛。
- STEM 后端：`a5185e11e37a679ad744e118ad87d8de84b294d2`，7 个运行模块精确哈希复核一致。新增整卷档位列为可重复执行的可空增量迁移，已做私有备份；回滚代码保留该列，不回灌旧库覆盖新数据。

## 验收证据

- 完整客户端 `npm run test:all` PASS；后端 50/50 套件；固定候选包 53/53 套件。
- 5 组原生选择器检查：场景默认、切换用途、个人记忆、恢复推荐、max 映射、原生触摸高度 44px。通过官方自动化调用原生组件事件；没有冒充实机滚轮操作。
- 8 组真实功能检查：拍题提示 low、完整解答 high、申请规划 high、雅思短问答 low、酒馆 low、整卷选图／上传／完成。捕获的出站参数与界面设置一致；仅记录路径和档位，不记录授权头或图片正文。
- 整卷任务返回的 canonical `reasoningEffort=high`，报告包含有效题目，档位锁定。
- 1 组真实中断恢复：收到服务端接单确认后取消客户端等待；随后把个人偏好改成 low，原任务仍以 high 恢复。重试 POST 次数为 0，完整答案恢复，未再次发起生成。
- 6 次同题图 low/high/max 对比均完整返回，结果核验一致；约 5.7–8.8 秒。另一次原生页面测试提示约 5.2 秒、完整解答约 6.2 秒。这些是小规模合成桌面样本，不能承诺实机耗时。
- 原生运行错误 0，HTTP 失败 0；测试图片移除 2 个，整卷本机输入余留 0，原本本地存储已恢复。
- 只读复核：STEM 与 IELTS HTTPS 均 200，服务稳定，swap 0.71%，可用内存约 2.29 GB，磁盘空闲约 21.47 GB，I/O wait 三次样本 0%、0%、1%。IELTS PID、重启次数和源码哈希未变。

证据目录：`D:/CodexWork/coach-effort-choice-20261030`，重点文件 `verification.json`、`native-controls.json`、`native-feature-flows.json`、`native-recovery.json`、`comparison.json`、`final-health.json`、`wechat-upload-receipt.json`。

## 边界与未验证项

- 真实 Android/iPhone 滚轮、键盘、弱网长请求以及 iPad/Pencil：NOT VERIFIED。未扩大真实支付测试或改免费次数规则。
- 首次原生选择器检查在属性刷新前断言失败；增加等待原生渲染完成后重跑通过，首次失败保留在 `native-controls-first-attempt.json`。正式包没有因此改写运行代码。
- 不把 high/max 视为正确率保证；不展示模型内部思考。独立 IELTS 写作／实时口语服务、支付配置、密钥和全局模型配置均未改动。
- 原始开发者工具 `project.config.json` 保持原 SHA；只配置了生成候选包的 AppID。

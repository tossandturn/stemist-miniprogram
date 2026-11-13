# 微信 AI 通用学习导航本地验收清单

> 历史来源候选：本文件记录 `c8f605b` 在 1.0.86 基线上的验收。1.0.93 的合并、知识库 1.1.0、Coach 按需补图和最新包体证据见 `docs/ai-mode-integration-2026-11-13.md`。

版本：2026-11-12

## 代码基线

- Worktree：`D:\CodexWork\stemist-miniprogram-ai-entry-20261112-current`
- 分支：`codex/general-ai-entry-20261112`
- 独立 IDE QA 副本：`D:\CodexWork\stemist-ai-entry-qa-20261112`
- 基线提交：`db84e999946713d0de278d22593858f542c9fc6c`
- 1.0.86 运行时代码提交：`4a4a5ddbfec48b7ec04f43b2efcfdee716e2ad90`
- 1.0.86 上传清单 SHA-256：`15f73088c9117b0b42767c6ba7a51079a8fd0bfa1c6cd0398c806c99d38c775d`
- `db84e99` 相对 `4a4a5dd` 仅修改 `docs/coach-agent-access-acceptance-2026-11-02.md` 和 `releases/development.json`。
- 1.0.86 只确认开发上传成功；`publicReleasePerformed=false`，不称为正式发布。

## 官方参考

- `wechat-miniprogram/ai-mode-demo` 默认分支 `master`，固定参考 `240d61873714c0e488df95529df160a12d4f131f`，MIT。
- `wechat-miniprogram/ai-mode-skills` 默认分支 `master`，固定参考 `9bd1f25a7051ff137206f15251f716536f8409e9`，MIT。
- 微信开放文档 `guide.md`、`integration.md`、`evaluation-guide.md`，读取日期 2026-11-12。
- 参考内容只用于契约与测试设计；未复制官方示例业务代码或素材。

## 知识库上传清单

官方公开文档确认支持 PDF、DOC、DOCX、PPT、PPTX、TXT、MD、XLSX；最多 10 个文件，单文件不超过 10MB。来源：`https://developers.weixin.qq.com/miniprogram/dev/ai/integration.md` 第四节，读取日期 2026-11-12。

本地生成文件：

1. `knowledge-base/stemist-01-product-and-scope.txt`：1012 字节；SHA-256 `e953be9233bbbba2fd38c5ad01373aaf025b5c1a37cac49bfc96c56ed5e4d802`
2. `knowledge-base/stemist-02-course-navigation.txt`：3607 字节；SHA-256 `35d9b67e1d042b00aa5cbd4c306ddf7cf989539a80524a9a5a179f91b0f769bc`
3. `knowledge-base/stemist-03-operations-faq.txt`：3007 字节；SHA-256 `0d915e63148aa0e379756d5f664bf5a29e2b7e19af936ec3c338040b9c5c5a37`
4. `knowledge-base/stemist-04-account-privacy-ai-boundaries.txt`：1440 字节；SHA-256 `65599f50b4ea92e2a29ecff64203752269a99f3e64fc7db61130a7e4da75d72d`

上述格式和大小限制已由公开文档核实。文件尚未上传到公众平台，解析、切片、召回和审核状态均未验证。

## 评测文件

- 文件：`evaluation/ai-mode-learning-navigation.json`
- Intent 总数：50
- 正例：42
- 负例：8
- 维护源中复杂用例：25
- 未注册用例：2（公开学习服务导航 1 条、学习记录页面导航 1 条）
- API 覆盖：`discoverLearningOptions`、`openLearningDestination`
- location/time 标签：0。产品没有定位或日程服务，不为通过检测虚构标签。

`private_data` 用例只导航到原生记录页面，Skill 不读取或返回记录内容。微信平台预检可能判定它不构成私有数据查询并移除标签；本地数量检查不等于官方预检通过。

## 本地验收

- [x] `npm run generate:ai-learning`
- [x] `npm run test:ai-mode`
- [x] `npm test`
- [x] `npm run test:device`
- [x] `npm run test:image`
- [x] `npm run test:pages`
- [x] `npm run test:wechat`
- [x] `npm run test:package-minification`
- [x] `node scripts/build-native-package.mjs --check-only`
- [x] `npm run test:all`
- [x] `git diff --check`

`test:wechat` 已通过仓库内 WXML/WXSS 编译检查。候选 `project.config.json` 已把公开调试基础库从 3.8.8 升至 3.16.2，满足官方 Handoff 最低版本。Clean package 检查结果：主包 1,960,077 字节，距离 2MiB 上限剩余 137,075 字节，高于项目要求的 128KiB 最低余量；`bundles/ai-entry` 为 88,753 字节，独立 `skills` 分包为 92,244 字节。

## 微信开发者工具与平台待验

- 普通编译：用 Nightly 微信开发者工具导入本 worktree，确认独立 `skills` 分包、`agent.instruction`、`page-meta.json` 和 Handoff 页可编译。
- Handoff：从小微对话执行文本 + 小程序账号卡片，点击后进入 `/bundles/ai-entry/index`；验证 query/payload、重复事件、返回与再次选择。
- 设备：手机、iPad 横竖屏验证触控、长文本、无自动跳转；拍照和口语只在目标页由用户主动开启。
- 评测插件：上传 50 条 intent 后运行文件预检、自测和生成轨迹；根据平台对 unregistered/private_data/location/time 的适用性结果调整标签。
- 知识库：上传四个 TXT，等待解析后验证产品说明与 FAQ 召回；再验证导航请求优先匹配 Skill。
- 微信评测与真机评测：需要 AI 开发模式权限、可上传版本、测试号和公众平台操作。本地未执行。

### 微信开发者工具 CLI 实测

- 已确认官方 CLI：`D:\微信web开发者工具\wechatidecli.cmd`，并读取 `agent start/tool/render` 帮助。
- 现有 IDE HTTP 服务位于 `127.0.0.1:61631`。为保护其他已打开项目，没有重启或退出 IDE。
- Worktree 保持占位 AppID。QA 副本临时使用 1.0.86 上传包的已验证 AppID，并使用唯一项目名；未输出 AppID 值。`open --project` 成功，IDE 能载入 QA 项目。
- 在调试基础库 3.16.2 下，`agent start`、参数数组形式的 `agent tool` 和 `agent render` 均返回 code 10：`cant find runtimeid by webRuntime`。这表明当前项目窗口仍未切换到开发者工具 UI 的“小程序 AI 编译”模式。
- Computer Use 已唯一定位 QA 窗口，但检测到用户正在操作该窗口，因此停止 UI 自动化，没有抢占或点击其他项目。
- 真实原子接口、Handoff 卡片点击和接力页截图仍未验证。后续需在 QA 窗口手动选择“小程序 AI 编译”，再运行同一 CLI tool/render。
- 未修改 CLI 安全设置或登录票据；未调用 preview、upload、提交评测或发布。QA 副本位于工作树外，不提交真实 AppID。

本候选不上传、不提审、不发布，也不改变支付、会员、服务器或生产配置。

# 微信 AI 导航与 Coach 按需补图集成验收

日期：2026-11-13

## 基线与来源

- 目标目录：`D:\CodexWork\ai-function-regression-20261103\client`
- 分支：`codex/coach-wechat-three-stories-20261113`
- 1.0.93 修复基线：`3ff6bf2b0e832542a08d6f2a6d55fb97574b2de0`
- 微信 AI 导航来源提交：`c8f605bf7e04ba263779c96641a65c951272366d`
- 合并方式：只应用来源增量并保留 1.0.93 的登录续期、网络恢复、剧本房间、Edexcel IAL / OxfordAQA 和包体约束；未复制 1.0.86 整包。

官方参考仍固定为 `wechat-miniprogram/ai-mode-demo@240d61873714c0e488df95529df160a12d4f131f` 与 `wechat-miniprogram/ai-mode-skills@9bd1f25a7051ff137206f15251f716536f8409e9`（MIT）。2026-11-13 重新读取微信 `integration.md` 与 `evaluation-guide.md`，Handoff 最低基础库 3.16.2、知识库格式和 50–100 Intent 要求未变。

## 当前能力

- `learning-navigator` 只负责课程体系、学科、阶段、路线和任务的分层澄清，以及用户确认后的原生页面接力。
- 入口覆盖 Cambridge、Edexcel IAL、OxfordAQA 国际 A-Level、AP、IB、IELTS、BPhO、AMC 12、ESAT、TMUA、AI Coach、学习记录、笔记和计算器。
- Edexcel IAL 与 OxfordAQA 当前只进入已核对的国际单元卷目录，不借用 CIE 章节或模拟能力。
- Handoff 缓存只保留经白名单验证的路径和字段；重复 pageId、非法入口、非法路线与 query/payload 冲突均 fail closed。
- 页面不自动付款、下载、提交作答、发送 AI、打开相机或麦克风。

## Coach 按需补图

- `diagramFormat: stem-diagram-v1` 只表示客户端可渲染安全图形。
- 默认 `diagramIntent: ask`：先返回文字；只有完整成功结果带合法 `diagramOffer` 时显示“补受力图 / 暂时不用”。
- `draw` 由学生明确点击后发送，沿用原问题、图片、历史、学科、helpIntent 和考试权限。
- `decline` 只更新当前题本机状态，零网络请求；换题、换图、换账号或清空后重置。
- 补图失败保留原文字答案；任务编号、图片上传引用和重试继续使用现有恢复机制。
- 未知 `diagramIntent` 明确拒绝，不降级为 ask。

## 知识库与评测

- 版本：`stemist-ai-knowledge-v1.1.0-2026-11-13`
- `stemist-01-product-and-scope.txt`：2573 字节
- `stemist-02-course-navigation.txt`：4110 字节
- `stemist-03-operations-faq.txt`：3487 字节
- `stemist-04-account-privacy-ai-boundaries.txt`：1440 字节
- 评测文件：50 条 Intent，42 正例、8 负例，两个原子接口均覆盖。
- 知识库说明登录非会员 PDF/答案/音频每天合计 2 份、同日同一文件缓存/续传/重试不重复计数；会员当前 28.80 元、30 天、手动续费并以服务端为准；计算器免费。
- Coach 说明为文字优先、按需询问补图；新建剧本大厅明确为《最后一道选做题》《倒悬天文馆》《第十三次落幕》三本，并保留人数、AI 补位、年龄/成人、非血腥和无需天文课外知识等边界。
- 三本新目录后端尚未部署；旧房间继续可用且不删除记录，免费酒馆普通人格列表不受影响。
- 本地交付包：`knowledge-base/stemist-ai-knowledge-v1.1.0-2026-11-13.zip`，7792 字节，SHA-256 `73001122bef85de5de428e1b31afb2279dc55ecf8570aa5ebf9fa4d40490eb85`。ZIP 只用于交付归档；微信知识库按官方格式上传其中四个 TXT，而不是上传 ZIP。

## 验证状态

- `npm run test:ai-mode`：PASS；168 个目的地、4 个知识文件、50 条 Intent（42 正例、8 负例），2 个原子接口与 Handoff 契约均通过。
- `npm run test:coach`：PASS；文字优先、完整成功后 offer、本题本机拒绝、确认补图绑定原上下文、失败保留文字和身份重置均通过。
- `npm run test:all`：PASS；最终工作树完整客户端套件 exit 0。
- `npm run test:package-minification`：PASS；主包 1,961,319 字节，余量 135,833 字节；431 个运行文件两次构建一致
- 微信 WXML/WXSS 编译：PASS（`npm run test:wechat`，由完整套件执行）。
- 微信官方 CLI 自动化服务：PASS，开发者工具在 `127.0.0.1:9570` 可连接。
- 微信官方 CLI 原子接口：NOT VERIFIED。CLI 已解析 `learning-navigator/discoverLearningOptions` 及参数，但返回 `agent compile mode is disabled`；进程错误地返回 exit 0，因此以结构化结果判失败。需要在开发者工具 UI 切换到“小程序 AI 编译”后复测。
- 卡片 Handoff、知识库平台上传/解析/实际召回：NOT VERIFIED；本任务没有上传或伪造平台结果。

本任务不连接服务器，不上传、提审、发布或修改生产配置；真实 AppID 不进入 Git。

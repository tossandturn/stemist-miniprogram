# 微信 AI 通用学习导航设计

版本：2026-11-12

## 目标

为 STEMist 小程序增加一个微信 AI 开发模式入口。入口负责理解课程体系、学科、阶段和学习任务，必要时列出真实可选项，再通过小程序账号卡片、页面蓝链和 Handoff 接力进入现有原生页面。

入口不替代现有 AI Coach，不读取或返回用户的学习记录正文、笔记正文、照片、会话、Token 或其他私有内容，不自动调用付费模型，不创建订单，不提交作答，也不自动打开相机或麦克风。

## 官方契约基线

- 微信官方 `wechat-miniprogram/ai-mode-demo`：固定参考 `240d61873714c0e488df95529df160a12d4f131f`，MIT。采用“小微文本 + 小程序卡片 → 用户点击 → 原生接力页”的 Handoff 模式。
- 微信官方 `wechat-miniprogram/ai-mode-skills`：固定参考 `9bd1f25a7051ff137206f15251f716536f8409e9`，MIT。仅参考契约和校验方法，不复制示例业务代码。
- 微信开放文档：`/miniprogram/dev/ai/guide.md`、`integration.md`、`evaluation-guide.md`，读取日期 2026-11-12。

当前契约要求：Skill 位于独立分包；全局开启 `lazyCodeLoading=requiredComponents`；`app.json.agent.skills[].path` 与 `wx.modelContext.createSkill()` 一致；`SKILL.md` 最大 16000 字节；`mcp.json` 去掉 `outputSchema` 和空白后最大 24000 字节；全局 instruction 最大 10000 字节；`_meta.ui.pagePath` 使用固定接力页；接口可返回 Handoff resolver；正文蓝链由 `outputSchema` 的 `format: page-link` 与 `x-link-text-field` 生成，不在 `content` 手写链接。

## 架构

1. `scripts/lib/ai-learning-registry.mjs` 是 AI 导航元数据的维护源，并读取现有 `utils/stemRoutes.js` 作为 Cambridge 路线事实来源。
2. 生成器输出 Skill 内注册表、普通小程序页面注册表、四份 UTF-8 知识库 TXT、上传清单和评测用例 JSON。测试要求生成结果与维护源一致。
3. Skill 暴露两个原子接口：
   - `discoverLearningOptions`：按课程体系、学科、阶段和任务筛选，返回明确目的地或需要用户选择的选项。
   - `openLearningDestination`：只接受注册表中的稳定能力 ID 与必要路线，返回固定接力页 Handoff，并在结构化输出中提供真实页面蓝链。
4. `/bundles/ai-entry/index` 展示已识别条件、缺失选项和最终目的地。用户明确点击后才进入真实原生页面。
5. `app.js` 缓存 `wx.onAgentHandoff` 的 `pageId/path/query/payload`；页面仍能仅靠 query 恢复，避免 payload 丢失导致空白。

## 导航边界

- A-Level/IGCSE：支持学科、阶段、路线和章节/真题/模拟/拍题入口。阶段缺失或同阶段存在多路线时显示选项。
- AP/IB：进入现有课程资料与练习目录，只使用真实 board/course/level 参数。
- IELTS：覆盖听说读写、整套模拟、词汇、真题与音频目录；实时口语仅进入页面，不自动开麦。
- 竞赛/入学考试：BPhO、AMC 12、ESAT、TMUA 进入真题目录，不伪装成 Topic 练习。
- 工具：AI Coach、学习进度、笔记本和计算器只做页面导航。学习记录与笔记的私有内容由既有页面和登录边界处理。
- 会员购买、支付、相机、麦克风、提交答案和模型生成均不属于本 Skill 的原子能力。

## 知识库交付

官方当前支持 PDF、DOC、DOCX、PPT、PPTX、TXT、MD、XLSX；单文件最大 10MB，最多 10 个文件。本项目生成四个 UTF-8 TXT：产品定位、课程功能导航、操作 FAQ、账号隐私与 AI 反馈边界。文件不包含真题正文、答案、音频、用户数据、价格承诺、题量承诺或授权声明。

知识库用于解释产品与导航。可执行学习动作优先由 Skill 处理；知识库不是权限来源，也不替代原生页面的登录、会员、考试和提交校验。

## 评测

生成 50 条 intent：42 条正例、8 条负例。正例覆盖两个原子接口，复杂意图不少于 30%。未注册场景包含公开学习服务导航与“我的学习记录”私有数据导航两类；后者仅导航到登录保护页面，不读取或返回记录内容。产品不提供位置或日程服务，因此不虚构 location/time 标签，最终是否需要这些专项标签以微信评测文件预检结果为准。

微信专项评测、代码上传、真机评测和发布需要有 AI 开发模式权限的 AppID、Nightly 开发者工具、测试号与公众平台操作，本地实现不会自动执行这些外部步骤。

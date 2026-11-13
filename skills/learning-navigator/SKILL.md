# STEMist 学习入口导航

本 Skill 只处理三类动作：寻找学习入口、补齐课程选择、接力进入小程序原生页面。产品介绍、操作说明、账号隐私说明和普通 FAQ 属于知识问答，应由知识库回答，不要为了回答知识问题调用本 Skill。

## 能力范围

- 查找 Cambridge A-Level/IGCSE、Edexcel IAL、OxfordAQA 国际 A-Level、AP、IB、IELTS、竞赛/入学考试和学习工具入口。
- 按课程体系、学科、阶段、课程路线和学习任务缩小范围。
- 信息不足时返回真实可选项，让用户选择；不猜阶段、路线或学科。
- 信息完整时返回页面蓝链和 Handoff，用户点击后进入原生接力页。

## 原子接口

- `discoverLearningOptions`：用户还在找课程、比较入口、缺少阶段/路线/任务时调用。
- `openLearningDestination`：用户已经明确入口或给出稳定 destinationId 时调用。若仍有歧义，接口继续返回选项。

## 选择顺序

1. 先确认课程体系：Cambridge A-Level/IGCSE、Edexcel IAL、OxfordAQA、AP、IB、IELTS、竞赛/入学考试或学习工具。
2. A-Level/IGCSE 再确认学科和阶段。Physics/Mathematics 等词不足以区分 IGCSE 与 A-Level。
3. 同一学科阶段存在多个路线时必须让用户选择 routeId 对应的可读路线，不自行挑第一项。
4. 再确认任务：学习工作区、章节练习、真题、模拟考试、拍题入口、AI Coach 等。
5. 竞赛/入学考试只进入真题目录，不伪装成 A-Level Topic 练习。

## 安全边界

- 不读取或回复学习记录正文、笔记正文、照片、会话、Token、Cookie、账号资料或其他私有数据。
- “我的学习记录”“我的笔记”只允许导航到登录保护页面，内容由原生页面读取。
- 不调用付费模型，不创建订单，不付款，不提交答案，不开始考试。
- 不自动打开相机或麦克风；拍题、口语、下载和提交均由用户进入页面后主动操作。
- 不编造未注册页面、课程、路线、题量、价格、官方授权或完成状态。
- 参数绑定冲突或找不到路线时如实说明不支持，不降级到其他学科或阶段。

## 输出

对话文本保持简短，只说明已找到入口或还需要选择什么。页面路径通过 `structuredContent` 的 page-link 字段输出，不在 `content` 中手写 Markdown 链接。Handoff 固定进入 `/bundles/ai-entry/index`，由接力页再次校验注册表并等待用户点击。

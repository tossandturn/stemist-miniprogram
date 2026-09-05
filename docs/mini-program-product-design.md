# Stemist 小程序统一产品设计与技术基线

版本：2026-09-06

## 当前修复基线

- 用户最新决定：使用小程序原生页面复用后端 API，不再以打开网页作为功能迁移。首批已改为原生的完整路径是 A-Level 章节选择、组卷、逐题原图、拍照裁剪和答案草稿恢复；详见 `native-stem-practice.md`。以下原有 WebView 条目是尚待迁移的现状，不是最终架构。
- 首页只保留四个入口和右上角 AI Coach，主要学习页删除实现说明与重复引导。
- **竞赛 / 入学考试直接进入历年真题目录**，不出现 Topic 练习、章节达标门槛或独立练习生成器。
- 真题可搜索、逐批加载、打开原卷/参考答案或进入对应试卷练习。QP/MS 配对必须指向目录内存在的同组答案文件。
- 首页手机卡片间距 12px，按钮最小高度 44px；显式覆盖微信原生按钮默认宽度，避免卡片和操作按钮挤在一起。
- 真实运行证据见 `qa-2026-09-05-runtime-fixes.md`；接口契约与设备实测的验收范围分开记录。

这份文档是小程序实现的单一设计基线。它把 `STEM Studio` 与 `IELTSist` 已有的学习闭环、视觉语言和 AI Coach 边界迁移到微信小程序，而不是重新做一个独立 Demo。

说明：通用 UI 规则检索建议了偏游戏化的深色/粉色方案，但现有 STEM Studio 与 IELTSist 的生产 token、学生认知和跨站品牌一致性优先，因此本项目明确采用现有的浅色 `#f5f6fb` + `#7357e8` 体系，不引入另一套视觉品牌。

## 1. 产品定位

小程序是统一产品的轻量入口，首页只保留四个一级入口：

`A-Level 学科 | IELTS | 竞赛 / 入学考试 | Casio 计算器`

点击入口会先静默调用 `wx.login` 换取统一短期会话；换票服务暂不可用时允许进入本机浏览/草稿模式，真正调用 AI 或同步云端记录时再给出登录恢复动作。AI Coach 是右上角固定入口，所有页面都能直接提问。

它不替代网页/iOS 的完整 PDF 工作区：

- STEM 在小程序中采用「一题一拍」，先进入原生后置相机取景页，再裁剪、AI Coach；没有相机能力的开发者工具才降级到仍限制为 `sourceType:['camera']` 的兼容调用，不打开相册。
- IELTS 入口完整映射 IELTSist 的 Dashboard、四项技能、Same‑Test、Random Exam、Vocabulary、Mine/Account、Subscription 和 AI Coach；小程序提供快速入口，完整控制仍由 IELTSist WebView 承载。
- IELTS Listening / Reading 保留文本工作区，题库、音频、文章和证据链仍以 IELTSist 为准。
- IELTS Writing 支持键入或一张手写作文照片，然后进入 IELTSist Coach；需要 Cambridge 题组、完整报告和重写工作区时可一键打开原生网页。
- IELTS Speaking 通过 `web-view` 保留 IELTSist 的实时千问 examiner、转写、评分、录音和 retest。
- STEM Topic 改为原生组卷和逐题拍照，不打开网页或 PDF 渲染器。原题图片按当前题加载并保留多页、图表及分问。整卷作答/模拟等尚存 WebView 的入口是待迁移范围，不能宣称已全量原生。

## 2. 信息架构

### 首页 Today

首页第一屏只回答：学什么、从哪里进入、AI 在哪里。账号入口置于次要位置，不展示实现过程和连接检查：

1. 品牌栏：STEMist；AI Coach 固定在右上角。微信登录静默进行，首页不放登录按钮或 AI 状态说明。
2. 四张入口卡：A-Level 学科、IELTS、竞赛/入学考试、Casio 计算器；不在首页平铺二级功能。
3. 入口失败只显示可理解的恢复提示，不把内部 prompt、provider、路由调试词展示给学生。
4. A-Level 可选择学科和阶段，再进入章节、拍题、真题、模拟、进度或笔记。竞赛直接进入真题目录，只筛选考试和试卷，不展示 Topic readiness。
5. IELTS 按“开始学习 / 四项技能 / 整套模拟 / 词汇与账号”分组。完整网页能力由对应入口承接，不再重复添加“完整工作区”和第二张 AI Coach 卡片。账号续接仍须服务端与真机验收。
6. 进入工作区后不再重复放 A-Level/IELTS/竞赛三段筛选条，只显示“当前工作区 / 切换入口”；学科和阶段才是该页真正的筛选项。

### 技能工作区

每个工作区统一使用：

`Header → Context card → Input/evidence → AI Coach → Error/result → Next action`

共性由组件提供，技能页面只传入标题、上下文、占位文案、请求上下文和提交策略。AI Coach 不再使用页面内的开发者式提示词作为学生文案。

STEM 拍照在相机前必须选择 `subjectCode + stage`，对于 9709/9231 等存在多个纸张组合的路线还必须选择 `routeId`。客户端镜像 `src/data/routeRegistry.js` 的稳定路线 ID 并把它随照片传入 Coach，防止 Physics、Mathematics、IGCSE、A-Level 和 Competition 内容被错误合并。Writing 拍照使用独立的 IELTS 上下文，不复用 STEM 路由。

### STEM 类别边界

A‑Level 学科与竞赛/入学考试共用真题目录及 Coach 组件，但入口和服务端数据族严格分离。竞赛的用户入口仅保留真题：

- A‑Level 只允许 IGCSE、AS、A2 学科路线，发送 `category=alevel`、`family=exam`；
- 竞赛入口只允许 BPhO、AMC 12、ESAT、TMUA，Competition 与 Admissions 分别发送对应 `family`；
- `category + family + subjectCode + stage + routeId` 会随拍题、真题目录和网页接续传递，服务端仍是权限与成绩唯一权威；
- 切换入口会清空前一入口的路线和 inventory 状态，避免把题库数量或学习记录显示在错误类别下。

A-Level 章节摘要读取 `GET /api/stem/routes/{routeId}/syllabus-topics`，只展示当前章节与可用数量。后台保留来源和审核状态，但不把整组诊断指标堆给学生。竞赛不请求这个接口；整卷数量来自 QP 目录，不等同于 reviewed 题组数量。

## 3. 统一视觉系统

视觉 token 与现有生产网页对齐：

| Token | 值 | 用途 |
| --- | --- | --- |
| Canvas | `#f5f6fb` | 页面背景 |
| Text | `#18213d` | 标题与正文 |
| Muted | `#66708a` | 辅助说明（白底正文对比度约 4.94:1） |
| Line | `#e4e7f0` | 分隔与卡片边框 |
| Brand | `#7357e8` | STEMist/AI Coach 主色 |
| Brand dark | `#5638c3` | 强调文字 |
| Listening | `#7657e8` | Listening 状态线 |
| Reading | `#3a9d85` | Reading 状态线 |
| Writing | `#f19a3e` | Writing 状态线 |
| Speaking | `#ed6486` | Speaking 状态线 |

卡片统一使用白底、细边框、14–20px 圆角和轻阴影。正文和控件使用受控 px 尺寸，避免 rpx 在 iPad 上成倍放大；图标不替代可读标签。

## 4. 手机与 iPad 的明确适配

设备由 `utils/device.js` 读取 `deviceType`、型号和窗口宽度，页面得到 `device-phone` 或 `device-tablet` 类；CSS 只作为第二道保障。

### 手机（设备分类为 phone，不能仅按宽度判断）

- 阅读与输入内容单列，首页四入口为 2×2 网格；左右 16px 内边距。
- 底部固定五项导航：Today / Practice / AI Coach / Progress / Account；首页本身只展示四个一级入口。
- AI Coach 固定在右上角，不能被键盘、相机裁剪区或底部导航遮挡。
- 主按钮最小 44px 高，显式覆盖微信原生默认宽度，保证卡片间距至少 8px。
- 输入框和提交动作按垂直顺序排列，键盘弹出时不遮挡提交。
- STEM 裁剪区约 650rpx 高，优先拍单题。
- 口语 web-view 使用整页纵向空间。

### iPad（系统识别为 tablet/iPad，宽度仅作回退）

- 使用宽屏顶部导航，不显示手机底部导航。
- 首页不放指标说明；入口与技能卡根据 tablet 宽度排布。
- Listening/Reading/Writing/Coach 工作区采用左侧上下文 + 右侧输入/Coach 的双栏布局。
- STEM 裁剪区约 900rpx 高，横屏优先容纳题目和图表。
- iPad 竖屏自动改单栏，不能把两个栏压缩到不可读。
- 所有辅助面板必须保持在内容之外，不覆盖题目或输入区域。
- 裁剪使用 `movable-area scale-area` + `movable-view scale-value`，缩放和拖动事件都绑定在 `movable-view`；关闭惯性，保证图表/公式定位可重复。

## 5. AI Coach 数据链路

小程序只调用服务端：

```text
页面输入
  → skillPage / photo pipeline 规范化
  → STEM: POST https://stem.ieltsist.com/api/ai/coach
  → IELTS: POST https://ieltsist.com/api/help/chat（原生快速页）或安全 WebView handoff（完整工作区）
  → 服务端鉴权、上下文绑定、provider 路由
  → 结构化/安全结果
  → 页面 result + 下一步动作
```

请求必须包括：

- `product`：`STEM Studio` 或 `IELTSist`；
- `skill`：`stem-photo`、`listening`、`reading`、`writing`；
- `stage`：`practice`；
- `inputMode` / `mode`：`text`、`typed` 或 `photo`；
- 当前真实题目/学生文本/照片证据；
- `source: stemist-miniprogram`。
- IELTS 原生快速 Coach 只用于即时反馈；需要账号历史、正式题组、完整报告、词汇本或会员状态时统一进入 IELTSist WebView，由 IELTSist 会话 Cookie 负责持久化，不把 STEM bearer token 冒充成 IELTSist 登录态。

客户端选择的 `subjectCode/stage/routeId` 只用于帮助 Coach 聚焦，不能作为权限或正式题目绑定的依据；服务端仍必须以已认证用户和权威 attempt/source 记录校验任何正式评分、历史或题库访问。

客户端永远不放 GPT、Qwen 或其他 provider key。401 清理短期令牌并提示重新登录；超时、空结果、图片过大均进入可重试失败态。Coach 返回 `local` / `offline` 时显示非 AI 警示；只有 `mode=ai` 且 `providerStatus=connected` 才显示 AI 已连接，任何状态都不宣称官方分数。

客户端请求预算与服务端视觉预算对齐：文本 Coach 最多等待 55 秒，含照片的 Coach 最多等待 60 秒；这不是无限重试，超时后仍保留原始照片和可重试入口。

## 6. 账号与草稿

- 默认入口用 `wx.login → /api/auth/wechat → code2Session` 获取短期 `accessToken`，只存 `stemistSessionToken`；用户名/密码仅作为兼容恢复路径。
- `session_key`、App Secret 和 provider key 只留在服务端，绝不返回客户端或写入 WebView query。
- 服务端通过 `WECHAT_MINIPROGRAM_APP_ID` / `WECHAT_MINIPROGRAM_APP_SECRET` 配置换票；生产只允许官方 `api.weixin.qq.com`，本地测试才允许 loopback mock。
- 文本练习草稿以 `stemistDraft:<skill>` 本地保存，收到真实 AI 反馈后清理对应草稿并保存提交摘要；降级或失败保留草稿。离开立即保存最后输入，显式退出取消延迟写入并清理私有记录。
- 身份共用，STEM 与 IELTSist 学习记录按产品边界隔离；不把浏览器 Cookie 或数据库复制到小程序。

## 7. 质量门槛

### 静态与契约

- 所有 JS `node --check` 通过。
- `npm test` 通过。
- app/page/component JSON 可解析。
- 代码和文档不包含 API key、Cookie、session token、私钥。

### 学生路径

- 手机：首页 → STEM 拍照 → 裁剪 → Coach → 错误重试。
- iPad：横屏双栏、竖屏改单栏；裁剪框和提交按钮可见且不覆盖内容。
- Listening/Reading：草稿恢复、文本提交、AI 结果和清空。
- Writing：Task 1/Task 2、打字、拍照裁剪、AI 反馈。
- Speaking：web-view 加载 IELTSist 千问口语，麦克风/业务域名失败时有可理解提示。
- 登录过期：清理令牌、提示重新登录，不能把 401 当成空分数。

### 真实环境阻塞项

- 替换 `project.config.json` 的正式 AppID（本地工具生成的 `project.private.config.json` 不提交）。
- 配置微信服务器域名和 `ieltsist.com` web-view 业务域名。
- 真机验证相机、裁剪、键盘、iPad 横竖屏、麦克风和 Qwen 实时口语。
- 提交审核前补齐隐私政策、相机/麦克风用途说明和付费/内容资质。
- `app.json` 已开启隐私检查；camera/record 不使用无效的静态 permission 字段。公众平台仍需配置隐私保护指引，并在真机首次调用时验证授权拒绝和重新授权路径。

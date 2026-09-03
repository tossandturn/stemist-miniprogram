# Stemist 小程序统一产品设计与技术基线

版本：2026-09-04

这份文档是小程序实现的单一设计基线。它把 `STEM Studio` 与 `IELTSist` 已有的学习闭环、视觉语言和 AI Coach 边界迁移到微信小程序，而不是重新做一个独立 Demo。

说明：通用 UI 规则检索建议了偏游戏化的深色/粉色方案，但现有 STEM Studio 与 IELTSist 的生产 token、学生认知和跨站品牌一致性优先，因此本项目明确采用现有的浅色 `#f5f6fb` + `#7357e8` 体系，不引入另一套视觉品牌。

## 1. 产品定位

小程序是统一产品的轻量入口：

`Today → 选择技能 → 输入真实证据 → AI Coach 反馈 → 下一步练习`

它不替代网页/iOS 的完整 PDF 工作区：

- STEM 在小程序中采用「一题一拍」，后置摄像头、裁剪、AI Coach。
- IELTS Listening / Reading 保留文本工作区，题库和完整音频/文章仍以 IELTSist 为准。
- IELTS Writing 支持键入或一张手写作文照片，然后进入 AI Coach。
- IELTS Speaking 通过 `web-view` 保留 IELTSist 的实时千问 examiner、转写、评分和 retest。

## 2. 信息架构

### 首页 Today

首页第一屏必须回答四件事：今天做什么、有哪些练习、AI 在哪里、账号是否连接。结构沿用两个网页的 Dashboard/Today 语义：

1. 品牌栏：STEMist + IELTSist learning studio + AI 状态。
2. Today hero：`Study clearly. Improve visibly.`，主行动是 `拍一题 STEM`，次行动是 `打开 AI Coach`。
3. 学习信号：本周完成、草稿、Coach 状态、下一步动作；没有真实数据时显示 0/Ready，不编造分数。
4. Continue learning：STEM Studio 单题照片入口。
5. IELTS-ist practice：Listening、Reading、Writing、Speaking 四张技能卡。
6. AI Coach：明确“evidence before advice”，缺少证据时拒绝伪造反馈。
7. Account：同一账号、产品记录边界分开。

### 技能工作区

每个工作区统一使用：

`Header → Context card → Input/evidence → AI Coach → Error/result → Next action`

共性由组件提供，技能页面只传入标题、上下文、占位文案、请求上下文和提交策略。

STEM 拍照在相机前必须选择 `subjectCode + stage`，对于 9709/9231 等存在多个纸张组合的路线还必须选择 `routeId`。客户端镜像 `src/data/routeRegistry.js` 的稳定路线 ID 并把它随照片传入 Coach，防止 Physics、Mathematics、IGCSE、A-Level 和 Competition 内容被错误合并。Writing 拍照使用独立的 IELTS 上下文，不复用 STEM 路由。

## 3. 统一视觉系统

视觉 token 与现有生产网页对齐：

| Token | 值 | 用途 |
| --- | --- | --- |
| Canvas | `#f5f6fb` | 页面背景 |
| Text | `#18213d` | 标题与正文 |
| Muted | `#6f7892` | 辅助说明 |
| Line | `#e4e7f0` | 分隔与卡片边框 |
| Brand | `#7357e8` | STEMist/AI Coach 主色 |
| Brand dark | `#5638c3` | 强调文字 |
| Listening | `#7657e8` | Listening 状态线 |
| Reading | `#3a9d85` | Reading 状态线 |
| Writing | `#f19a3e` | Writing 状态线 |
| Speaking | `#ed6486` | Speaking 状态线 |

卡片统一使用白底、细边框、18rpx 圆角和轻阴影。图标只表达技能身份，不用装饰性图标替代文字。

## 4. 手机与 iPad 的明确适配

设备由 `utils/device.js` 读取 `deviceType`、型号和窗口宽度，页面得到 `device-phone` 或 `device-tablet` 类；CSS 只作为第二道保障。

### 手机（窗口宽度 < 768px）

- 单列内容，左右 32rpx 内边距。
- 底部固定四项导航：Today / Practice / AI Coach / Account。
- 主按钮最小 88rpx 高，适合单手点击。
- 输入框和提交动作按垂直顺序排列，键盘弹出时不遮挡提交。
- STEM 裁剪区约 650rpx 高，优先拍单题。
- 口语 web-view 使用整页纵向空间。

### iPad（窗口宽度 ≥ 768px 或系统识别为 tablet/iPad）

- 使用宽屏顶部导航，不显示手机底部导航。
- 首页指标四列、技能卡两列。
- Listening/Reading/Writing/Coach 工作区采用左侧上下文 + 右侧输入/Coach 的双栏布局。
- STEM 裁剪区约 900rpx 高，横屏优先容纳题目和图表。
- iPad 竖屏自动改单栏，不能把两个栏压缩到不可读。
- 所有辅助面板必须保持在内容之外，不覆盖题目或输入区域。

## 5. AI Coach 数据链路

小程序只调用服务端：

```text
页面输入
  → skillPage / photo pipeline 规范化
  → POST https://stem.ieltsist.com/api/ai/coach
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

客户端选择的 `subjectCode/stage/routeId` 只用于帮助 Coach 聚焦，不能作为权限或正式题目绑定的依据；服务端仍必须以已认证用户和权威 attempt/source 记录校验任何正式评分、历史或题库访问。

客户端永远不放 GPT、Qwen 或其他 provider key。401 清理短期令牌并提示重新登录；超时、空结果、图片过大均进入可重试失败态。

## 6. 账号与草稿

- 当前 MVP 用已有 `/api/auth/login`、`/api/auth/register` 获取短期 `accessToken`，只存 `stemistSessionToken`。
- 正式微信发布增加服务端 `wx.login → code2Session` 适配，不向客户端返回 `session_key`。
- 文本练习草稿以 `stemistDraft:<skill>` 本地保存，提交成功后清理草稿并保存最近提交摘要。
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
- `app.json` 已开启隐私检查并声明 camera/record 用途；公众平台仍需完成隐私保护指引配置，真机首次调用前必须验证授权拒绝和重新授权路径。

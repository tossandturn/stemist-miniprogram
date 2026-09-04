# Stemist 微信小程序 v2：交互、文案与实现规范

版本：2026-09-04（Asia/Shanghai）
状态：实现基线（先定交互，再按本文件验收）

这不是一个把网页缩小的 Demo。小程序是 IELTSist 统一学习产品的轻量入口：在手机上快速完成一题，在 iPad 上并行查看上下文和证据；完整 PDF、连续 Apple Pencil 批注和长篇真题浏览继续由 iOS/网页承载。

## 0. v3 产品壳层决策（当前执行版本）

首页只呈现四个一级入口，避免把学生直接扔进一张功能清单：

1. **A-Level 学科**：IGCSE / AS / A2 的路线选择、真题和一题一拍。
2. **IELTS**：Listening、Reading、Writing、Speaking，沿用 IELTSist 的技能边界。
3. **竞赛 / 入学考试**：BPhO、AMC 12、ESAT、TMUA，和 Cambridge A-Level 统计分开。
4. **Casio 计算器**：应用内科学计算器练习；明确标注为 Stemist 工具，不冒充 Casio 官方模拟器。

点击任一入口时先静默执行 `wx.login` 换取短期 Stemist 会话；换票服务未配置或网络失败时允许进入本机浏览/草稿模式，并在需要 AI 或云端记录时给出可恢复的登录入口。AI Coach 不再藏在页面底部：所有主页面都有一个固定的 **AI Coach** 悬浮按钮，点击后进入同一 Coach 工作区。

## 1. 目标与边界

### 学生目标

学生打开小程序后 10 秒内应能回答：

1. 我今天先做什么？
2. 我是在 STEM 还是 IELTSist 学习空间？
3. AI 是否真的已连接？
4. 提交后下一步是什么？

### 输入边界

| 场景 | 小程序输入 | 提交链路 | 明确不做 |
| --- | --- | --- | --- |
| STEM（IGCSE/AS/A2） | 后置摄像头一题一拍 → 裁剪 | 照片 + route context → STEM AI Coach → 可选 attempt 同步 | 不在小程序模拟 PDF/Apple Pencil |
| STEM 竞赛/入学考试 | 后置摄像头一题一拍 → 裁剪 | BPhO/AMC/ESAT/TMUA route context → Coach | 不把竞赛题混入 Cambridge A-Level 统计 |
| IELTS Listening | 文本框记录题号、答案、听力陷阱 | IELTSist Coach → 草稿/提交摘要 | 不在小程序伪造音频播放器 |
| IELTS Reading | 文本框记录答案、原文定位、证据 | IELTSist Coach → 草稿/提交摘要 | 不把题型当成 Topic |
| IELTS Writing | 键入作文或拍一页手写稿 → 裁剪 | 四项标准反馈；无题目时只做语言反馈 | 不宣称官方成绩 |
| IELTS Speaking | `web-view` 打开 IELTSist realtime examiner | IELTSist 账号/业务域名/麦克风 | 不降级成伪造文本评分 |

## 2. 顶层信息架构

手机和 iPad 使用同一套信息架构，只改变导航密度和工作区排列。首页壳层固定为四个入口，进入后再使用统一的次级导航：

`Today → Practice → AI Coach → Progress → Account`

Notebook 是 Progress 的固定入口，也可从提交结果进入。底部导航最多 5 项；不能用一个“弹出 ActionSheet”同时冒充 Practice 和 Coach。AI Coach FAB 是跨页面快捷入口，不增加第六个底部导航项。

### 页面职责

| 页面 | 主 CTA（唯一） | 次 CTA | 必须保留的状态 |
| --- | --- | --- | --- |
| Today | `选择一个学习入口` | `打开 AI Coach`、`查看学习记录` | 微信会话状态、AI 状态、四个一级入口 |
| Practice | `选择路线并开始` | `拍一题 STEM`、四项 IELTS 技能 | route、inventory loading/error、设备布局 |
| STEM Capture | `打开相机拍题` | 重新选择路线、查看题库状态 | subject、stage、route、inventory、busy/error |
| Crop | `确认这张证据` | 重拍、取消 | 原图、裁剪框、缩放/拖动、失败原因 |
| AI Coach | `提交给 AI Coach` | 重拍/换技能、重新同步 | evidence、route、连接状态、部分结果、重试 |
| IELTS text skill | `提交并获取反馈` | 清空、恢复草稿、打开 Coach | text、draft、loading、error、result、warning |
| Writing | `提交并获取评分` | Task 1/2、拍照、清空 | prompt、text/photo、任务类型、结果状态 |
| Progress | `继续薄弱项` | 打开 Notebook、查看全部记录 | 真实提交计数、失败/待同步、空状态 |
| Account | `登录并连接学习记录` | 注册、退出、隐私说明 | session、identity、401 恢复 |

## 3. 关键交互文案（单一真源）

所有页面必须复用下表文案；不要再出现“AI ready”但实际是本地提示、或只写“请求失败”的模糊状态。

| 状态 | 学生看到的文案 | 动作 |
| --- | --- | --- |
| 未登录 | `登录后，反馈和学习记录才会回到同一 IELTSist 账号。` | `登录 / 注册` |
| AI 已连接 | `AI 已连接 · 基于当前证据反馈` | 无 |
| 本地 fallback | `本地提示 · 未调用 AI，不是正式评分` | `重试 AI` |
| 服务失败 | `AI 暂时不可用，原始证据已保留。` | `重试` |
| 401 | `登录已过期，草稿仍保留。` | `重新登录` |
| 相机权限拒绝 | `需要相机权限才能拍题；可去设置开启后重试。` | `去设置` / `稍后` |
| 空照片 | `没有获得照片，原路线仍保留。` | `重新拍摄` |
| 裁剪失败 | `裁剪区域尚未准备好，题目没有丢失。` | `重试裁剪` |
| 题库加载中 | `正在读取这条路线的真实题库状态…` | 禁止伪造数量 |
| 题库不可用 | `题库状态暂不可用；仍可拍题，提交后由 Coach 分析。` | `继续拍题` |
| 证据已保存 | `已保存到本机草稿` | 无 |
| 云端同步失败 | `反馈已显示，但学习记录尚未同步。` | `重新同步学习记录` |
| 提交成功 | `已提交 · 下一步：重做一个薄弱点` | `继续练习` / `打开 Notebook` |

## 4. 统一数据与权限链路

### STEM photo

```text
route selection
  → GET /api/stem/routes/{routeId}/syllabus-topics
  → wx.chooseMedia({ mediaType:['image'], sourceType:['camera'], camera:'back' })
  → crop (one image)
  → POST /api/ai/coach { product:'STEM Studio', skill:'stem-photo', routeId, stage, imageDataUrls }
  → render { mode, providerStatus, answer, warning }
  → authenticated only: POST /api/stem/attempts (summary, never raw image)
```

客户端的 `subjectCode/stage/routeId` 只是聚焦上下文；服务端仍是 attempt、题目、评分和权限的唯一权威。任何 401/403/404/409 都要保留照片并显示可恢复动作。

### IELTS text/photo

```text
draft (local, debounced)
  → normalized context { product:'IELTSist', skill, inputMode, stage:'practice', source:'stemist-miniprogram' }
  → POST /api/ai/coach
  → explicit AI/local/offline state
  → submission summary + next action
```

### 账号

- 当前小程序登录/注册继续走服务端短期会话；正式发布增加服务端 `wx.login → code2Session`，绝不向客户端返回 `session_key`。
- STEM 与 IELTSist 使用同一 identity，但学习记录按产品/技能边界保存。
- 退出登录清理 token、用户、临时照片、提交摘要；`401` 只清理会话并保留草稿。

## 5. 手机与 iPad 适配规则

### 手机（真实 `deviceType=phone`）

- 一列、左右 32rpx、底部五项导航；所有固定元素预留安全区。
- 主 CTA 高度 ≥ 88rpx，输入框 ≥ 88rpx；按钮之间至少 16rpx。
- 题目拍摄默认竖屏单题；裁剪框占主要首屏，确认按钮固定在可见区域之外不遮挡内容。
- 键盘出现时编辑器和提交按钮按纵向流动，不使用会盖住文本的 fixed 面板。
- 只显示核心信息；inventory 详情折叠，避免学生先看数字而不开始练习。

### iPad/tablet（系统识别优先，宽度为兜底）

- 横屏：顶部导航 + 左上下文/右输入或 Coach 双栏；题目和证据不重叠。
- 竖屏：自动改单栏，保持 48px 等效 CTA，不把两栏压缩成窄列。
- inventory、证据预览和 Coach 可并列；不显示手机底部导航。
- 小程序不接 Apple Pencil；页面文案明确引导到 iOS App，不让用户误以为触控笔已接入。

## 6. 视觉与组件规范

沿用 IELTSist/STEM Studio 生产 token，不采用通用生成器的粉色/深色替代方案：

```text
canvas    #f5f6fb   text       #18213d
muted     #66708a   line       #e4e7f0
brand     #7357e8   brandDark  #5638c3
success   #0f8668   warning    #865f1e
listening #7657e8   reading    #3a9d85
writing   #f19a3e   speaking   #ed6486
```

- 卡片：白底、细边框、18rpx 圆角、轻阴影；不要在每页重新发明阴影/半径。
- 结构性图标使用微信 `icon` 或统一 CSS/vector 图标；不用 emoji 或字符画作导航图标。
- 每个屏幕只有一个主 CTA；加载、禁用、错误、成功都有文字和可访问状态。
- 视觉反馈 80–150ms，状态切换 150–300ms；不使用会导致布局跳动的缩放动画。

## 7. 实现顺序与验收门槛

1. 先实现共享 `app-nav`、状态卡、route/inventory adapter，再迁移页面；禁止复制四份导航逻辑。
2. 先让 Today/Practice/Coach/Progress/Account 导航真实可达，再完善 STEM/IELTS 细节。
3. 每个输入页面必须覆盖：空、加载、自动保存、成功、AI fallback、401、超时、重试、返回恢复。
4. 静态门禁：`npm run test:all`、所有 JS `node --check`、WXML/WXSS 编译、无 secret scan 命中。
5. 浏览器/开发者工具门禁：390×844、iPad 竖屏、iPad 横屏，无横向溢出；真实相机和麦克风必须真机验收。
6. 数据门禁：真实 inventory 才显示数量；未审核/缺图题目只能标记 study-only 或待审核，不能进入正式成绩。

## 8. 已知发布前置条件

- 微信公众平台配置真实 AppID、request 合法域名、`ieltsist.com` web-view 业务域名和隐私指引。
- DevTools 仅用于编译/交互回归；其模拟器的“拍照”不等于真机摄像头。
- 真机至少覆盖：相机拒绝→设置→重试、裁剪缩放、低网/超时、键盘、iPad 横竖屏、web-view 麦克风。
- GitHub 公共仓库不保存 `project.private.config.json`、密钥、Cookie、session 或数据库。

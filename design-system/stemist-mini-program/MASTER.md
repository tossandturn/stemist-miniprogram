# Stemist Mini Program · Design System Master

版本：2026-09-05 v3
权威来源：IELTSist / STEM Studio 生产视觉语言 + `docs/mini-program-redesign-v2.md`

这份文件覆盖早期生成器给出的粉色、儿童字体、深色电影风方案。小程序必须看起来像同一个 IELTSist 教育产品，而不是另一套独立 Demo。

## 1. 产品气质

- 清晰、可信、学术但不冷漠。
- 先显示学习目标和真实状态，再显示装饰。
- AI 是证据驱动的学习助手，不是霓虹机器人或游戏广告。
- 手机是快速完成一题；iPad 是更宽的上下文/证据工作区。
- 首页只展示四个一级入口：A-Level 学科、IELTS、竞赛/入学考试、Casio 计算器；二级功能进入后再展开。
- A-Level 与竞赛/入学考试共用同一套前端组件，但必须显示当前入口范围，并把 `category/family/subjectCode/stage/routeId` 作为独立数据上下文传递；不能用一个混合列表替代两个数据族。
- IELTS 入口按“开始学习、四项技能、整套模拟、词汇与账号、完整工作区”分组，原生快速页与 IELTSist WebView 使用同一账号和明确的数据边界。

## 2. Semantic tokens

| Token | Value | Usage |
| --- | --- | --- |
| `canvas` | `#f5f6fb` | 页面背景 |
| `surface` | `#ffffff` | 卡片、输入、导航 |
| `text` | `#18213d` | 主标题、正文 |
| `textMuted` | `#66708a` | 说明、状态；白底正文对比度约 4.94:1 |
| `textQuiet` | `#6d758b` | 次级元数据；白底对比度约 4.60:1 |
| `line` | `#e4e7f0` | 边框、分隔 |
| `brand` | `#7357e8` | 主 CTA、AI、选中态 |
| `brandDark` | `#5638c3` | 强调文字 |
| `brandSoft` | `#f0ecff` | 选中/次按钮背景 |
| `success` | `#0f8668` | 已保存、已同步 |
| `successSoft` | `#e7f8f0` | 成功背景 |
| `warning` | `#865f1e` | fallback、待确认 |
| `warningSoft` | `#fff6e8` | 警告背景 |
| `danger` | `#b33b55` | 错误、删除 |
| `dangerSoft` | `#fff0f2` | 错误背景 |
| `listening` | `#7657e8` | Listening accent |
| `reading` | `#3a9d85` | Reading accent |
| `writing` | `#f19a3e` | Writing accent |
| `speaking` | `#ed6486` | Speaking accent |

页面组件不得引入新的品牌主色。状态不能只靠颜色，必须同时有文字。

## 3. Typography

- 使用系统字体：`-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif`。
- 页面大标题：30–32px 等效，800；手机允许 27px 等效。
- 卡片标题：16–20px 等效，700–800。
- 正文/输入：至少 15px 等效，行高 1.5–1.65。
- 状态/元数据：12–14px 等效，不低于 4.5:1 时才可使用浅灰。
- 数字指标使用稳定宽度和清晰单位，不显示伪造的分数。

## 4. Spacing and shape

- 4/8 基础节奏：8 / 12 / 16 / 24 / 32。
- 手机左右 gutter：32rpx；iPad：48px。
- Card：白底、1rpx `line`、18rpx 手机圆角 / 12px iPad 圆角。
- 轻阴影只用于主要卡片和固定导航：`0 12rpx 30rpx rgba(42,31,89,.07)`。
- 不使用多层玻璃、强发光、厚重拟物或大面积渐变。

## 5. Controls

### Primary

- 每屏最多一个主要 CTA。
- 高度：手机 ≥88rpx；iPad ≥48px。
- `brand` 紫底、白字，disabled 同时设置语义属性并降低到 0.45–0.55。

### Secondary

- `brandSoft` 背景、`brandDark` 文字、细边框。
- 不能与主 CTA 同等强调。

### Destructive

- 使用 `danger`，与正常导航/保存按钮保持空间分离，并弹确认框。

### Inputs

- 可见 label + helper，不依赖 placeholder 解释字段。
- 手机输入高度 ≥88rpx；textarea 正文 ≥30rpx。
- 键盘出现时保持纵向流式布局，不用会盖住输入的 fixed CTA。

## 6. Navigation

- 固定五项：Today / Practice / AI Coach / Progress / Account。
- 手机：底部安全区导航；iPad：顶部宽屏导航。
- AI Coach 另以右上角固定按钮提供，不挤占底部导航，也不在首页重复铺一张 Coach 卡。
- 同一层级只使用这一套导航，不混用另一套 Tab/Sidebar。
- 活跃项有颜色、背景和文字；非活跃项提供 80–150ms 按压反馈。
- Notebook/Past papers 是二级页面，不占用第六个顶层导航位。
- 首页四入口已经确定产品范围；工作区内不得再放第二套 A-Level/IELTS/竞赛分段筛选，只保留当前范围标签和返回首页的“切换入口”。

## 7. Icons and imagery

- 结构图标使用微信 `icon`、SVG 或统一 CSS vector；不使用 emoji/Unicode 字符画作为导航图标。
- 图标尺寸和线宽保持一致；图标不代替文字标签。
- 学生照片只用于其主动提交的证据，预览保留固定比例，避免 CLS。

## 8. Responsive contract

### Phone

- 单列；底部导航；内容预留导航 + safe-area 高度。
- 卡片和输入全宽；不出现横向页面滚动。
- 主要交互触点 ≥44px 等效，间距 ≥8px。

### iPad landscape

- 顶部导航；内容最大宽度 1440px；输入/证据允许双栏。
- 辅助面板不能覆盖题目、照片、裁剪框或提交动作。

### iPad portrait

- 保留 tablet 导航，但工作区回退单栏。
- 不按窄宽度误判成手机，也不显示底部导航。

## 9. Motion

- 点击反馈 80–150ms；状态切换 150–300ms。
- 仅动画 opacity/transform，不动画会导致布局跳动的宽高。
- 必须允许系统 reduced-motion；核心操作不依赖动画完成。

## 10. Release checklist

- [ ] 结构性 emoji 已清除。
- [ ] 手机和 iPad 使用同一五项信息架构。
- [ ] 390×844、iPad 竖屏、iPad 横屏无水平溢出或遮挡。
- [ ] 所有主触点满足 44px 等效尺寸和 8px 间距。
- [ ] loading/error/fallback/success/401 均有明确文字和恢复动作。
- [ ] AI/local/offline 状态没有混淆。
- [ ] 相机、麦克风、WebView 业务域名和隐私提示在真机验证。

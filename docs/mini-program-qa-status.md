# Stemist 小程序 QA 状态

更新时间：2026-09-05（Asia/Shanghai）

当前实现基线：工作树包含四入口首页、A-Level/竞赛隔离的数据范围、原生 Camera/裁剪、Practice/Coach/Progress/Notebook/Past papers/Web workspace 页面，以及完整 IELTSist 功能目录；待本次提交后的 GitHub Actions 和真实 DevTools/真机复验。

## 已验证

- GitHub `master`：上一基线为 `124ce42`；本轮修改完成后会推送新提交并等待 Actions，不把本地绿色结果直接当作远端验收。
- `npm run test:all`：契约、API 客户端、账号身份、会话清理、AI Coach 状态、STEM Coach 页面、attempt 同步、inventory、路线镜像、裁剪、设备分类、拍照流程、图片管线、页面组件和 WXML/WXSS 编译全部通过。
- 本轮新增门禁：统一五项导航、真题目录 normalization/cache、学习摘要、WebView 主机 allowlist、手机/iPad 触点尺寸与布局、正文颜色对比度；均通过 `npm run test:all`。
- 路线镜像：26 个客户端 route ID 与 STEM `src/data/routeRegistry.js` 一致，包含 IGCSE Biology 0610、A-Level、竞赛和入学考试路线。
- 生产只读烟雾：`stem.ieltsist.com/healthz`、`/api/ai/status`、9702 AS syllabus inventory、`ieltsist.com/` 均返回 HTTP 200；当前 9702 AS inventory 报告 120 个已审核可练习题组。
- 2026-09-05 生产范围复核：`cie-9702-as-physics` 返回 `ready=true`；BPhO、AMC 12、ESAT、TMUA 路线接口均可访问但当前 `verified/available=0`，因此竞赛入口会如实显示“当前以拍题/学习为主”，不会把 A-Level 题库数量冒充竞赛数据。
- IELTSist 生产深链 `#home/#sequence/#exam/#vocabulary/#mine/#subscription` 均返回 HTTP 200；`POST /api/help/chat` 的空请求按契约返回 HTTP 400，证明路由存在且不会为无输入调用 AI。

## 本轮修复

- 裁剪缩放事件绑定到 `movable-view`，启用 `scale-area`，关闭惯性并同步缩放后的 x/y，避免双指缩放失效或定位跳动。
- STEM 拍题先进入原生 `camera` 取景页并调用 `wx.createCameraContext().takePhoto`；没有相机能力的开发者工具才降级到 `sourceType:['camera']`，不自动打开相册。
- 设备 class 优先于 CSS 宽度：横屏 iPhone 不再套 iPad 双栏，窄屏 iPad mini 仍使用 tablet chrome；竖屏 tablet 自动改单栏。
- STEM 路线补齐 0610；拍照页读取服务端 syllabus inventory，数量缺失时显示“—”，接口失败不阻塞拍照。
- AI Coach 显示真实连接/本地提示/离线状态；视觉照片请求预算 60 秒，与服务端视觉 deadline 对齐。
- 高分辨率照片使用有限质量阶梯压缩，超过 4MB 时不发送超限 payload。
- 登录正确读取 STEM 响应中的 `identity`；显式退出清理账号私有证据，401 只清理过期会话并保留草稿/照片；STEM 照片 Coach 在登录后同步 provisional attempt 摘要，并核对服务端返回的 attempt ID。
- 首页入口和 Account 已接入 `wx.login → /api/auth/wechat`；服务端映射 openid/unionid，Web workspace 使用一次性 handoff，不把 bearer token 放进 URL。
- A-Level 与竞赛/入学考试共用前端组件但使用独立 `category/family`：路线选择、拍题上下文、QP 目录、attempt 摘要和进度回放均保留范围标签；IELTS 原生快捷页使用 `https://ieltsist.com/api/help/chat`，完整 Dashboard、Same‑Test、Random Exam、Vocabulary、Mine/Account、Subscription 和沉浸式控制通过 allowlisted WebView 深链进入。

## 尚未替代真机验收的项目

1. 微信开发者工具 CLI 当前未授权 `Codex` 客户端，因此本轮没有伪造模拟器截图。一次性在开发者工具安全设置允许后执行：

   ```powershell
   D:\微信web开发者工具\wechatide.cmd auth -c Codex
   ```

   然后刷新 `D:\CodexWork\stemist-miniprogram`，再验证手机/iPad 横竖屏、相机授权拒绝/恢复、裁剪缩放、真实 AI 请求和 web-view 口语。

2. 正式发布前仍需公众平台配置真实 AppID、服务器域名、`ieltsist.com` web-view 业务域名，并在真实设备检查相机、麦克风和隐私弹窗。GitHub 公共树保留通用 `touristappid`；本地 AppID 在未跟踪的 `project.config.json` 中，没有被提交。

小程序的完整 PDF/真题浏览与 Apple Pencil 连续批注仍由 iOS/网页端承载；小程序只执行 STEM 一题一拍、裁剪和 AI Coach 闭环，以及 IELTS 的快速文本/照片反馈。IELTS 正式计时、音频、完整报告、词汇和会员数据仍以 IELTSist WebView 为准。

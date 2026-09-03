# Stemist 小程序 QA 状态

更新时间：2026-09-04（Asia/Shanghai）

## 已验证

- GitHub `master`：`2dd0316`，Actions run [33810229078](https://github.com/tossandturn/stemist-miniprogram/actions/runs/33810229078) 为 success。
- `npm run test:all`：契约、API 客户端、账号身份、会话清理、AI Coach 状态、STEM Coach 页面、attempt 同步、inventory、路线镜像、裁剪、设备分类、拍照流程、图片管线、页面组件和 WXML/WXSS 编译全部通过。
- 路线镜像：26 个客户端 route ID 与 STEM `src/data/routeRegistry.js` 一致，包含 IGCSE Biology 0610、A-Level、竞赛和入学考试路线。
- 生产只读烟雾：`stem.ieltsist.com/healthz`、`/api/ai/status`、9702 AS syllabus inventory、`ieltsist.com/` 均返回 HTTP 200；当前 9702 AS inventory 报告 46 份官方配对卷、112 个已审核可练习题组。

## 本轮修复

- 裁剪缩放事件绑定到 `movable-view`，启用 `scale-area`，关闭惯性并同步缩放后的 x/y，避免双指缩放失效或定位跳动。
- 设备 class 优先于 CSS 宽度：横屏 iPhone 不再套 iPad 双栏，窄屏 iPad mini 仍使用 tablet chrome；竖屏 tablet 自动改单栏。
- STEM 路线补齐 0610；拍照页读取服务端 syllabus inventory，数量缺失时显示“—”，接口失败不阻塞拍照。
- AI Coach 显示真实连接/本地提示/离线状态；视觉照片请求预算 60 秒，与服务端视觉 deadline 对齐。
- 高分辨率照片使用有限质量阶梯压缩，超过 4MB 时不发送超限 payload。
- 登录正确读取 STEM 响应中的 `identity`，退出/401 清理账号证据；STEM 照片 Coach 在登录后同步 provisional attempt 摘要，并核对服务端返回的 attempt ID。

## 尚未替代真机验收的项目

1. 微信开发者工具 CLI 当前未授权 `Codex` 客户端，因此本轮没有伪造模拟器截图。一次性在开发者工具安全设置允许后执行：

   ```powershell
   D:\微信web开发者工具\wechatide.cmd auth -c Codex
   ```

   然后刷新 `D:\CodexWork\stemist-miniprogram`，再验证手机/iPad 横竖屏、相机授权拒绝/恢复、裁剪缩放、真实 AI 请求和 web-view 口语。

2. 正式发布前仍需公众平台配置真实 AppID、服务器域名、`ieltsist.com` web-view 业务域名，并在真实设备检查相机、麦克风和隐私弹窗。GitHub 公共树保留通用 `touristappid`；本地 AppID 在未跟踪的 `project.config.json` 中，没有被提交。

小程序的完整 PDF/真题浏览与 Apple Pencil 连续批注仍由 iOS/网页端承载；小程序只执行一题一拍、裁剪和 AI Coach 闭环。

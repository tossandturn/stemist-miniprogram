# 剧本房间网络恢复视觉验收

日期：2026-11-12，Asia/Shanghai。以下全是本地合成状态，未发版、未部署、未操作学生账号。

## 发现并修复

原生模拟器同时显示“重试操作”和“重新同步”时，原 `.room-error` 的 `max-height:140px;overflow:auto` 裁掉了第二个按钮。原截图 `native-pending.png` 可复现：旧消息和草稿还在，但恢复入口不完整。

仅修改错误区 WXML/WXSS：正文独立分组、操作按钮横排并可换行、按钮至少 44px、移除固定高度裁剪。没有修改消息、nonce、重试次数或服务端状态。新增 `test-script-room-recovery-layout.mjs`，先因缺少分组/固定裁剪失败，再修复通过；已加入 `test:script-rooms`。

## 原生证据

独立项目 `script-room-recovery-fixture-20261112`：内存合成账号、应用 `wx.request` 禁用、模拟 API 不调用生产、库存图片复制到本地 assets。当前服务端只在独立合成 SQLite 中创建房间并取得视图，没有模型请求或线上写入。

截图位于工作区 `qa/script-room-recovery-20261112/`：

- `native-paused-r2.png`：原生视口 390×753，单个“重新同步”、旧消息及草稿可见。
- `native-pending-fixed.png`：修复后的双按钮完整可见，未确认操作时发送仍禁用，旧消息及草稿保留。
- `native-stock-art.png`：当前库存的新二次元角色立绘及合影作为消息内图片显示；图片从本地 assets 载入，不访问未部署的生产 URL。
- `native-stock-legacy-final.png`：冻结的 `1.0.92 / 83b8d9f` 页面模板、样式与逻辑未改，仅注入同一合成 API/本地素材后，新库存图片同样随消息显示。这是旧客户端原生模拟器兼容证据，不是物理 iOS 图像解码或生产 URL 验收。

原生视口来自 fixture 内实际 `wx.getWindowInfo()`，显示在合成说明中；截图导出尺寸 231×497 是 IDE 缩放图像像素，不是 CSS viewport。首次冷启动虽工具返回成功却仍在首页，`native-paused.png` 保留为失败证据；检查画面后重新打开指定页才采纳 r2。

## 手机与平板布局补充

微信官方 CLI 注册表不提供模拟器设备尺寸切换；`automation_evaluate` 通道亦不稳定。因此不把 tablet-class 切换或浏览器截图冒充原生 iPad。

`qa-script-recovery-layout-20261112.mjs` 使用当前页面 presentation 状态及未经改写的 app/room WXSS，对聊天分支做浏览器布局镜像。仅补上浏览器的基础元素/scroll-view 语义，不伪装为原生 WXML 编译。Chrome 无用户 profile、headless、HTTP(S) 请求阻断；图像为本地数据。

| 合成布局视口 | 截图 | 两个恢复按钮 | 其他检查 |
| --- | --- | --- | --- |
| 390×844 | `phone-390-recovery-layout.png` | 168×44 px，各自完整落在错误区内 | 无横向溢出；草稿与旧消息保留 |
| 820×1180 | `ipad-portrait-recovery-layout.png` | 383×44 px | 竖屏、消息居中、输入区可见 |
| 1180×820 | `ipad-landscape-recovery-layout.png` | 563×44 px | 横屏、消息有最大行宽、输入区可见 |

三张均已目视检查；`layout-report.json` 保存几何断言与源文件 SHA。图中明确标识“本地合成布局验收、非原生/真机截图”。

## 状态与边界

- 本地源代码/压缩版本恢复逻辑、静态布局契约及原有 script-rooms 回归通过。
- 原生手机模拟器与三尺寸浏览器几何通过，但不是物理 iPhone、原生 iPad 横竖、VoiceOver、大字号或真实弱网验收。
- 库存图片展示证明当前客户端消息内布局，不证明未来实时生成图片的质量或生产图片 URL 已上线。
- 账号/昵称/首页公告的先前视觉证据继续保留于 `qa/auth-announcement-20261112/`，见 `qa-auth-announcements-2026-11-12.md`。本次没有覆盖或替换它们。

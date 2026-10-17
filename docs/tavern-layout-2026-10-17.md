# 酒馆排版修复与验收

日期：2026-10-17（客户端 Asia/Shanghai 日期）。

## 范围和版本

- 维护基线：本地与 GitHub master 均为 `1ef016698ee1429ae8fb99fb1c342272fe6375d3`，对应已记录的 1.0.45 开发版基线。
- 只修改酒馆 WXML / WXSS、布局回归测试与文档。角色 ID、云端记忆、请求、登录、会员、抽取与重试逻辑不变。
- 尚未上传新的微信开发版，尚未切换 CloudBase 或线上模型。Git 分支不等于微信发布。
- 本机 `project.config.json` 不纳入提交，其 SHA256 保持 `a6d9c6a9cb8c4732f591272e9f18db86c12628cb2aa5fedecd9efb97ce5705fa`。

## 原生截图确认的原因

1. 微信 style v2 的原生按钮默认宽度为 184px；旧 `.persona` 规则优先级不足。390px 窗口内每列实际只有 174.5px，因此两张卡片相互挤压。
2. 全局 box-sizing 规则没有覆盖 `scroll-view`。聊天框的 100% 宽度加上 padding / border 后变为约 379.3px，右侧超出窗口。
3. 聊天记录固定 136px 高，重复品牌/大标题又占用了顶部空间，长回复阅读困难。

## 修复

- 使用更明确的按钮选择器以及 `max-width:100%`，保留两列和触控尺寸。
- 为聊天 `scroll-view` 明确设置 border-box 和边界宽度。
- 使用紧凑标题、普通字重的卡片说明、可换行的选中角色介绍。
- 聊天高度随窗口调整并设上下限；缩短输入框、保留发送区与导航的间距。
- Safe area 统一由页面底部保留，不在多层容器反复累加。
- 保留历史翻页、回到最新、登录恢复、抽取/解读重试及减少动态效果偏好。

## 实际 WeChat DevTools 验收

隔离测试副本：`D:/CodexWork/tavern-layout-20261017-baseline`。
该副本明确标记 NOT-FOR-UPLOAD，禁用网络、登录和支付，存储为进程内 Map；没有访问真实用户记录或调用模型。
截图使用真实微信原生渲染器，聊天文本和抽取结果是明确的合成视觉测试样例，不是真实 AI 回答。

390 × 753 模拟器逻辑窗口实测：

| 指标 | 修复前 | 修复后 |
| --- | --- | --- |
| 角色卡片宽度 | 184px | 174.5px |
| 两卡实际间隔 | -0.5px（重叠） | 9px |
| 聊天框右边界 | 395.3px（越过 390px 屏幕） | 374px（保留 16px 边距） |
| 聊天框渲染高度 | 157.3px（136px + 错误盒模型） | 247.3px |
| 发送按钮 / 导航间隔 | 约 29.9px，但聊天仅一小条 | 19.2px，同时保留更大的阅读区 |

实际调用原生滚动接口后，聊天 scrollTop 为 195.3px，能够查看末尾段落；发送按钮高 48px，未被固定导航覆盖。
已截图检查角色选择、普通长回复、回复末尾和塔罗结果。

证据：

- [修复前聊天截图](D:/CodexWork/tavern-layout-20261017/baseline-chat.png)
- [修复后角色列表](D:/CodexWork/tavern-layout-20261017/final-discovery.png)
- [修复后聊天截图](D:/CodexWork/tavern-layout-20261017/final-chat.png)
- [滚动到回复末尾](D:/CodexWork/tavern-layout-20261017/final-chat-end.png)
- [修复后塔罗结果](D:/CodexWork/tavern-layout-20261017/final-fortune.png)
- [真实原生几何与断言结果](D:/CodexWork/tavern-layout-20261017/final-geometry.json)

## 自动化与边界

- PASS：先写失败的布局回归，再修复；`test:tavern-presets` 包含新布局检查。
- PASS：完整 `npm run test:all`，包括状态隔离、历史、重试、四入口、设备分类、页面及 WXML/WXSS 编译。
- PASS：最终增加导航定位 ID 后重新运行酒馆测试和原生编译；真实几何断言 `PASS_NATIVE_PHONE_VISUAL`。
- PASS：本地真题目录 fixture 审计，14 学科；这不是本次新增的题库发布验收。
- NOT VERIFIED：真实 iPhone / Android / iPad、系统放大文字和键盘弹出行为。平板及横屏分类/布局静态契约已回归，不能冒充真机截图。
- NOT DEPLOYED：CloudBase 接入、服务器变更、微信开发版上传或公众发布。

界面检查遵循现有浅色紫色设计体系及 UI 技能的触控、边界宽度、safe area、字体层级与减少动态效果规则。参考腾讯 [TDesign 小程序](https://github.com/Tencent/tdesign-miniprogram) 的原生聊天实现方向；没有复制第三方代码或安装新组件库。

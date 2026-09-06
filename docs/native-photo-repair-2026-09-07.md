# 原生照片输入修复记录

## 范围与实现

- 小程序拍照、裁剪后直接发送图像内容给多模态模型，不要求学生先 OCR、转录或核对文字。
- Writing 的打字/照片模式明确隔离。照片批改不会携带旧的文字稿；AI Coach 从当前照片模式打开时同样携带照片，不把本机文件路径发给服务端。
- 单篇、Task 1/2 完整写作、完整模拟共用图像传输和异步批改任务。完整模拟只接受服务端已完成且属于当前用户、当前原题的 Writing job，不接受客户端自证分数。
- JPEG/PNG/WebP 按真实文件头识别，避免把 PNG 字节误标成 JPEG。压缩最多四档，单图 4 MiB 上限，`setData` 不传 Base64 大图。
- 裁剪默认保留整张照片，可以缩小、放大和重置。裁剪框与图片的实际交集决定输出，移到框外会提示恢复，不生成错误的细条图片。
- 相机/裁剪异步回调在退出后不能重新导航；照片、题目、账户和隐私版本绑定。重拍清除旧分数；网络重试只查询原 job，不重复上传；重新进入单篇/完整写作自动恢复查询。
- 分数摘要与下载入口移到长篇反馈之前。证据缺失、模型失败或低可信度结果不产生可靠分数。

## 服务端与真实模型诊断

后端候选分支 `codex/native-ielts-production` 的部署顺序：

1. `123ddc9`：原生照片直传、owned Writing jobs、云端记录、照片 Coach、完整模拟权威绑定。
2. `8ab221c`：照片异步时限与 HTTP body 截止时间；安全错误码，不暴露上游原始错误。
3. `170fc6b`：照片写作使用已配置且实测支持图像的 Qwen3.7-Plus；AI Coach 的 GPT-5.5/xhigh 配置不变。
4. `5f0bbb9`：将照片证据字段写进实际 JSON schema，并开启结构化 JSON 输出。证据字段只用于同一次模型响应的核对，不是额外 OCR 请求。

只使用已有服务端凭证，没有更改密钥或数据库 schema。每次部署均经过只读 readiness，按固定 Git SHA 和文件哈希发布，有单独代码回滚备份；没有在生产运行 npm install 或源码构建。

合成图片诊断：GPT-5.5 完整照片报告一次耗时约 142 秒，实际小程序请求另一次超过 180 秒；Qwen3.7-Plus 同类完整报告约 50–61 秒。后者读取了仅存在于图片中的 `24 computers`，并返回四项标准。这些是诊断样本，不是延迟 SLA。

## 验收证据与边界

- `npm run test:all` 已覆盖接口、权限隔离、照片归属、裁剪、断网恢复、设备分类、26 页 WXML/WXSS，以及既有 SOLVE 回归。
- 官方开发者工具实际执行了照片模式、相机快门、裁剪确认与返回原题；相机硬件由合成图片替代，AI HTTP 请求不 mock。
- `scripts/test-native-real-photo.cjs` 使用隔离账号，不输出凭证；结束后恢复原来的本机存储。评分提交通过原生页面方法触发，自定义组件按钮的真实命中区域不属于这段脚本的覆盖范围。
- 模型接收照片不等于整个评分闭环通过。曾实测发现模型漏回证据字段，系统拦截了分数；修复后仍须以 `acceptance.json` 的真实生产结果为准。
- 生产 Writing 复测通过：一张照片、空文字稿；离开再返回恢复相同 job；四项分数 9/8/8/8，练习估分 8.5，反馈 8473 字符；模型证据 2186 字符包含只在图片内的 `24 computers`。云端 owned record 返回 200、相同分数和 `studentImagesSubmitted=1`。
- 生产 STEM 拍题独立复测通过：合成照片中的 `2x + 3 = 7` 和解题过程由真实 AI 读取；返回 `x = 2`、168 字符反馈，显示“AI 已连接”和“已同步到 STEM 学习记录”。测试使用不同隔离账号，两条路径分别验收。
- Writing 截图为 `writing-feedback.png`，STEM 为 `stem-feedback.png`，位于本机 `D:/CodexWork/qa-artifacts/native-photo-acceptance-20260907/`。`latest-writing-diagnostic.json` 保留 Writing 核验数据，`acceptance.json` 为最后一次独立 STEM 测试；不把它们误称为同一次连续测试。
- 物理相机、真实手写、手机/iPad 横竖屏和网络切换不能由合成图片或模拟器代替。本次真实图片链路通过，不代表所有小程序功能或发布审核全部通过。
- 微信自动登录仍缺服务端 AppSecret 配置，不能伪造登录或权限；现有真实账号登录路径可用。

## 参考

- [OpenAI 图像输入](https://developers.openai.com/api/docs/guides/images-vision)：图像与文字共同作为多模态内容提交。
- [阿里云 Qwen3.7-Plus 模型说明](https://help.aliyun.com/zh/model-studio/qwen3-7-plus)：原生图像输入和结构化输出。
- [阿里云视觉模型](https://help.aliyun.com/zh/model-studio/vision-model/)：采用多模态视觉理解，不使用 OCR-only 模型代替批改。

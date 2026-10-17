# 酒馆通过 CloudBase 接入 DeepSeek

状态：接入方案；尚未创建收费资源、部署 CloudBase 凭证或切换线上模型。

## 保留现有产品链路

`小程序酒馆 → 现有 STEM 后端（登录、权限、限流、角色历史） → CloudBase 内置 AI → 控制台已启用的 DeepSeek 模型`

本轮不迁移题库、账号、PDF 阅卷或实时口语。酒馆仍使用现有 `/api/ai/coach` 与独立对话接口，密钥不进入小程序包。已有支付消息回调也不因此改址。

## 控制台准备

1. 使用与小程序主体一致的腾讯云账号，进入 [CloudBase 控制台](https://tcb.cloud.tencent.com/)，选择或创建对应环境；新资源的费用先确认，不自动购买。
2. 在 AI / 生文模型中启用平台内置的 DeepSeek，并确认资源包或计费资格。模型 ID 从实际控制台复制，不根据品牌名称猜测。
3. 在环境配置 / API Key 管理创建服务端使用的 Key。该 Key 属于管理端身份，必须私密保存，不能填到小程序源码、聊天、截图或 Git。
4. 保留环境 ID、实际模型 ID，以及控制台给出的服务接入地址。环境 ID 和模型 ID可以提供给开发者，Key 使用私密配置渠道。
5. 在 AI 模块获取算法合作协议，填写正确 AppID 和主体，准备算法备案截图及合作材料，再提交微信对应类目审核。

算法材料有自己的资格要求：官方说明目前要求主体一致、完成相应企业认证、环境有效期至少三个月；是否覆盖选定服务与当前账号，以实际控制台和平台确认结果为准。

如果选的是“第三方自定义模型”，只是把自己的 DeepSeek Key 配进网关，不应默认认为腾讯合作材料自动覆盖这条调用链。应优先核对实际技术服务商与材料范围，再决定接法。

## 后端改造范围

CloudBase 官方 OpenAI 兼容入口为：

```text
https://<ENV_ID>.api.tcloudbasegateway.com/v1/ai/cloudbase
```

服务端调用 `chat/completions`，使用 CloudBase API Key 和控制台已启用的 `model`。这只是已核对的接口形态，不代表当前项目已经配置成功。

- 只为 `feature=tavern` 增加可关闭的 provider 配置，学术图片、整卷阅卷、实时语音保持原链路。
- 沿用服务端会员/身份权限、按账号及角色隔离的历史、幂等消息 ID、预算与内容审核。
- 失败时保留草稿，给出可理解的错误，不泄露上游地址或原始错误；不擅自换到另一个未经同意的供应商。
- 流式调用按官方说明使用 `Accept: text/event-stream`；客户端是否流式展示需单独完成协议与取消/重试验收。
- 只有服务端到 CloudBase 的调用发生变化时，小程序仍访问现有自有域名，无须为了这条服务端调用把云端管理 Key 或网关地址放进客户端。

## 切换前的验证

- 实际启用模型的小请求、流式结束、超时/限额/取消/重试。
- 角色不串话、历史续接、账号切换、退出后迟到响应被丢弃。
- 现有免费/会员策略不被模型接口绕过；未开通功能仍拒绝调用。
- 输入输出审核、AI 内容标识、隐私告知及申报材料与真实供应商一致。
- 符合项目既有服务器部署检查并保留可回退的原 provider 配置。

## 官方参考与实现参考

- [CloudBase OpenAI SDK 接入](https://docs.cloudbase.net/en/ai/model/openai-sdk-access)
- [CloudBase API Key 的管理端权限与服务端用途](https://docs.cloudbase.net/en/http-api/basic/apikey)
- [CloudBase 大模型 HTTP 调用与流式请求](https://docs.cloudbase.net/http-api/ai-model/call-llm)
- [微信云开发在用证明与算法合作协议](https://docs.cloudbase.net/en/ai/release/algorithm-filing)
- [腾讯 TDesign 小程序组件库](https://github.com/Tencent/tdesign-miniprogram)：本轮酒馆排版参考其原生聊天组件与移动端布局思路；未复制代码、安装组件库或改变现有图标授权。

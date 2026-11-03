# AI 酒馆：玩家参与式原创剧本

更新：2026-11-03

## 参考研究与边界

- Algernon Blackwood 的《The Empty House》以空间、安静和逐步增强的异样感建立恐怖氛围；这里只借鉴“先给可观察细节、再解释”的节奏，不复制原句、人物或事件。[Project Gutenberg 原书](https://www.gutenberg.org/ebooks/14471)
- 《The Hound of the Baskervilles》把超自然传闻与可核对的现实线索并置，适合参考如何让玩家区分传闻、观察和结论；本产品的故事不使用 Sherlock Holmes、Dartmoor 或原作桥段。[Project Gutenberg 原书](https://www.gutenberg.org/ebooks/2852)
- 《Great Short Stories, Volume 1: Detective Stories》的目录包含多篇早期侦探故事，提供“线索可回溯、推理不能超过证据”的体裁参考；不复用其中角色、情节或表述。[Project Gutenberg 选集](https://www.gutenberg.org/ebooks/74548)
- [Openovel](https://github.com/Feed-Scription/openovel) 采用文件化 canon、记忆和可忽略的选择建议；仓库标注 Apache-2.0。本项目只借鉴状态组织方法，不复制代码或资产。
- [SillyTavern World Info 文档](https://docs.sillytavern.app/usage/core-concepts/worldinfo/) 与 [角色卡文档](https://docs.sillytavern.app/usage/characters/)展示了角色背景与按上下文载入世界设定的做法。本项目只借鉴概念，不引入其代码、卡片或第三方角色。

Project Gutenberg 对《空屋》及《巴斯克维尔的猎犬》的说明是美国公版判断，并提示其他地区可能不同；这里仅作研究来源，不把它们当作可在所有司法辖区自由改编或发布的法律结论。小程序新增内容均为 STEMist 原创。

## 玩家体验约定

- 用户是玩家。模型不得代写用户台词、动作、决定、已进入地点、持有物或内心感受。
- `【旁白】`只承担环境和可观察动作；`【林漪】`、`【闻笙】`、`【沈照】`等标签只承担该角色对白。角色对白里的“我”不能冒充用户的“我”。
- 每轮只推进一个短场景。遇到真正的选择点时给 2–3 个可点建议，玩家也可忽略选项自由输入；选择按钮会发送当轮选项，不会自动提交隐藏行动。
- 普通闲聊可以暂停剧本，不能强迫用户进入剧情。
- 固定 Story Bible 每轮注入服务端提示；线索只有被玩家实际检查后才算发现，证据不足就不猜。真相与人物动机不能因模型“即兴”而改写。

## 首批原创故事

### 《雨窗茶室·00:17》

主持人格是林漪，玩家是雨夜来访者。茶室曾兼作渡口信号站；断电的旧呼叫铃在 00:17 重复三短一长。玩家可检查铃、旧线路、值班簿，逐步了解失踪信号员周棠在雾夜发出的停航信号。固定真相是周棠没有遇害，她把一艘误入雾区的渡船引回安全水道；铃声是她留下的超自然回声。结局取决于玩家选择保存记录、回应信号或封存旧室，不强迫追出去。

### 《河岸档案室的第九张票》

主持人格是闻笙，玩家是临时调查员。闭馆后玻璃展台出现第九张门票影，但登记只有八人。线索包括玻璃反光、台面灰尘、慢七分钟的投影时钟和旧测试片上的双重印章。固定真相是没有第九位访客；夜班维护员罗桥用无损投影演示提醒馆方校准时间，不存在藏品盗窃。至少三条线索经玩家确认后，才在玩家要求时揭晓。

### 已有故事线的补强

- 诺米：《无名信与银翼鸟》固定为姐姐季弥留下的航线邀请。
- 沈照：《白汀渡的旧灯》围绕洪水夜的停航记录；旧告示漏掉信号发出时间，导致老渡工被误解。沈照的旧伞、返乡动机与结尾相互一致。

## 配图与实时生成

开场根据故事节点映射到图库中已有的原创气氛插画：雨窗茶室、河岸夜景、浮空城和竹林庭院。图片仍由 AI 回复契约附在对应文字下方，不伪称是当场实拍或新生成。

本次开发环境的内置图片生成工具返回 403，未能制作新的定制场景图；因此没有把现有插画冒称为“按本故事新生成”。实时绘图接口已按认证、服务端提示词、区域校验、大小限制、每账号节流及本机私有文件展示实现；优先使用专用 `TAVERN_IMAGE_API_KEY` / `TAVERN_IMAGE_BASE_URL`，也可复用现有 `DASHSCOPE_API_KEY` / `DASHSCOPE_COMPAT_BASE_URL`，但 base URL 必须经服务端校验为新加坡百炼端点。未配置时文字照常显示并明确提示失败。图像 API 的地区密钥不能跨区，生成图 URL 有时效；服务端会立即取回图片而不向客户端暴露 provider URL 或 API key。[官方区域说明](https://help.aliyun.com/en/model-studio/regions/)、[Qwen Image API](https://help.aliyun.com/en/model-studio/qwen-image-generation-and-editing-api-reference)、[官方价格表](https://help.aliyun.com/en/model-studio/model-pricing)。

体验版用户明确提出绘图才调用图像服务；当前单进程默认每账号每天最多 6 张、两次之间至少 30 秒，服务端扣费由账号所有者承担。多进程/双服务器启用前须把限流换成共享配额存储，避免各实例分别计数。需要部署端配置 `TAVERN_IMAGE_API_KEY` 与新加坡 `TAVERN_IMAGE_BASE_URL`，也可复用同区域 `DASHSCOPE_API_KEY` / `DASHSCOPE_COMPAT_BASE_URL`；本地实现不改 `.env`，也不在未配置时尝试连接供应商。

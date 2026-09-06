# 全原生迁移执行计划

用户决定：IELTS、学科和竞赛全部使用微信小程序原生页面；解决卡顿，
复用本机题库及 OCR 后处理数据。保留 AI Coach、统一身份与学习记录。
本计划取代旧文档中把 WebView 作为最终架构的条目。

## 已核实的源

- IELTS 本机主库：72 套 Listening、76 套 Reading、152 个 Writing task；
  另有 59 套 Speaking，主库约 95 MB，ASR 缓存约 46 MB。
- 生产 `/api/tasks` 已做精简和压缩，可供原生客户端复用。2026-09-06
  HEAD 响应 200、220718 字节；不是让客户端读取本机 95 MB 原始文件。
- 学科 OCR：独立工作区有原始输出、复核稿、postprocess-rendered 与
  artifacts。已有 Topic API/原题资源可复用；OCR 完成不等于审核发布。
- IELTS/STEM 生产源码仓库都有其他未提交改动，不将它们混入小程序提交。

## 学生体验与性能约束

- 首页四入口和右上角 Coach 不变；竞赛只保留真题，不迁入章节组卷门槛。
- Listening/Reading：真实试题、原图/文章、音频、文本答题、计时、恢复、
  服务端提交与复盘，不能再用一个随意填写的文本框代替试题工作区。
- Writing：题库选择、Task 1 图表、打字/拍照、异步批改和报告。
- Speaking：微信原生录音、WebSocket 音频、Qwen 对话、结束评分，不嵌网页。
- 学科：保留 IG/AS/A2 与路线；章节、整卷、模拟、拍照、批改、笔记、进度。
- 竞赛与学科共用原生真题组件，只更换数据族。
- 大库留在逻辑层/服务器；页面只 setData 当前页或当前题。列表分页、请求
  合并、失败可重试、音频/图片按需加载，退出立即取消音频和后续 UI 更新。
- 服务端成绩、真实凭证与客户端草稿分离。没有正式来源/授权时不伪造评分。
- 手机单列；iPad 横屏双栏、竖屏回退。测试设备差异，不靠全局缩放。

## 执行与验收清单

- [x] 真题目录不再全量 setData；固定 30 行分页、搜索防抖、最多缓存三个学科。
- [x] 原生 IELTS 目录和 Listening/Reading 工作区；每次只渲染当前题。
- [x] Writing 题库/图表、照片持久保存、识别确认、异步评分、反馈恢复与 PDF 下载。
- [x] Speaking 原生录音/播放/实时会话及安全退出实现，传输层通过模拟测试。
- [x] 整套模拟、词汇、目标/记录/会员的原生页面和服务调用实现。
- [x] 学科/竞赛共用原生整卷与逐题照片组件，原始 PDF 使用微信文档查看器。
- [x] 本地 OCR/题库审计；本轮不启动 OCR、不放宽审核/6/12 门槛。
- [x] 所有学习入口无 WebView；遗留站内链接转原生目标。
- [x] 单测、WXML/WXSS 官方编译器、开发者工具九条原生入口/工作区路径。
- [x] 两个服务端原生接口按现网基线独立修改、测试、GitHub 分支同步并部署。
- [ ] 手机/iPad 真机长会话、相机、麦克风、键盘/旋转与实际帧率验收。
- [ ] 下方网页全功能对照缺口完成后，才允许称作全功能迁移完成。

最终验收以真实功能为准，不能只把入口标成 native 或删除旧按钮。

## 本轮证据

- 全套 `npm run test:all` 通过，含 25 页路由/绑定/官方编译、4,000 条目录的
  30 行固定分页、照片和账号隔离、60 余项计算器回归。
- 开发者工具真实点击：Listening/Reading 各 40 题；输入、换题、恢复通过。
  两个工作区的页面数据分别约 3.7 KB/3.6 KB；这不是整机内存或真实设备 FPS。
- 另外七条路径：今日计划、3217 词条目录、三组完整剑桥来源的模拟入口、
  AMC12 原生整卷、AS Physics 原生整卷、Writing 原题图片、Speaking 控制。
  无运行时异常；这些点击不代表整套模拟最终提交或真实麦克风已验收。
- 生产专用 QA 账号：注册、独立 IELTS 会话、`/api/me`、原卷 context、
  原题图片均为 200。曾复现原生签名与旧网页 SSO 签名混用导致的 401，
  专用校验修复后重测通过；测试凭证只保存在进程内，未输出到日志。
- 生产 IELTS Coach：一次自编阅读问题请求，HTTP 200、`mode=ai`、回答非空，
  5281ms。只证明这次文本调用成功，不代表照片阅卷、长口语或整体延迟指标。
- STEM 服务端：`a6a0267`；IELTS 服务端：`90af7b8`。从对应现网源码基线
  创建独立候选，不夹带两个主工作区的其他未提交修改。部署前后 readiness
  通过；磁盘约 52%、可用内存约 70%、swap 约 4.3%、采样 I/O wait 低于 3%。
  每次服务切换保留回滚；未在生产执行源码构建。

## 数据不是空壳，也不把 OCR 数量当作正式题量

| 来源 | 本轮核查 | 小程序使用方式 |
| --- | --- | --- |
| IELTS 本机主库 | 72 Listening、76 Reading、152 Writing；另有 59 Speaking | 原生消费现有精简 API，不打包 95 MB 原始库 |
| IELTS 当前生产目录 | 72 Listening、72 Reading、144 Writing、3 Speaking | 以当前可用源返回为准；差集继续按质量规则审查 |
| 学科/竞赛目录 | 14 个科目目录；审计快照 4888 份 active QP | 固定分页、原卷/答案配对、保持不同数据族 |
| 独立 OCR 清单 | 快照 2464 jobs：2336 completed、65 pending、62 quarantined、1 partial | 仅使用已经审查发布的 API/原图，未批量转 ready |
| 词汇 | 304 IELTS + 2913 STEM | 已部署不可变版本目录，80 词/块，客户端最多保留两块 |

以上是本轮审计快照，后台队列之后可能继续变化。Speaking 本机与生产的差异
不能直接解释成漏上传：源图、内容完整性及生产质量过滤需要逐项比对。

## 仍然阻止“生产全功能完成”的项目

1. **微信账号配置**：当前生产 `wechatConfigured=false`。需把此小程序的
   AppID/AppSecret 配置在账号服务的安全环境，并配置 request/download/socket
   合法域名。AppSecret 不得出现在聊天、客户端、Git 或测试截图中。
2. **真机验证**：原生相机、裁剪、真实照片 AI 批卷；iPad 横竖屏及键盘；
   Qwen 连续对话、回声/中断/长会话与音频质量。当前设备测试不能替代这些。
3. **IELTS 细分功能对照**：网页 Section/Passage/内容 Topic 细分、同步字幕、
   Writing 双任务加权/段落重写、完整跨设备学习状态/报告同步、词汇发音和
   精确 taxonomy 回程，尚不能宣称完整等价。不能用网页跳转代替补齐。
4. **整套计时模拟**：当前为原生串联、答案保留和服务端报告契约；须继续验证
   最终真实提交、超时限制、恢复和重复提交。当前 elapsed 计时不等同强制截止。
5. **Speaking 双向音频导出**：目前能导出对话文本，尚未实现完整双向 MP3
   导出。只有转写时不得宣称发音评分已验证；低证据评分不能变成官方成绩。

## 采用的官方资料

- [微信 setData 性能建议](https://developers.weixin.qq.com/miniprogram/dev/framework/performance/tips/runtime_setData.html)：数据留在逻辑层，视图只传当前页/题。
- [RecorderManager.start](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.start.html)：原生 PCM 录音配置与时长上限。
- [WebAudioContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.createWebAudioContext.html)：原生输出音频缓冲。
- 微信官方 `ai-mode-skills`/开发者工具 skill v0.3.9：使用已安装的官方编译、
  自动化和截图命令；未把模拟器测试包装成真机结论。

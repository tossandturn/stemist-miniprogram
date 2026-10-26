# 雅思老师

AI Coach 第六个原生入口，位于留学申请顾问旁边。保留原有四功能与全部 IELTS 学习页面、实时口语、音频及模型设置。

## 学生功能

- 备考计划：按 Academic / General Training、目标、水平、时间安排具体任务。
- 写作辅导：依据完整题目与作文，解释四项标准相关的问题和修改理由；缺图表数据时不编造。
- 听读解析：依据用户提供的原文或 transcript、题目及答案证据，解释定位和干扰项。
- 口语文字练习：区分 Part 1 / 2 / 3，一次一问或一张题卡；文字不能评发音、真实语速、停顿或完整口语总分。

快捷按钮只填草稿，不自动调用模型。对话支持逐步显示、连续追问、复制、历史翻页、草稿恢复与明确清空。估分只供练习，不是官方 IELTS 成绩。首页提供既有 IELTS 学习与实时口语的手动入口，不自动开麦。

## 隔离与恢复

固定服务端 persona 为 `ielts-teacher`，客户端 API 前缀为 `/api/ai/ielts-teacher/`，本机键为 `stemistIeltsTeacher`。与申请顾问共用会话实现但不共享数据库、历史、草稿、清空隔离标记或生成结果收据。退出登录清除本机私有草稿；同账号可恢复云端记录。分享不包含私人内容。

每次输入最多 12,000 字符。新角色服务端截止时间上限 50 秒，客户端 55 秒；部分回答不标成完成。已生成但待保存的结果仅重试保存，不重复调用模型；结果不确定时先刷新确认或明确清空。

沿用现有已登录 Coach 授权，不把本次变更描述为新增全局会员或考试状态拦截。没有实时网页检索，也不会自动读取既有成绩、作文、录音或其他角色历史。

## 验收边界

- `npm run test:ielts-teacher` 覆盖新角色和共享恢复状态；完整 admissions 回归保留。
- 完整小程序回归、转换后包测试、官方 WXML/WXSS 编译、主包余量和独立代码复查必须通过。
- 微信模拟器使用真实页面和隔离的合成账号/存储/API，检查入口、填草稿、流式显示、分角色恢复、清空和键盘高度事件。
- 真实配置模型另用隔离回环与合成历史检验；不读取学生数据，也不把服务器侧时间当手机延迟。
- 物理手机 / iPad / 实际键盘：NOT VERIFIED。
- 开发版上传成功、正式审核、公开发布是三个独立状态；结果见下方交付记录。

## 参考

- [IELTS Writing criteria and tasks](https://ielts.org/take-a-test/preparation-resources/writing-test-resources)
- [General Training Writing](https://ielts.org/take-a-test/test-types/ielts-general-training-test/ielts-general-training-format-writing)
- [Speaking format and criteria](https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-speaking)
- [IELTS score resources](https://ielts.org/organisations/ielts-for-organisations/understanding-ielts-scoring/resources-for-setting-your-ielts-scores)
- [IELTS-Study GitHub reference](https://github.com/iFralex/IELTS-Study)：仅参考功能组织；Electron 项目不是可直接复用的原生微信实现，未引入代码或依赖。

UI 技能用于可读性、触达尺寸、安全区和六卡布局；保持现有 STEMist 配色、原生字体和原创 SVG 图标。口语技能用于一次一问与音频证据边界，不用于声称本轮修复实时口语。

## 本轮交付结果

- 客户端运行时代码：`ac9eaf003bf622263f52cab61ccefc55c394469e`；开发版 **1.0.61** 官方上传返回 `success:true`。
- 编译后总包：2,513,877 bytes；主包：1,988,120 bytes。打包前主包 1,961,756 bytes，余量 135,396 bytes，高于 131,072 bytes 门槛。新角色位于 Coach 懒加载子包，主包只增加 28 bytes。
- 完整 `test:all`、转换后 teacher/admissions/session/responsive 测试、官方编译、原生模拟器隔离流程、独立复查：PASS。
- 后端运行时代码 `0e502cbb194ef428565aa4163a89c9c3a14c48c1` 已部署；四文件校验、回滚、部署前后严格资源检查：PASS。共享会话存储源码与既有模型配置未变，IELTS 服务未重启。
- 真实配置模型的合成三轮测试：计划 4.428 秒、记忆及语法讲解 7.809 秒、Part 1 开场 1.521 秒；对应首段 3.705 / 7.344 / 1.326 秒。只是服务器侧样例，不是手机速度承诺。
- 实际回复能复述 8 周、目标 7 分、目前约 6 分、每天 45 分钟；正确改写句子，并明确文字不能判断发音。回放、六条历史记录、跨角色隔离、合成记录清空：PASS。
- 首次真实模型运行曾发生断言失败，原测试未保留失败的第二轮回答，原因未能确证。失败记录保留于 `post-live-attempt-1.json`；后续运行捕获全部回答并通过。验收器已把单词 `makes` 的过窄匹配替换为完整的正确语法句式检查，可接受 `helps/makes/allows/enables` 的正确改写并拒绝 `it make/it help`。不将首次失败描述为已确证的产品故障或已彻底解释。
- 模拟器新窗口首次自动化连接超时；只读确认运行时就绪、错误过滤日志无匹配后，重跑一次完整流程通过。没有清理用户缓存或重置无关窗口。
- 公网新接口未登录返回 401，未访问学生记录。用户原有 `project.config.json` 修改保持原校验值，未提交。
- 未提交正式审核、未公开发布；物理手机 / iPad / 实际键盘：NOT VERIFIED。
- 本地证据：`D:/CodexWork/ielts-teacher-20261027/`，包含上传回执、真实模型样例、独立复查、原生截图、各轮测试和前后资源检查。

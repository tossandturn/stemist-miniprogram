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

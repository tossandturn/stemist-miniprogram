# 登录连续性、公告与下载额度验收

日期：2026-11-12（Windows 本机 Asia/Shanghai 时间）。本记录是本地实现与验收，不代表已上传、发布或部署。

## 实际根因与范围

- 页面入口在短期令牌到期时先跳登录，没有等待已有身份静默续期。现在同账号跨页面、前后台恢复先复用合并的续期请求；只在真实失效时重新登录，不使用永不过期凭证。
- `getPrivacySetting` 暂时失败原先被当作撤销协议。现在“未知”保留此前明确同意；明确 `needAuthorization=true` 仍撤销本机许可。访客不自动登录，协议仍默认不勾选。
- 受保护 GET 的 401 先进行一次同账号续期。迟到的旧 token 401 不清掉新 token。初次请求和唯一 GET 重放的返回结果都复核账号、隐私世代和取消状态；切号后晚到的 200 不能把旧账号数据交给调用者。POST、支付、写入、流式请求不自动重放，避免重复操作；仅提示用户再次操作。超时与 5xx 不做盲目重试。
- 资料读取时切后台会丢弃迟到结果，但回到页面没有重新加载，造成空白。已补恢复；昵称输入在本页保持，提交仍以原生 `form` 最终值为准，不绕过原生检查。
- 显式微信登录的 HTTP 换票新增与原生请求相同的 10 秒 JavaScript 看门狗：SDK 未回调也能结束 loading、尝试中止传输；迟到的成功不能写身份，下一次用户重试重新申请单次 code。没有延长原生登录时限。
- 普通公告列表原先并行请求 `/announcements/manage` 探测权限，正常学生会得到 403。现在列表返回服务端验签得到的 `canManage` 布尔值；只有明确进入管理页才调用管理接口，管理授权未降低。

调度任务提供的真实 We分析证据：iPhone16ProMax / iOS26.2 / Wi‑Fi / 1.0.92 的微信换票约 12039 ms 超时、Errno5，随后恢复 200；另一次请求出现 `ERR_TUNNEL_CONNECTION_FAILED` / `cronet_error_code:-111`。前者已覆盖失败后人工重试获取新的单次微信 code；后者明确提示检查代理/VPN或切换网络，不把它描述为服务器慢、不修改网络设置、不清会话。主动 `abort` 分类为取消，不自动重试。此证据不是修复后的真机验收。

## 功能与边界

- “真题编号怎么看？考试季、卷型与版本号说明”使用已存在的固定公告 ID，服务端展示排序第一、不因存储中的到期时间失效；保留原发布时间，不修改生产数据库。主动归档仍隐藏，不能自动恢复已下线内容。
- 首页先显示最后一次公开公告缓存，再联网刷新；缓存最多 7 天，不保存管理员权限或其他账号已读状态，不把缓存日期当发布时间。离线刷新失败保留已有公告。
- PDF 与听力音频仅在确切 `pdf_daily_limit_reached` 响应后弹提示。已有会员公告缓存时显示其付费会员段；没有可靠条款缓存时不编价格，提供完整公告入口。401、普通 403、429 限流、5xx 不当作超额。查看会员不自动下单；重复回调只弹一次，切账号/离页后不能通过旧弹窗跳转。
- 微信登录只确认身份，不静默取得昵称。账号页提供醒目的可选“设置头像与昵称”入口，昵称使用原生 `type="nickname"`，头像使用 `open-type="chooseAvatar"`；不会强制填写或合并同名账号。

## 自动验收

- `node --test scripts/test-auth-continuity.mjs`：30 项；旧代码的入口续期、隐私未知、401恢复、资料后台恢复等回归先失败，再修复通过。独立审查另外发现重放后切号的晚到 200 竞态，新增初次/重放 GET 的账号、隐私、取消边界及 Binary 共 7 项，全部先失败再修复；独立复现器从 `accepted:true` 变为 `accepted:false, code:account_changed`。另有无原生回调的换票超时回归，从永远未结束修为有界失败、迟到隔离和 fresh-code 重试。
- `node --test scripts/test-announcement-access-cache.mjs`：8 项，涵盖无管理探测、真实能力、缓存隔离、额度弹窗和 PDF/音频控制器。
- 同一组 30＋8 项在 `STEMIST_TEST_PACKAGED=1` 的真实代码压缩转换下再次运行，38/38 通过；不是只测未压缩源代码。
- `npm run test:auth`、`test:wechat-auth`、`test:session`、`test:entry-access`、`test:api`、`test:membership`、`test:announcements`、`test:audio-downloads`、`test:pdf-download`、`test:pages`、`test:wxml-bindings`、`test:device`、`test:wechat`：本地通过。
- 后端 `node scripts/test-announcement-presentation.mjs` 与 `node scripts/test-stem-announcements.mjs`：通过；检查置顶、到期、真实日期、翻页、读回执、归档，以及访客/学生/管理员真实能力和原有写权限。
- `node scripts/build-native-package.mjs --check-only`：通过。本次检查主包余量 135848 字节，最低要求 131072 字节；没有为了过门槛下调预算。最终打包须再次确认。
- 语法、WXML/WXSS 编译、`git diff --check`：通过。

## 原生视觉与限制

独立本地 fixture：`auth-announcement-fixture-20261112`，应用请求禁用、内存合成账号，不创建线上账号、不上传。IDE 不接受 touristappid，因此使用仓库已有公开 AppID；不加载真实登录或存储。原生路由与截图通道可用，`automation_evaluate` 两次超时，因此不宣称完整自动化 E2E 或几何验证。

视觉检查抓到一次新引入的 WXML `if/else` 邻接错误：已登录页面也显示了登录表单。已改为显式 `!user` 条件，新增回归并重新编译截图确认修复。

截图保留在工作区 `qa/auth-announcement-20261112/`：`account-fixed.png`、`profile-nickname.png`、`home-cached-guide.png` 已逐张目视检查，分别确认登录表单不重复、可选昵称输入与保存可见、网络刷新失败仍展示首页第一屏编号公告。截图尺寸是 231×497 图像像素，不冒充设备 CSS viewport。尚未验证真实 iPhone 微信昵称选择、iPad/大字号/VoiceOver，也未验证修复后的中国移动网络。真实在线发布后仍需针对原始失败入口验收。

## 外部参考

参考微信官方原创 [mp-user-avatar README](https://github.com/wechat-miniprogram/mp-user-avatar/blob/master/README.md) 对原生 `chooseAvatar`、`input type="nickname"` 的能力说明，以及腾讯维护者关于 [原生 form 提交昵称值](https://github.com/Tencent/tdesign-miniprogram/issues/3143) 的示例。只使用接口设计事实，没有复制组件源码、安装依赖或声称静默获取昵称。微信开发者文档本次访问失败，因此以官方仓库说明和本项目已有原生合同交叉核对。

本地工具错误：PowerShell 的 `rg` 不接收未展开的路径 glob，已改用精确目录和 `-g`；IDE 首次打开后的自动化超时不当作验收成功。未修改用户已有 `.learnings/ERRORS.md`。

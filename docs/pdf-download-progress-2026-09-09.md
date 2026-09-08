# 原卷 PDF 下载进度与打开状态

日期：2026-09-09（Asia/Shanghai）

## 学生可见行为

- 真题目录的进度状态只出现在刚点击的试卷卡片内。
- 逐题试卷工作区的进度状态位于“查看原卷 / 查看参考答案”按钮附近，不使用遮挡题目的全屏 loading。
- 下载总字节已知时显示“已下载 / 总量 + 百分比”；未知时只显示真实已下载字节，不推算百分比。
- `DownloadTask.onProgressUpdate` 即使先报告 100%，下载阶段仍最多显示 99%。只有 `wx.downloadFile` 成功回调且 HTTP 状态为 200 后，才切换为“下载完成，正在打开…”。
- 学生可取消下载、失败后重试，以及收起/展开状态。所有操作按钮保持至少 44px 触控高度。
- 考试模拟提交前仍不显示或打开参考答案。

## 生命周期和数据边界

- 取消、切换目录/学科/筛选、页面隐藏或卸载会使当前下载代际失效；有活动网络任务时调用 `DownloadTask.abort()`。
- 下载开始时记录账号、隐私 epoch 和会话快照。快照变化后的进度、成功或失败回调不会打开文档，也不会更新旧页面。
- PDF 临时路径只保存在控制器内的有界内存缓存中，不进入 `setData`、Storage 或日志。缓存命中前使用小程序文件系统验证路径仍存在；丢失则重新下载。
- 缓存最多保留四个路径引用，只淘汰内存引用，不复制、改写或删除服务端原卷、学生草稿或照片。
- `wx.openDocument` 成功前不显示“已打开”；打开失败保留临时文件并提供重试。缺少该 API 的模拟环境会明确提示到真机微信重试。

## 验证

自动化覆盖真实/未知总量、100% 事件钳制、HTTP 200 边界、打开阶段、取消与迟到回调、HTTP 失败重试、缓存命中/丢失、打开失败、模拟器提示、账号/页面/目录切换、缓存上限及 MS 考试门禁：

```powershell
node scripts/test-pdf-download-progress.mjs
npm run test:paper-catalog
npm run test:pages
npm run test:responsive
npm run test:wechat
npm run test:all
```

发布前仍需主控在真实手机和 iPad 上用正常网络与弱网各打开一份原卷和参考答案，确认下载进度、取消、重试、系统文档查看器返回后的状态，以及合法 download 域名配置。

API 参考：微信小程序 `wx.downloadFile`、`DownloadTask.onProgressUpdate`、`DownloadTask.abort` 和 `wx.openDocument`。

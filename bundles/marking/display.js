const VALID_STATUSES = new Set(['draft', 'queued', 'processing', 'completed', 'failed'])
const MIN_DISPLAY_TIME = Date.UTC(2000, 0, 1)
const MAX_DISPLAY_TIME = Date.UTC(2100, 0, 1)
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

const two = value => String(value).padStart(2, '0')

function formatBeijingTime(value) {
 const milliseconds = typeof value === 'string' || typeof value === 'number' ? Date.parse(String(value)) : NaN
 if (!Number.isFinite(milliseconds) || milliseconds < MIN_DISPLAY_TIME || milliseconds >= MAX_DISPLAY_TIME) return ''
 const date = new Date(milliseconds + BEIJING_OFFSET_MS)
 return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日 ${two(date.getUTCHours())}:${two(date.getUTCMinutes())}（北京时间）`
}

function retryRequestId(job) {
 const safeJobId = String(job?.jobId || 'unknown-job').replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 72) || 'unknown-job'
 const attempt = Number.isSafeInteger(Number(job?.processingAttempt)) && Number(job.processingAttempt) >= 0
  ? Number(job.processingAttempt)
  : 0
 return `retry-${safeJobId}-${attempt}`.slice(0, 100)
}

function failureKind(code, invalidCompleted) {
 const value = String(code || '').toLowerCase()
 if (invalidCompleted) return 'invalid-result'
 if (value === 'cancelled') return 'cancelled'
 if (value === 'worker_restarted') return 'worker-restarted'
 if (/timeout|deadline|abort(?:ed)?/.test(value)) return 'timeout'
 if (/^report_|report.*(?:invalid|failed|limit|unavailable)|pdf_(?:render|generation|report)/.test(value)) return 'report'
 if (value === 'ai_assessment_empty' || /assessment.*empty/.test(value)) return 'empty-result'
 if (/^ai_assessment_|response_schema_invalid|provider_envelope_invalid/.test(value)) return 'invalid-result'
 if (/vision_review_failed|vision_not_configured|provider|upstream|rate_limit|temporar(?:y|ily)_unavailable/.test(value)) return 'provider-unavailable'
 return 'unknown'
}

function failureCopy(job, { invalidCompleted = false, resultValid = false, retryConfirmationPending = false } = {}) {
 const reportStage = ['reporting', 'ai-result-received', 'analysis-received'].includes(String(job?.progress?.lastStage || ''))
 const kind = (resultValid || reportStage) && job?.status === 'failed' && !job?.reportPdfPath
  ? 'report'
  : failureKind(job?.failureCode, invalidCompleted)
 const copies = {
  'invalid-result': ['AI 返回内容未通过校验', 'AI 返回内容未通过完整性校验，本次未生成不可靠分数。作答文件仍保留。'],
  'cancelled': ['已取消', '这份任务没有进入 AI 批改，可新建任务重新选择作答。'],
  'worker-restarted': ['批改服务重启后已暂停', '上次处理在服务重启时中断，作答文件仍保留。'],
  'timeout': ['批改超时', '本次处理超过时限，批改未完成。作答文件仍保留。'],
  'report': ['PDF 报告生成失败', resultValid
   ? 'AI 批改文字已保留，仅 PDF 报告未能生成。可直接重新生成报告。'
   : '批改报告未能生成，作答文件仍保留。'],
  'empty-result': ['AI 未返回可用的逐题结果', 'AI 没有返回可用的逐题结果，因此未生成分数或报告。作答文件仍保留。'],
  'provider-unavailable': ['AI 服务暂时不可用', 'AI 服务暂时未完成本次分析，批改未完成。作答文件仍保留。'],
  unknown: ['批改未完成', job?.retryable ? '本次批改未完成，作答文件仍保留。' : '本次批改未完成，请检查文件后新建任务。'],
 }
 const [title, baseDetail] = copies[kind]
 const detail = retryConfirmationPending
  ? `${baseDetail} 上次重试请求的结果尚未确认，请先重新读取状态；不会重复提交重试。`
  : baseDetail
 let action = 'new'
 if (retryConfirmationPending) action = 'refresh'
 else if (kind !== 'cancelled' && !invalidCompleted && job?.retryable === true) action = 'retry'
 return {
  failureKind: kind,
  failureTitle: title,
  failureDetail: detail,
  failureAction: action,
  failureActionLabel: action === 'refresh'
   ? '确认任务状态'
   : action === 'new'
    ? '新建批改'
    : kind === 'report' && resultValid ? '重新生成报告' : '重试批改',
 }
}

function retentionCopy(job, reportAvailable) {
 const formatted = formatBeijingTime(job?.expiresAt)
 if (!formatted) return { expiresAtLabel: '', retentionLabel: '' }
 if (reportAvailable) return { expiresAtLabel: formatted, retentionLabel: `作答与批改报告保留至 ${formatted}，请在到期前下载。` }
 if (job?.sourcePdfPath) return { expiresAtLabel: formatted, retentionLabel: `作答 PDF 保留至 ${formatted}；当前没有可下载的批改报告。` }
 if (job?.status === 'draft') return { expiresAtLabel: formatted, retentionLabel: `已上传文件保留至 ${formatted}。` }
 return { expiresAtLabel: formatted, retentionLabel: `任务记录保留至 ${formatted}；当前没有可下载文件。` }
}

function markingJobDisplay(job, options = {}) {
 const status = VALID_STATUSES.has(job?.status) ? job.status : ''
 const invalidCompleted = options.invalidCompleted === true
 const resultValid = options.resultValid === true
 const displayStatus = invalidCompleted ? 'failed' : status
 const failure = displayStatus === 'failed'
  ? failureCopy(job, { invalidCompleted, resultValid, retryConfirmationPending: options.retryConfirmationPending === true })
  : { failureKind: '', failureTitle: '', failureDetail: '', failureAction: '', failureActionLabel: '' }
 const reportStageFailed = displayStatus === 'failed' && (failure.failureKind === 'report' || resultValid)
 const flowStep = displayStatus === 'completed' || reportStageFailed ? 3 : ['queued', 'processing', 'failed'].includes(displayStatus) ? 2 : 1
 const labels = { draft: '等待上传', queued: '排队中', processing: '正在批改', completed: '批改已完成' }
 let jobLabel = labels[displayStatus] || ''
 let jobStateHint = '正在读取任务状态…'
 if (displayStatus === 'draft') jobStateHint = '正在准备上传文件。'
 else if (displayStatus === 'queued') jobStateHint = '作答已提交，正在等待 AI 批改。'
 else if (displayStatus === 'processing') jobStateHint = '完成后可在这里查看逐题反馈和 PDF 报告。'
 else if (displayStatus === 'completed') jobStateHint = job?.reportPdfPath
  ? '批改完成，逐题反馈与 PDF 报告已可查看。'
  : '批改完成，可查看本页反馈；PDF 尚未生成。'
 else if (displayStatus === 'failed') {
  jobLabel = failure.failureTitle
  jobStateHint = failure.failureDetail
 }
 const retention = retentionCopy(job, options.reportAvailable === true)
 return {
  displayStatus,
  flowStep,
  currentStepLabel: flowStep === 3 ? (displayStatus === 'failed' ? '生成报告' : '查看报告') : flowStep === 2 ? 'AI 批改' : '上传作答',
  jobLabel,
  jobStateHint,
  ...failure,
  ...retention,
 }
}

module.exports = { formatBeijingTime, markingJobDisplay, retryRequestId }

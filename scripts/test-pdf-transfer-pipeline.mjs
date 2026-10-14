import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { miniRuntime } from './helpers/mini-runtime.mjs'

const KiB = 1024
const MiB = 1024 * KiB
const URL = 'https://stem.ieltsist.com/api/stem/curriculum-papers/files/file-' + 'd'.repeat(32)
const digest = value => crypto.createHash('sha256').update(value).digest('hex')
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const waitFor = async (predicate, message, timeoutMs = 1500) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline && !predicate()) await wait(5)
  assert.ok(predicate(), message)
}
const pdf = size => {
  const value = Buffer.alloc(size)
  Buffer.from('%PDF-1.7\n').copy(value)
  for (let index = 9; index < Math.max(9, size - 6); index++) value[index] = index % 251
  if (size >= 6) Buffer.from('%%EOF\n').copy(value, size - 6)
  return value
}

class TransferHarness {
  constructor({ source = pdf(5 * MiB + 333), delay = () => 0, fail = () => false, response = () => ({}) } = {}) {
    this.source = source
    this.delay = delay
    this.fail = fail
    this.response = response
    this.files = new Map()
    this.storage = new Map()
    this.requests = []
    this.completions = []
    this.progress = []
    this.phases = []
    this.writes = []
    this.writeBuffers = []
    this.reads = []
    this.active = 0
    this.maxActive = 0
    this.activeByUrl = new Map()
    this.maxActiveByUrl = new Map()
    this.deliveredPending = 0
    this.maxDeliveredPending = 0
    this.abortCount = 0
    this.holdAppends = false
    this.pendingAppends = []
    this.failEnabled = true
    this.attempts = new Map()
    const harness = this
    const manager = {
      mkdirSync() {},
      accessSync(path) { if (!harness.files.has(path)) throw Error('not found') },
      statSync(path) { if (!harness.files.has(path)) throw Error('not found'); return { size: harness.files.get(path).length } },
      writeFile(options) {
        harness.writeBuffers.push(options.data)
        const data = Buffer.from(options.data)
        harness.files.set(options.filePath, data)
        harness.deliveredPending = Math.max(0, harness.deliveredPending - data.length)
        harness.writes.push({ kind: 'write', before: 0, length: data.length, after: data.length })
        queueMicrotask(() => options.success())
      },
      appendFile(options) {
        const append = () => {
          harness.writeBuffers.push(options.data)
          const before = harness.files.get(options.filePath)?.length || 0
          const data = Buffer.from(options.data)
          harness.files.set(options.filePath, Buffer.concat([harness.files.get(options.filePath) || Buffer.alloc(0), data]))
          harness.deliveredPending = Math.max(0, harness.deliveredPending - data.length)
          harness.writes.push({ kind: 'append', before, length: data.length, after: before + data.length })
          queueMicrotask(() => options.success())
        }
        if (harness.holdAppends) harness.pendingAppends.push(append)
        else append()
      },
      readFile(options) {
        const data = harness.files.get(options.filePath)
        if (!data) return queueMicrotask(() => options.fail())
        const start = Number(options.position) || 0
        const length = options.length === undefined ? data.length - start : Number(options.length)
        const part = data.subarray(start, start + length)
        harness.reads.push({ path: options.filePath, start, length })
        queueMicrotask(() => options.success({ data: part.buffer.slice(part.byteOffset, part.byteOffset + part.length) }))
      },
      unlink(options) { harness.files.delete(options.filePath); queueMicrotask(() => options.success?.()) },
    }
    const wx = {
      env: { USER_DATA_PATH: '/user' },
      getFileSystemManager: () => manager,
      getStorageSync: key => harness.storage.get(key),
      setStorageSync: (key, value) => harness.storage.set(key, value),
      removeStorageSync: key => harness.storage.delete(key),
      request: options => harness.request(options),
    }
    this.wx = wx
    this.runtime = miniRuntime({
      wx,
      globals: { setTimeout: (callback, ms) => setTimeout(callback, ms === 350 || ms === 900 ? 0 : ms) },
    })
    this.module = this.runtime.load('utils/pdfRangeCache')
  }

  request(options) {
    const match = /^bytes=(\d+)-(\d+)$/.exec(options.header.Range)
    assert.ok(match, 'every PDF request has a finite byte range')
    assert.equal(options.header.Authorization, 'Bearer transfer-test-token')
    const start = Number(match[1])
    const end = Number(match[2])
    const key = `${options.url}:${start}-${end}`
    const attempt = (this.attempts.get(key) || 0) + 1
    this.attempts.set(key, attempt)
    const entry = {
      options, url: options.url, start, end, length: end - start + 1, attempt,
      ifRange: options.header['If-Range'] || '', headers: new Set(), aborted: false, transportDone: false,
    }
    this.requests.push(entry)
    this.active++
    this.maxActive = Math.max(this.maxActive, this.active)
    const perUrl = (this.activeByUrl.get(entry.url) || 0) + 1
    this.activeByUrl.set(entry.url, perUrl)
    this.maxActiveByUrl.set(entry.url, Math.max(this.maxActiveByUrl.get(entry.url) || 0, perUrl))
    const finishTransport = () => {
      if (entry.transportDone) return
      entry.transportDone = true
      this.active--
      this.activeByUrl.set(entry.url, (this.activeByUrl.get(entry.url) || 1) - 1)
    }
    const task = {
      abort: () => {
        if (entry.aborted) return
        entry.aborted = true
        this.abortCount++
        finishTransport()
        queueMicrotask(() => options.fail({ errMsg: 'request:fail abort' }))
      },
      onHeadersReceived: callback => entry.headers.add(callback),
      offHeadersReceived: callback => entry.headers.delete(callback),
    }
    entry.task = task
    setTimeout(() => {
      if (entry.aborted) return
      const policy = this.response(entry) || {}
      const actualEnd = Math.min(end, this.source.length - 1)
      const bodySource = this.source.subarray(start, actualEnd + 1)
      const body = policy.damage ? Buffer.from(bodySource.map((value, index) => index === 20 ? value ^ 1 : value)) : bodySource
      const etag = policy.etag === undefined ? `"${digest(this.source)}"` : policy.etag
      const headers = {
        'Content-Type': 'application/pdf',
        'Content-Length': String(policy.contentLength === undefined ? body.length : policy.contentLength),
        'Content-Range': policy.contentRange || `bytes ${start}-${actualEnd}/${this.source.length}`,
        ...(etag ? { ETag: etag } : {}),
      }
      const early = policy.earlyHeaders || headers
      for (const callback of [...entry.headers]) callback({ ...(policy.earlyStatus === undefined ? {} : { statusCode: policy.earlyStatus }), header: early })
      if (entry.aborted) {
        if (policy.lateSuccess) queueMicrotask(() => options.success({ statusCode: 206, header: headers, data: body.buffer.slice(body.byteOffset, body.byteOffset + body.length) }))
        return
      }
      if (this.failEnabled && this.fail(entry)) {
        finishTransport()
        options.fail({ errMsg: 'request:fail timeout' })
        return
      }
      finishTransport()
      this.deliveredPending += body.length
      this.maxDeliveredPending = Math.max(this.maxDeliveredPending, this.deliveredPending)
      const payload = body.buffer.slice(body.byteOffset, body.byteOffset + body.length)
      entry.payload = payload
      this.completions.push(entry)
      options.success({ statusCode: policy.statusCode || 206, header: headers, data: payload })
    }, this.delay(entry))
    return task
  }

  acquire(extra = {}) {
    const targetUrl = extra.url || URL
    return this.module.acquirePdf({
      wxApi: this.wx,
      url: targetUrl,
      owner: 'student-1|1',
      version: 'v1',
      fileName: 'transfer-test.pdf',
      expectedBytes: this.source.length,
      expectedSha256: digest(this.source),
      authorization: async () => 'Bearer transfer-test-token',
      onProgress: (saved, total) => this.progress.push({ saved, total }),
      onPhase: (phase, saved, total) => this.phases.push({ phase, saved, total }),
      ...extra,
    })
  }

  releaseAppend() { this.pendingAppends.shift()?.() }
}

// Useful probe, measured adaptive growth, two useful workers, ordered durable writes.
{
  let firstDataStart = null
  const harness = new TransferHarness({
    delay: entry => {
      if (entry.start === 0) return 0
      if (firstDataStart === null) firstDataStart = entry.start
      return entry.start === firstDataStart ? 25 : 1
    },
  })
  const handle = harness.acquire()
  const path = await handle.promise
  handle.release()
  assert.equal(harness.requests[0].start, 0)
  assert.equal(harness.requests[0].length, 256 * KiB, 'the first request must carry useful content')
  assert.equal(harness.maxActiveByUrl.get(URL), 2, 'a file uses at most two useful requests concurrently')
  assert.ok(harness.requests.some(entry => entry.length === 512 * KiB), 'fast clean requests recover to 512 KiB')
  assert.ok(harness.requests.some(entry => entry.length === MiB), 'fast clean requests recover to the 1 MiB ceiling')
  assert.ok(harness.requests.every(entry => entry.length <= MiB), 'every HTTP body remains bounded')
  assert.ok(harness.maxDeliveredPending <= 2 * MiB, 'completed out-of-order bodies stay inside the per-file buffer cap')
  const writtenBuffers = new Set(harness.writeBuffers)
  assert.ok(harness.completions.every(entry => writtenBuffers.has(entry.payload)), 'full response spans are handed to the filesystem without another ArrayBuffer copy')
  assert.deepEqual(harness.files.get(path), harness.source)
  assert.ok(harness.writes.every(write => write.after === write.before + write.length), 'the writer never appends across a gap')
  const durable = new Set(harness.writes.map(write => write.after))
  assert.ok(harness.progress.every(item => item.saved === 0 || durable.has(item.saved)), 'progress reports only durable contiguous bytes')
}

// A first logical range can shrink to 32 KiB while the second finishes first; the whole planned span is still covered.
{
  const source = pdf(1400 * KiB)
  const harness = new TransferHarness({
    source,
    delay: entry => entry.start >= 256 * KiB && entry.start < 512 * KiB ? 12 : 0,
    fail: entry => entry.start >= 256 * KiB && entry.start < 512 * KiB && entry.length > 32 * KiB,
  })
  const handle = harness.acquire()
  const path = await handle.promise
  handle.release()
  assert.ok(harness.requests.some(entry => entry.start === 256 * KiB && entry.length === 32 * KiB), 'the failed first logical span reaches the 32 KiB fallback')
  const afterProbe = harness.completions.filter(entry => entry.start > 0)
  assert.equal(afterProbe[0].start, 512 * KiB, 'the second planned range completes out of order')
  assert.deepEqual(harness.files.get(path), source, 'subdividing the first logical span cannot leave a gap before the second')
  assert.ok(harness.writes.every(write => write.after === write.before + write.length))
  assert.ok(harness.maxDeliveredPending <= 2 * MiB)
}

// Clean but slow active requests do not count toward growth. The permit wait is not part of this duration.
{
  const source = pdf(700 * KiB)
  const harness = new TransferHarness({ source, delay: () => 2050 })
  const handle = harness.acquire()
  await handle.promise
  handle.release()
  assert.ok(harness.requests.every(entry => entry.length <= 256 * KiB), '2s-plus active requests hold the conservative segment size')
}

// Six controllers share a small request pool even though each can use two workers.
{
  const source = pdf(900 * KiB)
  const harness = new TransferHarness({ source, delay: () => 15 })
  let authorizations = 0
  const handles = Array.from({ length: 6 }, (_, index) => harness.acquire({
    url: `https://stem.ieltsist.com/local-pdf/9702/global-${index}.pdf`,
    version: `global-${index}`,
    fileName: `global-${index}.pdf`,
    authorization: async () => { authorizations++; return 'Bearer transfer-test-token' },
  }))
  await waitFor(() => harness.active === 4, 'four global request permits become active')
  assert.equal(authorizations, 4, 'queued requests refresh authorization only after receiving a network permit')
  await Promise.all(handles.map(handle => handle.promise))
  handles.forEach(handle => handle.release())
  assert.equal(harness.maxActive, 4, 'the global PDF request pool is capped at four')
  assert.ok([...harness.maxActiveByUrl.values()].every(value => value <= 2))
}

// EOF-shortened 206 responses support tiny/unknown-length PDFs without a second request.
{
  const source = Buffer.from('%PDF-\n%%EOF\n')
  const harness = new TransferHarness({ source })
  const handle = harness.acquire({ expectedBytes: 0, expectedSha256: digest(source), fileName: 'tiny.pdf' })
  const path = await handle.promise
  handle.release()
  assert.equal(harness.requests.length, 1)
  assert.equal(harness.requests[0].end, 256 * KiB - 1)
  assert.deepEqual(harness.files.get(path), source)
}

// Access failures retain the exact dispatched bearer for stale-safe session invalidation upstream.
{
  const source = pdf(300 * KiB)
  const harness = new TransferHarness({ source, response: () => ({ statusCode: 401 }) })
  const handle = harness.acquire()
  await assert.rejects(handle.promise, error => error.code === 'auth_required' && error.statusCode === 401 && error.authorization === 'Bearer transfer-test-token')
  handle.release()
}

// Both useful workers are aborted, and a same-key retry waits for an already-started append to drain.
{
  const source = pdf(2 * MiB)
  const cancelling = new TransferHarness({ source, delay: entry => entry.start === 0 ? 0 : 500 })
  const handle = cancelling.acquire()
  await waitFor(() => (cancelling.activeByUrl.get(URL) || 0) === 2, 'two useful requests did not start')
  handle.release()
  await assert.rejects(handle.promise, error => error.code === 'pdf_cancelled')
  assert.ok(cancelling.abortCount >= 2, 'cancellation aborts both active range requests')
  assert.equal(cancelling.active, 0)

  const draining = new TransferHarness({ source: pdf(1200 * KiB), delay: () => 0 })
  draining.holdAppends = true
  const first = draining.acquire()
  await waitFor(() => draining.pendingAppends.length === 1, 'the first ordered append did not start')
  const beforeRetry = draining.requests.length
  first.release()
  const second = draining.acquire()
  await wait(25)
  assert.equal(draining.requests.length, beforeRetry, 'same-key retry must wait for the cancelled append to drain')
  draining.holdAppends = false
  draining.releaseAppend()
  await assert.rejects(first.promise, error => error.code === 'pdf_cancelled')
  const path = await second.promise
  second.release()
  assert.deepEqual(draining.files.get(path), draining.source)
}

// A failed future range preserves only the contiguous prefix; the next acquisition resumes that byte exactly.
{
  const source = pdf(2 * MiB + 7)
  const harness = new TransferHarness({ source, fail: entry => entry.start >= 768 * KiB })
  const first = harness.acquire()
  await assert.rejects(first.promise, error => error.code === 'pdf_network')
  first.release()
  const record = harness.storage.get(harness.module.REGISTRY)[0]
  assert.equal(harness.files.get(record.path).length, record.offset)
  assert.ok(record.offset >= 512 * KiB && record.offset < source.length)
  const savedOffset = record.offset
  const requestCount = harness.requests.length
  harness.failEnabled = false
  const next = harness.acquire()
  const path = await next.promise
  next.release()
  const resumed = harness.requests.slice(requestCount)
  assert.equal(resumed[0].start, 0, 'resume still validates the source identity')
  assert.equal(resumed[0].length, 5, 'resume does not redownload the 256 KiB cold-start probe')
  assert.ok(resumed.some(entry => entry.start === savedOffset), 'resume begins at the exact durable prefix')
  assert.deepEqual(harness.files.get(path), source)
}

// Missing or mixed validators never enter the ordered writer.
{
  const missing = new TransferHarness({ response: () => ({ etag: '' }) })
  await assert.rejects(missing.acquire().promise, error => error.code === 'pdf_invalid_range')
  assert.equal(missing.writes.length, 0)

  const mixed = new TransferHarness({ response: entry => entry.start >= 256 * KiB ? { etag: '"different"' } : {} })
  await assert.rejects(mixed.acquire().promise, error => ['pdf_source_changed', 'pdf_invalid_range'].includes(error.code))
  assert.ok(mixed.writes.every(write => write.after <= 256 * KiB), 'bytes from a mixed ETag are never appended')
}

// Header inspection rejects an oversized body before delivery, even when the event omits statusCode.
{
  const harness = new TransferHarness({
    response: () => ({
      earlyHeaders: { 'Content-Type': 'application/pdf', 'Content-Length': String(32 * MiB), ETag: `"${digest(pdf(10))}"` },
      lateSuccess: true,
    }),
  })
  await assert.rejects(harness.acquire().promise, error => ['pdf_invalid_range', 'pdf_source_changed'].includes(error.code))
  await wait(10)
  assert.equal(harness.abortCount, 1, 'the response is aborted from headers before a large ArrayBuffer is accepted')
  assert.equal(harness.writes.length, 0, 'late success callbacks from an aborted generation are ignored')
}

// Legacy schema-v1 cache stays network-free and full SHA verification uses a separate 512 KiB read bound.
{
  const source = pdf(1300 * KiB)
  const harness = new TransferHarness({ source })
  const path = '/user/pdf-cache/pdf-legacy/legacy.pdf'
  const record = {
    schema: 1,
    key: `student-1|1|${URL}|v1`,
    url: URL,
    owner: 'student-1|1',
    version: 'v1',
    path,
    offset: source.length,
    total: source.length,
    etag: `"${digest(source)}"`,
    used: 1,
  }
  harness.files.set(path, Buffer.from(source))
  harness.storage.set(harness.module.REGISTRY, [record])
  const handle = harness.acquire()
  assert.equal(await handle.promise, path)
  handle.release()
  assert.equal(harness.requests.length, 0, 'a complete legacy cache hit does not touch the network')
  const hashReads = harness.reads.filter(read => read.start >= 5)
  assert.ok(hashReads.length <= Math.ceil(source.length / (512 * KiB)) + 1)
  assert.ok(hashReads.every(read => read.length <= 512 * KiB), 'cache hashing remains bounded at 512 KiB per bridge read')
}

// Full-size corruption still fails SHA verification and cannot poison the cache.
{
  const source = pdf(900 * KiB)
  const harness = new TransferHarness({ source, response: entry => entry.start >= 256 * KiB ? { damage: true } : {} })
  await assert.rejects(harness.acquire().promise, error => error.code === 'pdf_integrity')
  assert.equal(harness.storage.get(harness.module.REGISTRY)?.length || 0, 0)
}

console.log('PDF transfer pipeline: adaptive bounded ranges, ordered checkpoints, cancellation/drain, resume, validators, global cap, EOF, cache hashing and integrity passed.')

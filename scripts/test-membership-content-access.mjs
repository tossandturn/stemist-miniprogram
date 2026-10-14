import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { miniRuntime, deferred, settle } from './helpers/mini-runtime.mjs'

const protocol = 'stemist-membership-v1'
const future = '2026-10-14T13:00:00.000Z'
const nowValue = Date.parse('2026-10-14T12:00:00.000Z')
const activeStatus = {
  protocol,
  userId: 'ielts:42',
  entitlement: { active: true, planId: 'all-access-month', startsAt: '2026-10-14T11:00:00.000Z', expiresAt: future, version: 3 },
  enforcement: { enabled: true, appliesToExistingUsers: true },
}

{
  const calls = []
  const runtime = miniRuntime({ modules: {
    'utils/api': { requestJson: async (...args) => { calls.push(args); return { protocol, enforcement: { enabled: false, appliesToExistingUsers: true } } } },
    'utils/nativeSession': { refreshNativeSession: async () => '' },
    'utils/membershipAccess': { offerMembership: () => assert.fail('safe-off guest must not show membership prompt') },
  } })
  const access = runtime.load('utils/membershipProof')
  const first = await access.ensureMembershipAccess({ wxApi: runtime.wx, now: () => nowValue })
  const second = await access.ensureMembershipAccess({ wxApi: runtime.wx, now: () => nowValue + 1 })
  assert.equal(first.enforcementEnabled, false)
  assert.equal(first.active, false)
  assert.equal(second.enforcementEnabled, false)
  assert.equal(calls.length, 2, 'guest safe-off catalog proof must be fresh for every managed-cache open')
  assert.equal(calls[0][0], '/api/membership/catalog')
  assert.equal(calls[0][2].stemAuth, false)
}

{
  let calls = 0
  const runtime = miniRuntime({ modules: {
    'utils/api': { requestJson: async () => { calls++; return { protocol, enforcement: { enabled: true, appliesToExistingUsers: true } } } },
    'utils/nativeSession': { refreshNativeSession: async () => '' },
    'utils/membershipAccess': { offerMembership: () => assert.fail('guest needs login, not a purchase prompt') },
  } })
  const access = runtime.load('utils/membershipProof')
  await assert.rejects(
    access.ensureMembershipAccess({ wxApi: runtime.wx, now: () => nowValue }),
    error => error.code === 'auth_required' && error.statusCode === 401,
  )
  assert.equal(calls, 1)
}

{
  const calls = []
  let refreshed = 0
  const runtime = miniRuntime({ modules: {
    'utils/api': { requestJson: async (...args) => { calls.push(args); return activeStatus } },
    'utils/nativeSession': { refreshNativeSession: async () => { refreshed++; runtime.storage.set('stemistSessionToken', 'rotated-token'); return 'rotated-token' } },
    'utils/membershipAccess': { offerMembership: () => assert.fail('active member must not be prompted') },
  } })
  runtime.storage.set('stemistUser', { id: 'ielts:42' })
  runtime.storage.set('stemistPrivacyEpoch', 7)
  runtime.storage.set('stemistSessionToken', 'old-token')
  const access = runtime.load('utils/membershipProof')
  const proof = await access.ensureMembershipAccess({ wxApi: runtime.wx, now: () => nowValue })
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], '/api/membership/status')
  assert.equal(calls[0][2].method, 'GET')
  assert.equal(proof.owner, 'ielts:42')
  assert.equal(proof.epoch, 7)
  assert.equal(proof.active, true)
  assert.equal(proof.validUntil, nowValue + 30_000)
  runtime.storage.set('stemistSessionToken', 'newer-token-with-same-owner')
  assert.equal((await access.ensureMembershipAccess({ wxApi: runtime.wx, now: () => nowValue + 10_000 })).version, 3)
  assert.equal(calls.length, 1, 'same-owner token rotation keeps the bounded positive proof')
  const authorization = await access.authorizationForMembership({
    wxApi: runtime.wx,
    proof,
    expected: { owner: 'ielts:42', epoch: 7 },
  })
  assert.equal(authorization, 'Bearer rotated-token')
  assert.equal(refreshed, 1)
  runtime.storage.delete('stemistUser');runtime.storage.delete('stemistSessionToken')
  await assert.rejects(access.ensureMembershipAccess({wxApi:runtime.wx,now:()=>nowValue+11_000}),error=>error.code==='auth_required'&&error.statusCode===401)
  assert.equal(calls.length,2,'logout cannot reuse the prior owner positive proof')
}

{
  for(const entitlement of [{ active: false, planId: '', startsAt: null, expiresAt: null, version: 4 },{ active: true, planId: 'all-access-month', startsAt: '2026-10-01T00:00:00.000Z', expiresAt: '2026-10-14T11:59:59.000Z', version: 5 }]){
  let prompted = 0
  const runtime = miniRuntime({ modules: {
    'utils/api': { requestJson: async () => ({ ...activeStatus, entitlement }) },
    'utils/nativeSession': { refreshNativeSession: async () => 'token' },
    'utils/membershipAccess': { offerMembership: () => { prompted++ } },
  } })
  runtime.storage.set('stemistUser', { id: 'ielts:42' })
  runtime.storage.set('stemistSessionToken', 'token')
  const access = runtime.load('utils/membershipProof')
  await assert.rejects(
    access.ensureMembershipAccess({ wxApi: runtime.wx, now: () => nowValue }),
    error => error.code === 'membership_required' && error.statusCode === 403,
  )
  assert.equal(prompted, 1)
  }
}

{
  const pending = deferred()
  const runtime = miniRuntime({ modules: {
    'utils/api': { requestJson: async () => pending.promise },
    'utils/nativeSession': { refreshNativeSession: async () => 'token' },
    'utils/membershipAccess': { offerMembership() {} },
  } })
  runtime.storage.set('stemistUser', { id: 'ielts:42' })
  runtime.storage.set('stemistPrivacyEpoch', 1)
  runtime.storage.set('stemistSessionToken', 'token')
  const access = runtime.load('utils/membershipProof')
  const request = access.ensureMembershipAccess({ wxApi: runtime.wx, now: () => nowValue })
  runtime.storage.set('stemistPrivacyEpoch', 2)
  pending.resolve(activeStatus)
  await assert.rejects(request, error => error.code === 'account_changed')
}

{
  const downloads = []
  const progress = []
  const files = new Map([['wxfile://protected.png', Buffer.from('protected-image')]])
  let gateCalls = 0
  const runtime = miniRuntime({ wx: {
    env: { USER_DATA_PATH: '/user' },
    downloadFile(options) {
      const task = { aborted: 0, abort() { this.aborted++ }, onProgressUpdate(listener) { this.progress = listener; queueMicrotask(() => listener({ totalBytesWritten: 8, totalBytesExpectedToWrite: 15 })) } }
      downloads.push({ options, task })
      setImmediate(() => options.success({ statusCode: 200, tempFilePath: 'wxfile://protected.png' }))
      return task
    },
    getFileSystemManager() {
      return {
        access({ path, success, fail }) { files.has(path) ? success({}) : fail({}) },
        statSync(path) { return { size: files.get(path)?.length || 0 } },
        readFile({ filePath, position = 0, length, success, fail }) {
          const value = files.get(filePath)
          if (!value) return fail({})
          const part = value.subarray(position, length === undefined ? value.length : position + length)
          success({ data: part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) })
        },
      }
    },
  } })
  runtime.storage.set('stemistUser', { id: 'ielts:42' })
  runtime.storage.set('stemistPrivacyEpoch', 9)
  runtime.storage.set('stemistSessionToken', 'current-token')
  const assets = runtime.load('utils/protectedAsset')
  const loader = assets.createProtectedAssetLoader({
    wxApi: runtime.wx,
    membershipGate: async () => { gateCalls++; return { owner: 'ielts:42', epoch: 9, enforcementEnabled: true, active: true, validUntil: nowValue + 30_000 } },
    authorize: async () => 'Bearer current-token',
    onProgress: value => progress.push(value),
  })
  const url = 'https://stem.ieltsist.com/question-assets/paper/qp-1.jpg'
  const imageDigest=crypto.createHash('sha256').update(files.get('wxfile://protected.png')).digest('hex')
  assert.equal(await loader.load(url,{expectedBytes:files.get('wxfile://protected.png').length,sha256:imageDigest}), 'wxfile://protected.png')
  assert.equal(downloads[0].options.url, url)
  assert.equal(downloads[0].options.header.Authorization, 'Bearer current-token')
  assert.deepEqual(Object.keys(downloads[0].options.header), ['Authorization'])
  assert.ok(progress.some(value => value.phase === 'downloading' && value.bytes === 8 && value.total === 15), 'protected image downloads publish measured progress')
  assert.equal(progress.at(-1).phase, 'ready')
  assert.equal(await loader.load(url,{expectedBytes:files.get('wxfile://protected.png').length,sha256:imageDigest}), 'wxfile://protected.png')
  assert.equal(gateCalls, 2, 'every render/preview entry revalidates membership before a local cache hit')
  assert.equal(downloads.length, 1)
  assert.equal(JSON.stringify([...runtime.storage.values()]).includes('current-token'), true, 'only the existing session storage may contain the token')
  assert.equal(JSON.stringify(loader.inspect()).includes('current-token'), false, 'asset cache metadata must not retain the token')
  loader.dispose()
  const proof={owner:'ielts:42',epoch:9,enforcementEnabled:true,active:true}
  assert.equal(await assets.authorizationForIeltsMembership({wxApi:runtime.wx,proof,expected:{owner:'ielts:42',epoch:9},ensureIelts:async()=>({owner:'ielts:42',epoch:9,token:'ielts-native-token'})}),'Bearer ielts-native-token')
  const ieltsLoader=assets.createProtectedAssetLoader({wxApi:runtime.wx,authority:'ielts',membershipGate:async()=>proof,authorize:async()=> 'Bearer ielts-native-token'})
  const ieltsUrl='https://ieltsist.com/generated/writing-pages/cam21/test1/page-30.webp'
  await ieltsLoader.load(ieltsUrl);assert.equal(downloads.at(-1).options.url,ieltsUrl);assert.equal(downloads.at(-1).options.header.Authorization,'Bearer ielts-native-token')
  await assert.rejects(ieltsLoader.load('https://evil.example/generated/writing-pages/cam21/test1/page-30.webp'),error=>error.code==='protected_asset_invalid')
  ieltsLoader.dispose()
  runtime.storage.delete('stemistUser');runtime.storage.delete('stemistSessionToken')
  const safeOffLoader=assets.createProtectedAssetLoader({wxApi:runtime.wx,membershipGate:async()=>({owner:'guest',epoch:9,enforcementEnabled:false,active:false}),authorize:async()=>''})
  await safeOffLoader.load('https://stem.ieltsist.com/question-assets/paper/qp-4.jpg')
  assert.equal(downloads.at(-1).options.header,undefined,'safe-off compatibility may remain anonymous only after a fresh public enforcement=false proof')
  safeOffLoader.dispose()
}

{
  const pending = deferred()
  let activeTask
  const runtime = miniRuntime({ wx: {
    downloadFile(options) { activeTask = { aborted: 0, abort() { this.aborted++ } }; pending.promise.then(options.success); return activeTask },
  } })
  runtime.storage.set('stemistUser', { id: 'ielts:42' })
  runtime.storage.set('stemistPrivacyEpoch', 3)
  runtime.storage.set('stemistSessionToken', 'token')
  const assets = runtime.load('utils/protectedAsset')
  const loader = assets.createProtectedAssetLoader({
    wxApi: runtime.wx,
    membershipGate: async () => ({ owner: 'ielts:42', epoch: 3, enforcementEnabled: true, active: true }),
    authorize: async () => 'Bearer token',
  })
  const request = loader.load('https://stem.ieltsist.com/question-assets/paper/qp-2.jpg')
  await settle()
  runtime.storage.set('stemistUser', { id: 'ielts:99' })
  loader.setScope()
  assert.equal(activeTask.aborted, 1)
  await assert.rejects(request, error => error.code === 'account_changed')
  pending.resolve({ statusCode: 200, tempFilePath: 'wxfile://late.png' })
  await assert.rejects(
    loader.load('https://evil.example/question-assets/paper/qp-2.jpg'),
    error => error.code === 'protected_asset_invalid',
  )
}

{
  for (const statusCode of [401, 403, 503]) {
    let offered = 0
    const runtime = miniRuntime({ wx: {
      downloadFile(options) { setImmediate(() => options.success({ statusCode, tempFilePath: '' })); return { abort() {} } },
    } })
    runtime.storage.set('stemistUser', { id: 'ielts:42' })
    runtime.storage.set('stemistSessionToken', 'token')
    const assets = runtime.load('utils/protectedAsset')
    const loader = assets.createProtectedAssetLoader({
      wxApi: runtime.wx,
      membershipGate: async () => ({ owner: 'ielts:42', epoch: 0, enforcementEnabled: true, active: true }),
      authorize: async () => 'Bearer token',
      onMembershipRequired: () => { offered++ },
    })
    await assert.rejects(
      loader.load('https://stem.ieltsist.com/question-assets/paper/qp-3.jpg'),
      error => error.statusCode === statusCode
        && error.code === ({ 401: 'auth_required', 403: 'membership_required', 503: 'membership_authority_unavailable' })[statusCode],
    )
    assert.equal(offered, statusCode === 403 ? 1 : 0)
  }
}

{
  const runtime = miniRuntime({ wx: {
    downloadFile(options) { setImmediate(() => options.success({ statusCode: 401, tempFilePath: '' })); return { abort() {} } },
  } })
  runtime.storage.set('stemistUser', { id: 'ielts:42' })
  runtime.storage.set('stemistSessionToken', 'stem-token-must-survive')
  runtime.storage.set('stemistIeltsSessionState', { owner: 'ielts:42', epoch: 0, token: 'expired-ielts-token', expiresAt: future })
  const assets = runtime.load('utils/protectedAsset')
  const loader = assets.createProtectedAssetLoader({
    wxApi: runtime.wx,
    authority: 'ielts',
    membershipGate: async () => ({ owner: 'ielts:42', epoch: 0, enforcementEnabled: true, active: true }),
    authorize: async () => 'Bearer expired-ielts-token',
  })
  await assert.rejects(loader.load('https://ieltsist.com/generated/reading-pages/cam21/test1/page-4.webp'), error => error.code === 'auth_required')
  assert.equal(runtime.storage.get('stemistUser').id, 'ielts:42', 'an IELTS token failure must not log out the STEM identity')
  assert.equal(runtime.storage.get('stemistSessionToken'), 'stem-token-must-survive')
  assert.equal(runtime.storage.get('stemistIeltsSessionState').token, '', 'the rejected IELTS token is invalidated for a fresh native exchange')
  assert.equal(runtime.storage.get('stemistIeltsSessionState').expiresAt, '')
}

{
  for (const authority of ['stem', 'ielts']) {
    let downloadOptions, cleared = 0
    const runtime = miniRuntime({ modules: { 'utils/session': { clearLocalSession: () => { cleared++ } } }, wx: {
      downloadFile(options) { downloadOptions = options; return { abort() {} } },
    } })
    runtime.storage.set('stemistUser', { id: 'ielts:42' });runtime.storage.set('stemistPrivacyEpoch', 0);runtime.storage.set('stemistSessionToken', 'stem-token-a')
    runtime.storage.set('stemistIeltsSessionState', { owner: 'ielts:42', epoch: 0, token: 'ielts-token-a', expiresAt: future })
    const assets = runtime.load('utils/protectedAsset'),proof={owner:'ielts:42',epoch:0,enforcementEnabled:true,active:true}
    const loader = assets.createProtectedAssetLoader({wxApi:runtime.wx,authority,membershipGate:async()=>proof,authorize:async()=>authority==='stem'?'Bearer stem-token-a':'Bearer ielts-token-a'})
    const pending=loader.load(authority==='stem'?'https://stem.ieltsist.com/question-assets/paper/qp-9.jpg':'https://ieltsist.com/generated/reading-pages/cam21/test1/page-9.webp');await settle()
    if(authority==='stem')runtime.storage.set('stemistSessionToken','stem-token-b')
    else runtime.storage.set('stemistIeltsSessionState',{owner:'ielts:42',epoch:0,token:'ielts-token-b',expiresAt:future})
    downloadOptions.success({statusCode:401,tempFilePath:''});await assert.rejects(pending,error=>error.code==='auth_required')
    assert.equal(cleared,0,'a late 401 for a stale '+authority+' bearer cannot clear the rotated session')
    assert.equal(authority==='stem'?runtime.storage.get('stemistSessionToken'):runtime.storage.get('stemistIeltsSessionState').token,authority==='stem'?'stem-token-b':'ielts-token-b')
  }
}

console.log('Membership content access: fresh safe-off gate, bounded proof, bearer assets and owner cancellation PASS')

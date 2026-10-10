import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { miniRuntime } from './helpers/mini-runtime.mjs'

const root = path.resolve(import.meta.dirname, '..')
const clone = (value) => JSON.parse(JSON.stringify(value))

function syntheticItems(prefix, count = 101) {
  return Array.from({ length: count }, (_, index) => {
    const ordinal = index + 1
    const rank = ordinal === 21 ? 20 : ordinal > 21 ? ordinal - 1 : ordinal
    return {
      id: `${prefix}-campus-${String(ordinal).padStart(3, '0')}`,
      rank,
      rankLabel: ordinal === 20 || ordinal === 21 ? '=20' : String(rank),
      nameEn: `Synthetic University ${ordinal}`,
      nameZh: `合成大学${ordinal}`,
      country: prefix === 'world' ? 'Synthetic Country' : 'United States',
      website: `https://${prefix}-${ordinal}.synthetic.edu/`,
    }
  })
}

function fixture() {
  return {
    schemaVersion: 'stemist-university-directory-v1',
    updatedAt: '2026-10-10T21:15:07.7481137+08:00',
    examBoards: [
      { id: 'ap', label: 'AP', organization: 'College Board', url: 'https://apstudents.collegeboard.org/' },
      { id: 'ib', label: 'IB', organization: 'International Baccalaureate', url: 'https://www.ibo.org/' },
      { id: 'alevel', label: 'A-Level', organization: 'Cambridge International', url: 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/' },
    ],
    rankings: [
      {
        id: 'qs-world', label: 'QS Synthetic World Ranking', editionYear: 2027, verifiedAt: '2026-10-10T21:15:07.7481137+08:00',
        sourceUrl: 'https://www.topuniversities.com/qs-top-uni-wur', methodologyUrl: 'https://www.topuniversities.com/world-university-rankings/methodology',
        scope: 'world', requestedRankLimit: 100, complete: true, items: syntheticItems('world'),
      },
      {
        id: 'usnews-national', label: 'U.S. News Synthetic National Ranking', editionYear: 2026, verifiedAt: '2026-10-09',
        sourceUrl: 'https://www.usnews.com/synthetic-national-ranking', methodologyUrl: 'https://www.usnews.com/synthetic-methodology',
        scope: 'us-national', requestedRankLimit: 100, complete: true, items: syntheticItems('national', 100),
      },
    ],
  }
}

{
  let request = null
  let fail = false
  const runtime = miniRuntime({ modules: { 'utils/api': { getJson: async (url, options) => {
    request = { url, options }
    if (fail) throw Object.assign(new Error('offline'), { code: 'network_error' })
    return fixture()
  } } } })
  const service = runtime.load('bundles/curricula/universityService')
  assert.equal(service.UNIVERSITY_DIRECTORY_PATH, '/data/university-directory.json')
  assert.equal(service.safeHttpsUrl('https://www.synthetic.edu/path/'), 'https://www.synthetic.edu/path/')
  for (const unsafe of [
    'http://www.synthetic.edu/', 'https://user:pass@www.synthetic.edu/', 'https://www.synthetic.edu/?token=x',
    'https://www.synthetic.edu/#top', 'https://localhost/path', 'https://127.0.0.1/path', 'https://school.local/path',
    'https://www.synthetic.edu:443/path', 'https://www.synthetic.edu/a/../b', 'https://www.synthetic.edu//path', 'https://www.synthetic.edu/<script>',
  ]) assert.equal(service.safeHttpsUrl(unsafe), '', `unsafe URL must be rejected: ${unsafe}`)

  const normalized = service.normalizeDirectory(fixture())
  assert.equal(normalized.examBoards.map((item) => item.id).join(','), 'ap,ib,alevel')
  assert.equal(normalized.rankings[0].items.length, 101)
  assert.equal(normalized.rankings[0].items[19].id, 'world-campus-020')
  assert.equal(normalized.rankings[0].items[20].id, 'world-campus-021', 'distinct tied campuses must not be deduplicated')
  assert.equal(normalized.rankings[0].items[20].rankLabel, '=20', 'server rank labels must be preserved')
  assert.equal(normalized.rankings[0].items[0].hostname, 'world-1.synthetic.edu')
  assert.equal(normalized.examBoards[0].hostname, 'apstudents.collegeboard.org')

  for (const mutate of [
    (value) => { value.schemaVersion = 'other' },
    (value) => { value.examBoards.pop() },
    (value) => { value.examBoards[0].url = 'https://apstudents.collegeboard.org/?ref=x' },
    (value) => { value.examBoards[0].url = 'https://ap.synthetic.org/' },
    (value) => { value.rankings[0].complete = false },
    (value) => { value.rankings[0].requestedRankLimit = 99 },
    (value) => { value.rankings[0].requestedRankLimit = '100' },
    (value) => { value.rankings[0].scope = 'subject' },
    (value) => { value.rankings[0].sourceUrl = 'https://rankings.synthetic.org/world/' },
    (value) => { value.rankings[0].items = value.rankings[0].items.slice(0, 99) },
    (value) => { value.rankings[0].items.forEach((item) => { item.rank = 1; item.rankLabel = '=1' }) },
    (value) => { value.rankings[0].items[0].rank = 101 },
    (value) => { value.rankings[0].items[1].id = value.rankings[0].items[0].id },
    (value) => { value.rankings[0].items[0].website = 'https://intranet.local/' },
  ]) {
    const invalid = fixture(); mutate(invalid)
    assert.throws(() => service.normalizeDirectory(invalid), /大学|排名|课程|网址|格式|数据|标识|范围|官方/)
  }

  const now = Date.parse('2026-10-10T13:00:00Z')
  const live = await service.fetchUniversityDirectory({ now })
  assert.deepEqual(clone(request), { url: '/data/university-directory.json', options: { timeout: 12000, stemAuth: false } })
  assert.equal(live.source, 'network')
  assert.equal(live.directory.schemaVersion, 'stemist-university-directory-v1')
  fail = true
  const cached = await service.fetchUniversityDirectory({ now: now + 60_000 })
  assert.equal(cached.source, 'cache')
  assert.equal(cached.cachedAt, now)
  assert.equal(cached.directory.rankings[0].items[20].rankLabel, '=20')

  const staleRuntime = miniRuntime({ modules: { 'utils/api': { getJson: async () => { throw new Error('offline') } } } })
  staleRuntime.storage.set(service.CACHE_KEY, { schemaVersion: 1, cachedAt: now, payload: fixture() })
  const staleService = staleRuntime.load('bundles/curricula/universityService')
  await assert.rejects(() => staleService.fetchUniversityDirectory({ now: now + service.CACHE_MAX_AGE_MS + 1 }), /暂时无法加载/)
}

{
  const data = fixture()
  let source = 'network'
  let failures = 0
  const clipboard = []
  const toasts = []
  const scrolls = []
  const runtime = miniRuntime({
    wx: {
      setClipboardData: (options) => clipboard.push(options),
      showToast: (options) => toasts.push(options),
      pageScrollTo: (options) => scrolls.push(options),
    },
    modules: { 'bundles/curricula/universityService': {
      fetchUniversityDirectory: async () => {
        if (failures-- > 0) throw new Error('暂时无法加载大学目录，请稍后重试。')
        return { directory: clone(data), source, cachedAt: Date.parse('2026-10-10T12:30:00Z') }
      },
    } },
  })
  const page = runtime.page('bundles/curricula/universities')
  page.route = 'bundles/curricula/universities'
  await page.onLoad({ tab: 'rankings', ranking: 'qs-world', token: 'private-token', query: 'private-query' })
  assert.equal(page.data.activeTab, 'rankings')
  assert.equal(page.data.currentRankingId, 'qs-world')
  assert.equal(page.data.currentRanking.verifiedAt, '2026-10-10')
  assert.equal(page.data.currentRanking.scopeLabel, '全球大学')
  assert.equal(page.data.visibleItems.length, 20)
  assert.equal(page.data.pageCount, 6)
  assert.equal(page.data.visibleItems[19].rankLabel, '=20')
  page.nextPage()
  assert.equal(page.data.visibleItems[0].rankLabel, '=20', 'ties spanning pages keep the source label')
  assert.equal(scrolls.at(-1)?.scrollTop, 0, 'pagination returns to the start so the next universities are visible')
  page.previousPage()
  assert.equal(page.data.pageNumber, 1)
  assert.equal(scrolls.length, 2)
  page.previousPage()
  assert.equal(scrolls.length, 2, 'disabled boundary does not jump the page')
  page.onSearchInput({ detail: { value: '合成大学21' } })
  page.applySearch()
  assert.equal(page.data.visibleItems.length, 1)
  assert.equal(page.data.visibleItems[0].nameEn, 'Synthetic University 21')
  page.onSearchInput({ detail: { value: 'university 2' } })
  page.applySearch()
  assert.ok(page.data.filteredCount > 1, 'English name search is case-insensitive')
  page.clearSearch()
  page.onSearchInput({ detail: { value: 'world-21' } })
  page.applySearch()
  assert.equal(page.data.filteredCount, 1, 'Official hostnames make common English aliases searchable without inventing ranking identities')
  assert.equal(page.data.visibleItems[0].id, 'world-campus-021')
  page.clearSearch()
  page.chooseRanking({ detail: { value: 1 } })
  assert.equal(page.data.currentRankingId, 'usnews-national')
  assert.equal(page.data.currentRanking.scopeLabel, '美国综合大学')
  assert.equal(page.data.visibleItems.length, 20)

  page.chooseTab({ currentTarget: { dataset: { tab: 'official' } } })
  page.chooseBoard({ currentTarget: { dataset: { board: 'ib' } } })
  assert.equal(page.data.activeTab, 'official')
  assert.equal(page.data.selectedBoardId, 'ib')
  page.copyOfficial()
  assert.equal(toasts.length, 0, 'clipboard success must not be announced before the native callback')
  assert.equal(clipboard.at(-1).data, 'https://www.ibo.org/')
  clipboard.at(-1).success()
  assert.equal(toasts.at(-1).title, '官网链接已复制')

  page.chooseTab({ currentTarget: { dataset: { tab: 'rankings' } } })
  page.chooseRanking({ detail: { value: 0 } })
  page.copyUniversity({ currentTarget: { dataset: { id: 'world-campus-001' } } })
  assert.equal(clipboard.at(-1).data, 'https://world-1.synthetic.edu/')
  clipboard.at(-1).fail()
  assert.equal(toasts.at(-1).title, '复制失败，请重试')
  page.copyRankingLink({ currentTarget: { dataset: { kind: 'source' } } })
  assert.equal(clipboard.at(-1).data, 'https://www.topuniversities.com/qs-top-uni-wur')

  let share = page.onShareAppMessage()
  assert.equal(share.path, '/bundles/curricula/universities?tab=rankings&ranking=qs-world')
  assert.doesNotMatch(JSON.stringify(share), /private-|token|query/)
  page.chooseTab({ currentTarget: { dataset: { tab: 'official' } } })
  page.chooseBoard({ currentTarget: { dataset: { board: 'alevel' } } })
  share = page.onShareAppMessage()
  assert.equal(share.path, '/bundles/curricula/universities?tab=official&board=alevel')
  assert.equal(page.onShareTimeline().query, 'tab=official&board=alevel')

  source = 'cache'
  const cachedPage = runtime.page('bundles/curricula/universities')
  await cachedPage.onLoad({ tab: 'official', board: 'ap' })
  assert.equal(cachedPage.data.dataSource, 'cache')
  assert.match(cachedPage.data.cacheNotice, /缓存/)

  failures = 1
  const retryPage = runtime.page('bundles/curricula/universities')
  await retryPage.onLoad()
  assert.match(retryPage.data.error, /暂时无法加载/)
  await retryPage.retry()
  assert.equal(retryPage.data.error, '')
  assert.equal(retryPage.data.visibleItems.length, 20)
}

const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
const curricula = app.subPackages.find((entry) => entry.root === 'bundles/curricula')
assert.ok(curricula?.pages.includes('universities'), 'university directory must stay in the curricula subpackage')
const homeJs = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')
const homeWxml = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8')
assert.equal((homeJs.match(/id\s*:\s*'(?:alevel|ap|ib|ielts|competition|calculator)'/g) || []).length, 6, 'the six primary home entries stay unchanged')
assert.match(homeWxml, /wx:for="\{\{secondaryLinks\}\}"/)
assert.match(homeWxml, /bindtap="openSecondary"/)
const homeConfigRuntime=miniRuntime(),homeConfigService=homeConfigRuntime.load('utils/productConfig'),homeConfig=homeConfigService.readProductConfigSnapshot().config
const universityLink=homeConfig.home.secondary.find(item=>item.id==='university-directory')
assert.equal(universityLink?.label,'大学排名与官网')
assert.equal(homeConfigService.resolveProductAction(homeConfig,universityLink.action)?.url,'/bundles/curricula/universities')
assert.match(fs.readFileSync(path.join(root, 'pages/practice/index.wxml'), 'utf8'), /url="\/bundles\/curricula\/universities\?tab=official&amp;board=alevel"[^>]*>A-Level 官网<\/navigator>/)
const curriculumWxml = fs.readFileSync(path.join(root, 'bundles/curricula/index.wxml'), 'utf8')
assert.match(curriculumWxml, /\/bundles\/curricula\/universities\?tab=official&amp;board=\{\{board\}\}/)
const pageWxml = fs.readFileSync(path.join(root, 'bundles/curricula/universities.wxml'), 'utf8')
const pageWxss = fs.readFileSync(path.join(root, 'bundles/curricula/universities.wxss'), 'utf8')
assert.doesNotMatch(pageWxml, /<web-view\b/i)
assert.match(pageWxml, /大学排名/)
assert.match(pageWxml, /课程官网/)
assert.match(pageWxml, /复制官网/)
assert.match(pageWxml, /item\.rankLabel/)
assert.match(pageWxml, /item\.hostname/)
assert.match(pageWxml, /class="source-actions"/)
assert.doesNotMatch(pageWxml, /class="directory-intro"|class="ranking-name"|class="source-host"|目录更新/)
assert.match(pageWxss, /min-height:\s*44px/)
console.log('University directory: strict public schema, safe URLs, bounded cache, ranking/search/pagination, clipboard, share and native routing passed.')

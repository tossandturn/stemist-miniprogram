import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  MINIMUM_MAIN_PACKAGE_SAVINGS_BYTES,
  NATIVE_PACKAGE_TRANSFORM,
  transformNativePackageFile,
} from './helpers/native-package-transform.mjs'
import {
  MAIN_PACKAGE_MINIMUM_HEADROOM_BYTES,
  nativeAppManifest,
  packageRootForPath,
  runtimePackageBudgets,
} from './helpers/native-app-manifest.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const jsonHash = value => hash(JSON.stringify(value))
const portable = value => value.replaceAll('\\', '/')

function runNode(cwd, ...args) {
  return execFileSync(process.execPath, args, { cwd, encoding: 'utf8' }).trim()
}

function runGit(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function walkFiles(directory) {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...walkFiles(absolute))
    else if (entry.isFile()) files.push(absolute)
  }
  return files
}

function copyFixture(fixtureRoot) {
  for (const directory of ['bundles', 'components', 'design-system', 'pages', 'scripts', 'third_party', 'utils']) {
    fs.cpSync(path.join(root, directory), path.join(fixtureRoot, directory), { recursive: true })
  }
  for (const name of ['.gitattributes', '.gitignore', 'app.js', 'app.json', 'app.wxss', 'package.json', 'package-lock.json', 'project.config.json', 'sitemap.json']) {
    fs.copyFileSync(path.join(root, name), path.join(fixtureRoot, name))
  }
  fs.mkdirSync(path.join(fixtureRoot, 'node_modules'), { recursive: true })
  fs.cpSync(path.join(root, 'node_modules', 'esbuild'), path.join(fixtureRoot, 'node_modules', 'esbuild'), { recursive: true })
  fs.cpSync(path.join(root, 'node_modules', '@esbuild'), path.join(fixtureRoot, 'node_modules', '@esbuild'), { recursive: true })
  runGit(fixtureRoot, 'init', '--quiet')
  runGit(fixtureRoot, 'config', 'core.autocrlf', 'false')
  runGit(fixtureRoot, 'config', 'user.name', 'Stemist package regression')
  runGit(fixtureRoot, 'config', 'user.email', 'package-regression.invalid')
  runGit(fixtureRoot, 'add', '--all')
  runGit(fixtureRoot, 'commit', '--quiet', '--no-gpg-sign', '-m', 'ephemeral package fixture')
}

function miniRuntimeAt(runtimeRoot, { modules = {} } = {}) {
  const storage = new Map()
  const cache = new Map()
  let requests = 0
  const wx = {
    getStorageSync: key => storage.has(key) ? storage.get(key) : '',
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key),
    getStorageInfoSync: () => ({ keys: [...storage.keys()] }),
    getSystemInfoSync: () => ({ windowWidth: 390, windowHeight: 780, deviceType: 'phone', model: 'iPhone' }),
  }
  function load(relative) {
    const normalized = portable(relative).replace(/\.js$/, '')
    if (Object.hasOwn(modules, normalized)) return modules[normalized]
    if (cache.has(normalized)) return cache.get(normalized)
    const filename = path.join(runtimeRoot, `${normalized}.js`)
    const module = { exports: {} }
    let definition
    const context = {
      module,
      exports: module.exports,
      wx,
      getApp: () => ({ globalData: {} }),
      getCurrentPages: () => [],
      Page: value => { definition = value },
      Component: value => { definition = value },
      setTimeout,
      clearTimeout,
      setInterval: (...args) => { const timer = setInterval(...args); timer.unref(); return timer },
      clearInterval,
      console,
      require: name => load(path.posix.join(path.posix.dirname(normalized), name)),
    }
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename })
    const exported = definition || module.exports
    cache.set(normalized, exported)
    return exported
  }
  return { load, storage, get requests() { return requests }, countRequest() { requests++ } }
}

function assertMixedCommonJsTransform() {
  const source = Buffer.from(`/*! retained-license */\nconst fallback = 'ready'\nfunction named(value) { return \`${'${value?.label ?? fallback}'}\` }\nconst rx = /a\\/b/u\nmodule.exports = { named, arrow: (value = 1) => value + 2, match: value => rx.test(value) }\n`, 'utf8')
  const result = transformNativePackageFile('fixtures/mixed-commonjs.js', source)
  assert.equal(result.transform, NATIVE_PACKAGE_TRANSFORM.id)
  assert.match(result.bytes.toString('utf8'), /retained-license/)
  const module = { exports: {} }
  const wrapper = vm.runInNewContext(`(function(module,exports,require){${result.bytes.toString('utf8')}\n})`)
  wrapper(module, module.exports, () => { throw new Error('fixture must not import') })
  assert.equal(module.exports.named({ label: 'ok' }), 'ok')
  assert.equal(module.exports.named.name, 'named', 'whitespace-only transform must preserve function names')
  assert.equal(module.exports.arrow(), 3)
  assert.equal(module.exports.match('a/b'), true)
}

function validatePackage({ fixtureRoot, outputRoot, receipt, summary }) {
  assert.equal(receipt.schemaVersion, 'stemist-native-upload-v3')
  assert.deepEqual(receipt.transform, NATIVE_PACKAGE_TRANSFORM)
  assert.deepEqual(summary.transform, NATIVE_PACKAGE_TRANSFORM)
  assert.equal(receipt.minimumHeadroomBytes, MAIN_PACKAGE_MINIMUM_HEADROOM_BYTES)
  assert.equal(summary.minimumHeadroom, MAIN_PACKAGE_MINIMUM_HEADROOM_BYTES)
  assert.ok(receipt.mainPackageSavingsBytes >= MINIMUM_MAIN_PACKAGE_SAVINGS_BYTES)
  assert.equal(summary.mainPackageSavingsBytes, receipt.mainPackageSavingsBytes)
  assert.equal(summary.sourceMainPackageBytes, receipt.sourceMainPackageBytes)
  assert.equal(summary.mainPackageBytes, receipt.mainPackage.bytes)
  assert.equal(summary.mainPackageHeadroom, receipt.mainPackage.headroom)
  assert.equal(summary.runtimeManifestSha256, receipt.runtimeManifestSha256)
  assert.equal(summary.sourceManifestSha256, receipt.sourceManifestSha256)

  const app = nativeAppManifest(JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'app.json'), 'utf8')))
  const outputManifest = []
  const receiptPaths = new Set()
  for (const item of receipt.files) {
    assert.ok(!receiptPaths.has(item.path), `duplicate receipt path ${item.path}`)
    receiptPaths.add(item.path)
    const source = fs.readFileSync(path.join(fixtureRoot, item.path))
    const output = fs.readFileSync(path.join(outputRoot, item.path))
    assert.equal(item.sourceBytes, source.length, `${item.path} source byte count`)
    assert.equal(item.sourceSha256, hash(source), `${item.path} source hash`)
    assert.equal(item.bytes, output.length, `${item.path} output byte count`)
    assert.equal(item.sha256, hash(output), `${item.path} output hash`)
    const transformId=NATIVE_PACKAGE_TRANSFORM.overrides.find(override=>override.paths.includes(item.path))?.id||NATIVE_PACKAGE_TRANSFORM.id
    assert.equal(item.transform, item.path.endsWith('.js') ? transformId : 'identity')
    if (item.transform === 'identity') assert.equal(item.sha256, item.sourceSha256)
    if (item.path.endsWith('.js')) new vm.Script(output.toString('utf8'), { filename: item.path })
    outputManifest.push({ path: item.path, bytes: item.bytes })
  }
  const packagedPaths = walkFiles(outputRoot)
    .map(absolute => portable(path.relative(outputRoot, absolute)))
    .filter(relative => relative !== 'project.config.json')
    .sort()
  assert.deepEqual(packagedPaths, [...receiptPaths].sort(), 'receipt must cover every packaged runtime file')
  const budget = runtimePackageBudgets(outputManifest, app.subPackages)
  assert.equal(receipt.runtimeManifestSha256, jsonHash(receipt.files.map(({ path, bytes, sha256, transform }) => ({ path, bytes, sha256, transform }))))
  assert.equal(receipt.sourceManifestSha256, jsonHash(receipt.files.map(({ path, sourceBytes, sourceSha256 }) => ({ path, sourceBytes, sourceSha256 }))))
  assert.equal(budget.mainPackageBytes, receipt.mainPackage.bytes)
  assert.equal(budget.mainPackageHeadroom, receipt.mainPackage.headroom)
  assert.deepEqual(budget.subPackages, receipt.subPackages)
  const sourceMainBytes = receipt.files
    .filter(item => packageRootForPath(item.path, app.subPackages) === null)
    .reduce((sum, item) => sum + item.sourceBytes, 0)
  assert.equal(sourceMainBytes, receipt.sourceMainPackageBytes)
  assert.equal(sourceMainBytes - budget.mainPackageBytes, receipt.mainPackageSavingsBytes)
}

assertMixedCommonJsTransform()
const uploadTransform=NATIVE_PACKAGE_TRANSFORM.overrides.find(item=>item.paths.includes('utils/coachImageUpload.js'))
assert.ok(uploadTransform,'upload transport must preserve the128KiB package headroom with a reviewed transform')
assert.equal(uploadTransform.id,'esbuild-upload-headroom-compact-v1')
assert.equal(uploadTransform.options.keepNames,true)
assert.equal(uploadTransform.options.minifySyntax,true)
assert.deepEqual([...uploadTransform.paths].sort(),['pages/calculator/index.js','utils/coachImageUpload.js','utils/cwController.js','utils/cwEditor.js'])
const directoryTransform=NATIVE_PACKAGE_TRANSFORM.overrides.find(item=>item.paths.includes('pages/index/index.js'))
assert.equal(directoryTransform.id,'esbuild-directory-home-compact-v1')
assert.deepEqual([...directoryTransform.paths].sort(),['pages/index/index.js','utils/productConfig.js'])
assert.equal(directoryTransform.options.keepNames,true)
assert.equal(directoryTransform.options.minifySyntax,true)
const pdfTransform=NATIVE_PACKAGE_TRANSFORM.overrides.find(item=>item.paths.includes('utils/pdfRangeCache.js'))
assert.equal(pdfTransform.id,'esbuild-pdf-transfer-compact-v1','PDF transfer gets its own reviewed compact transform rather than reducing headroom')
assert.equal(pdfTransform.options.minifySyntax,true)
assert.equal(pdfTransform.options.keepNames,true)
assert.deepEqual([...pdfTransform.paths].sort(),['utils/pdfDownload.js','utils/pdfRangeCache.js'])
assert.equal(NATIVE_PACKAGE_TRANSFORM.engine, 'esbuild')
assert.equal(NATIVE_PACKAGE_TRANSFORM.version, '0.28.2')
assert.deepEqual(NATIVE_PACKAGE_TRANSFORM.options, {
  charset: 'utf8',
  legalComments: 'inline',
  loader: 'js',
  minifyIdentifiers: false,
  minifySyntax: false,
  minifyWhitespace: true,
  sourcemap: false,
  treeShaking: false,
})

const protectedPaths = ['project.config.json', 'utils/ieltsBootstrap.js', 'utils/ieltsTaskBootstrap.js']
const protectedBefore = Object.fromEntries(protectedPaths.map(relative => [relative, hash(fs.readFileSync(path.join(root, relative)))]))
const workspaceParent = path.dirname(root)
const workspace = fs.mkdtempSync(path.join(workspaceParent, 'stemist-native-package-test-'))
assert.equal(path.dirname(path.resolve(workspace)), path.resolve(workspaceParent))
assert.match(path.basename(workspace), /^stemist-native-package-test-/)

try {
  const fixtureRoot = path.join(workspace, 'repo')
  const firstOutput = path.join(workspace, 'package-one')
  const secondOutput = path.join(workspace, 'package-two')
  fs.mkdirSync(fixtureRoot)
  copyFixture(fixtureRoot)

  const check = JSON.parse(runNode(fixtureRoot, 'scripts/build-native-package.mjs', '--check-only'))
  assert.equal(check.status, 'pass')
  assert.ok(check.mainPackageSavingsBytes >= 35 * 1024, 'whitespace minification must recover at least 35 KiB')

  const firstSummary = JSON.parse(runNode(fixtureRoot, 'scripts/build-native-package.mjs', '--out', firstOutput))
  const secondSummary = JSON.parse(runNode(fixtureRoot, 'scripts/build-native-package.mjs', '--out', secondOutput))
  const firstManifestPath = `${firstOutput}-manifest.json`
  const secondManifestPath = `${secondOutput}-manifest.json`
  const firstReceipt = JSON.parse(fs.readFileSync(firstManifestPath, 'utf8'))
  const secondReceipt = JSON.parse(fs.readFileSync(secondManifestPath, 'utf8'))

  validatePackage({ fixtureRoot, outputRoot: firstOutput, receipt: firstReceipt, summary: firstSummary })
  validatePackage({ fixtureRoot, outputRoot: secondOutput, receipt: secondReceipt, summary: secondSummary })
  assert.deepEqual(firstReceipt, secondReceipt, 'two package builds from identical source must have identical receipts')
  assert.equal(hash(fs.readFileSync(firstManifestPath)), hash(fs.readFileSync(secondManifestPath)), 'manifest bytes must be deterministic')
  assert.equal(hash(fs.readFileSync(path.join(firstOutput, 'project.config.json'))), hash(fs.readFileSync(path.join(secondOutput, 'project.config.json'))))

  const sourceRuntime = miniRuntimeAt(fixtureRoot)
  const packagedRuntime = miniRuntimeAt(firstOutput)
  assert.equal(jsonHash(packagedRuntime.load('utils/ieltsBootstrap')), jsonHash(sourceRuntime.load('utils/ieltsBootstrap')))
  assert.equal(jsonHash(packagedRuntime.load('utils/ieltsTaskBootstrap')), jsonHash(sourceRuntime.load('utils/ieltsTaskBootstrap')))

  let networkRequests = 0
  const offlineRuntime = miniRuntimeAt(firstOutput, { modules: {
    'utils/api': {
      IELTS_API_BASE: 'https://ieltsist.com',
      requestIeltsJson: async () => { networkRequests++; throw new Error('offline') },
    },
  } })
  const content = offlineRuntime.load('utils/ieltsContent')
  const bank = await content.loadIeltsContent()
  assert.ok(bank.reading.length >= 72)
  assert.ok(bank.listening.length >= 72)
  const reading = await content.getIeltsTask('reading', bank.reading[0].id)
  assert.equal(reading.questions.length, 40)
  assert.equal(networkRequests, 0, 'the transformed package must preserve the offline-first IELTS path')

  const pdfSuites=['test-pdf-download-progress.mjs','test-pdf-range-cache.mjs','test-pdf-transfer-pipeline.mjs','test-pdf-download-access.mjs']
  for(const suite of pdfSuites){
    execFileSync(process.execPath,[path.join('scripts',suite)],{cwd:fixtureRoot,encoding:'utf8',windowsHide:true,env:{...process.env,STEMIST_TEST_RUNTIME_ROOT:firstOutput},stdio:['ignore','pipe','pipe']})
  }
  const chapterSuites=['test-chapter-coach.mjs','test-chapter-coach-render.mjs','test-chapter-coach-handoff.mjs','test-chapter-coach-page.mjs','test-native-practice.mjs','test-native-source-regions.mjs','test-native-choice.mjs','test-native-coach-photo.mjs','test-coach-four-modes.mjs','test-session-cleanup.mjs']
  for(const suite of chapterSuites)execFileSync(process.execPath,[path.join('scripts',suite)],{cwd:fixtureRoot,encoding:'utf8',windowsHide:true,env:{...process.env,STEMIST_TEST_RUNTIME_ROOT:firstOutput},stdio:['ignore','pipe','pipe']})
  const examSuites=['test-native-exam-catalog.mjs','test-native-exam-page.mjs','test-native-flow-contracts.mjs','test-writing-source-guard.mjs','test-native-bootstrap.mjs','test-native-content-loading.mjs']
  for(const suite of examSuites)execFileSync(process.execPath,[path.join('scripts',suite)],{cwd:fixtureRoot,encoding:'utf8',windowsHide:true,env:{...process.env,STEMIST_TEST_RUNTIME_ROOT:firstOutput},stdio:['ignore','pipe','pipe']})
  const cropSuites=['test-coach-recrop.mjs','test-crop-gesture-stability.mjs','test-crop-export.mjs','test-native-photo-cancel.mjs','test-camera-lifecycle.mjs','test-native-paper.mjs']
  for(const suite of cropSuites)execFileSync(process.execPath,[path.join('scripts',suite)],{cwd:fixtureRoot,encoding:'utf8',windowsHide:true,env:{...process.env,STEMIST_TEST_RUNTIME_ROOT:firstOutput},stdio:['ignore','pipe','pipe']})
  const taskSuites=['test-coach-compact-ui.mjs','test-coach-mode-copy.mjs','test-coach-task-defaults.mjs','test-coach-task-progress.mjs','test-coach-task-selection.mjs','test-coach-task-job.mjs','test-coach-task-controls.mjs','test-coach-task-history.mjs','test-coach-task-page.mjs','test-native-answer.mjs','test-coach-service.mjs','test-device-profile.mjs','test-private-page-owner-boundaries.mjs','test-calculator.mjs','test-cw-calculator.mjs','test-cw-natural-input.mjs','test-cw-touch-cursor.mjs','test-cw-solver.mjs','test-cw-solver-page.mjs','test-cw-complex.mjs','test-cw-complex-page.mjs']
  for(const suite of taskSuites)execFileSync(process.execPath,[path.join('scripts',suite)],{cwd:fixtureRoot,encoding:'utf8',windowsHide:true,env:{...process.env,STEMIST_TEST_RUNTIME_ROOT:firstOutput},stdio:['ignore','pipe','pipe']})
  const compiledHeadroomSuites=['test-practice-entry.mjs','test-notebook-entry-scope.mjs','test-paper-page-service.mjs','test-ielts-bootstrap-packed.mjs']
  for(const suite of compiledHeadroomSuites)execFileSync(process.execPath,[path.join('scripts',suite)],{cwd:fixtureRoot,encoding:'utf8',windowsHide:true,env:{...process.env,STEMIST_TEST_RUNTIME_ROOT:firstOutput},stdio:['ignore','pipe','pipe']})

  assert.equal(check.mainPackageBytes, firstReceipt.mainPackage.bytes)
  assert.equal(check.mainPackageHeadroom, firstReceipt.mainPackage.headroom)
  assert.equal(check.sourceMainPackageBytes, firstReceipt.sourceMainPackageBytes)
  assert.equal(check.runtimeManifestSha256, firstReceipt.runtimeManifestSha256)
  assert.equal(check.sourceManifestSha256, firstReceipt.sourceManifestSha256)
  console.log(JSON.stringify({
    status: 'pass',
    transform: NATIVE_PACKAGE_TRANSFORM.id,
    mainPackageBytes: firstReceipt.mainPackage.bytes,
    mainPackageSavingsBytes: firstReceipt.mainPackageSavingsBytes,
    mainPackageHeadroom: firstReceipt.mainPackage.headroom,
    deterministicBuilds: 2,
    verifiedFiles: firstReceipt.files.length,
    offlineReadingQuestions: reading.questions.length,
    packagedPdfSuites: pdfSuites.length,
    packagedChapterSuites: chapterSuites.length,
    packagedExamSuites: examSuites.length,
    packagedCropSuites: cropSuites.length,
    packagedTaskAndHeadroomSuites: taskSuites.length,
    packagedCompiledHeadroomSuites: compiledHeadroomSuites.length,
  }))
} finally {
  for (const [relative, before] of Object.entries(protectedBefore)) {
    assert.equal(hash(fs.readFileSync(path.join(root, relative))), before, `${relative} must remain unchanged`)
  }
  assert.equal(path.dirname(path.resolve(workspace)), path.resolve(workspaceParent))
  assert.match(path.basename(workspace), /^stemist-native-package-test-/)
  fs.rmSync(workspace, { recursive: true, force: true })
}

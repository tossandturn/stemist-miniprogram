import * as esbuild from 'esbuild'

const EXPECTED_ESBUILD_VERSION = '0.28.2'
if (esbuild.version !== EXPECTED_ESBUILD_VERSION) {
  throw new Error(`Native package transform requires esbuild ${EXPECTED_ESBUILD_VERSION}; found ${esbuild.version || 'unknown'}`)
}

export const MINIMUM_MAIN_PACKAGE_SAVINGS_BYTES = 35 * 1024
export const NATIVE_PACKAGE_TRANSFORM = Object.freeze({
  id: 'esbuild-whitespace-v1',
  engine: 'esbuild',
  version: EXPECTED_ESBUILD_VERSION,
  overrides: Object.freeze([Object.freeze({
    id: 'esbuild-coach-effort-foundation-compact-v1',
    paths: Object.freeze(['utils/nativePaperGrading.js','utils/paperCatalog.js','utils/sourceRegion.js','utils/transferProgress.js','utils/announcements.js','components/coach-effort/index.js']),
    options: Object.freeze({ minifyIdentifiers: true, minifySyntax: true, keepNames: true, format: 'cjs' }),
  }),Object.freeze({
    id: 'esbuild-directory-home-compact-v1',
    paths: Object.freeze(['pages/index/index.js','utils/productConfig.js']),
    options: Object.freeze({ minifyIdentifiers: true, minifySyntax: true, keepNames: true, format: 'cjs' }),
  }),Object.freeze({
    id: 'esbuild-crop-recovery-compact-v1',
    paths: Object.freeze(['pages/crop/crop.js','pages/coach/index.js','utils/crop.js','pages/stem/camera.js','pages/stem/paper.js']),
    options: Object.freeze({ minifyIdentifiers: true, minifySyntax: true, keepNames: true, format: 'cjs' }),
  }),Object.freeze({
    id: 'esbuild-academic-identifiers-v1',
    paths: Object.freeze(['utils/academicAnswer.js', 'utils/nativeMath.js','utils/nativeAnswer.js']),
    options: Object.freeze({ minifyIdentifiers: true, keepNames: true, format: 'cjs' }),
  }),Object.freeze({
    id: 'esbuild-coach-network-identifiers-v1',
    paths: Object.freeze(['utils/api.js','utils/image.js']),
    options: Object.freeze({ minifyIdentifiers: true, keepNames: true, format: 'cjs' }),
  }),Object.freeze({
    id: 'esbuild-coach-recovery-compact-v1',
    paths: Object.freeze(['utils/coachJob.js']),
    options: Object.freeze({ minifyIdentifiers: true, minifySyntax: true, keepNames: true, format: 'cjs' }),
  }),Object.freeze({
    id: 'esbuild-source-action-identifiers-v1',
    paths: Object.freeze(['utils/coachSource.js']),
    options: Object.freeze({ minifyIdentifiers: true, keepNames: true, format: 'cjs' }),
  }),Object.freeze({
    id: 'esbuild-pdf-transfer-compact-v1',
    paths: Object.freeze(['utils/pdfDownload.js','utils/pdfRangeCache.js']),
    options: Object.freeze({ minifyIdentifiers: true, minifySyntax: true, keepNames: true, format: 'cjs' }),
  }),Object.freeze({
    id: 'esbuild-ielts-exam-compact-v1',
    paths: Object.freeze(['utils/nativeExam.js','utils/ieltsContent.js','pages/ielts/exam.js']),
    options: Object.freeze({ minifyIdentifiers: true, minifySyntax: true, keepNames: true, format: 'cjs' }),
  }),Object.freeze({
    id: 'esbuild-chapter-handoff-compact-v1',
    paths: Object.freeze(['utils/nativePractice.js','utils/nativeCoachPhoto.js','utils/session.js','pages/stem/practice.js']),
    options: Object.freeze({ minifyIdentifiers: true, minifySyntax: true, keepNames: true, format: 'cjs' }),
  }),Object.freeze({
    id: 'esbuild-coach-stream-identifiers-v1',
    paths: Object.freeze(['utils/coach.js','utils/nativeSession.js','utils/coachSession.js','utils/coachStream.js','utils/operationProgress.js','utils/nativeCoachPhoto.js','pages/coach/index.js','pages/stem/coach.js']),
    options: Object.freeze({ minifyIdentifiers: true, keepNames: true, format: 'cjs' }),
  })]),
  options: Object.freeze({
    charset: 'utf8',
    legalComments: 'inline',
    loader: 'js',
    minifyIdentifiers: false,
    minifySyntax: false,
    minifyWhitespace: true,
    sourcemap: false,
    treeShaking: false,
  }),
})

export function transformNativePackageFile(relative, sourceBytes) {
  if (typeof relative !== 'string' || !Buffer.isBuffer(sourceBytes)) throw new TypeError('Native package transform requires a path and Buffer')
  if (!relative.endsWith('.js')) return { bytes: sourceBytes, transform: 'identity' }
  const source = sourceBytes.toString('utf8')
  if (!Buffer.from(source, 'utf8').equals(sourceBytes)) throw new Error(`Runtime JavaScript is not valid UTF-8: ${relative}`)
  try {
    const override = NATIVE_PACKAGE_TRANSFORM.overrides.find(item => item.paths.includes(relative.replaceAll('\\', '/')))
    const result = esbuild.transformSync(source, {
      ...NATIVE_PACKAGE_TRANSFORM.options,
      ...override?.options,
      logLevel: 'silent',
      sourcefile: relative.replaceAll('\\', '/'),
    })
    return { bytes: Buffer.from(result.code, 'utf8'), transform: override?.id || NATIVE_PACKAGE_TRANSFORM.id }
  } catch (error) {
    throw new Error(`Unable to transform runtime JavaScript ${relative}: ${error?.message || error}`, { cause: error })
  }
}

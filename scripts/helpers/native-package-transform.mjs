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
    const result = esbuild.transformSync(source, {
      ...NATIVE_PACKAGE_TRANSFORM.options,
      logLevel: 'silent',
      sourcefile: relative.replaceAll('\\', '/'),
    })
    return { bytes: Buffer.from(result.code, 'utf8'), transform: NATIVE_PACKAGE_TRANSFORM.id }
  } catch (error) {
    throw new Error(`Unable to transform runtime JavaScript ${relative}: ${error?.message || error}`, { cause: error })
  }
}

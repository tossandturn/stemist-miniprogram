import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname, '..')
const names = fs.readdirSync(path.join(root, 'design-system/topic-icons')).sort()
const digest = value => crypto.createHash('sha256').update(value).digest('hex')
const expected = '61fae8a47315bbae2771a54b8c9ac391f04e26e562124633b54e2650b3b654af'
const records = names.map(name => {
  const relative = 'design-system/topic-icons/' + name
  const bytes = fs.readFileSync(path.join(root, relative))
  const canonical = execFileSync('git', ['show', 'HEAD:' + relative], { cwd: root, windowsHide: true })
  assert.equal(bytes.toString('utf8').replace(/\r\n/g, '\n'), canonical.toString('utf8'), 'Only checkout line endings may differ: ' + relative)
  return [name, digest(canonical)]
})
assert.equal(names.length, 17)
assert.equal(digest(JSON.stringify(records)), expected, 'Reviewed Git icon content must remain unchanged')
assert.match(fs.readFileSync(path.join(root, '.gitattributes'), 'utf8'), /^design-system\/topic-icons\/\*\.svg text eol=lf$/m)
const checkout = fs.mkdtempSync(path.join(path.dirname(root), 'topic-icons-eol-'))
try {
  const files = ['.gitattributes', ...names.map(name => 'design-system/topic-icons/' + name)]
  execFileSync('git', ['-c', 'core.autocrlf=true', 'checkout-index', '--prefix=' + checkout.replaceAll('\\', '/') + '/', '--stdin'], { cwd: root, input: files.join('\n') + '\n', stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  const manifest = names.map(name => {
    const bytes = fs.readFileSync(path.join(checkout, 'design-system/topic-icons', name))
    assert.equal(bytes.includes(Buffer.from('\r\n')), false)
    return [name, digest(bytes)]
  })
  assert.equal(digest(JSON.stringify(manifest)), expected)
} finally {
  const absolute = path.resolve(checkout)
  if (path.dirname(absolute) !== path.dirname(root) || !path.basename(absolute).startsWith('topic-icons-eol-')) throw new Error('Unexpected temporary checkout path')
  fs.rmSync(absolute, { recursive: true, force: true })
}
console.log('Topic icons: all 17 reviewed Git bytes survive a Windows autocrlf checkout PASS')

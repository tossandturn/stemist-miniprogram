import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const toolRoot = process.env.WECHAT_DEVTOOLS_ROOT || 'D:\\微信web开发者工具'
const wcc = path.join(toolRoot, 'resources', 'app.asar.unpacked', 'node_modules', 'wcc-exec', 'wcc.exe')
const wcsc = path.join(toolRoot, 'resources', 'app.asar.unpacked', 'node_modules', 'wcc-exec', 'wcsc.exe')

if (process.platform !== 'win32' || !fs.existsSync(wcc) || !fs.existsSync(wcsc)) {
  console.log('WeChat compiler not found; set WECHAT_DEVTOOLS_ROOT to run this optional check.')
  process.exit(0)
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stemist-wx-'))
const compile = (executable, args, label) => {
  const result = spawnSync(executable, args, { cwd: root, stdio: 'ignore', windowsHide: true })
  if (result.status !== 0) throw new Error(`${label} exited with ${result.status}`)
}

try {
  for (const file of fs.readdirSync(root, { recursive: true })) {
    const absolute = path.join(root, file)
    if (file.endsWith('.wxml')) compile(wcc, [absolute, '-o', path.join(tempRoot, `${path.basename(file)}.js`)], `WXML ${file}`)
    if (file.endsWith('.wxss')) compile(wcsc, ['-lc', absolute, '-o', path.join(tempRoot, `${path.basename(file)}.js`)], `WXSS ${file}`)
  }
  console.log('WeChat WXML/WXSS compiler checks passed.')
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true })
}

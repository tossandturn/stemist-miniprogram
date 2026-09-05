import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

export function miniRuntime({ wx = {}, modules = {}, globals = {} } = {}) {
  const root = path.resolve(import.meta.dirname, '../..')
  const storage = new Map()
  const calls = []
  const api = {
    getSystemInfoSync: () => ({ windowWidth: 390, windowHeight: 780, deviceType: 'phone', model: 'iPhone' }),
    getStorageSync: (key) => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: (key) => storage.delete(key),
    getStorageInfoSync: () => ({ keys: [...storage.keys()] }),
    navigateTo: (options) => { calls.push(options); options.complete?.({}) },
    redirectTo: (options) => { calls.push(options); options.complete?.({}) },
    navigateBack: (options = {}) => { calls.push(options); options.success?.({}) },
    ...wx,
  }
  const cache = new Map()
  function load(relative) {
    const normalized = relative.replace(/\\/g, '/').replace(/\.js$/, '')
    if (modules[normalized]) return modules[normalized]
    if (cache.has(normalized)) return cache.get(normalized)
    const filename = path.join(root, `${normalized}.js`)
    const module = { exports: {} }
    let definition
    const context = {
      module, exports: module.exports, wx: api, getApp: () => ({ globalData: {} }),
      getCurrentPages: () => [], Page: (value) => { definition = value },
      Component: (value) => { definition = value }, setTimeout, clearTimeout, console,
      require: (name) => load(path.posix.join(path.posix.dirname(normalized), name)),
      ...globals,
    }
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename })
    const exported = definition || module.exports
    cache.set(normalized, exported)
    return exported
  }
  function page(relative) {
    const definition = load(relative)
    // Copy definition before data; Object.assign in the previous harness
    // overwrote the cloned data with the shared Page definition.
    return { ...definition, data: JSON.parse(JSON.stringify(definition.data)), setData(patch, callback) { Object.assign(this.data, patch); callback?.() } }
  }
  return { load, page, wx: api, storage, calls }
}

export const settle = () => new Promise((resolve) => setImmediate(resolve))
export function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

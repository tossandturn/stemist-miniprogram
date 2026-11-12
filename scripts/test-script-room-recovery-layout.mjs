import assert from 'node:assert/strict'
import fs from 'node:fs'
const markup=fs.readFileSync(new URL('../bundles/coach/scriptRoom.wxml',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../bundles/coach/scriptRoom.wxss',import.meta.url),'utf8')
assert.match(markup,/class="room-error-message"/)
assert.match(markup,/class="room-error-actions"/)
for(const action of ['open','returnToScripts','retryAction','retrySync'])assert.match(markup,new RegExp('bindtap="'+action+'"'))
const error=css.match(/\.room-error\{([^}]+)\}/)?.[1]||''
assert.doesNotMatch(error,/max-height\s*:\s*140px|overflow\s*:\s*(?:hidden|auto)/,'error recovery controls must not be clipped inside a non-scrollable view')
assert.match(css,/\.room-error-actions\{[^}]*display:flex[^}]*flex-wrap:wrap/)
assert.match(css,/\.room-error-actions \.text-button\{[^}]*min-height:44px[^}]*margin:0/)
console.log('PASS script room recovery actions: no fixed-height clipping, explicit message/action groups, wrapping 44px controls')

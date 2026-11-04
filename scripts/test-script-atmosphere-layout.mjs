import assert from 'node:assert/strict'
import fs from 'node:fs'
const text=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8')
const wxml=text('bundles/coach/scriptRoom.wxml')
assert.match(wxml,/scene-intro/,'a scene opening must be visible in the native template')
assert.match(wxml,/bindtap="dismissScene"/);assert.match(wxml,/bindtap="replayScene"/);assert.match(wxml,/bindchange="setMotion"/)
assert.match(wxml,/canChat && !introOpen && !settingsOpen && !menuOpen/,'native textarea must not overlay dialogs')
assert.match(wxml,/windowHeight < 440/,'short available windows need compact controls even without viewport media changes')
const css=text('bundles/coach/scriptAtmosphere.wxss')
for(const name of ['rain','velvet','fog','stars'])assert.match(css,new RegExp('theme-'+name))
assert.match(css,/prefers-reduced-motion/);assert.match(css,/motion-off/);assert.match(css,/safe-area-inset-bottom/)
assert.match(css,/min-height:\s*44px/);assert.doesNotMatch(css,/backdrop-filter|\bblur\(/,'avoid expensive full-screen blur')
assert.match(css,/button\.room-menu-trigger\{[^}]*width:68px/,'native menu button must have an explicit width')
assert.match(css,/button\.story-scene-action\{[^}]*width:0/,'native scene entry must flex instead of using WeChat intrinsic width')
const luminance=hex=>{const v=hex.slice(1).match(/../g).map(s=>parseInt(s,16)/255).map(s=>s<=.04045?s/12.92:((s+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2]}
const contrast=(a,b)=>{a=luminance(a);b=luminance(b);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)}
for(const [surface,foreground,muted,accent,onAccent]of [
 ['#302720','#fff2db','#c8bba4','#e7b475','#2b1c0c'],
 ['#2b2029','#f8edf0','#cab6c0','#dfa4ac','#271216'],
 ['#192b33','#e8f3ef','#a6c0c4','#8cc9be','#102c2d'],
 ['#1d2b43','#f2f0dc','#b9c8dc','#e3c88a','#2d250e'],
]){assert.ok(contrast(surface,foreground)>=4.5);assert.ok(contrast(surface,muted)>=4.5);assert.ok(contrast(accent,onAccent)>=4.5)}
assert.doesNotMatch(text('bundles/coach/scriptRoom.js'),/createInnerAudioContext|scriptAtmosphereAudio|setInnerAudioOption/)
assert.ok(!fs.existsSync(new URL('../bundles/coach/ambience/station-rain.mp3',import.meta.url)),'cancelled audio cannot enter upload bundle')
console.log('PASS four visual themes, accessible contrast, skippable intro, reduced motion, safe-area controls and no audio')

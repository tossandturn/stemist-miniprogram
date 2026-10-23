import fs from 'node:fs'
import assert from 'node:assert/strict'

const css = fs.readFileSync(new URL('../bundles/coach/tavern.wxss', import.meta.url), 'utf8')
const wxml = fs.readFileSync(new URL('../bundles/coach/tavern.wxml', import.meta.url), 'utf8')
const rule = selector => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(escaped + '\\s*\\{([^}]+)\\}'))
  assert.ok(match, `Missing scoped layout rule: ${selector}`)
  return match[1]
}

// WeChat style v2 injects an intrinsic 184px button width. A single .persona
// class loses to that native rule; the actual 390px renderer overlapped cards.
const card = rule('.tavern-page button.persona')
assert.match(card, /(?:^|;)\s*width:\s*100%/)
assert.match(card, /max-width:\s*100%/)
assert.match(card, /min-width:\s*0/)
assert.match(card, /box-sizing:\s*border-box/)

// scroll-view is not covered by app.wxss's view/text/textarea box-sizing rule.
const chat = rule('.chat-list')
assert.match(chat, /box-sizing:\s*border-box/)
assert.match(chat, /(?:^|;)\s*width:\s*100%/)
assert.match(chat, /height:\s*0/)
assert.match(chat, /flex:\s*1/,'message scroller fills the keyboard-adjusted chat shell')
assert.match(rule('.page.tavern-page.chat-active'), /position:\s*fixed/)
assert.match(rule('.chat-composer'), /flex:\s*0 0 auto/,'composer cannot shrink underneath the scroller')
assert.doesNotMatch(chat, /height:\s*136px/)
assert.match(rule('.persona-detail'), /font-weight:\s*400/)
assert.match(wxml, /<stemist-header\b[^>]*compact="{{true}}"/)
assert.match(wxml, /<app-nav\b[^>]*id="tavern-nav"/)
assert.match(rule('.page.tavern-page.device-phone'), /padding-bottom:\s*calc\(96px \+ env\(safe-area-inset-bottom\)\)/)
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/)

// These state and safety affordances must not be dropped by a layout fix.
for (const attribute of ['bindtap="loadOlderHistory"','bindtap="returnLatestHistory"','bindtap="retryInterpretation"','bindtap="drawFortune"','bindtap="openAccount"']) assert.ok(wxml.includes(attribute))
assert.match(wxml, /AI 虚构角色/)
assert.match(wxml, /disabled="{{loading \|\| !message \|\| examBlocked \|\| authRequired}}"/)
console.log('Tavern native-width, keyboard-aware chat shell, compact header and recovery layout contracts passed.')

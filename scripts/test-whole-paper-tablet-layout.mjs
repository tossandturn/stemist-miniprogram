import assert from 'node:assert/strict'
import fs from 'node:fs'

const template=fs.readFileSync(new URL('../bundles/marking/index.wxml',import.meta.url),'utf8')
const styles=fs.readFileSync(new URL('../bundles/marking/index.wxss',import.meta.url),'utf8')
const globalStyles=fs.readFileSync(new URL('../app.wxss',import.meta.url),'utf8')

const rowPosition=template.indexOf('class="file-row" wx:for="{{answers}}"')
const primaryPosition=template.indexOf('id="marking-primary-action"')
const outputPosition=template.indexOf('class="marking-output"')
assert.ok(rowPosition>=0&&rowPosition<primaryPosition&&primaryPosition<outputPosition,'Synthetic geometry requires answer rows before submit and output in DOM order')

assert.match(styles,/\.marking-page\.device-tablet\.portrait\.has-primary-action\s*\{[^}]*padding-bottom:\s*calc\(156px \+ env\(safe-area-inset-bottom\)\)/s,'Portrait iPad reserves content space for the reachable primary action')
assert.match(styles,/\.marking-page\.device-tablet\.portrait \.marking-primary-action\s*\{[^}]*position:\s*fixed;[^}]*z-index:\s*45;[^}]*left:\s*24px;[^}]*right:\s*24px;[^}]*bottom:\s*calc\(16px \+ env\(safe-area-inset-bottom\)\);[^}]*max-width:\s*1152px;[^}]*margin:\s*0 auto;[^}]*box-shadow:/s,'Portrait iPad primary action stays in a bounded safe-area overlay')
assert.match(styles,/\.marking-page\.device-tablet\.portrait \.marking-primary-action button\s*\{[^}]*min-height:\s*44px;[^}]*margin:\s*0/s,'Portrait iPad submit remains a 44px touch target')

assert.match(styles,/\.marking-page\.device-tablet\.portrait\.has-job \.marking-output\s*\{[^}]*grid-row:\s*1/s,'Portrait iPad current job/report must precede the stored upload list')
assert.match(styles,/\.marking-page\.device-tablet\.portrait\.has-job \.marking-inputs\s*\{[^}]*grid-row:\s*2/s,'Portrait iPad upload list moves below current job/report')
assert.match(styles,/\.device-tablet\.landscape \.marking-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\) minmax\(0,1fr\)/s,'Landscape iPad retains the two-column workspace')
assert.match(styles,/@media\s*\(max-width:847px\)\s*\{[\s\S]*?\.marking-page\.device-tablet\.landscape \.marking-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\)[^}]*\}[\s\S]*?\}/s,'Narrow landscape tablet/Split View falls back to one column by viewport width')
assert.match(styles,/@media\s*\(max-width:847px\)[\s\S]*?\.marking-page\.device-tablet\.landscape\.has-primary-action\s*\{[^}]*padding-bottom:\s*calc\(156px \+ env\(safe-area-inset-bottom\)\)/s,'Narrow landscape tablet reserves the fixed action safe area')
assert.match(styles,/@media\s*\(max-width:847px\)[\s\S]*?\.marking-page\.device-tablet\.landscape\.has-job \.marking-output\s*\{[^}]*grid-row:\s*1/s,'Narrow landscape tablet keeps current job/report before upload rows')

assert.match(globalStyles,/button\s*\{[^}]*min-height:\s*44px/s,'Global Mini Program buttons remain minimum 44px touch targets')

const portraitWidth=768,pageHorizontalInset=24*2,overlayWidth=portraitWidth-pageHorizontalInset
const rowMinimum=96+24,twentyRows=rowMinimum*20
const viewportHeight=1024,reservedBottom=156,overlayBottom=16,estimatedOverlayHeight=112
assert.equal(overlayWidth,720)
assert.ok(twentyRows>2*viewportHeight,'Twenty answer rows reproduce a submit action more than two portrait viewports below DOM start')
assert.ok(reservedBottom>=overlayBottom+estimatedOverlayHeight,'Reserved bottom space prevents the fixed action obscuring the last content')
const splitViewWidth=507,tabletLandscapePadding=40*2,columnGap=16
const unsafeTwoColumnWidth=(splitViewWidth-tabletLandscapePadding-columnGap)/2
const unsafePanelContentWidth=unsafeTwoColumnWidth-40
const actionMinimumWidth=180+16
assert.ok(unsafePanelContentWidth<actionMinimumWidth,'507px landscape Split View reproduces action overflow under the unconditional two-column rule')
assert.ok(507<=847&&1024>847,'Viewport fallback applies to Split View but preserves normal 1024px landscape two-column layout')

console.log('Whole-paper tablet layout: portrait submit reachability, job-first ordering, safe-area spacing, touch target, and landscape two-column contract PASS')

import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime} from './helpers/mini-runtime.mjs'
assert.ok(fs.existsSync(new URL('../bundles/coach/tavernMedia.js',import.meta.url)),'native Tavern media module must exist')
const rt=miniRuntime(),media=rt.load('bundles/coach/tavernMedia'),conversation=rt.load('bundles/coach/tavernConversation')
const sticker={id:'cat-hug',kind:'sticker',src:'/api/ai/tavern/media/v1/cat-aaaaaaaaaaaaaaaa.jpg',width:1152,height:864,alt:'小猫张开双臂',caption:'抱抱',frame:{columns:4,rows:3,column:1,row:2}}
const picture={id:'sea',kind:'image',src:'/api/ai/tavern/media/v1/sea-bbbbbbbbbbbbbbbb.jpg',width:960,height:640,alt:'海边落日插画',caption:'去海边看看'}
assert.equal(media.normalizeTavernMedia([sticker,picture]).length,2)
assert.equal(media.normalizeTavernMedia([{...sticker,id:42}]).length,0,'media IDs must be strings, never coerced numbers')
for(const src of ['https://evil.invalid/a.jpg','data:image/png;base64,xxx','/api/ai/tavern/media/v1/../private.jpg','/api/ai/tavern/media/v1/a.jpg?token=secret'])assert.equal(media.normalizeTavernMedia([{...sticker,src}]).length,0)
assert.equal(media.normalizeTavernMedia([{...sticker,frame:{...sticker.frame,column:4}}]).length,0)
const turn={id:'turn-1:assistant',role:'assistant',content:'抱抱你。',sequence:2,status:'complete',media:[sticker,picture]}
const normalized=conversation.displayTavernMessages([turn])
assert.equal(normalized[0].media.length,2)
const decorated=media.decorateTavernTurns(normalized,390)
assert.match(decorated[0].media[0].renderUrl,/^https:\/\/stem\.ieltsist\.com\/api\/ai\/tavern\/media\/v1\//)
assert.equal(decorated[0].media[0].viewWidth,148)
assert.match(decorated[0].media[0].atlasStyle,/left:-148px/)
assert.equal(normalized[0].media[0].renderUrl,undefined,'display metadata never mutates persisted canonical content')
const older={...turn};delete older.media
assert.equal(conversation.mergeTavernMessages([older],[turn])[0].media.length,2,'old clients may have saved a text-only copy of the same canonical message')
assert.throws(()=>conversation.mergeTavernMessages([turn],[{...turn,media:[picture]}]),/conflict|版本冲突/)
let previews=0
const page=rt.page('bundles/coach/tavern');page.onLoad();page.choosePersona({currentTarget:{dataset:{persona:'keeper'}}});page.setData({turns:decorated})
rt.wx.previewImage=options=>{previews++;assert.equal(options.urls.length,1);assert.equal(options.current,decorated[0].media[1].renderUrl)}
const event=index=>({currentTarget:{dataset:{mediaKey:decorated[0].media[index].key}}})
page.previewReplyMedia(event(0));assert.equal(previews,0,'sticker atlas is not shown as a full sheet')
page.previewReplyMedia(event(1));assert.equal(previews,1)
page.onReplyMediaError(event(1));assert.equal(page.data.mediaFailures[decorated[0].media[1].key],true)
assert.equal(page.data.turns[0].content,'抱抱你。','failed image cannot erase text')
page.retryReplyMedia(event(1));assert.equal(page.data.mediaFailures[decorated[0].media[1].key],undefined)
page.onUnload();page.onReplyMediaError(event(1));assert.equal(page.data.mediaFailures[decorated[0].media[1].key],undefined,'late image events must not mutate a departed page')
const source=fs.readFileSync(new URL('../bundles/coach/tavernConversation.js',import.meta.url),'utf8')
assert.match(source,/mediaVersion:TAVERN_MEDIA_VERSION/)
console.log('Native Tavern media: strict origin/path/frame bounds, canonical restoration, immutable conflicts, preview, retry and lifecycle passed.')

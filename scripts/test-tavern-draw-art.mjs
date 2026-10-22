import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime,deferred,settle} from './helpers/mini-runtime.mjs'
import {drawArtFixture} from './helpers/draw-art-fixture.mjs'
assert.ok(fs.existsSync(new URL('../bundles/coach/drawArt.js',import.meta.url)),'draw artwork needs a client contract independent of AI media choices')
const raw=drawArtFixture()
const rt=miniRuntime(),service=rt.load('bundles/coach/drawArt'),catalog=service.normalizeDrawArtCatalog(raw)
assert.equal(catalog.items.length,142)
for(const mutate of [x=>x.items.pop(),x=>x.items[0].src='https://example.com/card.jpg',x=>x.items[0].src='/api/ai/tavern/draw-art/v1/../private',x=>x.items[0].src=x.items[1].src,x=>x.items[0].deckVersion='other',x=>x.items[0].width=-1,x=>x.items[0].sha256='bad',x=>x.items.push(x.items[0]),x=>x.credits[1].kind='__proto__']){const bad=structuredClone(raw);mutate(bad);assert.throws(()=>service.normalizeDrawArtCatalog(bad))}
const cards=[{id:'tarot-major-00-fool',name:'愚者 · The Fool',position:'过去主题',orientation:'upright'},{id:'tarot-cups-two',name:'圣杯二 · Two of Cups',position:'当下主题',orientation:'reversed'},{id:'tarot-wands-three',name:'权杖三 · Three of Wands',position:'可能的方向',orientation:'upright'}]
const draw={id:'fixture-draw',kind:'tarot',deckVersion:'rws-text-78-v1',spread:'three',entertainmentOnly:true,cards}
const view=service.artForDraw(draw,catalog)
assert.deepEqual(Array.from(view,x=>x.id),cards.map(x=>x.id));assert.equal(view[1].angle,180);assert.equal(view[0].angle,0)
assert.ok(view.every(x=>x.url.startsWith('https://stem.ieltsist.com/api/ai/tavern/draw-art/v1/'+x.id+'-')))
assert.equal(draw.cards[1].url,undefined,'canonical receipt is never mutated')
const bridged={...draw,cards:Object.fromEntries(cards.map((card,index)=>[String(index),card]))}
assert.deepEqual(Array.from(service.artForDraw(bridged,catalog),x=>x.id),cards.map(x=>x.id),'native Object-property bridge can expose nested arrays as contiguous numeric keys')
assert.equal(service.artForDraw({...draw,cards:{0:cards[0],2:cards[2]}},catalog).length,0,'sparse or unbounded bridged cards are rejected')
assert.equal(service.artForDraw({...draw,deckVersion:'wrong'},catalog).every(x=>!x.url),true,'unknown deck cannot show misleading artwork')
const gate=deferred();let requests=0
const r=miniRuntime({modules:{'utils/api':{getJson:async(path,options)=>{requests++;assert.equal(options.stemAuth,false);assert.equal(path,service.DRAW_ART_CATALOG_PATH);return gate.promise}}}}),s=r.load('bundles/coach/drawArt')
const one=s.fetchDrawArtCatalog(),two=s.fetchDrawArtCatalog();gate.resolve(raw);await Promise.all([one,two]);assert.equal(requests,1);await s.fetchDrawArtCatalog();assert.equal(requests,1)
const offline=miniRuntime({modules:{'utils/api':{getJson:async()=>{throw Error('offline')}}}});for(const[key,value]of r.storage)offline.storage.set(key,value)
assert.equal((await offline.load('bundles/coach/drawArt').fetchDrawArtCatalog({force:true})).source,'cache')

const definition=rt.load('bundles/coach/draw-art/index')
const events=[],component={...definition.methods,properties:{draw},data:structuredClone(definition.data),setData(patch){Object.assign(this.data,patch)},triggerEvent:(name,detail)=>events.push({name,detail})}
definition.lifetimes.attached.call(component);await settle();component.__catalog=catalog;component.renderDraw()
assert.equal(component.data.cards.length,3)
component.openPreview({currentTarget:{dataset:{key:component.data.cards[1].key}}})
assert.equal(component.data.previewCards[0].id,cards[1].id);assert.equal(component.data.previewCards[0].angle,180)
assert.equal(component.data.previewLoaded,false,'gallery exposes a loading state until its own image arrives')
component.onPreviewLoad({currentTarget:{dataset:{key:component.data.cards[1].key}}});assert.equal(component.data.previewLoaded,true)
component.nextPreview();assert.equal(component.data.previewCards[0].id,cards[2].id)
assert.equal(component.data.previewLoaded,false)
component.onPreviewError({currentTarget:{dataset:{key:component.data.cards[1].key}}});assert.equal(component.data.previewError,false,'late error from the previous card cannot cover the current preview')
component.onPreviewError({currentTarget:{dataset:{key:component.data.cards[2].key}}});assert.equal(component.data.previewError,true);component.retryPreview();assert.equal(component.data.previewError,false)
const key=component.data.cards[0].key;component.onImageError({currentTarget:{dataset:{key}}});assert.equal(component.data.failed[key],true)
component.retryImage({currentTarget:{dataset:{key}}});assert.equal(component.data.failed[key],undefined)
rt.storage.set('stemistPrivacyEpoch',1);component.openPreview({currentTarget:{dataset:{key}}});assert.equal(component.data.previewCards.length,0,'account/privacy changes clear the gallery')
definition.lifetimes.detached.call(component)
component.onImageLoad({currentTarget:{dataset:{key}}});assert.equal(component.data.loaded[key],undefined)
const template=fs.readFileSync(new URL('../bundles/coach/draw-art/index.wxml',import.meta.url),'utf8')
assert.match(template,/root-portal/);assert.match(template,/rotate\(/);assert.match(template,/movable-view/);assert.match(template,/scale-max="4"/)
console.log('Native draw art: 142 mappings, canonical ordering/orientation, safe cache, gallery, retry and owner lifecycle PASS')

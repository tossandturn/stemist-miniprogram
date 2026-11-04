import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime} from './helpers/mini-runtime.mjs'
assert.ok(fs.existsSync(new URL('../bundles/coach/scriptAtmosphere.js',import.meta.url)),'scene-led atmosphere module must exist')
const rt=miniRuntime(),{sceneForRoom,THEMES,createSceneMemory}=rt.load('bundles/coach/scriptAtmosphere')
assert.equal(Object.keys(THEMES).length,4)
const themes=new Set()
for(const id of Object.keys(THEMES)){
 for(let stage=0;stage<3;stage++){
  const scene=sceneForRoom({id:'room',scriptId:id,scriptVersion:2,stage,phase:'play',messages:[],act:{title:'本幕',image:''}})
  themes.add(scene.theme);assert.ok(scene.image);assert.ok(scene.place);assert.ok(scene.intro)
  assert.equal(scene.stage,stage);assert.equal(scene.actNumber,stage+1)
  assert.ok(!scene.intro.includes('2413'))
 }
}
assert.equal(themes.size,4)
const privateText='PRIVATE MUST NOT APPEAR',publicText='雨落在窗边。'
const room={id:'00000000-0000-0000-0000-000000000001',scriptId:'before-rain',scriptVersion:2,stage:0,phase:'play',act:{image:'/api/ai/tavern/media/v1/test.webp'},messages:[{actor:'dm',kind:'narration',target:'a',image:'/api/ai/tavern/media/v1/test.webp',text:privateText},{actor:'dm',kind:'narration',target:'public',image:'/api/ai/tavern/media/v1/test.webp',text:publicText}]}
assert.equal(sceneForRoom(room).intro,publicText)
assert.equal(sceneForRoom({...room,scriptId:'unknown'}).theme,'neutral')
assert.ok(!Object.hasOwn(sceneForRoom(room),'audio'),'visual-only: no audio paths or controls')
const mem=createSceneMemory('owner:1');assert.equal(mem.has(room),false);mem.acknowledge(room);assert.equal(mem.has(room),true)
assert.equal(createSceneMemory('owner:1').has(room),true)
assert.equal(createSceneMemory('owner:2').has(room),false)
assert.equal(mem.has({...room,stage:1}),false)
assert.ok(!JSON.stringify([...rt.storage.values()]).includes(publicText))
console.log('PASS four distinct themes, current-only public intro, owner-bound scene acknowledgement and neutral fallback')

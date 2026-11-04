import assert from 'node:assert/strict'
import {miniRuntime,deferred} from './helpers/mini-runtime.mjs'
let owner=true,loads=0,changed=0;const writes=[],deleted=[]
const rt=miniRuntime({wx:{env:{USER_DATA_PATH:'/private'},getFileSystemManager:()=>({writeFile:o=>{writes.push(o.filePath);o.success()},unlink:o=>{deleted.push(o.filePath);o.success?.()}})}})
const {createRoomImageCache}=rt.load('bundles/coach/scriptRoomImages')
const id='00000000-0000-0000-0000-000000000002',result={bytes:new Uint8Array([137,80,78,71,13,10,26,10]).buffer,mimeType:'image/png'}
const cache=createRoomImageCache({load:async()=>{loads++;return result},current:()=>owner,changed:()=>changed++})
await cache.request('room',id);assert.equal(loads,1);assert.ok(cache.get(id).path.startsWith('/private/script-image-'))
await cache.request('room',id);assert.equal(loads,1)
assert.equal(typeof cache.failed,'function','render failure must remain failed across room polls')
cache.failed(id);assert.ok(cache.get(id).error);assert.equal(cache.get(id).path,'');assert.equal(deleted.length,1)
await cache.request('room',id);assert.equal(loads,1)
await cache.retry('room',id);assert.equal(loads,2)
cache.dispose();assert.equal(deleted.length,2)
const delayed=deferred(),late=createRoomImageCache({load:()=>delayed.promise,current:()=>owner,changed:()=>changed++})
const pending=late.request('room',id);owner=false;delayed.resolve(result);await pending;assert.equal(writes.length,2,'late former-account image cannot be written')
assert.equal(rt.storage.get('stemistScriptImages').length,0)
console.log('PASS: authenticated local image cache, explicit fetch retry, cleanup and late-account response fence')

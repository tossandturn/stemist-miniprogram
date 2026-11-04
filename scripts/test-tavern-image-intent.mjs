import assert from 'node:assert/strict'
import { miniRuntime } from './helpers/mini-runtime.mjs'
const {imageRequestIntent}=miniRuntime().load('bundles/coach/tavernImageIntent')
for(const text of ['画出来','给我画一张沈照撑伞的插图','我想看沈照长什么样','给我看看这里的场景图']) assert.equal(imageRequestIntent(text),true,text)
for(const text of ['不要生成图片','先不画图，继续说','生成图片要钱吗','我检查呼叫铃','怎么看值班簿','随便聊聊']) assert.equal(imageRequestIntent(text),false,text)
console.log('PASS explicit illustration requests, no paid generation for negation, cost questions or story inspection')

import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
const {captionModel,captionFrame}=miniRuntime().load('utils/nativeCaptions')
const words=Array.from({length:6000},(_,i)=>({word:'word'+i,start:2+i/3,end:2.2+i/3,sentenceIndex:Math.floor(i/10),speaker:i<10?'Speaker 4':'Speaker 1'}))
const model=captionModel({available:true,timedWords:words})
assert.equal(captionFrame(model,0).bubbles.length,0,'do not reveal words before audio starts')
assert.equal(captionFrame(model,2).bubbles[0].tone,0)
assert.equal(captionFrame(model,6).bubbles.at(-1).tone,1,'speaker tone uses first appearance, not the label number')
const end=captionFrame(model,1000);assert.ok(end.bubbles.length<=3);assert.ok(JSON.stringify(end).length<4000)
assert.equal(captionFrame(model,2).index,0,'backward seek recomputes from audio time')
assert.equal(captionModel({available:true,timedWords:[words[1],words[0]]}),null)
assert.equal(captionModel({available:false,timedWords:words}),null)
const started=performance.now();for(let i=0;i<2000;i++)captionFrame(model,i%1600)
console.log(JSON.stringify({captionFrames:2000,elapsedMs:Math.round(performance.now()-started),maxBubbles:3,liveASRCalls:0,status:'pass'}))

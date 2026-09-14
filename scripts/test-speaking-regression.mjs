import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {execFileSync} from 'node:child_process'
const root=new URL('../',import.meta.url)
const oldSource=process.argv.includes('--compare-history')?execFileSync('git',['show','d34c793:utils/nativeSpeaking.js'],{cwd:root,encoding:'utf8'}):null
const changedSource=oldSource?execFileSync('git',['show','fdc8ade:utils/nativeSpeaking.js'],{cwd:root,encoding:'utf8'}):null
const newSource=fs.readFileSync(new URL('../utils/nativeSpeaking.js',import.meta.url),'utf8')
function simulate(source,{voice=true}={}){
 let now=100000;const sent=[],module={exports:{}}
 const wx={getStorageSync:()=>'',arrayBufferToBase64:b=>Buffer.from(b).toString('base64'),setKeepScreenOn(){}}
 vm.runInNewContext(source,{module,wx,require:()=>({}),Date:{now:()=>now},setTimeout:()=>1,clearTimeout(){},Promise,Error,Int16Array,Math,Set,ArrayBuffer})
 const engine=new module.exports.NativeSpeaking()
 engine.ready=true;engine.audio={currentTime:10,close(){}};engine.direct={responses:{next:{response:{instructions:'next',modalities:['text','audio']}}}}
 engine.socket={send:({data})=>sent.push(JSON.parse(data)),close(){}}
 const frame=level=>{now+=64;engine.frame(Int16Array.from({length:1024},(_,i)=>Math.round(level*Math.SQRT2*Math.sin(2*Math.PI*125*i/16000))).buffer)}
 if(voice)for(let i=0;i<32;i++)frame(1000)
 // -44 dBFS background, not digital-zero silence: this is where the new
 // .004 threshold diverged from the previous .008 recording path.
 for(let i=0;i<100;i++)frame(200)
 const result={commits:sent.filter(x=>x.type==='input_audio_buffer.commit').length,appends:sent.filter(x=>x.type==='input_audio_buffer.append').length}
 engine.close();return result
}
const old=oldSource?simulate(oldSource):null,current=simulate(newSource)
const introduced=changedSource?simulate(changedSource):null
console.log(JSON.stringify({previous:old,sept11:introduced,current}))
if(old)assert.equal(old.commits,1,'the previous recording path finishes the answer under this background noise')
if(introduced)assert.equal(introduced.commits,0,'the September 11 revision reproduces the missing end-of-turn signal')
assert.equal(current.commits,1,'background noise must not hold the new turn open forever')
assert.equal(simulate(newSource,{voice:false}).appends,0,'idle background is not candidate speech')
console.log('Speaking regression: identical voiced answer and nonzero background complete on old and repaired paths; idle background stays local.')

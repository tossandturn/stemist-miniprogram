import assert from 'node:assert/strict'
import {miniRuntime} from './helpers/mini-runtime.mjs'
let url,options,wrong=false
const scope={routeId:'cie-9702-as-physics',stage:'AS'},paper={id:'cie-9702-9702_m25_qp_22',subject:'9702'}
const runtime=miniRuntime({modules:{'utils/api':{requestJson:async(path,_,opts)=>{url=path;options=opts;return {schemaVersion:'native-paper-sources-v1',paperId:paper.id,...scope,questions:[{number:1,sourceQuestionId:paper.id+':q1',images:['/question-assets/'+(wrong?'different-paper':paper.id)+'/qp-03.jpg']}]}}}}})
const draft=runtime.load('utils/nativePaper').createPaperDraft(paper,scope),service=runtime.load('utils/nativePaperService')
const result=await service.paperSources(draft);assert.equal(options.stemAuth,false);assert.match(url,/\/source-context\?/);assert.equal(result.questions[0].parts.length,0);assert.equal(result.questions[0].images.length,1)
wrong=true;await assert.rejects(()=>service.paperSources(draft),/题图与原卷/)
console.log('Paper sources: guest-readable originals, separate marking authority and cross-paper image rejection passed.')

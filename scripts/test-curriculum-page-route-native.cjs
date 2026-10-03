// A Page's route is framework metadata, not an application method name.
const assert=require('node:assert/strict')
const {call,evaluate,until}=require('./helpers/wechat-cli.cjs'),account=require('./helpers/native-qa-account.cjs')
async function main(){try{
 await account.begin()
 await call('automation_navigate',{action:'navigateTo',url:'/bundles/curricula/practice?routeId=ap-physics-1-mcq-study'})
 const state=await until(function(){const p=getCurrentPages().at(-1);return p?.data?.routeId==='ap-physics-1-mcq-study'&&!p.data.loading?{routeType:typeof p.route,route:typeof p.route==='string'?p.route:null,phase:p.data.phase,error:p.data.error,available:p.data.availableCount}:null},'native AP Page metadata',30000)
 console.log(JSON.stringify(state))
 assert.equal(state.routeType,'string','Application methods must not shadow native Page.route')
 assert.equal(state.route,'bundles/curricula/practice')
 assert.equal(state.available,40)
 assert.equal(state.error,'')
}finally{await account.end()}}
main().catch(error=>{console.error(error.message);process.exitCode=1})

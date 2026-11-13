import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {nativeAppManifest} from './helpers/native-app-manifest.mjs'
import {aiSkillUploadContract,nativeUploadProjectConfig} from './helpers/native-ai-upload-contract.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const app=JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8')),manifest=nativeAppManifest(app),sourceConfig=JSON.parse(fs.readFileSync(path.join(root,'project.config.json'),'utf8'))
const contract=aiSkillUploadContract({root,appManifest:manifest})
assert.deepEqual(contract.skills.map(skill=>skill.path),['skills/learning-navigator'])
assert.deepEqual(contract.skills[0].requiredFiles,['skills/learning-navigator/SKILL.md','skills/learning-navigator/index.js','skills/learning-navigator/mcp.json'])
assert.deepEqual(contract.skills[0].apiNames,['discoverLearningOptions','openLearningDestination'])
assert.ok(contract.skills[0].files.every(file=>/^[a-f0-9]{64}$/.test(file.sha256)&&file.bytes>0))
const index=fs.readFileSync(path.join(root,'skills/learning-navigator/index.js'),'utf8')
assert.match(index,/createSkill\(['"]skills\/learning-navigator['"]\)/)
assert.doesNotMatch(index,/createSkill\(['"]\/skills\//)
assert.throws(()=>aiSkillUploadContract({root,appManifest:{...manifest,agent:{...manifest.agent,skills:[{...manifest.agent.skills[0],path:'/skills/learning-navigator'}]}}}),/relative|leading slash/i)

const uploadConfig=nativeUploadProjectConfig(sourceConfig,{appId:'wx1234567890abcdef',projectName:'stemist-ai-test'})
assert.equal(uploadConfig.setting.ignoreUploadUnusedFiles,false)
assert.equal(uploadConfig.setting.ignoreDevUnusedFiles,false)
assert.deepEqual(uploadConfig.packOptions,{ignore:[],include:[]})
assert.equal(uploadConfig.appid,'wx1234567890abcdef')
assert.equal(uploadConfig.libVersion,sourceConfig.libVersion)
console.log(JSON.stringify({status:'PASS',skillPath:contract.skills[0].path,requiredFiles:contract.skills[0].requiredFiles,unusedFilePruningDisabled:true}))

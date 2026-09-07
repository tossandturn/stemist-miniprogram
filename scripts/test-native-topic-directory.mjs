import assert from 'node:assert/strict'
import fs from 'node:fs'
import {miniRuntime,settle} from './helpers/mini-runtime.mjs'
const runtime=miniRuntime(),{topicDirectory,topicIcon}=runtime.load('utils/ieltsTopics'),bank=runtime.load('utils/ieltsBootstrap').catalog
const sources=bank.readingTests.map(t=>({...t,book:Number(t.book)})),topics=topicDirectory(sources)
assert.ok(topics.length>8);assert.ok(topics.every(t=>t.count>0&&t.label&&t.icon.endsWith('.svg')))
for(const topic of topics)assert.ok(fs.existsSync('.'+topic.icon),topic.key)
assert.equal(topicIcon('unexpected-topic'),topicIcon('education'))
const one=topicDirectory([{book:15,title:'Book',sections:[{number:1,topicKey:'science',topicLabel:'Science',title:'Bird flight'}]}],{book:15,query:'bird'})
assert.equal(one[0].count,1);assert.equal(topicDirectory(sources,{book:999}).length,0)
const r=miniRuntime({modules:{'utils/ieltsContent':{...runtime.load('utils/ieltsContent'),loadIeltsContent:async()=>({reading:sources})}}})
const page=r.page('pages/ielts/library');page.onLoad({module:'reading'});await settle();page.chooseScope({currentTarget:{dataset:{scope:'topic'}}})
assert.ok(page.data.topics.length>8);assert.equal(page.data.items.length,0,'topic landing renders categories, not every passage too')
const key=page.data.topics[0].key;page.chooseTopic({currentTarget:{dataset:{key}}});assert.equal(page.data.topic,key);assert.ok(page.data.items.length>0)
assert.ok(page.__units.every(unit=>unit.topicKey===key));assert.ok(page.data.items.length<=20)
page.clearTopic();assert.equal(page.data.topic,'');assert.equal(page.data.items.length,0);page.onUnload()
console.log('Native IELTS topic icons: source taxonomy, book/search counts, bounded category-to-passage navigation passed.')

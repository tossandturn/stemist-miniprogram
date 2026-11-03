import assert from 'node:assert/strict'
import fs from 'node:fs'
import { miniRuntime } from './helpers/mini-runtime.mjs'
const { parseTavernStoryMessage }=miniRuntime().load('bundles/coach/tavernStoryFormat')
const plain=value=>JSON.parse(JSON.stringify(value))

const parsed = parseTavernStoryMessage([
  '【旁白】雨声停了，旧呼叫铃又响了一次。',
  '',
  '【林漪】我没碰它。你可以先看铃，也可以问我这间空房的事。',
  '【可选行动】',
  '1. 检查呼叫铃',
  '2. 询问林漪',
  '3. 自己决定下一步',
].join('\n'))
assert.deepEqual(plain(parsed.segments), [
  { kind: 'narration', label: '旁白', text: '雨声停了，旧呼叫铃又响了一次。' },
  { kind: 'dialogue', label: '林漪', text: '我没碰它。你可以先看铃，也可以问我这间空房的事。' },
])
assert.deepEqual(plain(parsed.choices), ['检查呼叫铃', '询问林漪', '自己决定下一步'])
assert.deepEqual(plain(parseTavernStoryMessage('普通闲聊仍保持原来的纯文字显示。')), { segments: [], choices: [] })

const unsafe = parseTavernStoryMessage('【旁白】门外传来三声轻响。\n【玩家】你吓了一跳，决定开门。\n【沈照】我先不动，你来选。')
assert.deepEqual(plain(unsafe.segments), [
  { kind: 'narration', label: '旁白', text: '门外传来三声轻响。' },
  { kind: 'dialogue', label: '沈照', text: '我先不动，你来选。' },
], 'assistant-authored player action is never rendered as user speech')
const choices = parseTavernStoryMessage('【闻笙】线索还不够，先检查门票背面。\n【可选行动】\nA. 查看票根\nB. 询问值班员\nC. 自由输入')
assert.deepEqual(plain(choices.choices), ['查看票根', '询问值班员', '自由输入'])

const template = fs.readFileSync(new URL('../bundles/coach/tavern.wxml', import.meta.url), 'utf8')
const { tavernMediaState }=miniRuntime().load('bundles/coach/tavernMedia')
const choicesOnlyForLatest=plain(tavernMediaState([
 {id:'assistant-old',role:'assistant',content:'【角色】第一段。\n【可选行动】\n1. 旧选择',sequence:2,status:'complete'},
 {id:'user-new',role:'user',content:'我先问问题。',sequence:3,status:'complete'},
 {id:'assistant-new',role:'assistant',content:'【角色】先回答问题，不再重复选择。',sequence:4,status:'complete'},
],390).turns)
assert.equal(choicesOnlyForLatest[0].showStoryChoices,undefined,'old script choices disappear after the player takes another action')
assert.equal(choicesOnlyForLatest[2].showStoryChoices,undefined,'plain follow-up does not reopen stale choices')
const activeChoice=plain(tavernMediaState([{id:'assistant-current',role:'assistant',content:'【角色】请选择。\n【可选行动】\n1. 当前选项',sequence:2,status:'complete'}],390).turns)
assert.equal(activeChoice[0].showStoryChoices,true)
assert.match(template, /story-segment/)
assert.match(template, /story-speaker/)
assert.match(template, /bindtap="chooseStoryChoice"/)
assert.match(template, /answer-content wx:else/,'non-script Tavern conversations retain the existing text renderer')
console.log('Tavern story rendering: separate narrator/character blocks, player agency, optional tappable choices PASS')

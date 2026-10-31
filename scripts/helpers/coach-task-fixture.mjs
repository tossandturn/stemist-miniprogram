export function taskFixture(id='cj-fixture_task_00000001',status='succeeded',now=Date.now()){
 const stage=status==='succeeded'?'complete':status==='running'?'waiting_response':status
 return{id,status,stage,createdAt:now-12000,updatedAt:now,expiresAt:now-12000+259200000,serverNow:now,
  task:{schemaVersion:'stem-coach-task-v1',stage:{code:stage,changedAt:now},reasoning:{requestedEffort:'high',effectiveEffort:'high',enabled:true,activityObserved:false},input:{kind:'text',imageCount:0},helpIntent:'worked-solution',persistence:{saved:true,retentionMs:259200000},milestones:{completedAt:status==='running'?null:now},estimate:{status:status==='running'?'initial':'complete',totalMs:{lower:15000,upper:60000},remainingMs:{lower:3000,upper:48000},source:{kind:'initial',sampleCount:0}}},
  ...(status==='succeeded'?{result:{answer:'## 答案\n\\(x=2\\)\n## 解题步骤\n两边除以 2。',mode:'ai',providerStatus:'connected',answerStatus:'complete'}}:{})}
}

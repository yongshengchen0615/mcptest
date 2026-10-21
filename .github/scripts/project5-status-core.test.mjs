import test from 'node:test';
import assert from 'node:assert/strict';
import {buildChineseStatusPlan,validateStatusEvent,STATUS_MARKER} from './project5-status-core.mjs';
const opts=()=>[
  {id:'o1',name:'Todo',color:'GRAY',description:''},
  {id:'o2',name:'In Progress',color:'YELLOW',description:'Work in progress'},
  {id:'o3',name:'Done',color:'GREEN',description:''}
];
const evt=(body=STATUS_MARKER)=>({
  repository:{full_name:'yongshengchen0615/mcptest'},
  issue:{user:{login:'yongshengchen0615'},html_url:'https://github.com/yongshengchen0615/mcptest/issues/30',body},
  sender:{login:'yongshengchen0615'}
});
test('English status names become Traditional Chinese',()=>{
  assert.deepEqual(buildChineseStatusPlan(opts()).updates.map(x=>x.name),['待辦','開發中','已完成']);
});
test('Descriptions become Chinese',()=>{
  const x=buildChineseStatusPlan(opts());
  assert.ok(x.updates.every(o=>/[\u3400-\u9fff]/u.test(o.description)));
});
test('Preserves IDs and colors',()=>{
  const old=opts(),next=buildChineseStatusPlan(old).updates;
  for(let i=0;i<old.length;i++){assert.equal(next[i].id,old[i].id);assert.equal(next[i].color,old[i].color);}
});
test('Rerun is idempotent',()=>{
  const first=buildChineseStatusPlan(opts());
  assert.equal(buildChineseStatusPlan(first.updates).changed,false);
});
test('Unknown English label is blocked',()=>{
  assert.throws(()=>buildChineseStatusPlan([{id:'x',name:'Custom Unmapped State',color:'RED',description:''}]));
});
test('Existing Chinese custom label is preserved and gets a Chinese description',()=>{
  const p=buildChineseStatusPlan([{id:'x',name:'待人工審核',color:'BLUE',description:'Old'}]);
  assert.equal(p.updates[0].name,'待人工審核');
  assert.match(p.updates[0].description,/[\u3400-\u9fff]/u);
});
test('No status options is rejected',()=>assert.throws(()=>buildChineseStatusPlan([])));
test('Name collisions are blocked without partial mutation',()=>{
  assert.throws(()=>buildChineseStatusPlan([
    {id:'1',name:'Todo',color:'GRAY',description:''},
    {id:'2',name:'待辦',color:'GRAY',description:''}
  ]));
});
test('Duplicate option IDs rejected',()=>{
  assert.throws(()=>buildChineseStatusPlan([
    {id:'1',name:'Todo',color:'GRAY',description:''},
    {id:'1',name:'Done',color:'GREEN',description:''}
  ]));
});
test('Owner authorized',()=>assert.equal(validateStatusEvent(evt()),true));
test('Other user rejected',()=>{const e=evt();e.sender.login='other';assert.throws(()=>validateStatusEvent(e));});
test('Missing marker rejected',()=>assert.throws(()=>validateStatusEvent(evt('wrong'))));
test('Duplicate marker rejected',()=>assert.throws(()=>validateStatusEvent(evt(STATUS_MARKER+STATUS_MARKER))));
test('Unapproved repository rejected',()=>{const e=evt();e.repository.full_name='other/repo';assert.throws(()=>validateStatusEvent(e));});

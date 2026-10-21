import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEvent,prepareUpdate,hasOption,OPTION} from './release-core.mjs';
const event={
  repository:{full_name:'yongshengchen0615/test1111'},
  issue:{number:23,user:{login:'yongshengchen0615'},html_url:'https://github.com/yongshengchen0615/test1111/issues/23',body:'<!-- project7-release-demo:v1 -->'},
  sender:{login:'yongshengchen0615'}
};
const base={name:'Status',data_type:'single_select',node_id:'PVTSSF_123',options:[
  {id:'opt1',name:{raw:'Todo'},color:'GRAY',description:{raw:'backlog'}},
  {id:'opt2',name:{raw:'In Progress'},color:'BLUE',description:{raw:'working'}},
  {id:'opt3',name:{raw:'Done'},color:'GREEN',description:{raw:'finished'}}
]};
test('valid event',()=>assert.equal(validateEvent(event).issueNumber,23));
test('reject sender',()=>assert.throws(()=>validateEvent({...event,sender:{login:'attacker'}})));
test('reject repo',()=>assert.throws(()=>validateEvent({...event,repository:{full_name:'attacker/repo'}})));
test('reject without marker',()=>assert.throws(()=>validateEvent({...event,issue:{...event.issue,body:''}})));
test('reject issue URL mismatch',()=>assert.throws(()=>validateEvent({...event,issue:{...event.issue,html_url:'https://github.com/x/y/issues/23'}})));
test('preserves existing IDs, adds option',()=>{const r=prepareUpdate(base);assert.equal(r.options.length,4);assert.deepEqual(r.options.slice(0,3).map(o=>o.id),['opt1','opt2','opt3']);assert.equal(r.options[3].name,OPTION);});
test('idempotent if option exists',()=>{const next={...base,options:[...base.options,{id:'opt4',name:{raw:OPTION},color:'PURPLE'}]};assert.equal(prepareUpdate(next).exists,true);assert.equal(prepareUpdate(next).options.length,4);});
test('reject missing option id to avoid wiping values',()=>assert.throws(()=>prepareUpdate({...base,options:[{name:{raw:'Todo'},color:'GRAY'}]})));
test('reject duplicate existing option',()=>assert.throws(()=>prepareUpdate({...base,options:[...base.options,{...base.options[0],id:'opt4'}]})));
test('reject unsupported field type',()=>assert.throws(()=>prepareUpdate({...base,data_type:'text'})));
test('reject excessive options',()=>assert.throws(()=>prepareUpdate({...base,options:Array(31).fill(base.options[0])})));
test('can detect newly added option',()=>assert.equal(hasOption({...base,options:[...base.options,{id:'opt4',name:{raw:OPTION}}]}),true));

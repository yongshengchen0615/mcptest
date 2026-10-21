import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePlan,verifyEvent,resolveFields,findItem,readItemField,verifyReadback,MARKER} from './project7-core.mjs';

const base={
 repository:{full_name:'yongshengchen0615/test1111'},
 sender:{login:'yongshengchen0615'},
 issue:{
  user:{login:'yongshengchen0615'},
  html_url:'https://github.com/yongshengchen0615/test1111/issues/3',
  body:MARKER+'\n<!-- project7:Status=Todo -->\n<!-- project7:Priority=Low -->'
 }
};
test('parse metadata',()=>assert.deepEqual(parsePlan(base.issue.body),{Status:'Todo',Priority:'Low'}));
test('ignore prose',()=>assert.deepEqual(parsePlan(MARKER+'\nStatus: Done'),{}));
test('require marker',()=>assert.throws(()=>parsePlan('Status: Todo'),/Missing/));
test('invalid status rejected',()=>assert.throws(()=>parsePlan(MARKER+'\n<!-- project7:Status=DROP -->'),/Unsupported/));
test('duplicate rejected',()=>assert.throws(()=>parsePlan(MARKER+'\n<!-- project7:Status=Todo -->\n<!-- project7:Status=Done -->'),/Duplicate/));
test('date validated',()=>assert.throws(()=>parsePlan(MARKER+'\n<!-- project7:Due Date=2026-02-30 -->'),/valid/));
test('wrong repo denied',()=>assert.throws(()=>verifyEvent({...base,repository:{full_name:'evil/repo'}}),/repository/));
test('wrong sender denied',()=>assert.throws(()=>verifyEvent({...base,sender:{login:'attacker'}}),/sender/));
test('valid issue accepted',()=>assert.equal(verifyEvent(base).url,base.issue.html_url));
test('foreign URL rejected',()=>assert.throws(()=>verifyEvent({...base,issue:{...base.issue,html_url:'https://evil.test/issue'}}),/URL/));
test('resolve single-select',()=>assert.deepEqual(resolveFields([{name:'Status',options:[{name:'Todo'}]}],{Status:'Todo'}).actions,[{name:'Status',kind:'select',value:'Todo'}]));
test('unknown option skipped',()=>assert.equal(resolveFields([{name:'Status',options:[{name:'Doing'}]}],{Status:'Todo'}).warnings.length,1));
test('find existing item by content URL',()=>assert.equal(findItem([{id:'X',content:{url:'u'}},{id:'Y',content:{url:'v'}}],'v').id,'Y'));

test('read fields ignoring case',()=>assert.equal(readItemField({status:'Todo'},'Status'),'Todo'));
test('read unknown field returns undefined',()=>assert.equal(readItemField({status:'Todo'},'Priority'),undefined));
test('read option name from value object',()=>assert.equal(readItemField({Priority:{name:'Low'}},'priority'),'Low'));
test('verify readback succeeds on matching fields',()=>{
  const r=verifyReadback({status:'Todo',priority:'Low'},[
    {name:'Status',value:'Todo',kind:'select'},
    {name:'Priority',value:'Low',kind:'select'}
  ]);
  assert.deepEqual(r,{ok:true,errors:[]});
});
test('verify readback detects field update failure',()=>{
  const r=verifyReadback({status:'Todo'},[{name:'Status',value:'In Progress',kind:'select'}]);
  assert.equal(r.ok,false);
  assert.match(r.errors[0],/expected In Progress/);
});
test('verify readback missing item fails',()=>assert.equal(verifyReadback(null,[]).ok,false));

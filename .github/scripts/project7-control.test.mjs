import test from 'node:test';
import assert from 'node:assert/strict';
import {parseControl, validateControlEvent, findField, computeUpdate, assertReadback} from './project7-control-core.mjs';

const marker='<!-- project7-control:v1 -->';
const fence=String.fromCharCode(96).repeat(3);
const url='https://github.com/yongshengchen0615/test1111/issues/1';
const cmd=(value)=>marker+'\n'+fence+'json\n'+JSON.stringify(value)+'\n'+fence;
const event=(body)=>({
  repository:{full_name:'yongshengchen0615/test1111',private:false},
  issue:{user:{login:'yongshengchen0615'},html_url:url,body},
  sender:{login:'yongshengchen0615'}
});
test('valid inspect parsed',()=>assert.deepEqual(parseControl(cmd({version:1,op:'inspect'})),{version:1,op:'inspect'}));
test('event owner allowed',()=>assert.equal(validateControlEvent(event(cmd({version:1,op:'inspect'}))).command.op,'inspect'));
test('reject foreign repository',()=>assert.throws(()=>validateControlEvent({...event(cmd({version:1,op:'inspect'})),repository:{full_name:'evil/repo'}})));
test('reject foreign sender',()=>assert.throws(()=>validateControlEvent({...event(cmd({version:1,op:'inspect'})),sender:{login:'evil'}})));
test('reject foreign author',()=>{const e=event(cmd({version:1,op:'inspect'}));e.issue.user.login='evil';assert.throws(()=>validateControlEvent(e));});
test('reject missing marker',()=>assert.throws(()=>parseControl(fence+'json\n{}\n'+fence)));
test('reject duplicate marker',()=>assert.throws(()=>parseControl(cmd({version:1,op:'inspect'})+marker)));
test('reject malformed json',()=>assert.throws(()=>parseControl(marker+'\n'+fence+'json\n{x}\n'+fence)));
test('reject unexpected project override',()=>assert.throws(()=>parseControl(cmd({version:1,op:'inspect',project:5}))));
test('reject arbitrary command',()=>assert.throws(()=>parseControl(cmd({version:1,op:'exec',shell:'rm -rf /'}))));
test('reject arbitrary issue URL',()=>assert.throws(()=>parseControl(cmd({version:1,op:'add_item',issue_url:'https://github.com/foreign/repo/issues/3'}))));
test('add own Issue',()=>assert.equal(parseControl(cmd({version:1,op:'add_item',issue_url:url})).op,'add_item'));
test('single-select actual option',()=>assert.equal(computeUpdate({name:'Status',options:[{name:'Todo'},{name:'Done'}]},'todo').value,'Todo'));
test('single-select rejected for unknown option',()=>assert.throws(()=>computeUpdate({options:[{name:'Todo'}]},'HACK')));
test('missing Project field rejected',()=>assert.throws(()=>findField([{name:'Status'}],'Priority')));
test('date accepted',()=>assert.equal(computeUpdate({type:'DATE'},'2026-12-31').flag,'--date'));
test('invalid date rejected',()=>assert.throws(()=>computeUpdate({type:'DATE'},'2026-02-30')));
test('numeric field accepted',()=>assert.equal(computeUpdate({type:'NUMBER'},4).value,'4'));
test('negative field rejected',()=>assert.throws(()=>computeUpdate({type:'NUMBER'},-1)));
test('text input capped',()=>assert.throws(()=>computeUpdate({type:'TEXT'},'x'.repeat(1001))));
test('write readback works',()=>assert.equal(assertReadback({status:'Todo'},'Status',{verify:'Todo'}),true));
test('write readback rejects mismatch',()=>assert.throws(()=>assertReadback({status:'Done'},'Status',{verify:'Todo'})));
test('create field requires explicit confirmation',()=>assert.throws(()=>parseControl(cmd({version:1,op:'create_field',field:'Priority',field_type:'SINGLE_SELECT',options:['Low','High']}))));
test('create field accepted with confirmation',()=>assert.equal(parseControl(cmd({version:1,op:'create_field',field:'Priority',field_type:'SINGLE_SELECT',options:['Low','High'],confirm:'CREATE_FIELD:Priority'})).field,'Priority'));
test('duplicate select options rejected',()=>assert.throws(()=>parseControl(cmd({version:1,op:'create_field',field:'Priority',field_type:'SINGLE_SELECT',options:['Low','low'],confirm:'CREATE_FIELD:Priority'}))));
test('archive needs confirmation',()=>assert.throws(()=>parseControl(cmd({version:1,op:'archive_item',issue_url:url}))));
test('archive accepted only with explicit confirmation',()=>assert.equal(parseControl(cmd({version:1,op:'archive_item',issue_url:url,confirm:'ARCHIVE:'+url})).op,'archive_item'));
test('edit_project needs confirmation',()=>assert.throws(()=>parseControl(cmd({version:1,op:'edit_project',title:'A'}))));
test('reject large bodies',()=>assert.throws(()=>parseControl(cmd({version:1,op:'inspect'})+'x'.repeat(8192))));

import {OWNER, REPO, readItemField} from './project7-core.mjs';

export const CONTROL_MARKER = '<!-- project7-control:v1 -->';
export const OPERATIONS = Object.freeze([
  'inspect', 'get_item', 'add_item', 'set_field', 'clear_field',
  'create_field', 'archive_item', 'edit_project'
]);
const ISSUE_URL = /^https:\/\/github\.com\/yongshengchen0615\/test1111\/issues\/[1-9]\d*$/;
const NUMBER = /^(0|[1-9]\d*)(\.\d+)?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function string(v,max=200) {return typeof v==='string' && v.length>0 && v.length<=max && v.trim()===v;}
function validDate(v) {
  return typeof v==='string' && DATE.test(v) && Number.isFinite(Date.parse(v+'T00:00:00Z')) &&
    new Date(v+'T00:00:00Z').toISOString().slice(0,10) === v;
}
export function validateControlEvent(event) {
  if (event?.repository?.full_name !== OWNER+'/'+REPO) throw new Error('Wrong repository');
  if (event?.issue?.user?.login !== OWNER || event?.sender?.login !== OWNER)
    throw new Error('Only owner issue edits may control Project #7');
  if (!ISSUE_URL.test(event?.issue?.html_url || '')) throw new Error('Invalid command issue URL');
  return {command:parseControl(event.issue.body),isPrivate:event.repository.private===true};
}
export function parseControl(body) {
  if (typeof body!=='string' || body.length>8192 || body.split(CONTROL_MARKER).length!==2)
    throw new Error('Missing or duplicate control marker, or oversized command');
  const blocks=[...body.matchAll(/(?:^|\n)\x60\x60\x60json[ \t]*\r?\n([\s\S]*?)\r?\n\x60\x60\x60(?=\n|$)/g)];
  if(blocks.length!==1 || blocks[0][1].length>6144)throw new Error('Exactly one small json fenced block is required');
  let command;try{command=JSON.parse(blocks[0][1]);}catch{throw new Error('Malformed JSON');}
  if(!object(command)||command.version!==1||!OPERATIONS.includes(command.op))
    throw new Error('Invalid command version or operation');
  const allowed={
    inspect:['version','op'],
    get_item:['version','op','issue_url'],
    add_item:['version','op','issue_url'],
    set_field:['version','op','issue_url','field','value'],
    clear_field:['version','op','issue_url','field'],
    create_field:['version','op','field','field_type','options','confirm'],
    archive_item:['version','op','issue_url','confirm'],
    edit_project:['version','op','title','description','confirm']
  };
  if(Object.keys(command).some(k=>!allowed[command.op].includes(k)))
    throw new Error('Unexpected command property');
  if(['get_item','add_item','set_field','clear_field','archive_item'].includes(command.op) &&
     !ISSUE_URL.test(command.issue_url||''))throw new Error('Only test1111 Issue URLs are allowed in v1');
  if(['set_field','clear_field','create_field'].includes(command.op) &&
    !string(command.field,80))throw new Error('Invalid field name');
  if(command.op==='set_field' && !['string','number'].includes(typeof command.value))
    throw new Error('Value must be a string or number');
  if(command.op==='create_field'){
    if(!['TEXT','SINGLE_SELECT','DATE','NUMBER'].includes(command.field_type))
      throw new Error('Unsupported field type');
    if(command.confirm!=='CREATE_FIELD:'+command.field)throw new Error('Explicit field confirmation required');
    if(command.field_type==='SINGLE_SELECT'){
      if(!Array.isArray(command.options)||command.options.length<2||command.options.length>12 ||
          command.options.some(o=>!string(o,48))||new Set(command.options.map(x=>x.toLowerCase())).size!==command.options.length)
        throw new Error('Invalid single-select options');
    }else if(Object.hasOwn(command,'options'))throw new Error('Options only for single-select');
  }
  if(command.op==='archive_item' && command.confirm!=='ARCHIVE:'+command.issue_url)
    throw new Error('Explicit archive confirmation required');
  if(command.op==='edit_project'){
    if(!string(command.title??'',120) && !string(command.description??'',2000))
      throw new Error('Title or description must be provided');
    if(command.confirm!=='EDIT_PROJECT:7')throw new Error('Explicit project confirmation required');
  }
  return command;
}
export function findField(fields,name){
  const f=fields.find(f=>f.name?.toLowerCase()===name.toLowerCase());
  if(!f)throw new Error('Project #7 has no field named '+name);
  return f;
}
export function computeUpdate(field,value){
  if(Array.isArray(field.options)){
    if(typeof value!=='string')throw new Error('Single-select value must be string');
    const option=field.options.find(o=>o.name?.toLowerCase()===value.toLowerCase());
    if(!option)throw new Error('Selection not offered: '+value);
    return {flag:'--value',value:option.name,verify:option.name};
  }
  const type=String(field.dataType||field.data_type||field.type||'').toUpperCase();
  if(type.includes('ITERATION')){
    const entries=[...(field.iterations||[]),...(field.configuration?.iterations||[])];
    const option=entries.find(x=>x.id===value || x.title===value);
    if(!option)throw new Error('Iteration must match an actual project iteration');
    return {flag:'--iteration-id',value:option.id,verify:option.title,iteration:true};
  }
  if(type.includes('DATE')){
    if(!validDate(value))throw new Error('Invalid YYYY-MM-DD date');
    return {flag:'--date',value,verify:value,date:true};
  }
  if(type.includes('NUMBER')){
    const val=typeof value==='number'?String(value):value;
    if(typeof val!=='string'||!NUMBER.test(val)||!Number.isFinite(Number(val))||Number(val)>1e12)
      throw new Error('Invalid non-negative number');
    return {flag:'--number',value:val,verify:Number(val)};
  }
  if(type.includes('TEXT')){
    if(!string(value,1000))throw new Error('Text must be 1-1000 chars');
    return {flag:'--text',value,verify:value};
  }
  throw new Error('Unsupported field kind: '+type);
}
export function assertReadback(item,fieldName,update){
  const actual=readItemField(item,fieldName);
  if(actual===undefined)throw new Error('Readback did not expose '+fieldName);
  const match=typeof update.verify==='number'
    ? Number(actual)===update.verify
    : (update.date ? actual.slice(0,10)===update.verify
    : actual.toLowerCase()===String(update.verify).toLowerCase());
  if(!match)throw new Error('Readback mismatch for '+fieldName);
  return true;
}
export function safePublicResult(command,extra={}){
  return {ok:true,project:7,operation:command.op,...extra};
}

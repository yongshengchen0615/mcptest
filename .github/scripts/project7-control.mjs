import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {OWNER, PROJECT_NUMBER, findItem} from './project7-core.mjs';
import {validateControlEvent, findField, computeUpdate, assertReadback, safePublicResult} from './project7-control-core.mjs';

function gh(args) {
  try {
    const raw=execFileSync('gh',args,{
      encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000,maxBuffer:16*1024*1024
    }).trim();
    if(!raw)return {};
    return JSON.parse(raw);
  }catch(error){
    const msg=String(error.stderr||'');
    if(msg.includes('missing required scopes'))throw Error('PROJECTS_V2_TOKEN lacks project/read:project scopes');
    // Don't echo arbitrary API errors or command input into a public repository's logs.
    throw Error('GitHub command failed: '+args[0]+' '+args[1]+' (exit '+String(error.status??'?')+')');
  }
}
const projectArgs=['7','--owner',OWNER];
const fields=()=>gh(['project','field-list',...projectArgs,'--limit','100','--format','json']).fields||[];
function items(){
  const result=gh(['project','item-list',...projectArgs,'--limit','1000','--format','json']);
  const all=result.items||[];
  if(all.length>=1000)throw Error('Project is at query limit; refusing potentially incomplete/deduped action');
  return all;
}
const itemByUrl=url=>findItem(items(),url);
const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
if(!process.env.GH_TOKEN)throw Error('PROJECTS_V2_TOKEN Actions secret is required');
const {command,isPrivate}=validateControlEvent(event);
let outcome={};
switch(command.op){
  case 'inspect': {
    const p=gh(['project','view',...projectArgs,'--format','json']);
    const f=fields(), a=items();
    // Never reveal a private Project's titles, issues, or field names through a public repo log.
    outcome=isPrivate?{projectTitle:p.title,fields:f.map(x=>({name:x.name,type:x.type,options:x.options?.map(y=>y.name)})),itemCount:a.length}
      :{fieldCount:f.length,itemCount:a.length,privateDataRedacted:true};
    break;
  }
  case 'get_item':{
    const it=itemByUrl(command.issue_url);
    if(!it)throw Error('Requested Issue is not in Project #7');
    outcome=isPrivate?{item:it}:{itemId:it.id,present:true,privateDataRedacted:true};
    break;
  }
  case 'add_item':{
    const existing=itemByUrl(command.issue_url);
    if(existing){outcome={itemId:existing.id,alreadyPresent:true};break;}
    gh(['project','item-add',...projectArgs,'--url',command.issue_url,'--format','json']);
    const check=itemByUrl(command.issue_url);
    if(!check)throw Error('Item add readback failed');
    outcome={itemId:check.id,added:true};
    break;
  }
  case 'set_field':{
    const field=findField(fields(),command.field);
    const update=computeUpdate(field,command.value);
    const it=itemByUrl(command.issue_url);
    if(!it)throw Error('Add the Issue to Project #7 before changing its fields');
    gh(['project','item-edit',...projectArgs,'--url',command.issue_url,
      '--field',field.name,update.flag,String(update.value),'--format','json']);
    const check=itemByUrl(command.issue_url);
    assertReadback(check,field.name,update);
    outcome={itemId:check.id,field:field.name,verified:true};
    if(isPrivate)outcome.value=update.verify;
    break;
  }
  case 'clear_field':{
    const it=itemByUrl(command.issue_url);
    if(!it)throw Error('Item not present in Project #7');
    const field=findField(fields(),command.field);
    const project=gh(['project','view',...projectArgs,'--format','json']);
    if(!project.id||!field.id||!it.id)throw Error('Missing Project / field / item node ID');
    gh(['project','item-edit','--id',it.id,'--field-id',field.id,'--project-id',project.id,'--clear','--format','json']);
    const latest=itemByUrl(command.issue_url);
    const key=Object.keys(latest||{}).find(k=>k.toLowerCase()===field.name.toLowerCase());
    if(key && latest[key]!=null && latest[key]!=='')throw Error('Field clear readback mismatch');
    outcome={itemId:latest?.id,field:field.name,cleared:true};
    break;
  }
  case 'create_field':{
    if(process.env.PROJECT7_ENABLE_SCHEMA!=='true')
      throw Error('Schema mutation disabled: requires admin opt-in and review');
    if(fields().some(x=>x.name?.toLowerCase()===command.field.toLowerCase()))
      throw Error('Field already exists: refusing duplicate/overwrite');
    const args=['project','field-create',...projectArgs,'--name',command.field,
      '--data-type',command.field_type];
    if(command.field_type==='SINGLE_SELECT'){
      if(command.options.some(o=>o.includes(',')))throw Error('Comma is not allowed in choice names');
      args.push('--single-select-options',command.options.join(','));
    }
    gh([...args,'--format','json']);
    if(!fields().some(x=>x.name===command.field))throw Error('Field creation readback failed');
    outcome={created:true,field:command.field};
    break;
  }
  case 'archive_item':{
    if(process.env.PROJECT7_ENABLE_ARCHIVE!=='true')
      throw Error('Archiving disabled: requires manual admin opt-in');
    const it=itemByUrl(command.issue_url);
    if(!it)throw Error('Item not found, cannot archive');
    gh(['project','item-archive',...projectArgs,'--id',it.id,'--format','json']);
    outcome={archiveCommandSucceeded:true,itemId:it.id};
    break;
  }
  case 'edit_project':{
    if(process.env.PROJECT7_ENABLE_SETTINGS!=='true')
      throw Error('Project metadata edits disabled: requires manual admin opt-in');
    const args=['project','edit',...projectArgs];
    if(command.title)args.push('--title',command.title);
    if(command.description)args.push('--description',command.description);
    gh([...args,'--format','json']);
    const p=gh(['project','view',...projectArgs,'--format','json']);
    if(command.title&&p.title!==command.title)throw Error('Project title readback mismatch');
    if(command.description&&p.description!==command.description)throw Error('Project description readback mismatch');
    outcome={updated:true,verified:true};
    break;
  }
  default:throw Error('Unsupported command');
}
console.log('PROJECT7_RESULT '+JSON.stringify(safePublicResult(command,outcome)));

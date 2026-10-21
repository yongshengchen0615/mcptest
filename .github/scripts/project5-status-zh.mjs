import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {OWNER,PROJECT_NUMBER} from './project5-plan.mjs';
import {buildChineseStatusPlan,validateStatusEvent} from './project5-status-core.mjs';

if(process.env.PROJECT5_OWNER!==OWNER||Number(process.env.PROJECT5_NUMBER)!==PROJECT_NUMBER)
  throw Error('Project #5 environment target mismatch');
if(!process.env.GH_TOKEN)throw Error('PROJECTS_V2_TOKEN unavailable');
const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
validateStatusEvent(event);

function gql(query){
  try{
    const raw=execFileSync('gh',['api','graphql','-f','query='+query],{
      encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000,maxBuffer:8*1024*1024
    });
    const data=JSON.parse(raw);
    if(data.errors?.length)throw Error('GraphQL returned errors');
    return data.data;
  }catch(err){
    // Do not echo GraphQL output, private Project fields, or API error bodies to public logs.
    throw Error('Project #5 GraphQL command failed (exit '+String(err.status??'?')+')');
  }
}
const query='query {user(login:'+JSON.stringify(OWNER)+'){projectV2(number:'+PROJECT_NUMBER+
  '){id public items{totalCount} field(name:"Status"){... on ProjectV2SingleSelectField{id name options{id name color description}}}}}}';
function inspect(){
  const p=gql(query)?.user?.projectV2;
  if(!p?.id||!p.field?.id||!Array.isArray(p.field.options))
    throw Error('Project #5 or native Status field is not accessible');
  return p;
}
const before=inspect();
const proposal=buildChineseStatusPlan(before.field.options);
console.log('PROJECT5_STATUS_BEFORE '+JSON.stringify({options:before.field.options.length,items:before.items.totalCount,changesRequired:proposal.changed,privateDataRedacted:true}));
if(proposal.changed){
  const optList=proposal.updates.map(o=>'{id:'+JSON.stringify(o.id)+
    ',name:'+JSON.stringify(o.name)+',color:'+o.color+
    ',description:'+JSON.stringify(o.description)+'}').join(',');
  const mutation='mutation {updateProjectV2Field(input:{fieldId:'+JSON.stringify(before.field.id)+
    ',singleSelectOptions:['+optList+']}){projectV2Field{... on ProjectV2SingleSelectField{id}}}}';
  const updated=gql(mutation)?.updateProjectV2Field?.projectV2Field;
  if(updated?.id!==before.field.id)throw Error('Status update was not acknowledged');
}
const after=inspect();
if(after.field.options.length!==proposal.updates.length||
   after.items.totalCount!==before.items.totalCount)
  throw Error('Status item or option count changed unexpectedly');
for(const planned of proposal.updates){
  const observed=after.field.options.find(x=>x.id===planned.id);
  if(!observed||observed.name!==planned.name||observed.description!==planned.description||
     observed.color!==planned.color)
    throw Error('Status readback mismatch; no claim of success');
}
console.log('PROJECT5_STATUS_RESULT '+JSON.stringify({
  verified:true,updated:proposal.changed,options:proposal.updates.length,
  optionIdsPreserved:true,colorsPreserved:true,itemsBefore:before.items.totalCount,
  itemsAfter:after.items.totalCount,labelsTraditionalChinese:true,descriptionsTraditionalChinese:true,
  privateDataRedacted:true
}));

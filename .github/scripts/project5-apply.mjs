import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {OWNER,PROJECT_NUMBER,planChanges,validateApplyEvent} from './project5-plan.mjs';

if(!process.env.GH_TOKEN)throw Error('PROJECTS_V2_TOKEN is not configured');
const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
validateApplyEvent(event);

function gh(args){
  try{
    const output=execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000,maxBuffer:8*1024*1024});
    const parsed=JSON.parse(output);
    if(parsed.errors?.length)throw Error('GraphQL returned errors');
    return parsed;
  }catch(e){
    // Never print private Project data or raw authentication responses to public Actions logs.
    throw Error('GitHub command failed ('+args[0]+' '+args[1]+', exit '+String(e.status??'?')+')');
  }
}
const QUERY='query($login:String!,$number:Int!){user(login:$login){projectV2(number:$number){id title public fields(first:100){pageInfo{hasNextPage} nodes{__typename ... on ProjectV2Field{id name dataType} ... on ProjectV2SingleSelectField{id name options{name}} ... on ProjectV2MultiSelectField{id name} ... on ProjectV2IterationField{id name}}} views(first:100){pageInfo{hasNextPage} nodes{id name layout number}} items{totalCount}}}}';
function inventory(){
  const response=gh(['api','graphql','-f','query='+QUERY,'-f','login='+OWNER,'-F','number='+PROJECT_NUMBER]);
  const project=response.data?.user?.projectV2;
  if(!project?.id)throw Error('Project #5 inaccessible');
  return project;
}
const project=inventory();
const plan=planChanges(project);
if(plan.conflicts.length)throw Error('Conflicting existing fields or views ('+plan.conflicts.length+'); no mutation applied');
console.log('PROJECT5_BEFORE '+JSON.stringify({fields:project.fields.nodes.length,views:project.views.nodes.length,items:project.items.totalCount,privateDetailsRedacted:true}));
console.log('PROJECT5_PLAN '+JSON.stringify({fieldsToAdd:plan.fieldsToCreate.length,viewsToAdd:plan.viewsToCreate.length,warnings:plan.warnings.length}));
const newlyAdded={fields:0,views:0};
for(const spec of plan.fieldsToCreate){
  const args=['project','field-create',String(PROJECT_NUMBER),'--owner',OWNER,'--name',spec.name,'--data-type',spec.dataType,'--format','json'];
  if(spec.options)args.push('--single-select-options',spec.options.join(','));
  gh(args);
  newlyAdded.fields++;
}
const afterFields=inventory();
for(const spec of plan.viewsToCreate){
  const mutation='mutation($projectId:ID!,$name:String!,$layout:ProjectV2ViewLayout!){createProjectV2View(input:{projectId:$projectId,name:$name,layout:$layout}){projectV2View{id name layout}}}';
  const created=gh(['api','graphql','-f','query='+mutation,'-f','projectId='+afterFields.id,'-f','name='+spec.name,'-f','layout='+spec.layout]);
  if(!created.data?.createProjectV2View?.projectV2View?.id)throw Error('View creation returned no ID');
  newlyAdded.views++;
}
const after=inventory(),verify=planChanges(after);
if(verify.fieldsToCreate.length||verify.viewsToCreate.length||verify.conflicts.length)throw Error('Post-write verification failed');
console.log('PROJECT5_RESULT '+JSON.stringify({verified:true,created:newlyAdded,fields:after.fields.nodes.length,views:after.views.nodes.length,items:after.items.totalCount,existingItemsPreserved:true,privateDetailsRedacted:true}));

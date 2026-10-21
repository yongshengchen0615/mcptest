import {readFileSync} from 'node:fs';
import {validateEvent,prepareUpdate,hasOption,checkItemStatus,OPTION,OWNER,REPO,PROJECT_NUMBER} from './release-core.mjs';

const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
const {issueNumber,issueUrl}=validateEvent(event);
if(!process.env.GH_TOKEN||!process.env.REPO_TOKEN)throw Error('Missing protected tokens');
const projectPath='users/'+OWNER+'/projectsV2/'+PROJECT_NUMBER;
const repositoryPath='repos/'+OWNER+'/'+REPO;
const version='2026-03-10';
async function api(method,path,body,scope='project'){
 const res=await fetch('https://api.github.com/'+path,{
   method,headers:{
     Authorization:'Bearer '+(scope==='project'?process.env.GH_TOKEN:process.env.REPO_TOKEN),
     Accept:'application/vnd.github+json',
     'X-GitHub-Api-Version':version,
     'User-Agent':'github-project7-mock-release',
     ...(body===undefined?{}:{'Content-Type':'application/json'})
   },
   ...(body===undefined?{}:{body:JSON.stringify(body)})
 });
 const raw=await res.text();
 let data;try{data=raw?JSON.parse(raw):{};}catch{data={message:'Unexpected response format'};}
 if(!res.ok)throw Error(method+' '+path.split('?')[0]+' failed HTTP '+res.status+' '+String(data.message||'').slice(0,180));
 return data;
}
function array(data){return Array.isArray(data)?data:Array.isArray(data?.value)?data.value:Array.isArray(data?.items)?data.items:[];}
const fields=array(await api('GET',projectPath+'/fields?per_page=100'));
const status=fields.find(f=>f.name==='Status');
const original=prepareUpdate(status);
if(!original.exists){
 const mutation=[
  'mutation UpdateField($input: UpdateProjectV2FieldInput!) {',
  '  updateProjectV2Field(input:$input) {',
  '    projectV2Field {',
  '      ... on ProjectV2SingleSelectField { id name options { id name } }',
  '    }',
  '  }',
  '}'
 ].join('\n');
 const response=await api('POST','graphql',{
    query:mutation,variables:{input:{fieldId:original.fieldId,singleSelectOptions:original.options}}
 });
 if(response.errors?.length)throw Error('GitHub GraphQL could not add Status option: '+
   response.errors.map(x=>String(x.message).slice(0,130)).join(' | '));
 if(!response.data?.updateProjectV2Field?.projectV2Field)throw Error('Status update response missing');
 console.log('SIM_NEW_OPTION_CREATED '+OPTION);
}else console.log('SIM_NEW_OPTION_ALREADY_EXISTS '+OPTION);

const refreshed=array(await api('GET',projectPath+'/fields?per_page=100'));
const current=refreshed.find(f=>f.name==='Status');
if(!hasOption(current))throw Error('New option not present after write');
const selected=current.options.find(x=>(typeof x.name==='string'?x.name:x.name?.raw)===OPTION);
if(!selected?.id)throw Error('New Status option ID missing');
console.log('SIM_NEW_OPTION_VERIFIED name='+OPTION);

const checkItems=async()=>array(await api('GET',projectPath+'/items?per_page=100&fields='+current.id));
const find=(items)=>items.find(x=>x.content?.html_url===issueUrl ||
  x.content?.url===issueUrl || x.content?.id===event.issue.id);
let item=find(await checkItems());
if(!item){
 item=await api('POST',projectPath+'/items',{type:'Issue',id:event.issue.id});
}
if(!Number.isSafeInteger(item?.id))throw Error('Numeric project item ID missing');
await api('PATCH',projectPath+'/items/'+item.id,{
  fields:[{id:current.id,value:selected.id}]
});
const verify=await api('GET',projectPath+'/items/'+item.id+'?fields='+current.id);
if(!checkItemStatus(verify,current.id,selected.id))throw Error('Item Status readback mismatch');
console.log('SIM_PROJECT_STATUS_VERIFIED issue='+issueNumber+' status='+OPTION);

const ref=process.env.GITHUB_SHA;
if(!/^[a-f0-9]{40}$/.test(ref||''))throw Error('Invalid ref');
const runUrl='https://github.com/'+OWNER+'/'+REPO+'/actions/runs/'+process.env.GITHUB_RUN_ID;
for(const [env,prod] of [['simulation-staging',false],['simulation-production',true]]){
 const deploy=await api('POST',repositoryPath+'/deployments',{
  ref,auto_merge:false,required_contexts:[],environment:env,
  description:'SIMULATION ONLY — no real Netlify/Supabase deployment',
  transient_environment:!prod,production_environment:false,
  task:'deploy'
 },'repository');
 if(!Number.isSafeInteger(deploy.id))throw Error('Deployment record missing ID for '+env);
 const status=await api('POST',repositoryPath+'/deployments/'+deploy.id+'/statuses',{
  state:'success',
  description:'MOCK PASSED — artifact and tests only. Not a live website.',
  environment_url:runUrl,
  auto_inactive:false
 },'repository');
 if(status.state!=='success')throw Error('Deployment status not confirmed for '+env);
 console.log('SIM_DEPLOYMENT_VERIFIED environment='+env+' id='+deploy.id+' noRealHosting=true');
}
const existing=array(await api('GET',repositoryPath+'/issues/'+issueNumber+'/comments?per_page=100',undefined,'repository'));
const marker='<!-- project7-release-evidence:v1 -->';
if(!existing.some(x=>String(x.body||'').includes(marker))){
 await api('POST',repositoryPath+'/issues/'+issueNumber+'/comments',{
  body:marker+'\n'+
  '✅ **模擬部署流程已完成（不是實際上線）**\n\n'+
  '- Project #7 Status 新增並驗證 '+OPTION+'\n'+
  '- 本卡 Status 已寫入並回讀驗證\n'+
  '- simulation-staging 與 simulation-production 僅建立 GitHub Deployment 模擬紀錄\n'+
  '- GitHub Actions 通過 Mock Unit/Smoke Test 並上傳靜態 artifact\n'+
  '- **未部署 Netlify、未連接 Supabase、未連接正式用戶資料**\n\n'+
  '驗證工作：[Actions]('+runUrl+')'
 },'repository');
}
console.log('SIM_RELEASE_COMPLETE '+JSON.stringify({project:7,issue:issueNumber,status:OPTION,simulatedDeployments:2,siteHosted:false,runUrl}));

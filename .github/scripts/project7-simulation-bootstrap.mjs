import {readFileSync} from 'node:fs';

const OWNER='yongshengchen0615';
const REPO='test1111';
const NUMBER=7;
const PROJECT='users/'+OWNER+'/projectsV2/'+NUMBER;
const MARKER='<!-- project7-simulation-bootstrap:v1 -->';
const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
if(event?.repository?.full_name!==OWNER+'/'+REPO ||
   event?.issue?.user?.login!==OWNER ||
   event?.sender?.login!==OWNER ||
   !String(event?.issue?.body||'').includes(MARKER)) throw Error('Bootstrap authorization denied');
if(!process.env.GH_TOKEN||!process.env.REPO_TOKEN)throw Error('Missing GitHub Actions credentials');

function unwrap(data){
  if(Array.isArray(data))return data;
  if(Array.isArray(data?.value))return data.value;
  if(Array.isArray(data?.items))return data.items;
  if(Array.isArray(data?.fields))return data.fields;
  return [];
}
async function api(method,path,body,repoToken=false){
  const token=repoToken?process.env.REPO_TOKEN:process.env.GH_TOKEN;
  const response=await fetch('https://api.github.com/'+path,{
    method,
    headers:{
      Authorization:'Bearer '+token,
      Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2026-03-10',
      'User-Agent':'project7-simulation-runner',
      ...(body===undefined?{}:{'Content-Type':'application/json'})
    },
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  const text=await response.text();
  let data=null;
  if(text){try{data=JSON.parse(text)}catch{data=text.slice(0,300)}}
  if(!response.ok){
    const message=String(data?.message||'request rejected').slice(0,160);
    const err=new Error('GitHub REST '+method+' '+path.split('?')[0]+' HTTP '+response.status+': '+message);
    err.status=response.status;
    throw err;
  }
  return data?.value && !Array.isArray(data.value)?data.value:data;
}
const repoPath='repos/'+OWNER+'/'+REPO;
const commentaryPath=repoPath+'/issues/'+event.issue.number+'/comments';
let comments=unwrap(await api('GET',commentaryPath+'?per_page=100',undefined,true));
function commentPresent(marker){return comments.some(x=>String(x.body||'').includes(marker))}
async function comment(body){
 const r=await api('POST',commentaryPath,{body},true);
 comments.push(r);
}
async function ensureLabels(){
 const defs=[
  ['sim-booking','526CFF'],['sim-sprint-1','5B78C7'],['sim-sprint-2','2A9D8F'],
  ['sim-sprint-3','A76AC8'],['sim-qa','D73A4A'],['sim-in-progress','F9D0C4'],
  ['sim-done','C2E0C6'],['sim-blocked','B60205'],['sim-review','BFDADC']
 ];
 for(const [name,color] of defs){
   try{await api('POST',repoPath+'/labels',{name,color,description:'Simulation workflow marker'},true)}
   catch(error){if(error.status!==422)throw error}
 }
 const groups=[
  [[5,6,7,8,9],['sim-booking','sim-sprint-1']],
  [[10,11,12,13,14],['sim-booking','sim-sprint-2']],
  [[15,16,17,18,19,20,21],['sim-booking','sim-sprint-3']],
  [[15,16,17],['sim-qa']],
  [[7,9,10,11],['sim-in-progress']],
  [[6,8],['sim-done']],
  [[17],['sim-blocked']],
  [[18],['sim-review']]
 ];
 for(const [nums,labels] of groups){
   for(const n of nums){
     await api('POST',repoPath+'/issues/'+n+'/labels',{labels},true);
   }
 }
 console.log('SIM_LABELS_DONE cards=17');
}
const views=[
 {key:'dev',name:'模擬開發工作區｜Kanban',layout:'board',filter:'label:sim-booking'},
 {key:'sprint1',name:'模擬 Sprint 1｜工作清單',layout:'table',filter:'label:sim-sprint-1'},
 {key:'qa',name:'模擬 QA｜測試與阻擋',layout:'table',filter:'label:sim-qa'},
 {key:'roadmap',name:'模擬 Roadmap｜三階段',layout:'roadmap',filter:'label:sim-booking'}
];
async function ensureViews(){
  let created=0;
  for(const view of views){
   const key='<!-- project7-view-created:'+view.key+':v1 -->';
   if(commentPresent(key)){console.log('SIM_VIEW_ALREADY_RECORDED '+view.key);continue}
   const result=await api('POST',PROJECT+'/views',{name:view.name,layout:view.layout,filter:view.filter});
   if(!result||!result.html_url)throw Error('View create response did not provide an HTML URL for '+view.key);
   await comment(key+'\nView created: '+view.name+'\n'+result.html_url);
   console.log('SIM_VIEW_CREATED '+view.key+' '+result.html_url);
   created++;
  }
  return created;
}
function valueName(v){return typeof v==='string'?v:v?.raw??v?.name?.raw??v?.name??null}
const stages=[
 [6,'Done',100],[8,'Done',100],
 [7,'In Progress',65],[9,'In Progress',35],[10,'In Progress',45],[11,'In Progress',30],
 [12,'Todo',0],[13,'Todo',0],[17,'Blocked',20]
];
async function applyStatuses(){
 const fieldList=unwrap(await api('GET',PROJECT+'/fields?per_page=100'));
 const status=fieldList.find(x=>x.name==='Status');
 if(!status||!Number.isSafeInteger(status.id))throw Error('Status REST field with numeric ID is absent');
 const opts=Array.isArray(status.options)?status.options:[];
 const map=new Map(opts.map(x=>[String(valueName(x.name)||'').toLowerCase(),x.id]));
 console.log('SIM_STATUS_OPTIONS '+Array.from(map.keys()).join(','));
 let items=unwrap(await api('GET',PROJECT+'/items?per_page=100&fields='+status.id));
 const summary=[];
 for(const [issueNumber,target,pct] of stages){
  let issue=await api('GET',repoPath+'/issues/'+issueNumber,undefined,true);
  let item=items.find(i=>
    i.content?.html_url===issue.html_url ||
    i.content?.url===issue.html_url ||
    i.content?.id===issue.id
  );
  if(!item){
    const added=await api('POST',PROJECT+'/items',{type:'Issue',id:issue.id});
    item=added;
    items.push(item);
  }
  if(!Number.isSafeInteger(item?.id))throw Error('REST Item numeric ID missing for issue #'+issueNumber);
  const option=map.get(target.toLowerCase());
  if(!option){
    summary.push({issue:issueNumber,stage:target,result:'option_missing'});
    continue;
  }
  await api('PATCH',PROJECT+'/items/'+item.id,{fields:[{id:status.id,value:option}]});
  const fetched=await api('GET',PROJECT+'/items/'+item.id+'?fields='+status.id);
  const vals=fetched?.fields||fetched?.field_values||fetched?.fieldValues;
  let match=false;
  if(Array.isArray(vals)){
    match=vals.some(f=> Number(f.id)===status.id &&
      [String(option),target.toLowerCase()].includes(String(f.value?.id??f.value??f.name?.raw??'').toLowerCase()));
  }
  const noteKey='<!-- project7-sim-progress:'+issueNumber+':v1 -->';
  const note='🧪 模擬工作狀態：'+target+'｜示範完成度 '+pct+'%（非真實產品進度）\n\n'+
   '操作紀錄：使用 Projects REST API 寫入 Stage；'+
   (match?'REST 回讀比對通過。':'REST 已回傳成功，但欄位值的回讀格式無法確認，需另以看板複核。');
  const cs=unwrap(await api('GET',repoPath+'/issues/'+issueNumber+'/comments?per_page=100',undefined,true));
  if(!cs.some(c=>String(c.body||'').includes(noteKey)))
    await api('POST',repoPath+'/issues/'+issueNumber+'/comments',{body:noteKey+'\n'+note},true);
  summary.push({issue:issueNumber,stage:target,result:match?'verified':'write_accepted_not_verified'});
 }
 console.log('SIM_STATUS_RESULT '+JSON.stringify(summary));
 await comment('<!-- project7-simulation-status-summary:v1 -->\n'+
   '模擬 Status 更新結果：\n'+summary.map(x=>'- Issue #'+x.issue+': '+x.stage+' — '+x.result).join('\n'));
 return summary;
}
const result={};
try {
  // REST-only bootstrap: avoids the exhausted GraphQL project rate budget.
  if(!commentPresent('<!-- project7-simulation-labels-done:v1 -->')){
    await ensureLabels();
    await comment('<!-- project7-simulation-labels-done:v1 -->\n17 張模擬卡已分配 Sprint/QA/進度 Labels');
  }
  result.viewsCreated=await ensureViews();
  if(!commentPresent('<!-- project7-simulation-status-summary:v1 -->'))
    result.statuses=await applyStatuses();
  console.log('SIMULATION_BOOTSTRAP_COMPLETE '+JSON.stringify({viewsCreated:result.viewsCreated,updates:result.statuses?.length||0}));
}catch(error){
 console.error('SIMULATION_BOOTSTRAP_FAILED '+String(error.message||error));
 throw error;
}

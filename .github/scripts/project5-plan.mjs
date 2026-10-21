export const OWNER='yongshengchen0615';
export const PROJECT_NUMBER=5;
export const APPLY_MARKER='<!-- project5-redesign:apply:v1 -->';
export const FIELDS=[
  {name:'Priority',dataType:'SINGLE_SELECT',options:['P0 Critical','P1 High','P2 Normal','P3 Low']},
  {name:'Work Type',dataType:'SINGLE_SELECT',options:['Feature','Bug','Refactor','Security','Testing','DevOps','Documentation']},
  {name:'Area',dataType:'SINGLE_SELECT',options:['Frontend','Backend','API','Database','Infrastructure','UX','QA']},
  {name:'Phase',dataType:'SINGLE_SELECT',options:['Discovery','Planning','Development','Review','Testing','Release','Monitoring']},
  {name:'Risk',dataType:'SINGLE_SELECT',options:['Low','Medium','High','Blocked']},
  {name:'Environment',dataType:'SINGLE_SELECT',options:['Development','Staging','Production']},
  {name:'Start Date',dataType:'DATE'},
  {name:'Target Date',dataType:'DATE'},
  {name:'Estimate (days)',dataType:'NUMBER'},
  {name:'Release',dataType:'TEXT'}
];
export const VIEWS=[
  {name:'01 | 開發看板',layout:'BOARD_LAYOUT'},
  {name:'02 | 工作清單',layout:'TABLE_LAYOUT'},
  {name:'03 | Roadmap',layout:'ROADMAP_LAYOUT'},
  {name:'04 | QA 驗收',layout:'TABLE_LAYOUT'},
  {name:'05 | 風險追蹤',layout:'TABLE_LAYOUT'}
];
export function planChanges(project){
  if(!project?.id||!Array.isArray(project?.fields?.nodes)||!Array.isArray(project?.views?.nodes))
    throw Error('Project inventory incomplete');
  if(project.fields.pageInfo?.hasNextPage||project.views.pageInfo?.hasNextPage)
    throw Error('Project exceeds audit limit; refusing changes');
  const fieldsToCreate=[],viewsToCreate=[],conflicts=[],warnings=[];
  for(const spec of FIELDS){
    const f=project.fields.nodes.find(x=>x?.name?.toLowerCase()===spec.name.toLowerCase());
    if(!f){fieldsToCreate.push(spec);continue;}
    const actual=f.dataType??(f.__typename==='ProjectV2SingleSelectField'?'SINGLE_SELECT':undefined);
    if(actual!==spec.dataType){conflicts.push(spec.name+': incompatible type');continue;}
    if(spec.options){
      const found=new Set((f.options??[]).map(o=>o.name?.toLowerCase()));
      const missing=spec.options.filter(o=>!found.has(o.toLowerCase()));
      if(missing.length)warnings.push(spec.name+': existing options preserved; '+missing.length+' suggested options absent');
    }
  }
  for(const view of VIEWS){
    const found=project.views.nodes.find(x=>x?.name?.toLowerCase()===view.name.toLowerCase());
    if(!found)viewsToCreate.push(view);
    else if(found.layout!==view.layout)conflicts.push('View '+view.name+': incompatible layout');
  }
  return {fieldsToCreate,viewsToCreate,conflicts,warnings};
}
export function validateApplyEvent(event){
  if(event?.repository?.full_name!==OWNER+'/mcptest')throw Error('Unexpected repository');
  if(event?.issue?.user?.login!==OWNER||event?.sender?.login!==OWNER)throw Error('Owner-only command');
  const body=event.issue.body;
  if(typeof body!=='string'||body.split(APPLY_MARKER).length!==2)throw Error('A single exact marker is required');
  if(!/^https:\/\/github\.com\/yongshengchen0615\/mcptest\/issues\/[1-9]\d*$/.test(event.issue.html_url??''))
    throw Error('Invalid control issue URL');
  return true;
}

export const OWNER='yongshengchen0615';
export const REPO='test1111';
export const PROJECT_NUMBER=7;
export const MARKER='<!-- project7-release-demo:v1 -->';
export const OPTION='Deployed (Simulation)';
export function validateEvent(event){
 if(event?.repository?.full_name!==OWNER+'/'+REPO)throw Error('Wrong repository');
 if(event?.issue?.user?.login!==OWNER||event?.sender?.login!==OWNER)throw Error('Unauthorized actor');
 if(typeof event?.issue?.body!=='string'||!event.issue.body.includes(MARKER))throw Error('Missing release marker');
 if(event.issue.number<1||!Number.isSafeInteger(event.issue.number))throw Error('Invalid issue');
 const expected='https://github.com/'+OWNER+'/'+REPO+'/issues/'+event.issue.number;
 if(event.issue.html_url!==expected)throw Error('Unexpected issue URL');
 return {issueNumber:event.issue.number,issueUrl:expected};
}
export function optionName(value){
 return typeof value==='string'?value:(value?.raw??value?.name?.raw??value?.name??null);
}
export function prepareUpdate(field){
 if(!field||field.name!=='Status'||field.data_type!=='single_select'||
   typeof field.node_id!=='string'||!field.node_id.startsWith('PVT'))throw Error('Status field is invalid');
 if(!Array.isArray(field.options)||field.options.length<1||field.options.length>30)throw Error('Invalid existing options');
 const names=new Set();
 const result=field.options.map(o=>{
  const name=optionName(o.name);
  if(typeof name!=='string'||!name||!o.id||typeof o.id!=='string')throw Error('Existing option cannot be preserved');
  if(names.has(name.toLowerCase()))throw Error('Duplicate existing option');
  names.add(name.toLowerCase());
  if(typeof o.color!=='string'||!['BLUE','GRAY','GREEN','ORANGE','PINK','PURPLE','RED','YELLOW'].includes(o.color))throw Error('Existing option color missing');
  return {id:o.id,name,color:o.color,description:optionName(o.description)||''};
 });
 if(result.some(o=>o.name.toLowerCase()===OPTION.toLowerCase()))return {exists:true,options:result,fieldId:field.node_id};
 result.push({name:OPTION,color:'PURPLE',description:'Simulation only; no real Netlify/Supabase deployment'});
 return {exists:false,options:result,fieldId:field.node_id};
}
export function hasOption(field){
 return Boolean(field?.options?.some(o=>optionName(o.name)?.toLowerCase()===OPTION.toLowerCase()));
}
export function checkItemStatus(item,fieldId,optionId){
 const values=item?.fields??item?.field_values??item?.fieldValues;
 return Array.isArray(values)&&values.some(f=>Number(f.id)===Number(fieldId)&&
  (String(f.value?.id??f.value??'')===String(optionId)||optionName(f.name)===OPTION));
}

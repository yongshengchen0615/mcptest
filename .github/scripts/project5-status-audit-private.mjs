import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {OWNER,PROJECT_NUMBER} from './project5-plan.mjs';

if(!process.env.GH_TOKEN)throw Error('Missing Project token');
const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
const marker='<!-- project5-status-audit:v1 -->';
if(event?.repository?.full_name!==OWNER+'/mcptest'||
   event?.issue?.user?.login!==OWNER||event?.sender?.login!==OWNER||
   typeof event?.issue?.body!=='string'||event.issue.body.split(marker).length!==2)
  throw Error('Unauthorized private audit trigger');
const target='yongshengchen0615/MembershipSystem';
function call(args){
  try{
    return execFileSync('gh',['api',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000,maxBuffer:8*1024*1024}).trim();
  }catch(e){throw Error('Private status audit API failed (exit '+String(e.status??'?')+')');}
}
const metadata=JSON.parse(call(['repos/'+target]));
if(metadata.private!==true||metadata.owner?.login!==OWNER)throw Error('Audit destination must be private and owner-controlled');
const q='query {user(login:'+JSON.stringify(OWNER)+'){projectV2(number:'+PROJECT_NUMBER+
  '){field(name:"Status"){...on ProjectV2SingleSelectField{options{name color description}}}}}}';
const raw=JSON.parse(call(['graphql','-f','query='+q]));
if(raw.errors?.length)throw Error('Cannot read Status options');
const options=raw.data?.user?.projectV2?.field?.options;
if(!Array.isArray(options)||options.length===0)throw Error('No Status options');
const payload=JSON.stringify({project:PROJECT_NUMBER,source:'Status',options},null,2)+'\n';
const targetPath='.github/project5/status-audit.json';
const args=['--method','PUT','repos/'+target+'/contents/'+targetPath,
  '-f','message=chore(project5): snapshot Status option texts for localization audit',
  '-f','content='+Buffer.from(payload).toString('base64')];
call(args);
console.log('PROJECT5_PRIVATE_AUDIT '+JSON.stringify({created:true,private:true,optionCount:options.length,detailsRedacted:true}));

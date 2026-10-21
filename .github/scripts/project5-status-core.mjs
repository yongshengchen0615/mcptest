import {OWNER,PROJECT_NUMBER} from './project5-plan.mjs';

export const STATUS_MARKER='<!-- project5-status-zh:v1 -->';
export const STATUS_OWNER=OWNER;
export const STATUS_PROJECT=PROJECT_NUMBER;

const DEFINITIONS=[
  {names:['Backlog','待整理','需求池','待規劃'],label:'待規劃',description:'需求或問題已收集，尚待釐清範圍、優先級與排程。'},
  {names:['Todo','To Do','To-do','待辦','待處理'],label:'待辦',description:'工作已確認但尚未開始，等待負責人安排與執行。'},
  {names:['Ready','Ready to Start','Ready for Development','準備開始','可開始開發'],label:'準備開始',description:'需求、驗收標準與相依條件已確認，可正式開始實作。'},
  {names:['Planned','規劃完成'],label:'規劃完成',description:'範圍與交付目標已確認，等待排入開發時程。'},
  {names:['Triage','分類中'],label:'分類中',description:'正在分類需求或缺陷，確認影響範圍、風險與處理優先級。'},
  {names:['Not Started','尚未開始'],label:'尚未開始',description:'任務已建立，但尚未安排開始或尚未開始處理。'},
  {names:['In Progress','進行中','開發中'],label:'開發中',description:'負責人正在實作、修正或執行任務，需持續更新進度。'},
  {names:['In Development','Development','實作中'],label:'實作中',description:'正在編寫與整合程式碼，完成後進入審查及測試。'},
  {names:['In Review','Review','審查中'],label:'審查中',description:'交付內容正接受同儕審查，待確認品質與驗收條件。'},
  {names:['Code Review','PR Review','程式碼審查'],label:'程式碼審查',description:'程式碼已提交審查，需通過 PR Review 與必要的 CI 檢查。'},
  {names:['QA','QA / Testing','QA/Testing','Testing','In Testing','In QA','測試中','測試驗收'],label:'測試驗收',description:'正在進行功能、整合、回歸及必要的安全測試，確認符合驗收標準。'},
  {names:['Blocked','已阻塞','受阻'],label:'已阻塞',description:'受到相依任務、權限、環境或未解決問題阻礙，需記錄原因與解除條件。'},
  {names:['On Hold','Paused','暫緩處理','已暫停'],label:'暫緩處理',description:'任務暫時停止執行，需記錄暫緩原因與恢復條件。'},
  {names:['Ready to Deploy','Ready for Deploy','Ready for Deployment','Ready for Release','等待部署'],label:'等待部署',description:'審查、測試與驗收已完成，等待排定部署或發布時機。'},
  {names:['Deploying','Deploy','部署中'],label:'部署中',description:'正在部署至目標環境並執行必要的設定及資料變更。'},
  {names:['Deployed','Monitoring','觀察中'],label:'觀察中',description:'變更已部署，持續監控錯誤、效能與服務穩定性。'},
  {names:['Released','Published','已發布'],label:'已發布',description:'版本已完成發布並確認基本服務可正常運作。'},
  {names:['Done','已完成'],label:'已完成',description:'任務已通過審查、測試與驗收，相關交付紀錄已更新。'},
  {names:['Completed','已結案'],label:'已結案',description:'工作與收尾事項均已完成，無待處理的必要動作。'},
  {names:['Closed','已關閉'],label:'已關閉',description:'事項已正式關閉，原因與處理結論已保留供追蹤。'},
  {names:['Canceled','Cancelled','已取消'],label:'已取消',description:'經評估確定不再執行，需保留取消原因與決策紀錄。'},
  {names:['Rejected','不予處理'],label:'不予處理',description:'經評估不符合目前目標或執行條件，保留評估與處置原因。'},
  {names:['Pending','等待確認'],label:'等待確認',description:'正等待需求、負責人或外部條件確認，暫未進入下一階段。'}
];
const normalize=s=>String(s).trim().toLocaleLowerCase('en-US').replace(/\s+/g,' ');
const byName=new Map();
const byLabel=new Map();
for(const item of DEFINITIONS){
  byLabel.set(item.label,item);
  for(const name of item.names)byName.set(normalize(name),item);
}
const hasHan=s=>/[\u3400-\u9fff]/u.test(s);
export function buildChineseStatusPlan(options){
  if(!Array.isArray(options)||options.length===0||options.length>100)throw Error('Status options not available');
  const ids=new Set(),names=new Set(),updates=[];
  for(const old of options){
    if(typeof old?.id!=='string'||!old.id||typeof old.name!=='string'||!old.name.trim()||
      typeof old.color!=='string'||!old.color.trim())throw Error('Invalid Status option');
    if(ids.has(old.id))throw Error('Duplicate option IDs');
    ids.add(old.id);
    const key=normalize(old.name);
    const known=byName.get(key)||byLabel.get(old.name);
    if(!known&&!hasHan(old.name))throw Error('Unmapped English status option: refusing partial translation');
    const name=known?.label||old.name;
    const description=known?.description||(
      typeof old.description==='string'&&hasHan(old.description)&&old.description.trim()
      ? old.description.trim()
      : '此狀態延用原有流程，請記錄工作進度、負責人及進入下一階段的條件。');
    if(names.has(normalize(name)))throw Error('Translated Status labels collide; refusing changes');
    names.add(normalize(name));
    updates.push({id:old.id,name,color:old.color,description});
  }
  return {
    updates,
    changed:updates.some((u,i)=>u.name!==options[i].name||u.description!==options[i].description),
    preservedIds:updates.length
  };
}
export function validateStatusEvent(event){
  if(event?.repository?.full_name!==OWNER+'/mcptest'||
    event?.issue?.user?.login!==OWNER||event?.sender?.login!==OWNER)
    throw Error('Owner-only Project #5 command');
  const body=event?.issue?.body;
  if(typeof body!=='string'||body.split(STATUS_MARKER).length!==2)throw Error('Exactly one Status command marker required');
  if(!/^https:\/\/github\.com\/yongshengchen0615\/mcptest\/issues\/[1-9]\d*$/.test(event?.issue?.html_url??''))
    throw Error('Control issue URL invalid');
  return true;
}

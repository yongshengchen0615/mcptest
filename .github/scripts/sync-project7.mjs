import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {OWNER, PROJECT_NUMBER, verifyEvent, resolveFields, findItem} from './project7-core.mjs';

function gh(args) {
  return JSON.parse(execFileSync('gh', args, {
    encoding: 'utf8',
    stdio: ['ignore','pipe','pipe'],
    timeout: 60000,
    maxBuffer: 10485760
  }));
}
function items() {
  return gh(['project','item-list',PROJECT_NUMBER,'--owner',OWNER,'--limit','1000','--format','json']).items || [];
}
if (!process.env.GH_TOKEN) throw new Error('Missing Actions secret PROJECTS_V2_TOKEN');
if (!process.env.GITHUB_EVENT_PATH) throw new Error('Missing GITHUB_EVENT_PATH');

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
const {url,plan} = verifyEvent(event);
console.log('Sync to Project #7: ' + url);

let item = findItem(items(),url);
if (!item) {
  gh(['project','item-add',PROJECT_NUMBER,'--owner',OWNER,'--url',url,'--format','json']);
  item = findItem(items(),url);
  if (!item) throw new Error('Failed to read back item after project item-add');
  console.log('Added item ' + item.id);
} else {
  console.log('Existing item ' + item.id);
}

const response = gh(['project','field-list',PROJECT_NUMBER,'--owner',OWNER,'--limit','100','--format','json']);
const {actions,warnings} = resolveFields(response.fields || [],plan);
for (const warning of warnings) console.warn('WARNING: ' + warning);
for (const action of actions) {
  const args = ['project','item-edit',PROJECT_NUMBER,'--owner',OWNER,'--url',url,'--field',action.name];
  if (action.kind === 'date') args.push('--date',action.value);
  else args.push('--value',action.value);
  gh([...args,'--format','json']);
  console.log('Updated ' + action.name + ': ' + action.value);
}
const check = findItem(items(),url);
if (!check) throw new Error('Project item could not be read back after update');
console.log('Project #7 item confirmed: ' + check.id);
if (warnings.length) console.log('Some fields were skipped, see warnings above.');

import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {OWNER, PROJECT_NUMBER, verifyEvent, resolveFields, findItem, verifyReadback} from './project7-core.mjs';

function gh(args) {
  try {
    return JSON.parse(execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore','pipe','pipe'],
      timeout: 60000,
      maxBuffer: 10485760
    }));
  } catch (error) {
    const stderr = String(error.stderr || '');
    if (stderr.includes('missing required scopes [read:project]') ||
        stderr.includes("requires one of the following scopes: ['read:project']")) {
      throw new Error('PROJECTS_V2_TOKEN lacks GitHub Project read access. For a user-owned Project #7, create a PAT (classic) with the project scope, then REPLACE the PROJECTS_V2_TOKEN repository Actions secret. Do not run gh auth refresh in Actions.');
    }
    if (stderr.includes("requires one of the following scopes: ['project']")) {
      throw new Error('PROJECTS_V2_TOKEN lacks GitHub Project write access (project scope). Update the repository Actions secret with a PAT (classic) authorized for Project #7.');
    }
    // Avoid printing any environment variables or request headers.
    throw new Error('GitHub CLI operation failed ('+args.slice(0,3).join(' ')+'): '+stderr.slice(0,900));
  }
}

function items(fieldNames = []) {
  const args = ['project','item-list',PROJECT_NUMBER,'--owner',OWNER,'--limit','1000'];
  for (const name of fieldNames) args.push('--field',name);
  return gh([...args,'--format','json']).items || [];
}
if (!process.env.GH_TOKEN) throw new Error('Missing Actions secret PROJECTS_V2_TOKEN');
if (!process.env.GITHUB_EVENT_PATH) throw new Error('Missing GITHUB_EVENT_PATH');

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
const {url,plan} = verifyEvent(event);
console.log('Sync to Project #7: ' + url);

// Project metadata is read before any mutation: fail clearly when authorization is missing.
const response = gh(['project','field-list',PROJECT_NUMBER,'--owner',OWNER,'--limit','100','--format','json']);
const {actions,warnings} = resolveFields(response.fields || [],plan);
for (const warning of warnings) console.warn('WARNING: ' + warning);
if (warnings.length) throw new Error('Requested Project #7 fields or options were not found; no changes performed. Adjust card metadata to match the actual Project field options.');

let item = findItem(items(),url);
if (!item) {
  gh(['project','item-add',PROJECT_NUMBER,'--owner',OWNER,'--url',url,'--format','json']);
  item = findItem(items(),url);
  if (!item) throw new Error('Failed to read back item after project item-add');
  console.log('Added item ' + item.id);
} else {
  console.log('Existing item ' + item.id);
}

for (const action of actions) {
  const args = ['project','item-edit',PROJECT_NUMBER,'--owner',OWNER,'--url',url,'--field',action.name];
  if (action.kind === 'date') args.push('--date',action.value);
  else args.push('--value',action.value);
  gh([...args,'--format','json']);
  console.log('Wrote ' + action.name + ': ' + action.value);
}
const check = findItem(items(actions.map(a=>a.name)),url);
if (!check) throw new Error('Project item could not be read back after update');
const result = verifyReadback(check,actions);
if (!result.ok) throw new Error('Project field readback mismatch: '+result.errors.join('; '));
console.log('VERIFIED Project #7 item ' + check.id + ' (' + actions.map(a=>a.name+'='+a.value).join(', ') + ')');

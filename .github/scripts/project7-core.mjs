export const OWNER = 'yongshengchen0615';
export const REPO = 'test1111';
export const PROJECT_NUMBER = '7';
export const MARKER = '<!-- project7-managed -->';

export function parsePlan(body) {
  if (typeof body !== 'string' || !body.includes(MARKER)) {
    throw new Error('Missing exact <!-- project7-managed --> marker');
  }
  const result = {};
  const allowed = new Map([
    ['Status', /^(?:Todo|To do|Backlog|Ready|In Progress|In Review|Code Review|QA|Blocked|Done|Closed)$/i],
    ['Priority', /^(?:Low|Medium|High|Critical|Urgent|P[0-3])$/i]
  ]);
  for (const line of body.split(/\r?\n/)) {
    const match = /^\s*<!--\s*project7:(Status|Priority|Due Date)=([^\r\n<>]{1,80})\s*-->\s*$/i.exec(line);
    if (!match) continue;
    const key = ['Status','Priority','Due Date'].find(x => x.toLowerCase() === match[1].toLowerCase());
    if (Object.hasOwn(result,key)) throw new Error('Duplicate ' + key);
    const value = match[2].trim();
    if (!value) throw new Error('Empty ' + key);
    if (key === 'Due Date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value+'T00:00:00Z')) ||
          new Date(value+'T00:00:00Z').toISOString().slice(0,10) !== value) {
        throw new Error('Due Date must be a valid YYYY-MM-DD date');
      }
    } else if (!allowed.get(key).test(value)) {
      throw new Error('Unsupported ' + key + ': ' + value);
    }
    result[key] = value;
  }
  return result;
}

export function verifyEvent(event) {
  if (event?.repository?.full_name !== OWNER+'/'+REPO) throw new Error('Unexpected repository');
  if (event?.issue?.user?.login !== OWNER) throw new Error('Issue author must be owner');
  if (event?.sender?.login !== OWNER) throw new Error('Event sender must be owner');
  const url = event?.issue?.html_url;
  if (typeof url !== 'string' ||
      !/^https:\/\/github\.com\/yongshengchen0615\/test1111\/issues\/[1-9]\d*$/.test(url)) {
    throw new Error('Invalid issue URL');
  }
  return { url, plan: parsePlan(event.issue.body) };
}

export function resolveFields(fields, requested) {
  const actions = [], warnings = [];
  for (const [name,value] of Object.entries(requested)) {
    const field = fields.find(f => f.name?.toLowerCase() === name.toLowerCase());
    if (!field) { warnings.push('Field '+name+' not present in Project #7; skipped'); continue; }
    if (name !== 'Due Date') {
      if (!Array.isArray(field.options)) { warnings.push(name+' is not a single-select field; skipped'); continue; }
      const match = field.options.find(o => o.name?.toLowerCase() === value.toLowerCase());
      if (!match) { warnings.push(name+' option '+value+' not defined; skipped'); continue; }
      actions.push({name:field.name,value:match.name,kind:'select'});
    } else {
      if (!/date/i.test(field.type || field.dataType || field.data_type || '')) {
        warnings.push(name+' is not confirmed as a date field; skipped'); continue;
      }
      actions.push({name:field.name,value,kind:'date'});
    }
  }
  return {actions,warnings};
}

export function findItem(items,url) {
  return items.find(x => x.content?.url === url || x.content?.html_url === url || x.url === url);
}


export function readItemField(item, name) {
  if (!item || typeof item !== 'object') return undefined;
  const key = Object.keys(item).find(k => k.toLowerCase() === name.toLowerCase());
  if (!key) return undefined;
  const entry = item[key];
  if (typeof entry === 'string') return entry;
  if (typeof entry === 'number') return String(entry);
  if (entry && typeof entry === 'object') {
    if (typeof entry.name === 'string') return entry.name;
    if (typeof entry.name?.raw === 'string') return entry.name.raw;
    if (typeof entry.value === 'string') return entry.value;
    if (typeof entry.date === 'string') return entry.date;
  }
  return undefined;
}

export function verifyReadback(item, actions) {
  if (!item) return {ok: false, errors: ['Project item missing']};
  const errors = [];
  for (const action of actions) {
    const observed = readItemField(item, action.name);
    const expected = action.value;
    const equal = action.kind === 'date'
      ? observed?.slice(0,10) === expected
      : observed?.toLowerCase() === expected.toLowerCase();
    if (!equal) errors.push(action.name + ': expected ' + expected + ', got ' + (observed ?? '<not returned>'));
  }
  return {ok: errors.length === 0, errors};
}

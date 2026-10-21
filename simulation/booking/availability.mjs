/**
 * Demonstration-only, pure slot-filtering logic for Project #7.
 * Not connected to production databases, authentication or billing.
 */
const MAX_LIMIT = 200;

function parseTime(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)) {
    throw new TypeError(label + ' must be a UTC ISO 8601 timestamp');
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new TypeError(label + ' is not a valid time');
  return time;
}

/**
 * Return publicly displayable available slots without modifying stored data.
 * IMPORTANT: reserving the slot still requires a transactional DB constraint.
 */
export function listAvailableSlots(slots, options) {
  if (!Array.isArray(slots)) throw new TypeError('slots must be an array');
  if (!options || typeof options !== 'object') throw new TypeError('options are required');
  const {serviceId, from, to, now, limit = 50} = options;
  if (typeof serviceId !== 'string' || serviceId.length < 1 || serviceId.length > 80) {
    throw new TypeError('serviceId is invalid');
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new RangeError('limit must be an integer between 1 and '+MAX_LIMIT);
  }
  const fromMs = parseTime(from, 'from');
  const toMs = parseTime(to, 'to');
  const nowMs = parseTime(now, 'now');
  if (toMs <= fromMs) throw new RangeError('to must be later than from');
  const matches = [];
  for (const slot of slots) {
    if (!slot || slot.serviceId !== serviceId || slot.isActive !== true) continue;
    const start = parseTime(slot.startsAt, 'slot.startsAt');
    if (start < fromMs || start >= toMs || start <= nowMs) continue;
    if (!Number.isSafeInteger(slot.capacity) || slot.capacity < 1) continue;
    if (!Number.isSafeInteger(slot.reservedCount) || slot.reservedCount < 0) continue;
    if (slot.reservedCount >= slot.capacity) continue;
    matches.push({
      id: slot.id,
      serviceId: slot.serviceId,
      startsAt: slot.startsAt,
      available: slot.capacity-slot.reservedCount
    });
  }
  return matches.sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)).slice(0,limit);
}

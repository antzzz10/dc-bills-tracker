// Counting units for every published number. Decided 2026-11-09 after the site said
// "14 have cleared at least one chamber — 4 are now law" when the truth was 12 and 2.
//
// bills.json stores some measures as several entries, one per D.C. provision: H.R. 1968
// (the 2025 full-year funding law) is three entries, H.R. 5242 is three. Counting entries
// counts the same law three times. So a published number counts *measures*: one official
// bill or resolution. Entries that share any bill number (companions included, in any
// order) are the same measure.
//
// Budget riders are the exception. Each rider entry is a separate D.C. provision that rides
// on a spending bill (17 on H.R. 5166 alone), and the site calls them "budget riders", not
// bills, so each one counts as one rider.
//
// Resolutions are counted apart from bills (Andria, 2026-11-09), so a sentence about
// "bills" never quietly includes them. Routine measures are counted apart from anti-DC
// ones by the callers: they are structural consequences of denied statehood, not attacks.

const normalize = number => String(number).replace(/\s+/g, '').toUpperCase();

const numbersOf = item => {
  const numbers = (item.billNumbers || []).map(normalize);
  return numbers.length ? numbers : [normalize(item.id)];
};

/** The first official number of an entry, normalized. Used for labels and lint keys. */
export const measureKey = item => numbersOf(item)[0];

export const isRider = item => item.type === 'rider';

export const isResolution = item => /RES\./.test(measureKey(item));

/**
 * Group entries into counting units: one per measure (entries sharing any bill number are
 * merged), one per budget-rider entry. Returns an array of groups, each an array of entries.
 */
export function groupUnits(items = []) {
  const groups = [];
  const groupByNumber = new Map();
  for (const item of items) {
    if (isRider(item)) {
      groups.push([item]);
      continue;
    }
    const matches = [...new Set(numbersOf(item).map(n => groupByNumber.get(n)).filter(Boolean))];
    let group;
    if (matches.length === 0) {
      group = [];
      groups.push(group);
    } else {
      // Merge every group this entry bridges into the first one.
      group = matches[0];
      for (const other of matches.slice(1)) {
        group.push(...other);
        for (const entry of other) numbersOf(entry).forEach(n => groupByNumber.set(n, group));
        groups.splice(groups.indexOf(other), 1);
      }
    }
    group.push(item);
    numbersOf(item).forEach(n => groupByNumber.set(n, group));
  }
  return groups;
}

/**
 * Count distinct units. `total` is what a sentence may call "N bills, resolutions and
 * budget riders"; `bills` and `resolutions` never include riders.
 */
export function countUnits(items = []) {
  const groups = groupUnits(items);
  let bills = 0;
  let resolutions = 0;
  let riders = 0;
  for (const [first] of groups) {
    if (isRider(first)) riders += 1;
    else if (isResolution(first)) resolutions += 1;
    else bills += 1;
  }
  return { total: groups.length, bills, resolutions, riders };
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** "11 bills and 1 resolution" — names only the kinds present. */
export function describeKinds({ bills = 0, resolutions = 0, riders = 0 }) {
  const parts = [];
  if (bills) parts.push(plural(bills, 'bill', 'bills'));
  if (resolutions) parts.push(plural(resolutions, 'resolution', 'resolutions'));
  if (riders) parts.push(plural(riders, 'budget rider', 'budget riders'));
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

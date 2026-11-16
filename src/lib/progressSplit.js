// How far the tracked anti-DC measures have got, in words that stay true.
//
// Decided 2026-11-15 (Andria): one headline number everywhere, the count of every
// tracked measure, with the split beneath it as context. The old split said "60 pending,
// 14 passed", but a bill that has passed one chamber and is not law is still pending, so
// "pending" is not used for any group. Each group is named by what is literally true of
// every measure in it:
//   law                  — enacted
//   moving               — cleared at least one chamber, not law (never "not yet law": an
//                          agreed concurrent resolution never becomes one)
//   notPassed            — has not passed either chamber
//
// The words for the middle group are chosen from the data. Today all of them passed the
// House, so the line says so; if the Senate ever acts first on one, the wording widens by
// itself instead of going stale.

import { groupUnits, countUnits } from './measureCounts.js';
import { isActive, isEnacted, measureType, ADVANCED_STAGES } from './measureStatus.js';

const stageOf = item => item.status?.stage;

// A chamber is named ("passed the House and await the Senate") only when that is the
// whole truth for the measure (Codex, 2026-11-15):
//   - a bill or joint resolution, which needs both chambers. A simple resolution agreed
//     to by the House is finished there and awaits nothing;
//   - at the plain passed-<chamber> stage in every entry;
//   - with no record that the other chamber has passed it too. When both have passed
//     different texts the monitor keeps the first chamber's stage and sets
//     status.bothChambersPassed, and "awaits the Senate" would be false.
const NEEDS_BOTH_CHAMBERS = new Set(['bill', 'joint']);
const awaitsOther = (unit, stage) =>
  NEEDS_BOTH_CHAMBERS.has(measureType(unit[0])) &&
  unit.every(item => stageOf(item) === stage && !item.status?.bothChambersPassed);

/** Which chamber the moving measures have cleared: 'house', 'senate' or 'mixed'. */
function whereMoving(movingUnits) {
  if (movingUnits.length === 0) return null;
  if (movingUnits.every(unit => awaitsOther(unit, 'passed-house'))) return 'house';
  if (movingUnits.every(unit => awaitsOther(unit, 'passed-senate'))) return 'senate';
  return 'mixed';
}

/**
 * Split entries into the three groups. Counts are of measures, not entries
 * (src/lib/measureCounts.js): entries are grouped into measures first and each measure
 * goes into exactly one group, by the furthest stage any of its entries records, so the
 * three always add up to `total`. (Entries of one measure should agree on its stage;
 * lint-bills.js check 7b and the claims gate fail when they don't.)
 */
export function progressSplit(items = []) {
  const units = groupUnits(items.filter(isActive));
  const law = units.filter(unit => unit.some(isEnacted));
  const rest = units.filter(unit => !unit.some(isEnacted));
  const moving = rest.filter(unit => unit.some(item => ADVANCED_STAGES.has(stageOf(item))));
  const notPassed = rest.filter(unit => !unit.some(item => ADVANCED_STAGES.has(stageOf(item))));
  return {
    total: units.length,
    law: law.length,
    lawKinds: countUnits(law.map(unit => unit[0])),
    moving: moving.length,
    movingWhere: whereMoving(moving),
    notPassed: notPassed.length,
  };
}

const one = n => n === 1;

/** "passed the House and await the Senate", agreeing with the count. */
export function movingPhrase(n, where) {
  if (where === 'house') return `passed the House and ${one(n) ? 'awaits' : 'await'} the Senate`;
  if (where === 'senate') return `passed the Senate and ${one(n) ? 'awaits' : 'await'} the House`;
  return `cleared at least one chamber and ${one(n) ? 'is' : 'are'} not law`;
}

/** Short form for a heading: "passed the House". */
export function movingShort(where) {
  if (where === 'house') return 'passed the House';
  if (where === 'senate') return 'passed the Senate';
  return 'cleared a chamber, not law';
}

/**
 * The context line shown under the headline number, the same on every surface:
 * ["4 are law", "10 passed the House and await the Senate", "60 have not passed either chamber"].
 * Groups with nothing in them are left out.
 */
export function contextParts({ law, moving, movingWhere, notPassed }) {
  return [
    law > 0 && `${law} ${one(law) ? 'is' : 'are'} law`,
    moving > 0 && `${moving} ${movingPhrase(moving, movingWhere)}`,
    notPassed > 0 && `${notPassed} ${one(notPassed) ? 'has' : 'have'} not passed either chamber`,
  ].filter(Boolean);
}

/** The same split, compressed for a list heading: "4 law, 10 passed the House, 60 not passed either chamber". */
export function shortParts({ law, moving, movingWhere, notPassed }) {
  return [
    law > 0 && `${law} law`,
    moving > 0 && `${moving} ${movingShort(movingWhere)}`,
    notPassed > 0 && `${notPassed} not passed either chamber`,
  ].filter(Boolean);
}

/** "threats to D.C. home rule": the one headline label, used with the total everywhere. */
export const headlineNoun = count => `${count === 1 ? 'threat' : 'threats'} to D.C. home rule`;

/**
 * The list heading's words, built here so the page and the claims gate use the same
 * text: App.jsx prints exactly these strings and scripts/check-published-claims.js
 * compares them with its own count.
 *   headline  "74 threats to D.C. home rule"      never changes with a search or filter
 *   breakdown "4 law, 10 passed the House, 60 not passed either chamber"
 *   also      "Also listed: 18 archived, 1 routine, 1 barrier to statehood"
 *             or, with a search or filter on, "Showing 18 matches: 2 law, 16 archived",
 *             whose parts add up to the number of matches.
 */
export function listHeading({ overall, matching = null, archived = 0, routine = 0, barriers = 0 }) {
  const others = [
    archived > 0 && `${archived} archived`,
    routine > 0 && `${routine} routine`,
    barriers > 0 && `${barriers} ${barriers === 1 ? 'barrier' : 'barriers'} to statehood`,
  ].filter(Boolean);
  let also = '';
  if (matching) {
    const matches = matching.total + archived + routine + barriers;
    also = matches === 0
      ? 'No matches'
      : `Showing ${matches} ${matches === 1 ? 'match' : 'matches'}: ${[...shortParts(matching), ...others].join(', ')}`;
  } else if (others.length > 0) {
    also = `Also listed: ${others.join(', ')}`;
  }
  return {
    headline: `${overall.total} ${headlineNoun(overall.total)}`,
    breakdown: shortParts(overall).join(', '),
    also,
  };
}

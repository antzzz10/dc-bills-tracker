// How far the tracked anti-DC measures have got, in words that stay true.
//
// Decided 2026-11-15 (Andria): one headline number everywhere, the count of every
// tracked measure, with the split beneath it as context. The old split said "60 pending,
// 14 passed", but a bill that has passed one chamber and is not law is still pending, so
// "pending" is not used for any group. Each group is named by what is literally true of
// every measure in it:
//   law                  — enacted
//   moving               — cleared at least one chamber, not law
//   notPassed            — has not passed either chamber
//
// The words for the middle group are chosen from the data. Today all of them passed the
// House, so the line says so; if the Senate ever acts first on one, the wording widens by
// itself instead of going stale.

import { countUnits } from './measureCounts.js';
import { isActive, hasAdvanced, isEnacted } from './measureStatus.js';

const HOUSE_ONLY = new Set(['passed-house', 'agreed-house']);
const SENATE_ONLY = new Set(['passed-senate', 'agreed-senate']);

/** Which chamber the moving measures have cleared: 'house', 'senate' or 'mixed'. */
function whereMoving(moving) {
  if (moving.length === 0) return null;
  if (moving.every(item => HOUSE_ONLY.has(item.status?.stage))) return 'house';
  if (moving.every(item => SENATE_ONLY.has(item.status?.stage))) return 'senate';
  return 'mixed';
}

/**
 * Split entries into the three groups. Counts are of measures, not entries
 * (src/lib/measureCounts.js). The three always add up to `total`; the claims gate
 * asserts that against an independent count.
 */
export function progressSplit(items = []) {
  const active = items.filter(isActive);
  const law = active.filter(isEnacted);
  const moving = active.filter(item => hasAdvanced(item) && !isEnacted(item));
  const notPassed = active.filter(item => !hasAdvanced(item));
  return {
    total: countUnits(active).total,
    law: countUnits(law).total,
    lawKinds: countUnits(law),
    moving: countUnits(moving).total,
    movingWhere: whereMoving(moving),
    notPassed: countUnits(notPassed).total,
  };
}

const one = n => n === 1;

/** "passed the House and await the Senate", agreeing with the count. */
export function movingPhrase(n, where) {
  if (where === 'house') return `passed the House and ${one(n) ? 'awaits' : 'await'} the Senate`;
  if (where === 'senate') return `passed the Senate and ${one(n) ? 'awaits' : 'await'} the House`;
  return `cleared at least one chamber and ${one(n) ? 'is' : 'are'} not yet law`;
}

/** Short form for a heading: "passed the House". */
export function movingShort(where) {
  if (where === 'house') return 'passed the House';
  if (where === 'senate') return 'passed the Senate';
  return 'cleared a chamber, not yet law';
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

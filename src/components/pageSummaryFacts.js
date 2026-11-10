// The claims PageSummary makes, computed apart from how they are rendered.
//
// Split out so scripts/check-published-claims.js can assert the *sentences* against
// bills.json without a DOM. Data-shape lint cannot catch a sentence that lies — it can
// only tell you the fields are well-formed — and every incident on this site has been a
// well-formed field feeding a false claim. Whatever asserts the copy has to be able to
// read the copy.

import { countUnits, describeKinds } from '../lib/measureCounts.js';
import { isActive, hasAdvanced as advancedPerModule } from '../lib/measureStatus.js';

// How recent an action must be to count as "latest movement". Congress recesses for
// weeks, so a short window blanks the sentence out for most of August; a long one dresses
// a stale committee referral up as news. The sentence always carries its own date.
export const MOVEMENT_WINDOW_DAYS = 60;

// Dates in bills.json are date-only ("2026-07-22"). `new Date()` reads those as UTC
// midnight, which renders a day early west of Greenwich.
export function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatSummaryDate(dateString) {
  return parseLocalDate(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// One definition for every surface (src/lib/measureStatus.js): resolutions' "agreed to"
// stages and riders enacted in a funding law count as advanced; archived entries never do.
export const hasAdvanced = advancedPerModule;

/**
 * Derive every figure the summary states. Nothing here is written down by hand —
 * hardcoded counts in copy are how a page starts lying quietly as data moves beneath it.
 *
 * Deliberately absent: any rate of new bills. `introducedDate` is stored for none of the
 * oppose entries and fewer than half carry `lastActionDate`, so "N introduced this month"
 * would measure the gaps in our own data rather than anything Congress did.
 */
export function getPageSummaryFacts({ bills = [], riders = [], routineBills = [], now = Date.now() }) {
  // Anti-DC measures only. Routine measures (S. 1077, D.C.'s own budget) are structural
  // consequences of denied statehood, not attacks, so this sentence never counts them
  // (Andria, 2026-11-09). They have their own section and count.
  const tracked = [...bills, ...riders].filter(isActive);
  if (tracked.length === 0) return null;

  const advanced = tracked.filter(hasAdvanced);
  const enacted = tracked.filter(item => item.status?.stage === 'enacted');
  const passedBoth = tracked.filter(item => item.status?.stage === 'passed-both');

  const withActions = tracked
    .filter(item => item.status?.lastActionDate && (item.billNumbers || []).length > 0)
    .sort((a, b) => b.status.lastActionDate.localeCompare(a.status.lastActionDate));

  const latest = withActions[0] || null;
  const latestAgeDays = latest
    ? Math.floor((now - parseLocalDate(latest.status.lastActionDate)) / 86400000)
    : null;

  // Every count is of measures, not entries (src/lib/measureCounts.js): H.R. 1968 is
  // three entries but one law.
  const trackedUnits = countUnits(tracked);
  const advancedUnits = countUnits(advanced);

  return {
    trackedCount: trackedUnits.total,
    advancedCount: advancedUnits.total,
    advancedKinds: advancedUnits,
    enactedCount: countUnits(enacted).total,
    enactedKinds: countUnits(enacted),
    passedBothCount: countUnits(passedBoth).total,
    // 17 of the 18 riders are provisions of a single appropriations bill, so calling all
    // of them separate "bills" would overstate the count. Resolutions are named too, so
    // "bills" never quietly includes them.
    scopeNoun: [
      trackedUnits.bills > 0 && 'bills',
      trackedUnits.resolutions > 0 && 'resolutions',
      trackedUnits.riders > 0 && 'budget riders',
    ].filter(Boolean).join(', ').replace(/, ([^,]+)$/, ' and $1'),
    routineCount: countUnits((routineBills || []).filter(isActive)).total,
    latest,
    latestAgeDays,
    showMovement: Boolean(latest && latestAgeDays <= MOVEMENT_WINDOW_DAYS),
  };
}

/** The advanced-detail clause, or '' when nothing has got that far. */
//
// When riders are among the enacted, the kinds are named: two riders enacted in one
// funding law are two provisions, not two laws, and "4 are now law" alone would read as
// four laws (Codex, 2026-11-09).
export function advancedDetailText({ passedBothCount, enactedCount, enactedKinds }) {
  const kinds = enactedKinds?.riders > 0 ? ` (${describeKinds(enactedKinds)})` : '';
  return [
    passedBothCount > 0 && `${passedBothCount} ${passedBothCount === 1 ? 'has' : 'have'} passed both chambers`,
    enactedCount > 0 && `${enactedCount} ${enactedCount === 1 ? 'is' : 'are'} now law${kinds}`,
  ].filter(Boolean).join(', and ');
}

#!/usr/bin/env node

/**
 * Generates stats.json from bills.json
 * This file is deployed with the site and can be fetched by the main site
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { countUnits, groupUnits } from '../src/lib/measureCounts.js';
import { isActive, isArchived, isPending, hasAdvanced } from '../src/lib/measureStatus.js';
import { buildStatehoodPayload } from './lib/statehood.js';
import { CURRENT_CONGRESS } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load bills data
const billsPath = join(__dirname, '../src/data/bills.json');
const billsData = JSON.parse(readFileSync(billsPath, 'utf-8'));

/**
 * Provisional entries are auto-discovered by discover-bills.js and have NOT been
 * human-reviewed for position/attackType (see METHODOLOGY.md). The site excludes
 * them (App.jsx filters `!bill.provisional`), so stats.json must exclude them too
 * — otherwise representdc-main, which fetches these counts via useBillStats, would
 * publish a bill count that includes unreviewed entries.
 *
 * This divergence was live: on 2026-07-26 the tracker showed 93 while main cited
 * 96, a gap of exactly the 3 then-unreviewed provisionals. Keep this filter and
 * App.jsx's in agreement; scripts/lint-bills.js now asserts that they match.
 */
const reviewed = (list) => (list || []).filter(item => !item.provisional);
// Archived entries (final, with an official outcome) are reviewed but outside every
// active count, same as the site (src/lib/measureStatus.js).
const active = (list) => (list || []).filter(isActive);

// Calculate stats
const bills = active(billsData.bills);
const riders = active(billsData.riders);
const routineBills = active(billsData.routineBills);
const archived = ['bills', 'riders', 'routineBills']
  .flatMap(section => reviewed(billsData[section]))
  .filter(isArchived);

const provisionalCount =
  (billsData.bills || []).length + (billsData.riders || []).length +
  (billsData.routineBills || []).length -
  (bills.length + riders.length + routineBills.length + archived.length);

// Riders can advance too: one enacted in a funding law is law (2026-11-09).
const passedBills = [...bills, ...riders].filter(hasAdvanced);
const pendingBills = bills.filter(isPending);
const pendingRiders = riders.filter(isPending);

// Measures, not entries (src/lib/measureCounts.js): H.R. 1968 is three entries but one
// law. representdc-main publishes these three numbers, so they must match the tracker's
// own sentences exactly; check-published-claims.js asserts that.
//
// Routine measures (S. 1077, D.C.'s own budget) are not anti-DC: they are structural
// consequences of denied statehood (Andria, 2026-11-09). They get their own block and are
// never added into the anti-DC totals.
const totalOpposeBills = countUnits([...bills, ...riders]).total;
const pendingOpposeBills = countUnits([...pendingBills, ...pendingRiders]).total;
const passedUnits = countUnits(passedBills);
const routineAdvanced = routineBills.filter(hasAdvanced);

const stats = {
  lastUpdated: billsData.lastUpdated,
  lastChecked: billsData.lastChecked || null,
  totalBills: totalOpposeBills,
  // Everything introduced in this Congress that the tracker has classified as anti-DC,
  // archived entries included: archiving a measure doesn't un-introduce it. The main
  // site's "N ... introduced in this Congress" reads this, not totalBills (Codex,
  // 2026-11-09). totalBills is the active count the tracker page shows.
  introducedThisCongress: countUnits([
    ...bills, ...riders,
    ...archived.filter(item => item.position === 'oppose')
  ]).total,
  pendingBills: pendingOpposeBills,
  passedBills: passedUnits.total,
  // How the passed figure splits. Resolutions are counted apart from bills (2026-11-09).
  passedBreakdown: { bills: passedUnits.bills, resolutions: passedUnits.resolutions, riders: passedUnits.riders },
  // Oppose-side only. supportBills is deliberately absent: pro-DC bills are parked
  // (decisions/2026-08-03-park-support-bills.md) and the site does not render them,
  // so publishing a count for them would advertise something no page shows. Verified
  // unconsumed by representdc-main and dc-statehood-pledge before removal.
  // Anti-DC totals split by kind, in the same units as totalBills (they add up to it).
  breakdown: {
    bills: countUnits(bills).bills,
    resolutions: countUnits(bills).resolutions,
    riders: countUnits(riders).riders
  },
  routine: {
    total: countUnits(routineBills).total,
    advanced: countUnits(routineAdvanced).total
  },
  // Final and outside every count above (Andria, 2026-11-09). Kept for the record.
  archived: { total: countUnits(archived).total, ...countUnits(archived) },
  // Awaiting human review — deliberately excluded from every count above.
  provisionalAwaitingReview: provisionalCount,
  // One row per measure, matching passedBills. A law stored as several provision entries
  // lists how many anti-DC provisions it carries.
  //
  // A rider enacted in a funding law is listed under the law it is in, with the bill it was
  // proposed in kept apart: H.R. 5166 never passed, but two of its riders are law through
  // H.R. 7148.
  passed: groupUnits(passedBills).map(group => {
    const first = group[0];
    const row = {
      id: first.id,
      kind: first.type === 'rider' ? 'rider' : 'measure',
      number: first.outcome?.enactedIn || first.billNumbers[0],
      title: first.title,
      stage: first.status.stage,
      provisions: group.length
    };
    if (first.outcome?.result === 'became-law') {
      Object.assign(row, {
        proposedIn: first.billNumbers[0],
        law: first.outcome.law,
        provision: first.outcome.provision,
        source: first.outcome.source
      });
    }
    return row;
  })
};

// Ensure public/api directory exists
const apiDir = join(__dirname, '../public/api');
try {
  mkdirSync(apiDir, { recursive: true });
} catch (e) {
  // Directory already exists
}

// Write stats file
const statsPath = join(apiDir, 'stats.json');
writeFileSync(statsPath, JSON.stringify(stats, null, 2));

// ---------------------------------------------------------------------------
// The statehood-bill files for representdc.org/statehood-bill. Separate files, so every
// stats.json field above keeps its meaning (PRD § 6). Both are derived from stored data;
// no number here is typed.
// ---------------------------------------------------------------------------
const generatedAt = new Date().toISOString();
let statehoodStore = { bills: {} };
try {
  statehoodStore = JSON.parse(readFileSync(join(__dirname, '../src/data/statehood-cosponsors.json'), 'utf-8'));
} catch {
  // No store yet: rows publish as incomplete (no list, no checkedAt), never as zero.
}
const statehood = buildStatehoodPayload({
  store: statehoodStore, billsData, currentCongress: CURRENT_CONGRESS, generatedAt
});
writeFileSync(join(apiDir, 'statehood-cosponsors.json'), JSON.stringify(statehood, null, 2) + '\n');

// Prior Congresses: a one-time export from representdc-data (scripts/export-statehood-history.js),
// republished as-is.
try {
  const history = JSON.parse(readFileSync(join(__dirname, '../src/data/statehood-bill-history.json'), 'utf-8'));
  writeFileSync(join(apiDir, 'statehood-bill-history.json'), JSON.stringify(history, null, 2) + '\n');
} catch (e) {
  console.log(`  ⚠ statehood-bill-history.json not published: ${e.message}`);
}

console.log('✓ Generated stats.json');
for (const row of statehood.bills) {
  console.log(`  Statehood ${row.billNumber} (${row.congress}th): ${row.complete ? `${row.totals.cosponsors} cosponsors, checked ${row.checkedAt}` : 'no complete list yet'}`);
}
console.log(`  Total bills: ${stats.totalBills}  (reviewed only)`);
console.log(`  Pending: ${stats.pendingBills}`);
console.log(`  Passed: ${stats.passedBills}`);
if (provisionalCount > 0) {
  console.log(`  ⚠ ${provisionalCount} provisional entr${provisionalCount === 1 ? 'y' : 'ies'} excluded — awaiting human review`);
}
console.log(`  Last updated: ${stats.lastUpdated}`);

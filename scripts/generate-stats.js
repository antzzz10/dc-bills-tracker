#!/usr/bin/env node

/**
 * Generates stats.json from bills.json
 * This file is deployed with the site and can be fetched by the main site
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { countUnits, groupUnits } from '../src/lib/measureCounts.js';

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

// Calculate stats
const bills = reviewed(billsData.bills);
const riders = reviewed(billsData.riders);
const routineBills = reviewed(billsData.routineBills);

const provisionalCount =
  (billsData.bills || []).length + (billsData.riders || []).length +
  (billsData.routineBills || []).length -
  (bills.length + riders.length + routineBills.length);

const passedBills = bills.filter(bill =>
  bill.status?.stage &&
  (bill.status.stage.startsWith('passed-') || bill.status.stage === 'enacted')
);

const pendingBills = bills.filter(bill =>
  !bill.status?.stage ||
  (!bill.status.stage.startsWith('passed-') && bill.status.stage !== 'enacted')
);

// Measures, not entries (src/lib/measureCounts.js): H.R. 1968 is three entries but one
// law. representdc-main publishes these three numbers, so they must match the tracker's
// own sentences exactly; check-published-claims.js asserts that.
//
// Routine measures (S. 1077, D.C.'s own budget) are not anti-DC: they are structural
// consequences of denied statehood (Andria, 2026-11-09). They get their own block and are
// never added into the anti-DC totals.
const totalOpposeBills = countUnits([...bills, ...riders]).total;
const pendingOpposeBills = countUnits([...pendingBills, ...riders]).total;
const passedUnits = countUnits(passedBills);
const routineAdvanced = routineBills.filter(b =>
  b.status?.stage && (b.status.stage.startsWith('passed-') || b.status.stage === 'enacted'));

const stats = {
  lastUpdated: billsData.lastUpdated,
  lastChecked: billsData.lastChecked || null,
  totalBills: totalOpposeBills,
  pendingBills: pendingOpposeBills,
  passedBills: passedUnits.total,
  // How the passed figure splits. Resolutions are counted apart from bills (2026-11-09).
  passedBreakdown: { bills: passedUnits.bills, resolutions: passedUnits.resolutions },
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
  // Awaiting human review — deliberately excluded from every count above.
  provisionalAwaitingReview: provisionalCount,
  // One row per measure, matching passedBills. A law stored as several provision entries
  // lists how many anti-DC provisions it carries.
  passed: groupUnits(passedBills).map(group => ({
    id: group[0].id,
    number: group[0].billNumbers[0],
    title: group[0].title,
    stage: group[0].status.stage,
    provisions: group.length
  }))
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

console.log('✓ Generated stats.json');
console.log(`  Total bills: ${stats.totalBills}  (reviewed only)`);
console.log(`  Pending: ${stats.pendingBills}`);
console.log(`  Passed: ${stats.passedBills}`);
if (provisionalCount > 0) {
  console.log(`  ⚠ ${provisionalCount} provisional entr${provisionalCount === 1 ? 'y' : 'ies'} excluded — awaiting human review`);
}
console.log(`  Last updated: ${stats.lastUpdated}`);

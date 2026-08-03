#!/usr/bin/env node

/**
 * Generates stats.json from bills.json
 * This file is deployed with the site and can be fetched by the main site
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

const totalOpposeBills = bills.length + riders.length + routineBills.length;
const pendingOpposeBills = pendingBills.length + riders.length + routineBills.length;

const stats = {
  lastUpdated: billsData.lastUpdated,
  lastChecked: billsData.lastChecked || null,
  totalBills: totalOpposeBills,
  pendingBills: pendingOpposeBills,
  passedBills: passedBills.length,
  // Oppose-side only. supportBills is deliberately absent: pro-DC bills are parked
  // (decisions/2026-08-03-park-support-bills.md) and the site does not render them,
  // so publishing a count for them would advertise something no page shows. Verified
  // unconsumed by representdc-main and dc-statehood-pledge before removal.
  breakdown: {
    bills: bills.length,
    riders: riders.length,
    routineBills: routineBills.length
  },
  // Awaiting human review — deliberately excluded from every count above.
  provisionalAwaitingReview: provisionalCount,
  passed: passedBills.map(bill => ({
    id: bill.id,
    number: bill.billNumbers[0],
    title: bill.title,
    stage: bill.status.stage
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

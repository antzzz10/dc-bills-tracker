#!/usr/bin/env node

/**
 * Published-claims check — asserts the *sentences* the site shows, not the shape of the
 * data behind them.
 *
 * Why this exists as a separate gate from lint-bills.js: every wrong thing this site has
 * published came from well-formed data. `highlight: "floor-vote"` was a valid string on a
 * real bill; the banner turned it into "3 bills scheduled for floor vote" about one that
 * had been law since February. A vote of 211-215 was two valid integers; the page turned
 * it into "passed the House". Schema validation cannot see any of that. The only way to
 * catch a claim is to render it and check it.
 *
 * So this imports the same pure modules the components render from — no duplicated logic,
 * no DOM — and asserts each claim against bills.json. Offline, no API key. Runs beside
 * lint-bills.js in CI, before anything is committed or deployed.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { getUpdateBannerMessage } from '../src/components/updateBannerMessage.js';
import {
  getPageSummaryFacts,
  advancedDetailText,
  hasAdvanced,
} from '../src/components/pageSummaryFacts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, '../src/data/bills.json'), 'utf-8'));

const failures = [];
const claims = [];
const fail = (claim, why) => failures.push(`${claim}\n     → ${why}`);

const reviewed = list => (data[list] || []).filter(item => !item.provisional);
const bills = reviewed('bills');
const riders = reviewed('riders');
const routineBills = reviewed('routineBills');
const opposeById = new Map(
  [...bills, ...riders, ...routineBills].map(b => [(b.billNumbers || [])[0], b])
);

// ---------------------------------------------------------------------------
// 1. The top banner
// ---------------------------------------------------------------------------
const passedBills = bills.filter(hasAdvanced);
const banner = getUpdateBannerMessage({
  passedBills,
  upcomingFloorVotes: bills.filter(b => b.highlight === 'floor-vote'),
  allBills: data.bills || [],
});

if (banner) {
  claims.push(`banner: "${banner.message}"`);
  const message = banner.message;

  // "N bills scheduled for floor vote: ..." — none of the named bills may have advanced.
  const floorMatch = message.match(/scheduled for floor vote:\s*(.+)$/);
  if (floorMatch) {
    for (const number of floorMatch[1].split(',').map(s => s.trim())) {
      const bill = opposeById.get(number);
      if (!bill) {
        fail(message, `names ${number}, which is not an oppose-side bill`);
      } else if (bill.status?.stage) {
        fail(message, `${number} has stage "${bill.status.stage}" — it cannot be awaiting a floor vote`);
      }
    }
  }

  // "H.R. X passed the House (Y-Z)" — the bill must actually hold that stage and tally,
  // and a passing vote cannot be a losing one.
  const passMatch = message.match(/^(\S+)\s+passed the (House|Senate)\s+\((\d+)-(\d+)\)/);
  if (passMatch) {
    const [, number, chamber, yeasRaw, naysRaw] = passMatch;
    const yeas = Number(yeasRaw);
    const nays = Number(naysRaw);
    const bill = opposeById.get(number);
    if (!bill) {
      fail(message, `names ${number}, which is not an oppose-side bill`);
    } else {
      if (!hasAdvanced(bill)) {
        fail(message, `${number} has no passage stage recorded`);
      }
      if (yeas <= nays) {
        fail(message, `announces a passage of ${yeas}-${nays}, which did not carry`);
      }
      const record = bill.passage?.[chamber.toLowerCase()]?.vote;
      if (record && (record.yeas !== yeas || record.nays !== nays)) {
        fail(message, `says ${yeas}-${nays} but bills.json records ${record.yeas}-${record.nays}`);
      }
    }
  }

  // "X just introduced" — must correspond to a real, recent introduction.
  const introMatch = message.match(/^(\S+)\s+just introduced:/);
  if (introMatch) {
    const bill = opposeById.get(introMatch[1]);
    if (!bill) {
      fail(message, `names ${introMatch[1]}, which is not an oppose-side bill`);
    } else if (bill.status?.stage) {
      fail(message, `${introMatch[1]} has stage "${bill.status.stage}" — it is past introduction`);
    }
  }
} else {
  claims.push('banner: (silent)');
}

// ---------------------------------------------------------------------------
// 2. The page summary
// ---------------------------------------------------------------------------
const facts = getPageSummaryFacts({ bills, riders, routineBills });
if (facts) {
  const detail = advancedDetailText(facts);
  const sentence =
    `This tracker follows ${facts.trackedCount} ${facts.scopeNoun} ... ` +
    (facts.advancedCount > 0
      ? `${facts.advancedCount} have already cleared at least one chamber${detail ? ` — ${detail}` : ''}. `
      : '') +
    (facts.showMovement ? `Latest movement: ${facts.latest.billNumbers[0]}.` : '');
  claims.push(`summary: "${sentence}"`);

  const expectedTracked = bills.length + riders.length + routineBills.length;
  if (facts.trackedCount !== expectedTracked) {
    fail(sentence, `claims ${facts.trackedCount} tracked, data holds ${expectedTracked}`);
  }

  const expectedAdvanced = [...bills, ...riders, ...routineBills].filter(hasAdvanced).length;
  if (facts.advancedCount !== expectedAdvanced) {
    fail(sentence, `claims ${facts.advancedCount} advanced, data holds ${expectedAdvanced}`);
  }
  if (facts.advancedCount > facts.trackedCount) {
    fail(sentence, `claims more advanced (${facts.advancedCount}) than tracked (${facts.trackedCount})`);
  }

  // The summary and the published stats must agree — representdc-main renders the same
  // number from stats.json, and these two derivations diverged once already (93 vs 96).
  try {
    const stats = JSON.parse(readFileSync(join(__dirname, '../public/api/stats.json'), 'utf-8'));
    if (stats.totalBills !== facts.trackedCount) {
      fail(sentence, `summary says ${facts.trackedCount} but stats.json publishes ${stats.totalBills}`);
    }
  } catch {
    // generate-stats.js has not run; lint-bills.js check 7 already warns about this.
  }

  // "Latest movement" must genuinely be the most recent action we hold.
  if (facts.showMovement) {
    const newest = [...bills, ...riders, ...routineBills]
      .filter(b => b.status?.lastActionDate)
      .reduce((a, b) => (a.status.lastActionDate >= b.status.lastActionDate ? a : b));
    if (newest.status.lastActionDate !== facts.latest.status.lastActionDate) {
      fail(sentence, `calls ${facts.latest.billNumbers[0]} the latest movement, but ${(newest.billNumbers || [])[0]} is newer`);
    }
    if (facts.latest.status.lastActionDate > new Date().toISOString().slice(0, 10)) {
      fail(sentence, `latest movement is dated in the future`);
    }
  }
}

// ---------------------------------------------------------------------------
console.log(`Checked ${claims.length} published claim(s):`);
claims.forEach(c => console.log(`  • ${c}`));

if (failures.length) {
  console.error('');
  failures.forEach(f => console.error(`❌ ${f}`));
  console.error(`\n${failures.length} false or unsupported claim(s).`);
  process.exit(1);
}
console.log('\n✅ All published claims are supported by bills.json.');

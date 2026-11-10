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

import { getUpdateBannerMessage, introductionDate } from '../src/components/updateBannerMessage.js';
import {
  getPageSummaryFacts,
  advancedDetailText,
} from '../src/components/pageSummaryFacts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, '../src/data/bills.json'), 'utf-8'));

const failures = [];
const claims = [];
const fail = (claim, why) => failures.push(`${claim}\n     → ${why}`);

// Archived entries (final, with an official outcome) are outside every published count.
// Written here independently of src/lib/measureStatus.js, so a bug there can't pass its
// own check.
const isArchivedHere = item => item.outcome?.archived === true;
const reviewed = list => (data[list] || []).filter(item => !item.provisional && !isArchivedHere(item));
const archivedEntries = ['bills', 'riders', 'routineBills']
  .flatMap(list => (data[list] || []).filter(item => !item.provisional && isArchivedHere(item)));
// Cleared at least one chamber, per stage. Independent of the module's list.
const ADVANCED_HERE = ['passed-house', 'passed-senate', 'passed-both', 'enacted',
  'agreed-house', 'agreed-senate', 'agreed-both', 'sent-to-states'];
const hasAdvanced = item => ADVANCED_HERE.includes(item.status?.stage);
const bills = reviewed('bills');
const riders = reviewed('riders');
const routineBills = reviewed('routineBills');
const opposeById = new Map(
  [...bills, ...riders, ...routineBills].map(b => [(b.billNumbers || [])[0], b])
);

// Counting units, implemented here independently of src/lib/measureCounts.js so a bug
// there can't pass its own check. One per official measure (entries sharing any bill
// number, spacing ignored, are one measure); one per budget rider. Counting entries said
// "14 ... 4 are now law" when the truth was 12 and 2.
function independentCount(items) {
  const parent = new Map();
  const find = x => { while (parent.get(x) !== x) x = parent.get(x); return x; };
  const union = (a, b) => parent.set(find(a), find(b));
  for (const item of items) {
    const keys = item.type === 'rider'
      ? [`rider:${item.id}`]
      : (item.billNumbers?.length ? item.billNumbers : [item.id]).map(n => String(n).replace(/\s+/g, '').toUpperCase());
    keys.forEach(k => { if (!parent.has(k)) parent.set(k, k); });
    keys.slice(1).forEach(k => union(k, keys[0]));
  }
  return new Set(items.map(item => find(item.type === 'rider'
    ? `rider:${item.id}`
    : String((item.billNumbers?.length ? item.billNumbers : [item.id])[0]).replace(/\s+/g, '').toUpperCase()))).size;
}

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

  // "N bills and M resolutions have passed!" — the number must be measures, not entries.
  const manyMatch = message.match(/^(.+?) have passed!/);
  if (manyMatch) {
    const claimed = [...manyMatch[1].matchAll(/(\d+)/g)].reduce((sum, m) => sum + Number(m[1]), 0);
    const latest = b => [b.passage?.house?.date, b.passage?.senate?.date].filter(Boolean).sort().pop();
    const recent = passedBills.filter(b => {
      const d = latest(b);
      return d && Math.floor((Date.now() - new Date(`${d}T00:00:00`)) / 86400000) <= 30;
    });
    if (claimed !== independentCount(recent)) {
      fail(message, `claims ${claimed} passed; data holds ${independentCount(recent)} measures passed in the last 30 days`);
    }
  }

  // "X introduced: <title>" — must correspond to a real introduction within the last week.
  // The banner joins companion numbers with "/" and numbers contain spaces ("H.R. 7068"),
  // so match up to " introduced:". (This used to look for "just introduced", which the
  // banner never says, so the claim was never checked.) Provisional bills count: the
  // banner announces them on purpose.
  const introMatch = message.match(/^(.+?) introduced:/);
  if (introMatch) {
    const firstNumber = introMatch[1].split('/')[0].trim();
    const bill = (data.bills || []).find(b => (b.billNumbers || [])[0] === firstNumber);
    const introduced = bill && introductionDate(bill);
    const ageDays = introduced
      ? Math.floor((Date.now() - new Date(`${introduced}T00:00:00`)) / 86400000)
      : null;
    if (!bill) {
      fail(message, `names ${firstNumber}, which is not in the bills list`);
    } else if (bill.status?.stage) {
      fail(message, `${firstNumber} has stage "${bill.status.stage}" — it is past introduction`);
    } else if (ageDays === null || ageDays < 0 || ageDays > 7) {
      fail(message, `${firstNumber} was not introduced in the last 7 days (${introduced || 'no date'})`);
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

  // Counted here independently of src/lib/measureCounts.js, so a bug there can't pass its
  // own check. One per official measure (first bill number, spacing ignored); one per
  // budget rider. Counting entries said "14 ... 4 are now law" when the truth was 12 and 2.
  // Anti-DC only: routine measures are counted apart (2026-11-09).
  const all = [...bills, ...riders];

  const expectedTracked = independentCount(all);
  if (facts.trackedCount !== expectedTracked) {
    fail(sentence, `claims ${facts.trackedCount} tracked, data holds ${expectedTracked} measures`);
  }

  const expectedAdvanced = independentCount(all.filter(hasAdvanced));
  if (facts.advancedCount !== expectedAdvanced) {
    fail(sentence, `claims ${facts.advancedCount} advanced, data holds ${expectedAdvanced} measures`);
  }
  const expectedEnacted = independentCount(all.filter(b => b.status?.stage === 'enacted'));
  if (facts.enactedCount !== expectedEnacted) {
    fail(sentence, `claims ${facts.enactedCount} now law, data holds ${expectedEnacted} measures`);
  }
  const advancedRiders = all.filter(hasAdvanced).filter(b => b.type === 'rider').length;
  const advancedResolutions = independentCount(all.filter(hasAdvanced).filter(b => b.type !== 'rider' && /RES\./i.test((b.billNumbers || [])[0] || '')));
  const advancedBills = expectedAdvanced - advancedResolutions - advancedRiders;
  if (facts.advancedKinds.resolutions !== advancedResolutions ||
      facts.advancedKinds.riders !== advancedRiders ||
      facts.advancedKinds.bills !== advancedBills) {
    fail(sentence, `splits advanced into ${facts.advancedKinds.bills} bills, ${facts.advancedKinds.resolutions} resolutions and ${facts.advancedKinds.riders} riders; data holds ${advancedBills}, ${advancedResolutions} and ${advancedRiders}`);
  }
  // Riders enacted in one funding law are provisions, not laws. If any are among the
  // enacted, the sentence must name the kinds, or "4 are now law" reads as four laws.
  const enactedRiders = all.filter(b => b.type === 'rider' && b.status?.stage === 'enacted').length;
  if (enactedRiders > 0 && !/budget rider/.test(detail)) {
    fail(sentence, `${enactedRiders} enacted budget rider(s) counted in "now law" without naming them as riders`);
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
    if (stats.passedBills !== facts.advancedCount) {
      fail(sentence, `summary says ${facts.advancedCount} advanced but stats.json publishes ${stats.passedBills}`);
    }
    if (stats.pendingBills + stats.passedBills !== stats.totalBills) {
      fail(sentence, `stats.json pending (${stats.pendingBills}) + passed (${stats.passedBills}) ≠ total (${stats.totalBills})`);
    }
    const pb = stats.passedBreakdown || {};
    if (pb.bills !== advancedBills || pb.resolutions !== advancedResolutions || (pb.riders || 0) !== advancedRiders) {
      fail(sentence, `stats.json passedBreakdown is ${pb.bills} bills / ${pb.resolutions} resolutions / ${pb.riders} riders; data holds ${advancedBills} / ${advancedResolutions} / ${advancedRiders}`);
    }
    if ((stats.archived?.total ?? 0) !== independentCount(archivedEntries)) {
      fail(sentence, `stats.json archived.total is ${stats.archived?.total}; data holds ${independentCount(archivedEntries)}`);
    }
    const bd = stats.breakdown || {};
    if ((bd.bills + bd.resolutions + bd.riders) !== stats.totalBills) {
      fail(sentence, `stats.json breakdown (${bd.bills}+${bd.resolutions}+${bd.riders}) does not add up to totalBills ${stats.totalBills}`);
    }
    if ((stats.passed || []).length !== stats.passedBills) {
      fail(sentence, `stats.json lists ${(stats.passed || []).length} passed rows but passedBills is ${stats.passedBills}`);
    }
    if (stats.routine?.total !== independentCount(routineBills)) {
      fail(sentence, `stats.json routine.total is ${stats.routine?.total}; data holds ${independentCount(routineBills)}`);
    }
  } catch {
    // generate-stats.js has not run; lint-bills.js check 7 already warns about this.
  }

  // "Latest movement" must genuinely be the most recent action we hold.
  if (facts.showMovement) {
    const newest = [...bills, ...riders]
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
// 3. Outcomes (archived cards and enacted riders): each states a checked fact with a source
// ---------------------------------------------------------------------------
// An outcome is hand-verified, so the gate can't recompute it. It can require that each
// one says what it is, where it was checked and when, and that it agrees with the stage.
for (const item of ['bills', 'riders', 'routineBills'].flatMap(list => data[list] || [])) {
  const o = item.outcome;
  if (!o) continue;
  const claim = `outcome ${item.id}: "${o.summary || ''}"`;
  claims.push(claim);
  if (!o.summary || !o.source || !o.verifiedOn || !o.result || !o.date) {
    fail(claim, 'an outcome needs result, date, summary, source and verifiedOn');
  }
  if (o.source && !/^https:\/\/(www\.)?(congress\.gov|govinfo\.gov|clerk\.house\.gov|senate\.gov)\//.test(o.source)) {
    fail(claim, `source ${o.source} is not an official record`);
  }
  if (o.result === 'became-law' && (o.archived || item.status?.stage !== 'enacted')) {
    fail(claim, 'became law, so it must be active with stage "enacted"');
  }
  if (o.result !== 'became-law' && !o.archived) {
    fail(claim, `result "${o.result}" is final but the entry is not archived`);
  }
  // An archived entry may keep its furthest progress (a measure that passed the House and
  // was later withdrawn): progress and outcome are separate facts. It is never counted.
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

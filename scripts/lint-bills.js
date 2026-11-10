#!/usr/bin/env node

/**
 * Offline consistency lint + golden-label eval for src/data/bills.json.
 * No API key required — run before deploying any data change:
 *
 *   node scripts/lint-bills.js
 *
 * Checks:
 *   1. No duplicate bill IDs across bills/riders/supportBills
 *   2. Section/position agreement (bills+riders oppose, supportBills support,
 *      routineBills routine)
 *   3. Every non-provisional oppose/routine bill has attackType "direct" or
 *      "partial"; support bills carry no attackType unless golden-labeled as
 *      an edge case
 *   4. No high-priority partial attack without legislative momentum
 *      (mirrors the runtime cap in monitor-bills.js calculatePriority)
 *   5. Categories exist in the taxonomy
 *   6. bills.json matches scripts/eval/golden-labels.json
 *   7. public/api/stats.json totalBills matches what the site renders
 *      (non-provisional only) — main fetches that number and publishes it
 *   8. Passage vote tallies are internally possible (yeas > nays, party rows
 *      don't exceed totals, vote date not before introduction)
 *   9-10. Hand-set highlight flags don't contradict status.stage and expire (30d TTL)
 *   11. Passage vote records carry provenance (source URL + verifiedOn date)
 *   12. Every entry in every section records its Congress (the monitor looks each
 *       entry up in its own Congress and refuses to guess)
 *   13. A rider or amendment carries a stage only with a verified became-law outcome
 *   14. A constitutional amendment is never "enacted"
 *   15. Flagship (statehood-bill) entries: support only, one per chamber per Congress
 *   16. The stored statehood cosponsor lists: a complete list carries checkedAt and agrees
 *       with bills.json's count; an incomplete one carries neither checkedAt nor rows
 *   17. The current-member roster: plausible chamber counts, counts match the rows
 *   18. The prior-Congress history export matches the values verified 2026-11-10
 *
 * Exits 1 on any error. See METHODOLOGY.md ("Quality control").
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { countUnits, measureKey, isRider } from '../src/lib/measureCounts.js';
import { isActive, isProvision } from '../src/lib/measureStatus.js';
import { CURRENT_CONGRESS } from './config.js';
import { NON_VOTING_STATES, chamberOf } from './lib/statehood.js';
import { ROSTER_BOUNDS, rosterCounts } from './build-member-roster.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, '../src/data/bills.json'), 'utf-8'));
const golden = JSON.parse(readFileSync(join(__dirname, 'eval/golden-labels.json'), 'utf-8'));

const errors = [];
const warnings = [];

const sections = [
  ['bills', data.bills, 'oppose'],
  ['riders', data.riders, 'oppose'],
  ['supportBills', data.supportBills, 'support'],
  ['routineBills', data.routineBills || [], 'routine']
];

// 1. Duplicate IDs
const seenIds = new Map();
for (const [section, items] of sections) {
  for (const bill of items) {
    if (seenIds.has(bill.id)) {
      errors.push(`Duplicate id "${bill.id}" in ${section} (also in ${seenIds.get(bill.id)})`);
    }
    seenIds.set(bill.id, section);
  }
}

const validCategories = new Set(data.categories.map(c => c.id));
const hasMomentum = s =>
  s.hasFloorVote || s.hasCommitteeMarkup || s.hasCommitteeHearing || (s.cosponsors || 0) >= 20;

for (const [section, items, expectedPosition] of sections) {
  for (const bill of items) {
    const label = `${section}/${bill.id}`;

    // 2. Section/position agreement
    if (bill.position !== expectedPosition) {
      errors.push(`${label}: position "${bill.position}" but section expects "${expectedPosition}"`);
    }

    // 3. attackType discipline — oppose and routine both require it once reviewed;
    // routine's stakes/severity signal lives in attackType, never in the position label
    if (expectedPosition === 'oppose' || expectedPosition === 'routine') {
      if (!bill.provisional && !['direct', 'partial'].includes(bill.attackType)) {
        errors.push(`${label}: non-provisional ${expectedPosition} bill missing valid attackType (got "${bill.attackType}")`);
      }
    } else if (bill.attackType && golden.labels[bill.id]?.attackType !== bill.attackType) {
      warnings.push(`${label}: support bill carries attackType "${bill.attackType}" without a golden-label edge case`);
    }

    // 4. Priority cap: no high partial without momentum
    if (bill.attackType === 'partial' && bill.priority === 'high' && !hasMomentum(bill.status || {})) {
      errors.push(`${label}: partial attack ranked high without legislative momentum (violates cap)`);
    }

    // 5. Category exists
    if (bill.category && !validCategories.has(bill.category)) {
      errors.push(`${label}: unknown category "${bill.category}"`);
    }
  }
}

// 6. Golden labels
const allById = new Map(sections.flatMap(([, items]) => items.map(b => [b.id, b])));
for (const [id, expected] of Object.entries(golden.labels)) {
  const bill = allById.get(id);
  if (!bill) {
    errors.push(`golden/${id}: labeled bill missing from bills.json (${expected.note})`);
    continue;
  }
  if (bill.position !== expected.position) {
    errors.push(`golden/${id}: position is "${bill.position}", golden expects "${expected.position}" (${expected.source})`);
  }
  const actualAttackType = bill.attackType ?? null;
  if (actualAttackType !== expected.attackType) {
    errors.push(`golden/${id}: attackType is ${JSON.stringify(actualAttackType)}, golden expects ${JSON.stringify(expected.attackType)} (${expected.source})`);
  }
}

// 7. Published count agrees with what the site actually renders.
//    App.jsx filters `!bill.provisional`; generate-stats.js must do the same, or
//    representdc-main (which fetches stats.json via useBillStats) publishes a
//    different number than the tracker displays. This diverged silently once —
//    the tracker showed 93 while main cited 96 — so it is asserted here.
{
  // Measures, not entries (src/lib/measureCounts.js): H.R. 1968 is three entries, one law.
  // Active only: archived entries (final, with an official outcome) render in their own
  // section and are outside every count (src/lib/measureStatus.js).
  const reviewed = (list) => (data[list] || []).filter(isActive);
  // Anti-DC only: routine measures are counted apart (2026-11-09).
  const siteTotal = countUnits([...reviewed('bills'), ...reviewed('riders')]).total;

  let statsJson = null;
  try {
    statsJson = JSON.parse(readFileSync(join(__dirname, '../public/api/stats.json'), 'utf-8'));
  } catch {
    warnings.push('public/api/stats.json not found — run `node scripts/generate-stats.js` (skipping count check)');
  }

  if (statsJson && statsJson.totalBills !== siteTotal) {
    errors.push(
      `stats.json totalBills is ${statsJson.totalBills} but the site renders ${siteTotal} ` +
      `(non-provisional bills+riders, as measures). Regenerate stats.json — representdc-main ` +
      `publishes this number.`
    );
  }
}

// 7b. Entries that are the same measure must agree on its stage. Counts treat H.R. 1968's
//     three entries as one law; that is only true if all three say "enacted". A split
//     stage would make the measure both pending and passed at once.
{
  const stageByMeasure = new Map();
  for (const list of ['bills', 'routineBills', 'supportBills']) {
    for (const item of data[list] || []) {
      // An amendment or rider is a provision of a measure, not the measure: its own
      // outcome can differ (S.Amdt. 2195 died; H.Con.Res. 14 was agreed to).
      if (isRider(item) || isProvision(item)) continue;
      const key = `${list}:${measureKey(item)}`;
      const stage = item.status?.stage ?? null;
      const seen = stageByMeasure.get(key);
      if (seen && seen.stage !== stage) {
        errors.push(`${item.id} and ${seen.id} are the same measure (${measureKey(item)}) but have stages ${JSON.stringify(stage)} and ${JSON.stringify(seen.stage)}`);
      } else if (!seen) {
        stageByMeasure.set(key, { stage, id: item.id });
      }
    }
  }
}

// 8. Vote records must be internally possible.
//    A wrong vote total is the most falsifiable thing on the site — anyone can click
//    through to Congress.gov — so these are errors, not warnings. This fires on the exact
//    shape of the 2026-07-28 regression, where a session-mismatched roll call published
//    "passed the House 211-215" (a losing tally) for H.R. 5103, dated five months before
//    the bill was introduced, with the parties reversed.
for (const [section, items] of sections) {
  for (const bill of items) {
    const label = `${section}/${bill.id}`;
    for (const chamber of ['house', 'senate']) {
      const record = bill.passage?.[chamber];
      const vote = record?.vote;
      if (!vote) continue;

      const { yeas, nays, byParty } = vote;

      // A recorded passage that did not carry a majority is a data error by definition.
      if (typeof yeas === 'number' && typeof nays === 'number' && yeas <= nays) {
        errors.push(`${label}: ${chamber} passage recorded as ${yeas}-${nays} — a passed vote cannot have yeas <= nays`);
      }

      // Party rows must not exceed the totals they break down.
      if (byParty) {
        const sum = key => Object.values(byParty).reduce((n, p) => n + (p?.[key] || 0), 0);
        if (typeof yeas === 'number' && sum('yeas') > yeas) {
          errors.push(`${label}: ${chamber} party yeas sum to ${sum('yeas')}, exceeding the ${yeas} total`);
        }
        if (typeof nays === 'number' && sum('nays') > nays) {
          errors.push(`${label}: ${chamber} party nays sum to ${sum('nays')}, exceeding the ${nays} total`);
        }
      }

      // A vote cannot predate the bill. This is what proved H.R. 5103's record wrong
      // without needing the API at all.
      const introduced = bill.status?.introducedDate || bill.introducedDate;
      if (record.date && introduced && record.date < introduced) {
        errors.push(`${label}: ${chamber} vote dated ${record.date} predates introduction on ${introduced}`);
      }
    }
  }
}

// 9 + 10. Hand-set display flags must expire and must not contradict derived state.
//
//    `highlight: "floor-vote"` drives the loudest things on the page — the top banner
//    and a pulsing "FLOOR VOTE" badge with red card styling. Nothing in the pipeline
//    reads or writes it, so it was true-forever: on 2026-08-03 all three flagged bills
//    had moved (two passed the House in Nov 2025, one was signed into law in Feb 2026)
//    and the banner had been announcing a false "3 bills scheduled for floor vote" for
//    53 straight days.
//
//    Two rules, because either alone leaves a hole: the stage check catches a flag the
//    data has already outrun, and the date check catches one on a bill that simply never
//    moved — where no derived field would ever contradict it.
const HIGHLIGHT_TTL_DAYS = 30;
const todayIso = new Date().toISOString().slice(0, 10);

for (const [section, items] of sections) {
  for (const bill of items) {
    if (!bill.highlight) continue;
    const label = `${section}/${bill.id}`;

    // 9. A bill that has already reached a stage cannot be awaiting one.
    if (bill.highlight === 'floor-vote' && bill.status?.stage) {
      errors.push(
        `${label}: highlight "floor-vote" but status.stage is "${bill.status.stage}" — ` +
        `it has already advanced and cannot be awaiting a floor vote`
      );
    }

    // 10. Every hand-set highlight carries the date it was set, and expires.
    if (!bill.highlightSetOn) {
      errors.push(
        `${label}: highlight "${bill.highlight}" has no highlightSetOn date. Urgency ` +
        `claims must expire — add "highlightSetOn": "YYYY-MM-DD" or drop the flag.`
      );
    } else {
      const ageDays = Math.floor(
        (Date.parse(todayIso) - Date.parse(bill.highlightSetOn)) / 86400000
      );
      if (Number.isNaN(ageDays)) {
        errors.push(`${label}: highlightSetOn "${bill.highlightSetOn}" is not a YYYY-MM-DD date`);
      } else if (ageDays > HIGHLIGHT_TTL_DAYS) {
        errors.push(
          `${label}: highlight "${bill.highlight}" was set ${ageDays} days ago ` +
          `(max ${HIGHLIGHT_TTL_DAYS}). Re-confirm it against Congress.gov or remove it.`
        );
      }
    }
  }
}

// 11. Vote records must carry provenance — a resolvable link to the official roll call
//     record plus the date it was confirmed there. Phase 1 of provenance-per-fact
//     (decisions/2026-08-23-vote-provenance-phase1.md): the passage vote is the exact
//     class of claim that has twice shipped wrong (H.R. 5103's inverted, session-mismatched
//     tally), and it's the one thing on the page a reader can independently verify by
//     clicking through. A vote without a source is not phase-1 complete.
for (const [section, items] of sections) {
  for (const bill of items) {
    const label = `${section}/${bill.id}`;
    for (const chamber of ['house', 'senate']) {
      const record = bill.passage?.[chamber];
      if (!record) continue;
      if (!record.source) {
        errors.push(`${label}: ${chamber} passage vote has no "source" (resolvable roll call URL)`);
      }
      if (!record.verifiedOn) {
        errors.push(`${label}: ${chamber} passage vote has no "verifiedOn" date`);
      }
    }
  }
}

// 12. Every entry records its Congress. A bill number names a different bill in each
//     Congress, so the monitor looks an entry up in its own Congress only. Four support
//     bills had none until 2026-11-09; guessing the current Congress for them would have
//     been right this time and wrong for any past-Congress entry.
for (const [section, items] of sections) {
  for (const bill of items) {
    if (!Number.isInteger(bill.congress)) {
      errors.push(`${section}/${bill.id}: no "congress" recorded (got ${JSON.stringify(bill.congress)})`);
    }
  }
}

// 13. A rider or amendment shows a stage only with a verified outcome. The monitor reads
//     bill numbers, and the bill a provision sits on can become law without it (H.R. 7148
//     became law; S.Amdt. 4253 was never voted on). Its stage must come from its own
//     checked outcome, never from the parent bill.
for (const [section, items] of sections) {
  for (const item of items) {
    if (!isProvision(item)) continue;
    const stage = item.status?.stage ?? null;
    if (stage && !(item.outcome?.result === 'became-law' && stage === 'enacted')) {
      errors.push(`${section}/${item.id}: provision has stage "${stage}" without a verified "became-law" outcome`);
    }
  }
}

// 14. A constitutional amendment is never law and never goes to the President: its last
//     congressional step is "sent-to-states" (two-thirds of each chamber).
for (const [section, items] of sections) {
  for (const item of items) {
    if (item.constitutionalAmendment && item.status?.stage === 'enacted') {
      errors.push(`${section}/${item.id}: a constitutional amendment cannot be "enacted"; its final stage is "sent-to-states"`);
    }
  }
}

// 15. Flagship entries feed representdc.org/statehood-bill. They are found by this flag,
//     never by bill number, so the flag itself must be well placed.
const readJson = rel => JSON.parse(readFileSync(join(__dirname, rel), 'utf-8'));
const flagships = [];
for (const [section, items] of sections) {
  for (const item of items) {
    if (item.flagship === undefined) continue;
    if (item.flagship !== true) {
      errors.push(`${section}/${item.id}: flagship must be true or absent (got ${JSON.stringify(item.flagship)})`);
    } else if (section !== 'supportBills') {
      errors.push(`${section}/${item.id}: only a supportBills entry can be flagship`);
    } else {
      flagships.push(item);
    }
  }
}
const flagshipSlots = new Map();
for (const item of flagships) {
  const slot = `${item.congress}:${chamberOf(item.billNumbers[0])}`;
  if (flagshipSlots.has(slot)) {
    errors.push(`supportBills/${item.id}: second flagship for ${slot} (also ${flagshipSlots.get(slot)})`);
  }
  flagshipSlots.set(slot, item.id);
}

// 16. Stored cosponsor lists. checkedAt means "a complete list was fetched then"; it must
//     never sit on a partial list (Codex PRD review, finding 6).
let statehoodStore = null;
try {
  statehoodStore = readJson('../src/data/statehood-cosponsors.json');
} catch {
  if (flagships.length) warnings.push('src/data/statehood-cosponsors.json not found — the monitor writes it on its next run');
}
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
if (statehoodStore) {
  for (const item of flagships) {
    const rec = statehoodStore.bills?.[item.id];
    const label = `statehood-cosponsors/${item.id}`;
    if (!rec) {
      warnings.push(`${label}: no stored record yet — the monitor writes it on its next run`);
      continue;
    }
    if (rec.congress !== item.congress || rec.billNumber !== item.billNumbers[0]) {
      errors.push(`${label}: stored for ${rec.congress} ${rec.billNumber}, but the entry is ${item.congress} ${item.billNumbers[0]}`);
    }
    const list = Array.isArray(rec.cosponsors) ? rec.cosponsors : null;
    if (rec.complete === true) {
      if (!ISO_INSTANT.test(rec.checkedAt || '')) errors.push(`${label}: complete list without a valid checkedAt`);
      if (!list) { errors.push(`${label}: complete but no cosponsors array`); continue; }
      if (!rec.sponsor?.bioguideId) errors.push(`${label}: complete but no sponsor`);
      const ids = new Set();
      for (const c of list) {
        if (!c.bioguideId || !c.name || !c.party || !/^[A-Z]{2}$/.test(c.state || '') || !YMD.test(c.sponsorshipDate || '') || typeof c.isOriginalCosponsor !== 'boolean') {
          errors.push(`${label}: cosponsor row missing a required field (${c.bioguideId || 'no id'})`);
        }
        if (ids.has(c.bioguideId)) errors.push(`${label}: ${c.bioguideId} listed twice`);
        ids.add(c.bioguideId);
        if (c.sponsorshipWithdrawnDate) errors.push(`${label}: ${c.bioguideId} withdrew but is still listed`);
      }
      if (rec.sponsor?.bioguideId && ids.has(rec.sponsor.bioguideId)) {
        errors.push(`${label}: the sponsor is also listed as a cosponsor`);
      }
      // The daily check sets both from the same fetch, and leaves both alone on failure.
      if (item.status?.cosponsors !== list.length) {
        errors.push(`${label}: stored list has ${list.length} cosponsors but bills.json says ${item.status?.cosponsors}`);
      }
    } else {
      if (rec.complete !== false) errors.push(`${label}: complete must be true or false`);
      if (rec.checkedAt !== undefined) errors.push(`${label}: incomplete list carries checkedAt ${rec.checkedAt}`);
      if (list && list.length) errors.push(`${label}: incomplete record holds ${list.length} rows`);
    }
  }
}

// 17. The current-member roster (scripts/build-member-roster.js). The page derives "not yet
//     signed on" from it, so a short roster would hide members and a stale one would list
//     people who have left.
const rosterRel = `../public/api/members-${CURRENT_CONGRESS}.json`;
let roster = null;
try {
  roster = readJson(rosterRel);
} catch {
  warnings.push(`${rosterRel.slice(3)} not found — run scripts/build-member-roster.js (weekly workflow)`);
}
if (roster) {
  const label = `members-${CURRENT_CONGRESS}`;
  const members = Array.isArray(roster.members) ? roster.members : [];
  if (roster.congress !== CURRENT_CONGRESS) errors.push(`${label}: congress is ${roster.congress}`);
  const counts = rosterCounts(members);
  for (const key of Object.keys(counts)) {
    if (roster.counts?.[key] !== counts[key]) {
      errors.push(`${label}: counts.${key} says ${roster.counts?.[key]}, rows hold ${counts[key]}`);
    }
  }
  for (const [chamber, [lo, hi]] of Object.entries(ROSTER_BOUNDS)) {
    if (counts[chamber] < lo || counts[chamber] > hi) {
      errors.push(`${label}: ${counts[chamber]} current ${chamber} members, outside the plausible ${lo}-${hi}`);
    }
  }
  if (counts.houseNonVoting > NON_VOTING_STATES.size) {
    errors.push(`${label}: ${counts.houseNonVoting} non-voting House members, more than the ${NON_VOTING_STATES.size} seats that exist`);
  }
  const ids = new Set();
  for (const m of members) {
    if (ids.has(m.bioguideId)) errors.push(`${label}: ${m.bioguideId} listed twice`);
    ids.add(m.bioguideId);
    if (!m.bioguideId || !m.name || !/^[A-Z]{2}$/.test(m.state || '') || !['house', 'senate'].includes(m.chamber)) {
      errors.push(`${label}: row missing a required field (${m.bioguideId || 'no id'})`);
    }
    const expectVoting = m.chamber === 'senate' || !NON_VOTING_STATES.has(m.state);
    if (m.votingMember !== expectVoting) {
      errors.push(`${label}: ${m.bioguideId} (${m.chamber}, ${m.state}) votingMember is ${m.votingMember}`);
    }
  }
  const ageDays = (Date.now() - Date.parse(roster.generatedAt)) / 86400000;
  if (!Number.isFinite(ageDays)) errors.push(`${label}: generatedAt is not a date`);
  else if (ageDays > 15) warnings.push(`${label}: generated ${Math.floor(ageDays)} days ago — the weekly refresh has missed at least two runs`);
}

// 18. The statehood bill in earlier Congresses: a one-time export, pinned to the values
//     verified against GovInfo BILLSTATUS on 2026-11-10 (withdrawn cosponsors excluded).
//     The 119th row is a snapshot and is not pinned; the live list is checked by 16.
const HISTORY_EXPECTED = {
  115: { house: ['H.R. 1291', 181], senate: ['S. 1278', 30], passedHouse: null },
  116: { house: ['H.R. 51', 227], senate: ['S. 631', 42], passedHouse: '2020-06-26' },
  117: { house: ['H.R. 51', 216], senate: ['S. 51', 45], passedHouse: '2021-04-22' },
  118: { house: ['H.R. 51', 211], senate: ['S. 51', 46], passedHouse: null }
};
const HISTORY_119_SNAPSHOT = { house: 209, senate: 43 };
try {
  const history = readJson('../src/data/statehood-bill-history.json');
  const rows = new Map((history.congresses || []).map(r => [r.congress, r]));
  for (const [congress, want] of Object.entries(HISTORY_EXPECTED)) {
    const row = rows.get(Number(congress));
    const label = `statehood-bill-history/${congress}`;
    if (!row) { errors.push(`${label}: missing`); continue; }
    for (const chamber of ['house', 'senate']) {
      const [number, count] = want[chamber];
      if (row[chamber]?.billNumber !== number || row[chamber]?.cosponsors !== count) {
        errors.push(`${label}: ${chamber} is ${row[chamber]?.billNumber} ${row[chamber]?.cosponsors}, verified ${number} ${count}`);
      }
      if (row[chamber]?.passedSenate) errors.push(`${label}: ${chamber} bill shows a Senate passage; none occurred`);
    }
    if ((row.house?.passedHouse ?? null) !== want.passedHouse) {
      errors.push(`${label}: House passage ${row.house?.passedHouse}, verified ${want.passedHouse}`);
    }
    if (row.final !== true) errors.push(`${label}: a finished Congress must be final: true`);
  }
  const r119 = rows.get(119);
  if (r119 && (r119.house?.cosponsors !== HISTORY_119_SNAPSHOT.house || r119.senate?.cosponsors !== HISTORY_119_SNAPSHOT.senate)) {
    errors.push(`statehood-bill-history/119: snapshot is ${r119.house?.cosponsors}/${r119.senate?.cosponsors}, exported as ${HISTORY_119_SNAPSHOT.house}/${HISTORY_119_SNAPSHOT.senate} on 2026-11-10`);
  }
  if (r119 && CURRENT_CONGRESS === 119 && r119.final !== false) {
    errors.push('statehood-bill-history/119: the Congress is in session, so the row must be final: false');
  }
} catch (e) {
  errors.push(`src/data/statehood-bill-history.json unreadable: ${e.message}`);
}

const total = sections.reduce((n, [, items]) => n + items.length, 0);
console.log(`Checked ${total} entries against ${Object.keys(golden.labels).length} golden labels.`);
warnings.forEach(w => console.log(`⚠️  ${w}`));
if (errors.length) {
  errors.forEach(e => console.error(`❌ ${e}`));
  console.error(`\n${errors.length} error(s).`);
  process.exit(1);
}
console.log(`✅ Lint + golden-label eval passed (${warnings.length} warning(s)).`);

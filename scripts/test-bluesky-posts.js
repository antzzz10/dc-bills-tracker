#!/usr/bin/env node
// Replay and gate checks for the Bluesky post builder (scripts/lib/bluesky-posts.js).
// Runs offline against the real bills.json: node scripts/test-bluesky-posts.js
// Exits non-zero on any failure.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { CURRENT_CONGRESS } from './config.js';
import {
  collectEvents, composePosts, postText, summaryText, seedLedger, displayNumber, measureKey,
  MAX_GRAPHEMES, TRACKER_LINK
} from './lib/bluesky-posts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const real = JSON.parse(readFileSync(join(__dirname, '../src/data/bills.json'), 'utf-8'));
const NOW = '2026-11-13T00:00:00.000Z';
const clone = x => JSON.parse(JSON.stringify(x));
const graphemes = t => [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(t)].length;
const C = CURRENT_CONGRESS;
// A valid ledger that knows none of today's entries, so every entry reads as new.
const UNRELATED = { entries: { other: { measure: '0:X', stage: null, cosponsors: null } } };

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`); }
}
const allIds = data => new Set(Object.values(data).filter(Array.isArray).flat().map(e => e.id));
const find = (data, id) => Object.values(data).filter(Array.isArray).flat().find(e => e.id === id);
// A ledger as if everything were posted, with one entry changed or removed.
const ledgerWith = (data, id, patch) => {
  const ledger = seedLedger(data, C, NOW);
  for (const record of Object.values(ledger.entries)) if (record.cosponsors === null) record.cosponsors = 0;
  for (const [key, record] of Object.entries(ledger.entries)) record.cosponsors = find(data, key)?.status?.cosponsors ?? record.cosponsors;
  if (patch === undefined) delete ledger.entries[id];
  else ledger.entries[id] = { ...ledger.entries[id], ...patch };
  return ledger;
};
const run = (data, overrides) => collectEvents({ billsData: data, currentCongress: C, now: NOW, looked: allIds(data), ...overrides });

console.log('Baseline');
{
  const r = run(real, { ledger: undefined });
  check('no ledger file: seeds and posts nothing', r.seeded && r.events.length === 0);
  check('seeded counts come only from this run\'s readings', Object.values(r.ledger.entries).every(e => e.cosponsors === null));
  const again = run(real, { ledger: r.ledger, freshCosponsors: new Map([['hr6578', 2]]) });
  check('a first reading after seeding sets the baseline silently', again.events.length === 0 && again.ledger.entries.hr6578.cosponsors === 2);
}

console.log('Replay: past events in the data');
{
  const r = run(real, {
    ledger: ledgerWith(real, 'hr5103', { stage: null }),
    passed: [{ id: 'hr5103', section: 'bills', stage: 'passed-house', houseVote: { yeas: 218, nays: 206, date: '2026-03-25' } }]
  });
  const posts = composePosts(r.events);
  check('H.R. 5103 House passage', posts.length === 1 && posts[0].text ===
    `Passed the House: anti-DC bill H.R. 5103, Make the District of Columbia Safe and Beautiful Act of 2025 (218-206). ${TRACKER_LINK}`, posts[0]?.text);
  const repeat = run(real, { ledger: r.ledger, passed: [{ id: 'hr5103', section: 'bills', stage: 'passed-house' }] });
  check('the same passage reported again: not reposted', repeat.events.length === 0);
}
{
  // H.J.Res. 142 itself carries manualOverride (never posted); its path is replayed on H.R. 5103.
  const data = clone(real);
  find(data, 'hr5103').status.stage = 'enacted';
  const r = run(data, { ledger: ledgerWith(data, 'hr5103', { stage: 'passed-both' }), passed: [{ id: 'hr5103', section: 'bills', stage: 'enacted' }] });
  check('became law', composePosts(r.events)[0]?.text.startsWith('Became law: anti-DC bill H.R. 5103, '));
  find(data, 'hr5103').status.stage = 'passed-both';
  const both = composePosts(run(data, { ledger: ledgerWith(data, 'hr5103', { stage: 'passed-house' }), passed: [{ id: 'hr5103', section: 'bills', stage: 'passed-both' }] }).events);
  check('passed both chambers: no claim about the next step', both[0]?.text === `Passed both chambers: anti-DC bill H.R. 5103, Make the District of Columbia Safe and Beautiful Act of 2025. ${TRACKER_LINK}`, both[0]?.text);
}
{
  const r = run(real, { ledger: ledgerWith(real, 'hr6578') });
  const posts = composePosts(r.events);
  check('new bill added after review', posts.length === 1 && posts[0].text ===
    `New anti-DC bill: H.R. 6578, Charlie Kirk Freedom of Speech Plaza Act, introduced Dec 10, 2025. ${TRACKER_LINK}`, posts[0]?.text);
}
{
  const data = clone(real);
  find(data, 'hr6578').status.cosponsors = 3;
  const posts = composePosts(run(data, { ledger: ledgerWith(real, 'hr6578', { cosponsors: 2 }), freshCosponsors: new Map([['hr6578', 3]]) }).events);
  check('cosponsor gain', posts.length === 1 && posts[0].text ===
    `Anti-DC bill H.R. 6578, Charlie Kirk Freedom of Speech Plaza Act, now has 3 cosponsors, up from 2. ${TRACKER_LINK}`, posts[0]?.text);
  find(data, 'hr6578').status.cosponsors = 1;
  const down = composePosts(run(data, { ledger: ledgerWith(real, 'hr6578', { cosponsors: 2 }), freshCosponsors: new Map([['hr6578', 1]]) }).events);
  check('cosponsor loss, singular', down[0]?.text.includes('now has 1 cosponsor, down from 2.'), down[0]?.text);
}

console.log('Gates: never posted');
{
  const r = collectEvents({ billsData: real, ledger: UNRELATED, currentCongress: C, now: NOW, looked: allIds(real) });
  const ids = new Set(r.events.map(e => e.entry.id));
  const archived = [...real.bills, ...real.riders].find(e => e.outcome?.archived);
  check('archived entries', !ids.has(archived.id));
  check('riders and amendments', !r.events.some(e => e.section === 'riders' || e.entry.type === 'rider' || /AMDT/i.test(e.entry.billNumbers?.[0] || '')));
  check('entries sharing a bill number (H.R. 5242 amendments, H.R. 1968 provisions)',
    !['hr5242-secondchance', 'hr5242-perry-cameras', 'hr5242-perry-rightturn', 'hr1968-abortion', 'hr1968-marijuana', 'hr1968-budget'].some(id => ids.has(id)));
  check('entries under manualOverride (H.J.Res. 142)', !ids.has('hjres142-sjres102'));
  check('routine measures', !r.events.some(e => e.section === 'routineBills'));

  const shared = run(real, { ledger: ledgerWith(real, 'x'), freshCosponsors: new Map([['hr5242-perry-cameras', 9], ['hr5242-secondchance', 9]]) });
  check('a parent bill\'s cosponsor change is not posted for its amendments', shared.events.length === 0);

  const provisional = clone(real);
  find(provisional, 'hr6578').provisional = true;
  check('unreviewed (provisional) entries', run(provisional, { ledger: ledgerWith(real, 'hr6578') }).events.length === 0);

  const oldCongress = clone(real);
  find(oldCongress, 'hr6578').congress = C - 1;
  check('entries from another Congress', run(oldCongress, { ledger: ledgerWith(real, 'hr6578') }).events.length === 0);

  const notLooked = run(real, { ledger: ledgerWith(real, 'hr6578'), looked: new Set() });
  check('a new entry whose lookup failed this run (announced later)', notLooked.events.length === 0 && !notLooked.ledger.entries.hr6578);

  const renamed = clone(real);
  find(renamed, 'hr6578').id = 'hr6578-renamed';
  const rn = run(renamed, { ledger: ledgerWith(real, 'x') });
  check('an entry renamed by hand is not re-announced', rn.events.length === 0 && rn.ledger.entries['hr6578-renamed']?.measure === measureKey(find(real, 'hr6578')) && !rn.ledger.entries.hr6578);

  const mismatch = run(real, { ledger: ledgerWith(real, 'hr6578', { stage: null }), passed: [{ id: 'hr6578', section: 'bills', stage: 'passed-house' }] });
  check('a stage the stored data does not hold', mismatch.events.length === 0);

  const handEdit = clone(real);
  find(handEdit, 'hr6578').status.stage = 'passed-house';
  check('a hand correction to a stage', run(handEdit, { ledger: ledgerWith(real, 'x') }).events.length === 0);

  const handCount = run(real, { ledger: ledgerWith(real, 'hr6578', { cosponsors: 2 }), freshCosponsors: new Map([['hr6578', 5]]) });
  check('a cosponsor reading the monitor did not write to bills.json', handCount.events.length === 0 && handCount.ledger.entries.hr6578.cosponsors === 2);

  const missing = run(real, { ledger: ledgerWith(real, 'hr6578', { cosponsors: 1 }), freshCosponsors: new Map() });
  check('a cosponsor count that did not arrive this run', missing.events.length === 0 && missing.ledger.entries.hr6578.cosponsors === 1);

  const failedVote = composePosts(run(real, {
    ledger: ledgerWith(real, 'hr5103', { stage: null }),
    passed: [{ id: 'hr5103', section: 'bills', stage: 'passed-house', houseVote: { failed: true } }]
  }).events);
  check('no tally without an official roll call', failedVote.length === 1 && !/\(\d+-\d+\)/.test(failedVote[0].text), failedVote[0]?.text);
}

console.log('Ledger and data corrections');
{
  for (const [name, bad] of [['null', null], ['an empty ledger', { entries: {} }], ['entries: null', { entries: null }], ['entries: []', { entries: [] }], ['a malformed record', { entries: { hr6578: { stage: 1 } } }]]) {
    let threw = false;
    try { run(real, { ledger: bad }); } catch { threw = true; }
    check(`a damaged ledger (${name}) stops planning instead of reseeding`, threw);
  }

  const fixed = clone(real);
  find(fixed, 'hr5242-perry-cameras').billNumbers = ['H.Amdt. 1'];
  find(fixed, 'hr5242-perry-rightturn').billNumbers = ['H.Amdt. 2'];
  const rf = run(fixed, { ledger: seedLedger(real, C, NOW) });
  check('amendments moved to their own numbers: the parent is not announced as new', rf.events.length === 0, rf.events.map(postText).join(' | '));

  const wrongNumber = clone(real);
  find(wrongNumber, 'hr6578').billNumbers = ['H.R. 6579'];
  const before = seedLedger(wrongNumber, C, NOW);
  const corrected = run(real, { ledger: before });
  check('a corrected bill number is not announced as new', corrected.events.length === 0 && corrected.ledger.entries.hr6578.measure === measureKey(find(real, 'hr6578')));

  const both = clone(real);
  find(both, 'hr6578').status.stage = 'passed-house';
  const passedSameRun = run(both, { ledger: before, passed: [{ id: 'hr6578', section: 'bills', stage: 'passed-house' }] });
  check('a number correction in the same run as a passage: the passage is still posted', passedSameRun.events.length === 1 && passedSameRun.events[0].kind === 'stage', passedSameRun.events.map(postText).join(' | '));

  const nextCongress = clone(real);
  for (const e of Object.values(nextCongress).filter(Array.isArray).flat()) e.congress = C + 1;
  const nc = collectEvents({ billsData: nextCongress, ledger: seedLedger(real, C, NOW), currentCongress: C + 1, now: NOW, looked: allIds(nextCongress) });
  check('an id reused in a new Congress is a new measure', nc.events.some(e => e.kind === 'new' && e.entry.id === 'hr6578'));

  const otherCongress = clone(real);
  otherCongress.bills.push({ ...clone(find(real, 'hr6578')), id: 'hr6578-118', congress: C - 1, outcome: { archived: true } });
  const oc = run(otherCongress, { ledger: ledgerWith(real, 'hr6578', { stage: null }), passed: [] });
  const ocData = clone(otherCongress); find(ocData, 'hr6578').status.stage = 'passed-house';
  const ocPassed = run(ocData, { ledger: oc.ledger, passed: [{ id: 'hr6578', section: 'bills', stage: 'passed-house' }] });
  check('the same number in another Congress does not hide this one', ocPassed.events.length === 1 && ocPassed.events[0].kind === 'stage');

  const renamed = clone(real);
  const e = find(renamed, 'hr6578'); e.id = 'hr6578-renamed'; e.status.cosponsors = 3;
  const rc = run(renamed, { ledger: ledgerWith(real, 'x'), freshCosponsors: new Map([['hr6578-renamed', 3]]) });
  check('a rename and a cosponsor change in the same run: the change is still posted', rc.events.length === 1 && rc.events[0].kind === 'cosponsors' && rc.events[0].from === 2);
}

console.log('Wording, busy days and limits');
{
  const barrier = real.statehoodBarriers[0];
  const amend = postText({ kind: 'stage', section: 'statehoodBarriers', entry: barrier, stage: 'sent-to-states' });
  check('a barrier keeps the tracker\'s wording', amend === `Passed both chambers: constitutional amendment H.J.Res. 141 (a barrier to statehood). It goes to the states for ratification. ${TRACKER_LINK}`, amend);
  const support = postText({ kind: 'new', section: 'supportBills', entry: real.supportBills[0] });
  check('a pro-DC bill says so', support.startsWith('New pro-DC bill: '), support);

  const data = clone(real);
  const ids = ['hr6578', 'hr2096', 'hr5140', 'hr5143'];
  const fresh = new Map(ids.map(id => { const e = find(data, id); e.status.cosponsors += 1; return [id, e.status.cosponsors]; }));
  const posts = composePosts(run(data, { ledger: ledgerWith(real, 'x'), freshCosponsors: fresh }).events);
  check('more than 3 events: one summary post', posts.length === 1 && posts[0].kind === 'summary' &&
    posts[0].text === `Tracker update: 4 measures gained or lost cosponsors. ${TRACKER_LINK}`, posts[0]?.text);

  const everything = collectEvents({ billsData: real, ledger: UNRELATED, currentCongress: C, now: NOW, looked: allIds(real) });
  const stages = ['passed-house', 'passed-senate', 'agreed-house', 'agreed-senate', 'passed-both', 'agreed-both', 'sent-to-states', 'enacted'];
  const allEvents = [
    ...everything.events,
    ...everything.events.flatMap(e => stages.map(stage => ({ ...e, kind: 'stage', stage, houseVote: { yeas: 400, nays: 30 } }))),
    ...everything.events.map(e => ({ ...e, kind: 'cosponsors', from: 120, to: 121 }))
  ];
  const texts = allEvents.map(postText);
  check(`every template composes for every postable entry (${texts.length})`, texts.length > 1000 && texts.every(Boolean));
  const tooLong = texts.filter(t => graphemes(t) > MAX_GRAPHEMES);
  check(`every post within ${MAX_GRAPHEMES} characters`, tooLong.length === 0, tooLong[0]);
  check('no doubled punctuation after a title', texts.every(t => !/[.;:,][.,]/.test(t)), texts.find(t => /[.;:,][.,]/.test(t)));
  check('every post ends with the tracker link', texts.every(t => t.endsWith(` ${TRACKER_LINK}`)));
  check('every post names its own measure number', allEvents.every(e => postText(e).includes(displayNumber(e.entry.billNumbers[0]))));
  check('no post claims a next step after passing both chambers', !texts.some(t => /goes to the President/.test(t)));
  const busiest = summaryText(allEvents.slice(0, 40).concat(everything.events.slice(0, 3).map(e => ({ ...e, kind: 'stage', stage: 'enacted' }))));
  check('a mixed summary stays within the limit', graphemes(busiest) <= MAX_GRAPHEMES, busiest);
  check('display number spacing', displayNumber('H.J.Res.142') === 'H.J.Res. 142' && displayNumber('H.R. 5103') === 'H.R. 5103');
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);

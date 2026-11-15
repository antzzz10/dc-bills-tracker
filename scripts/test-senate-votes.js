#!/usr/bin/env node
// Tests for scripts/lib/senate-votes.js against saved senate.gov records
// (scripts/fixtures/senate-votes/, downloaded 2026-11-14). No network.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseSenateVote, fetchSenateVote, resolveSenateVote, reconcileSenateVote, combineActionVotes, selectSenateVote, mergeSenateVote, checkLockedSenateVote, parseActionTally, senateVoteXmlUrl, normalizeDocumentType } from './lib/senate-votes.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (session, roll) =>
  readFileSync(join(here, 'fixtures/senate-votes', `vote_119_${session}_${String(roll).padStart(5, '0')}.xml`), 'utf-8');

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}
const sumParties = v => Object.values(v.byParty).reduce((t, p) => [t[0] + p.yeas, t[1] + p.nays], [0, 0]);

console.log('Senate roll-call records');

// The five votes behind the daily email's fetch errors, each checked against the
// senate.gov page by hand on 2026-11-14.
const KNOWN = [
  { session: 1, roll: 191, billType: 'hconres', number: 14, date: '2025-04-05', yeas: 51, nays: 48 },
  { session: 1, roll: 133, billType: 'hr', number: 1968, date: '2025-03-14', yeas: 54, nays: 46 },
  { session: 1, roll: 87, billType: 'sconres', number: 7, date: '2025-02-21', yeas: 52, nays: 48 },
  // Matches the hand-verified record in bills.json (hjres142-sjres102, verifiedOn 2026-08-23).
  { session: 2, roll: 37, billType: 'hjres', number: 142, date: '2026-02-12', yeas: 49, nays: 47 },
  { session: 2, roll: 20, billType: 'hr', number: 7148, date: '2026-01-30', yeas: 71, nays: 29 }
];
for (const k of KNOWN) {
  const r = parseSenateVote(fixture(k.session, k.roll), { congress: 119, session: k.session, rollCallNumber: k.roll, billType: k.billType, number: k.number });
  const label = `${k.billType.toUpperCase()} ${k.number} (roll ${k.roll})`;
  check(`${label}: ${k.yeas}-${k.nays} on ${k.date}`, r.ok && r.vote.yeas === k.yeas && r.vote.nays === k.nays && r.vote.date === k.date, JSON.stringify(r));
  if (r.ok) {
    const [y, n] = sumParties(r.vote);
    check(`${label}: party rows add up`, y === k.yeas && n === k.nays, `${y}-${n}`);
    check(`${label}: R and D rows present`, r.vote.byParty.republican && r.vote.byParty.democrat);
  }
}

// H.Con.Res. 14's party split, from the record's member list: Collins and Paul were the
// Republican nays; King and Sanders voted as independents.
{
  const r = parseSenateVote(fixture(1, 191), { congress: 119, session: 1, rollCallNumber: 191, billType: 'hconres', number: 14 });
  const p = r.vote?.byParty || {};
  check('party split read from the member list (H.Con.Res. 14: R 51-2, D 0-44, I 0-2)',
    r.ok && p.republican.yeas === 51 && p.republican.nays === 2 && p.democrat.yeas === 0 && p.democrat.nays === 44 &&
    p.independent?.yeas === 0 && p.independent?.nays === 2, JSON.stringify(p));
}

console.log('\nRefusals');
const base = { congress: 119, session: 1, rollCallNumber: 191, billType: 'hconres', number: 14 };
const xml = fixture(1, 191);
{
  const r = parseSenateVote(xml, { ...base, billType: 'hr', number: 14 });
  check('another measure\'s vote is skipped, not used', !r.ok && r.skip, JSON.stringify(r));
}
{
  const r = parseSenateVote(xml, { ...base, session: 2 });
  check('wrong session is a failure', !r.ok && !r.skip);
}
{
  const r = parseSenateVote(xml, { ...base, rollCallNumber: 192 });
  check('wrong roll number is a failure', !r.ok && !r.skip);
}
{
  const r = parseSenateVote(xml.replace(/<congress>119<\/congress>/, '<congress>118</congress>'), base);
  check('wrong Congress is a failure', !r.ok && !r.skip);
}
{
  const r = parseSenateVote(xml.replace(/<yeas>51<\/yeas>/, '<yeas>52</yeas>'), base);
  check('count that disagrees with the member list is a failure', !r.ok && !r.skip, JSON.stringify(r));
}
{
  const tie = xml.replace(/<tie_breaker>[\s\S]*?<\/tie_breaker>/, '<tie_breaker><by_whom>Vice President</by_whom><tie_breaker_vote>Yea</tie_breaker_vote></tie_breaker>');
  const r = parseSenateVote(tie, base);
  check('a Vice President tie-break is skipped (no 50-50 published)', !r.ok && r.skip, JSON.stringify(r));
}
{
  const r = parseSenateVote('<html>Access denied</html>', base);
  check('an error page is a failure', !r.ok && !r.skip);
}
{
  const r = parseSenateVote(xml.replace(/<document_type>[^<]*<\/document_type>/, '<document_type>PN</document_type>'), base);
  check('a nomination vote is skipped', !r.ok && r.skip);
}
{
  const r = parseSenateVote(xml.replace(/<document_number>[^<]*<\/document_number>/, ''), base);
  check('a missing measure number is a failure, not a skip', !r.ok && !r.skip, JSON.stringify(r));
}
{
  const r = parseSenateVote(xml.replace(/<document>[\s\S]*?<\/document>/, ''), base);
  check('a missing measure block is a failure, not a skip', !r.ok && !r.skip, JSON.stringify(r));
}
{
  const r = parseSenateVote(xml.replace(/<document_type>[^<]*<\/document_type>/, '<document_type>XYZ</document_type>'), base);
  check('an unrecognised measure type is a failure, not a skip', !r.ok && !r.skip, JSON.stringify(r));
}
{
  const r = parseSenateVote(xml.replace(/<document_congress>119<\/document_congress>/, '<document_congress>118</document_congress>'), base);
  check('a measure from another Congress is a failure', !r.ok && !r.skip, JSON.stringify(r));
}
for (const [label, date] of [['an impossible date', 'February 31, 2025,  02:26 AM'], ['a date in the other session', 'March 14, 2026,  02:26 AM'], ['a date before the Congress', 'April 5, 2024,  02:26 AM']]) {
  const r = parseSenateVote(xml.replace(/<vote_date>[^<]*<\/vote_date>/, `<vote_date>${date}</vote_date>`), base);
  check(`${label} is a failure`, !r.ok && !r.skip, JSON.stringify(r));
}
{
  const r = parseSenateVote(xml.replace(/<vote_date>[^<]*<\/vote_date>/, '<vote_date>January 3, 2026,  10:00 AM</vote_date>'), base);
  check('a first-session vote on Jan 3 of the next year is accepted', r.ok && r.vote.date === '2026-01-03', JSON.stringify(r));
}
{
  const r = parseSenateVote(xml.replace(/<party>D<\/party>/, '<party>X</party>'), base);
  check('an unknown party is a failure', !r.ok && !r.skip);
}
{
  const r = parseSenateVote(xml.replace(/<vote_date>[^<]*<\/vote_date>/, '<vote_date>soon</vote_date>'), base);
  check('an unreadable date is a failure', !r.ok && !r.skip);
}

console.log('\nHelpers and fetch');
check('XML URL format', senateVoteXmlUrl(119, 1, 191) === 'https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00191.xml');
check('document types normalize', ['H.R.', 'S.', 'H.J.Res.', 'S.J.Res.', 'H.Con.Res.', 'S.Con.Res.', 'H.Res.', 'S.Res.'].map(normalizeDocumentType).join() === 'hr,s,hjres,sjres,hconres,sconres,hres,sres');
const noSleep = async () => {};
const answers = (...list) => { let i = 0; const calls = { n: 0 }; return [async () => { calls.n++; const a = list[Math.min(i++, list.length - 1)]; if (a instanceof Error) throw a; return a; }, calls]; };
const good = { ok: true, text: async () => xml };
{
  const [fetchImpl, calls] = answers({ ok: false, status: 403 });
  const r = await fetchSenateVote({ ...base }, { fetchImpl, sleep: noSleep });
  check('a refusal (403) is retried, then reported as unreachable', !r.ok && !r.skip && r.unreachable === true && /403/.test(r.reason) && calls.n === 3, JSON.stringify([r, calls]));
}
{
  const [fetchImpl, calls] = answers({ ok: false, status: 403 }, good);
  const r = await fetchSenateVote({ ...base }, { fetchImpl, sleep: noSleep });
  check('a refusal followed by an answer is read normally', r.ok && r.vote.yeas === 51 && calls.n === 2);
}
{
  const [fetchImpl, calls] = answers({ ok: false, status: 404 });
  const r = await fetchSenateVote({ ...base }, { fetchImpl, sleep: noSleep });
  check('a 404 is a failure at once, never "unreachable"', !r.ok && !r.unreachable && calls.n === 1, JSON.stringify([r, calls]));
}
{
  const timeout = Object.assign(new Error('aborted'), { name: 'TimeoutError' });
  const [fetchImpl, calls] = answers(timeout);
  const r = await fetchSenateVote({ ...base }, { fetchImpl, sleep: noSleep });
  check('timeouts are retried, then unreachable', !r.ok && r.unreachable && /timed out/.test(r.reason) && calls.n === 3);
}
{
  const [fetchImpl, calls] = answers({ ok: false, status: 503 });
  const r = await fetchSenateVote({ ...base }, { fetchImpl, sleep: noSleep, retryDelaysMs: [] });
  check('with no retries allowed, one request is made', !r.ok && r.unreachable && calls.n === 1);
}
{
  const [fetchImpl] = answers({ ok: true, text: async () => '<html>Access Denied</html>' });
  const r = await fetchSenateVote({ ...base }, { fetchImpl, sleep: noSleep });
  check('a block page served as 200 is a failure, not "unreachable"', !r.ok && !r.unreachable && !r.skip);
}
{
  let seenUrl = '';
  const r = await fetchSenateVote({ ...base }, { fetchImpl: async url => { seenUrl = url; return { ok: true, text: async () => xml }; } });
  check('fetch reads the right record', r.ok && r.vote.yeas === 51 && seenUrl.endsWith('vote_119_1_00191.xml'));
}

console.log('\nCongress.gov action tallies');
// Action lines copied from the Congress.gov API on 2026-11-15.
const ACTIONS = [
  ['Resolution agreed to in Senate with an amendment by Yea-Nay Vote. 51 - 48. Record Vote Number: 191.', 51, 48, 191],
  ['Passed/agreed to in Senate: Passed Senate without amendment by Yea-Nay Vote. 54 - 46. Record Vote Number: 133.', 54, 46, 133],
  ['Resolution agreed to in Senate with amendments by Yea-Nay Vote. 52 - 48. Record Vote Number: 87. (text: CR S1119-1125)', 52, 48, 87],
  ['Passed Senate without amendment by Yea-Nay Vote. 49 - 47. Record Vote Number: 37.', 49, 47, 37],
  ['Passed Senate, under the order of 1/30/2026, having achieved 60 votes in the affirmative, with amendments by Yea-Nay Vote. 71 - 29. Record Vote Number: 20.', 71, 29, 20]
];
for (const [text, yeas, nays, roll] of ACTIONS) {
  const t = parseActionTally(text);
  check(`tally read: ${yeas}-${nays}, vote ${roll}`, t && t.yeas === yeas && t.nays === nays && t.rollCallNumber === roll, JSON.stringify(t));
}
check('a voice vote has no tally', parseActionTally('Passed/agreed to in Senate: Introduced in the Senate, read twice, considered, read the third time, and passed without amendment by Voice Vote.') === null);
check('House wording has no Senate tally', parseActionTally('On passage Passed by the Yeas and Nays: 217 - 213 (Roll no. 70).') === null);
check('a mention of another vote number is not a tally', parseActionTally('Motion by Senator Thune to reconsider the vote by which cloture on the motion to proceed to H.R.7148 was not invoked (Record Vote No. 13) rendered moot in Senate.') === null);

console.log('\nTwo official records together');
const tally = { yeas: 51, nays: 48, rollCallNumber: 191 };
const refused = () => answers({ ok: false, status: 403 })[0];
{
  const r = await resolveSenateVote({ ...base }, { tally, actionDate: '2025-04-05' }, { fetchImpl: answers(good)[0], sleep: noSleep });
  check('both agree: the Senate record is used, with party rows', r.ok && !r.totalsOnly && r.vote.byParty.republican.yeas === 51);
}
{
  const r = await resolveSenateVote({ ...base }, { tally: { ...tally, yeas: 52 }, actionDate: '2025-04-05' }, { fetchImpl: answers(good)[0], sleep: noSleep });
  check('the two records disagree: a failure, nothing published', !r.ok && !r.skip && !r.unreachable && /51-48/.test(r.reason) && /52-48/.test(r.reason), JSON.stringify(r));
}
{
  const r = await resolveSenateVote({ ...base }, { tally: null, actionDate: '2025-04-05' }, { fetchImpl: answers(good)[0], sleep: noSleep });
  check('no Congress.gov tally: the Senate record is used as before', r.ok && r.vote.yeas === 51);
}
{
  const r = await resolveSenateVote({ ...base }, { tally, actionDate: '2025-04-05' }, { fetchImpl: refused(), sleep: noSleep });
  check('senate.gov refuses: Congress.gov totals, no party rows', r.ok && r.totalsOnly && r.vote.yeas === 51 && r.vote.nays === 48 && r.vote.date === '2025-04-05' && !('byParty' in r.vote) && /403/.test(r.unreachableReason), JSON.stringify(r));
}
{
  const r = await resolveSenateVote({ ...base }, { tally: null, actionDate: '2025-04-05' }, { fetchImpl: refused(), sleep: noSleep });
  check('senate.gov refuses and Congress.gov has no tally: a failure', !r.ok && r.unreachable);
}
{
  const r = await resolveSenateVote({ ...base }, { tally: { ...tally, rollCallNumber: 190 }, actionDate: '2025-04-05' }, { fetchImpl: refused(), sleep: noSleep });
  check('a tally for another vote number is never used', !r.ok);
}
{
  const r = await resolveSenateVote({ ...base }, { tally, actionDate: '2025-04-05' }, { fetchImpl: answers({ ok: false, status: 404 })[0], sleep: noSleep });
  check('a 404 never falls back to Congress.gov totals', !r.ok && !r.totalsOnly);
}
{
  const r = await resolveSenateVote({ ...base, billType: 'hr' }, { tally, actionDate: '2025-04-05' }, { fetchImpl: answers(good)[0], sleep: noSleep });
  check('another measure\'s record is still skipped, not replaced by totals', !r.ok && r.skip);
}
// 50-49 is how Congress.gov wrote S.J.Res. 49's vote 226 (2025), a 49-49 split the Vice
// President broke.
for (const [label, t] of [['a tie', { yeas: 50, nays: 50, rollCallNumber: 191 }], ['101 votes', { yeas: 51, nays: 50, rollCallNumber: 191 }], ['a one-vote margin (50-49)', { yeas: 50, nays: 49, rollCallNumber: 191 }], ['a one-vote margin (48-47)', { yeas: 48, nays: 47, rollCallNumber: 191 }]]) {
  const r = await resolveSenateVote({ ...base }, { tally: t, actionDate: '2025-04-05' }, { fetchImpl: refused(), sleep: noSleep });
  check(`${label} is not published from totals alone (possible tie-break)`, !r.ok && !r.totalsOnly && r.unreachable === true, JSON.stringify(r));
}
for (const [label, d] of [['no date', null], ['an impossible date (Feb 31)', '2025-02-31'], ['an impossible date (Apr 31)', '2025-04-31'], ['a date in the other session', '2026-04-05'], ['a date before the Congress', '2024-04-05'], ['a malformed date', '2025-4-5']]) {
  const r = await resolveSenateVote({ ...base }, { tally, actionDate: d }, { fetchImpl: refused(), sleep: noSleep });
  check(`totals with ${label} are not used, and the outage is still flagged`, !r.ok && !r.totalsOnly && r.unreachable === true, JSON.stringify(r));
}
{
  const r = await resolveSenateVote({ ...base }, { tally, actionDate: '2025-04-04' }, { fetchImpl: answers(good)[0], sleep: noSleep });
  check('the two records disagree on the date: a failure', !r.ok && !r.skip && /2025-04-05/.test(r.reason) && /2025-04-04/.test(r.reason), JSON.stringify(r));
}

console.log('\nOne senate.gov answer, several Congress.gov action lines');
{
  const fetched = await fetchSenateVote({ ...base }, { fetchImpl: answers(good)[0], sleep: noSleep });
  const a = reconcileSenateVote(fetched, base, { tally: null, actionDate: '2025-04-05' });
  const b = reconcileSenateVote(fetched, base, { tally: { ...tally, yeas: 52 }, actionDate: '2025-04-05' });
  check('a line without a tally passing does not excuse a later line that disagrees', a.ok && !b.ok, JSON.stringify(b));
  const down = await fetchSenateVote({ ...base }, { fetchImpl: refused(), sleep: noSleep });
  const c = reconcileSenateVote(down, base, { tally: null, actionDate: '2025-04-05' });
  const d = reconcileSenateVote(down, base, { tally, actionDate: '2025-04-05' });
  check('during a refusal, a line without a tally fails and a line with one still gives totals', !c.ok && d.ok && d.totalsOnly);
  const t = (yeas, nays, date = '2025-04-05') => ({ yeas, nays, date, totalsOnly: true });
  const fullVote = { yeas: 51, nays: 48, date: '2025-04-05', byParty: {} };
  check('lines that agree: one vote, no failure', combineActionVotes({ votes: [t(51, 48), t(51, 48)], failed: false }).vote?.yeas === 51);
  check('a bare line with nothing to fall back on is forgiven when another line answered', (r => r.vote && !r.failed)(combineActionVotes({ votes: [t(51, 48)], noEvidence: true })));
  check('a line that failed on substance voids the vote, even beside a good line', (r => !r.vote && r.failed)(combineActionVotes({ votes: [fullVote], failed: true })));
  check('...and beside a good totals-only line', (r => !r.vote && r.failed)(combineActionVotes({ votes: [t(54, 46)], failed: true, noEvidence: true })));
  check('nothing to fall back on anywhere: failed', (r => !r.vote && r.failed)(combineActionVotes({ votes: [], noEvidence: true })));
  check('lines that disagree on totals: nothing used, reported as failed', (r => !r.vote && r.failed && r.disagree)(combineActionVotes({ votes: [t(55, 45), t(54, 46)], failed: false })));
  check('lines that disagree on the date: nothing used', (r => !r.vote && r.failed)(combineActionVotes({ votes: [t(51, 48), t(51, 48, '2025-04-06')], failed: false })));
  check('the record with party rows wins over totals', combineActionVotes({ votes: [t(51, 48), fullVote], failed: false }).vote === fullVote);
  check('no answer at all: failed stays failed', (r => !r.vote && r.failed)(combineActionVotes({ votes: [], failed: true })));
  check('no lookups made: nothing, no failure', (r => !r.vote && !r.failed)(combineActionVotes({ votes: [], failed: false })));
}

console.log('\nWhich passage\'s vote is shown');
{
  const v = (yeas, nays, date) => ({ yeas, nays, date, byParty: {} });
  const roll = (rollNumber, votes, extra = {}) => ({ rollNumber, votes, failed: false, noEvidence: false, ...extra });
  const march = v(54, 46, '2025-03-14'), april = v(60, 40, '2025-04-20');
  const two = [{ date: '2025-03-14', rollKey: '2025:133' }, { date: '2025-03-14', rollKey: '2025:133' }];
  check('one passage cited on two lines: its vote', selectSenateVote(two, new Map([['2025:133', roll(133, [march, march])]])).vote === march);
  const both = new Map([['2025:200', roll(200, [april])], ['2025:133', roll(133, [march])]]);
  const twoPassages = [{ date: '2025-04-20', rollKey: '2025:200' }, { date: '2025-03-14', rollKey: '2025:133' }];
  check('two passages: the later one\'s vote, whatever the order read', selectSenateVote(twoPassages, both).vote === april && selectSenateVote([...twoPassages].reverse(), new Map([...both].reverse())).vote === april);
  check('later passage by unanimous consent: the earlier tally is not shown', (r => r.vote === null && !r.failed)(selectSenateVote([{ date: '2025-04-20', rollKey: null }, { date: '2025-03-14', rollKey: '2025:133' }], new Map([['2025:133', roll(133, [march])]]))));
  check('two different passages on the same day: no tally shown', (r => r.vote === null && r.messages.length === 1)(selectSenateVote([{ date: '2025-04-20', rollKey: '2025:133' }, { date: '2025-04-20', rollKey: '2025:200' }], new Map([['2025:133', roll(133, [v(54, 46, '2025-04-20')])], ['2025:200', roll(200, [april])]]))));
  check('the later vote failed: no tally, reported, earlier one not used', (r => r.vote === null && r.failed)(selectSenateVote(twoPassages, new Map([['2025:200', roll(200, [], { failed: true })], ['2025:133', roll(133, [march])]]))));
  check('an earlier vote failed: the later one is shown and the failure is still reported', (r => r.vote === april && r.failed)(selectSenateVote(twoPassages, new Map([['2025:200', roll(200, [april])], ['2025:133', roll(133, [], { failed: true })]]))));
  check('same roll number in two sessions: kept apart', selectSenateVote([{ date: '2026-01-30', rollKey: '2026:20' }, { date: '2025-01-30', rollKey: '2025:20' }], new Map([['2026:20', roll(20, [v(71, 29, '2026-01-30')])], ['2025:20', roll(20, [v(60, 40, '2025-01-30')])]])).vote?.yeas === 71);
  check('a voice vote only: nothing, no failure', (r => r.vote === null && !r.failed)(selectSenateVote([{ date: '2025-03-14', rollKey: null }], new Map())));
  check('no Senate passage: nothing', (r => r.vote === null && !r.failed)(selectSenateVote([], new Map())));
}

console.log('\nWhat gets stored');
const src = 'https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00133.htm';
const party = { republican: { yeas: 52, nays: 1 }, democrat: { yeas: 1, nays: 44 }, independent: { yeas: 1, nays: 1 } };
const full = { date: '2025-03-14', yeas: 54, nays: 46, byParty: party, source: src };
const totals = { date: '2025-03-14', yeas: 54, nays: 46, source: src, totalsOnly: true, unreachableReason: 'HTTP 403 from senate.gov' };
const storedFull = { date: '2025-03-14', vote: { yeas: 54, nays: 46, byParty: party }, source: src, verifiedOn: '2026-11-14' };
{
  const m = mergeSenateVote(undefined, full, '2026-11-15');
  check('new vote, full record: stored with party rows', m.record?.vote.byParty === party && m.record.verifiedOn === '2026-11-15' && m.note === null);
}
{
  const m = mergeSenateVote(storedFull, full, '2026-11-15');
  check('unchanged full record: nothing rewritten', m.record === null && m.note === null);
}
{
  const m = mergeSenateVote(storedFull, totals, '2026-11-15');
  check('senate.gov unreachable, stored record complete and matching: kept, no note', m.record === null && m.note === null);
}
{
  const m = mergeSenateVote(storedFull, { ...totals, date: '2025-03-15' }, '2026-11-15');
  check('stored date differs from Congress.gov\'s during a refusal: an error, nothing changed', m.record === null && m.note?.kind === 'conflict' && /2025-03-14/.test(m.note.text) && /2025-03-15/.test(m.note.text), JSON.stringify(m));
}
{
  const m = mergeSenateVote(undefined, totals, '2026-11-15');
  check('senate.gov unreachable, new vote: totals stored without party rows, reported as a gap', m.record && m.record.vote.yeas === 54 && !('byParty' in m.record.vote) && m.record.source === src && m.note?.kind === 'gap' && /403/.test(m.note.text), JSON.stringify(m));
}
{
  const storedTotals = { date: '2025-03-14', vote: { yeas: 54, nays: 46 }, source: src, verifiedOn: '2026-11-14' };
  const again = mergeSenateVote(storedTotals, totals, '2026-11-15');
  check('still unreachable next run: nothing rewritten, gap still reported', again.record === null && again.note?.kind === 'gap');
  const filled = mergeSenateVote(storedTotals, full, '2026-11-16');
  check('senate.gov answers later: party rows are filled in', filled.record?.vote.byParty === party && filled.note === null);
}
{
  const m = mergeSenateVote(storedFull, { ...totals, yeas: 55, nays: 45 }, '2026-11-15');
  check('stored tally differs from Congress.gov and senate.gov is unreachable: an error, nothing changed', m.record === null && m.note?.kind === 'conflict' && /54-46/.test(m.note.text) && /55-45/.test(m.note.text));
}
{
  const m = mergeSenateVote(storedFull, { ...full, yeas: 55, nays: 45, byParty: { ...party, republican: { yeas: 53, nays: 0 } } }, '2026-11-15');
  check('the Senate record itself changed: stored record follows it', m.record?.vote.yeas === 55 && m.note === null);
}
{
  const m = mergeSenateVote({ date: '2025-03-14', vote: null, source: 'x' }, full, '2026-11-15');
  check('a stored record with no tally (voice vote entry) does not crash', m.record?.vote.yeas === 54);
}

console.log('\nLocked (hand-entered) entries');
{
  const hand = { date: '2026-02-12', vote: { yeas: 49, nays: 47 }, source: 'x', verifiedOn: '2026-08-23' };
  const fresh = { date: '2026-02-12', yeas: 49, nays: 47, byParty: {} };
  check('hand-entered tally agrees: no note', checkLockedSenateVote(hand, fresh) === null);
  check('hand-entered tally agrees with totals-only: no note, no gap', checkLockedSenateVote(hand, { ...fresh, totalsOnly: true }) === null);
  check('hand-entered tally differs: an error', checkLockedSenateVote(hand, { ...fresh, yeas: 50, nays: 46 })?.kind === 'conflict');
  check('hand-entered tally differs from totals-only: an error', (n => n?.kind === 'conflict' && /Congress\.gov/.test(n.text))(checkLockedSenateVote(hand, { ...fresh, yeas: 50, nays: 46, totalsOnly: true })));
  check('hand-entered date differs: an error', checkLockedSenateVote(hand, { ...fresh, date: '2026-02-13' })?.kind === 'conflict');
  check('a locked voice-vote entry (no tally) is left alone', checkLockedSenateVote({ date: '2025-03-14', vote: null }, fresh) === null);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);

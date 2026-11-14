#!/usr/bin/env node
// Tests for scripts/lib/senate-votes.js against saved senate.gov records
// (scripts/fixtures/senate-votes/, downloaded 2026-11-14). No network.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseSenateVote, fetchSenateVote, senateVoteXmlUrl, normalizeDocumentType } from './lib/senate-votes.js';

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
{
  const r = await fetchSenateVote({ ...base }, { fetchImpl: async () => ({ ok: false, status: 403 }) });
  check('an HTTP error is a failure', !r.ok && !r.skip && /403/.test(r.reason));
}
{
  let seenUrl = '';
  const r = await fetchSenateVote({ ...base }, { fetchImpl: async url => { seenUrl = url; return { ok: true, text: async () => xml }; } });
  check('fetch reads the right record', r.ok && r.vote.yeas === 51 && seenUrl.endsWith('vote_119_1_00191.xml'));
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);

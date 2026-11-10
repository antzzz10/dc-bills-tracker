#!/usr/bin/env node

/**
 * Current-member roster for the statehood-bill page's member lookup (PRD #3, #7).
 *
 *   CONGRESS_API_KEY=... node scripts/build-member-roster.js
 *
 * Writes public/api/members-<congress>.json: every current member of Congress (House incl.
 * delegates and the resident commissioner, and Senate), with Bioguide ID, display name,
 * party, state, district, chamber, whether they vote on the floor, and the official website
 * Congress.gov records. The page joins this to the cosponsor list by Bioguide ID, so
 * "not yet signed on" = current members − sponsor − cosponsors, never a guess.
 *
 * Sources: /member/congress/{congress}?currentMember=true (paginated, limit 250) for who
 * serves; /member/{bioguideId} for the term, party and official website (the list
 * endpoint carries none of the three reliably).
 *
 * All or nothing: if any page or member detail fails after retries, or the per-chamber
 * counts are implausible, nothing is written and the script exits 1. The previous roster
 * stays published — an incomplete roster would put a cosponsor in "not yet signed on" or
 * drop a member from the lookup. Runs weekly (.github/workflows/refresh-member-roster.yml).
 */

import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { CURRENT_CONGRESS } from './config.js';
import { fetchJsonWithRetry, withKey, redactKey } from './lib/congress-api.js';
import { NON_VOTING_STATES } from './lib/statehood.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_BASE_URL = 'https://api.congress.gov/v3';
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const DELAY_MS = 300; // Same spacing as the daily monitor; ~540 details ≈ 3-5 minutes.

// Plausibility bounds, shared with lint-bills.js. House: 435 seats + 6 non-voting, less
// vacancies. Senate: 100, less at most two vacancies before something is wrong.
export const ROSTER_BOUNDS = { house: [430, 441], senate: [98, 100] };

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PARTY_FALLBACK = { Democratic: 'D', Republican: 'R', Independent: 'I' };

function chamberKey(chamber = '') {
  if (/house/i.test(chamber)) return 'house';
  if (/senate/i.test(chamber)) return 'senate';
  return null;
}

async function listCurrentMembers() {
  let url = `${API_BASE_URL}/member/congress/${CURRENT_CONGRESS}?currentMember=true&limit=250&format=json&api_key=${CONGRESS_API_KEY}`;
  const rows = [];
  let expected = null;
  const seen = new Set();
  while (url) {
    if (seen.has(url) || seen.size > 10) throw new Error('member list pagination looped');
    seen.add(url);
    const res = await fetchJsonWithRetry(url);
    if (!res.ok) throw new Error(`member list: ${res.reason}`);
    const p = res.data.pagination || {};
    if (expected !== null && p.count !== expected) throw new Error(`member count changed mid-walk (${expected}→${p.count})`);
    expected = p.count;
    rows.push(...(res.data.members || []));
    if (p.next) {
      url = withKey(p.next, CONGRESS_API_KEY, `/v3/member/congress/${CURRENT_CONGRESS}`);
      if (!url) throw new Error(`unexpected pagination.next ${redactKey(p.next)}`);
    } else {
      url = null;
    }
    await sleep(DELAY_MS);
  }
  if (rows.length !== expected) throw new Error(`member list returned ${rows.length} rows, pagination.count says ${expected}`);
  const ids = new Set(rows.map(r => r.bioguideId));
  if (ids.size !== rows.length) throw new Error('member list contains duplicate Bioguide IDs');
  return rows;
}

function memberRow(listItem, detail) {
  // The detail record must be the member we asked for and must still say they serve: a
  // resignation between the list request and this one would otherwise publish a departed
  // member with a fresh generatedAt (Codex attack review, 2026-11-10). Either mismatch
  // aborts the whole refresh; last week's roster stays.
  if (detail.bioguideId !== listItem.bioguideId) {
    throw new Error(`asked for ${listItem.bioguideId}, detail record is ${detail.bioguideId}`);
  }
  if (detail.currentMember !== true) {
    throw new Error(`${detail.bioguideId}: listed as current but the member record says currentMember=${detail.currentMember}`);
  }
  // The term in this Congress. A member who moved chambers mid-Congress has two; the
  // later one is where they serve now.
  const terms = (detail.terms || []).filter(t => t.congress === CURRENT_CONGRESS)
    .sort((a, b) => (a.startYear || 0) - (b.startYear || 0));
  const term = terms[terms.length - 1];
  if (!term) throw new Error(`${detail.bioguideId}: no term in the ${CURRENT_CONGRESS}th Congress`);
  const chamber = chamberKey(term.chamber);
  if (!chamber) throw new Error(`${detail.bioguideId}: unknown chamber "${term.chamber}"`);
  const state = term.stateCode;
  if (!/^[A-Z]{2}$/.test(state || '')) throw new Error(`${detail.bioguideId}: no state code`);

  const parties = [...(detail.partyHistory || [])].sort((a, b) => (a.startYear || 0) - (b.startYear || 0));
  const latestParty = parties[parties.length - 1];
  const party = latestParty?.partyAbbreviation || PARTY_FALLBACK[listItem.partyName] || null;

  // Delegates and the resident commissioner do not vote on final passage. memberType is
  // the record's own word for it; the state list is the cross-check (lint-bills.js).
  const votingMember = chamber === 'senate'
    ? true
    : (term.memberType ? term.memberType === 'Representative' : !NON_VOTING_STATES.has(state));

  const name = detail.directOrderName ||
    [detail.firstName, detail.middleName, detail.lastName, detail.suffixName].filter(Boolean).join(' ');

  return {
    bioguideId: detail.bioguideId,
    name,
    party,
    state,
    district: chamber === 'house' && Number.isInteger(listItem.district) ? listItem.district : null,
    chamber,
    votingMember,
    officialWebsiteUrl: detail.officialWebsiteUrl || null
  };
}

export function rosterCounts(members) {
  const house = members.filter(m => m.chamber === 'house');
  return {
    house: house.length,
    houseVoting: house.filter(m => m.votingMember).length,
    houseNonVoting: house.filter(m => !m.votingMember).length,
    senate: members.filter(m => m.chamber === 'senate').length,
    total: members.length
  };
}

async function main() {
  if (!CONGRESS_API_KEY) {
    console.error('❌ CONGRESS_API_KEY not set');
    process.exit(1);
  }
  const list = await listCurrentMembers();
  console.log(`Listed ${list.length} current members of the ${CURRENT_CONGRESS}th Congress`);

  const members = [];
  for (const [i, item] of list.entries()) {
    const res = await fetchJsonWithRetry(`${API_BASE_URL}/member/${item.bioguideId}?format=json&api_key=${CONGRESS_API_KEY}`);
    if (!res.ok) throw new Error(`member ${item.bioguideId}: ${res.reason}`);
    members.push(memberRow(item, res.data.member || {}));
    if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${list.length}`);
    await sleep(DELAY_MS);
  }

  const counts = rosterCounts(members);
  for (const [chamber, [lo, hi]] of Object.entries(ROSTER_BOUNDS)) {
    if (counts[chamber] < lo || counts[chamber] > hi) {
      throw new Error(`${chamber} has ${counts[chamber]} current members, outside ${lo}-${hi}; not publishing`);
    }
  }

  members.sort((a, b) =>
    a.state.localeCompare(b.state) ||
    a.chamber.localeCompare(b.chamber) ||
    (a.district ?? 0) - (b.district ?? 0) ||
    a.name.localeCompare(b.name));

  const out = {
    congress: CURRENT_CONGRESS,
    generatedAt: new Date().toISOString(),
    source: `Congress.gov API: /member/congress/${CURRENT_CONGRESS}?currentMember=true and /member/{bioguideId}`,
    counts,
    members
  };
  const dir = join(__dirname, '../public/api');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `members-${CURRENT_CONGRESS}.json`);
  writeFileSync(path, JSON.stringify(out, null, 2) + '\n');
  console.log(`✓ ${path}`);
  console.log(`  House ${counts.house} (${counts.houseVoting} voting, ${counts.houseNonVoting} non-voting) · Senate ${counts.senate}`);
}

// Only when run directly: lint-bills.js imports ROSTER_BOUNDS and rosterCounts.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    console.error(`❌ Roster not written: ${redactKey(error.message)}`);
    process.exit(1);
  });
}

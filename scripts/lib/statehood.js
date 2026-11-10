/**
 * The statehood bill's cosponsor lists: fetch, store, publish.
 *
 * Feeds representdc.org/statehood-bill (PRD docs/2026-11-10-cosponsor-page-and-120th-overview-prd.md,
 * decision #7). Flagship entries in bills.json carry `flagship: true`; nothing here keys on
 * a bill number, because the numbers change every Congress.
 *
 * Storage (Andria's call to confirm; see the PR):
 *   src/data/statehood-cosponsors.json   the stored, last COMPLETE list per flagship entry,
 *                                        written by monitor-bills.js. Kept out of bills.json
 *                                        so ~250 member rows don't churn that file's diffs.
 *   public/api/statehood-cosponsors.json the published payload, derived from the store by
 *                                        generate-stats.js, with totals computed, never typed.
 */

import { fetchJsonWithRetry, redactKey, withKey } from './congress-api.js';

// Non-voting House members: the delegates and the resident commissioner. Their cosponsorship
// is recorded like anyone else's, so the published totals say how many are included
// (PRD #2: "209 cosponsors in the House (including 2 non-voting delegates)").
export const NON_VOTING_STATES = new Set(['DC', 'PR', 'GU', 'VI', 'AS', 'MP']);

// A real member list is a few hundred rows; a walk longer than this is a pagination loop.
const MAX_PAGES = 10;

export function chamberOf(billNumber) {
  const n = String(billNumber).trim().toUpperCase();
  if (n.startsWith('H.')) return 'house';
  if (n.startsWith('S.')) return 'senate';
  return null;
}

export function congressGovBillUrl(congress, billType, number) {
  const path = {
    hr: 'house-bill', s: 'senate-bill',
    hjres: 'house-joint-resolution', sjres: 'senate-joint-resolution',
    hconres: 'house-concurrent-resolution', sconres: 'senate-concurrent-resolution',
    hres: 'house-resolution', sres: 'senate-resolution'
  }[billType];
  return `https://www.congress.gov/bill/${congress}th-congress/${path}/${number}`;
}

// Display order, no title or party tag: "Hakeem S. Jeffries". The page adds Rep./Sen./Del.
export function displayName({ firstName, middleName, lastName, suffixName }) {
  return [firstName, middleName, lastName, suffixName].filter(Boolean).join(' ').trim();
}

// "Del. Norton, Eleanor Holmes [D-DC-At Large]" → "Eleanor Holmes Norton". Used only where
// the record has no first/last fields (the GovInfo archive's sponsor rows).
export function nameFromFullName(fullName = '') {
  const core = String(fullName)
    .replace(/\s*\[[^\]]*\]\s*$/, '')
    .replace(/^(Rep|Sen|Del|Resident Commissioner|Res\. Comm|Commish)\.?\s+/i, '')
    .trim();
  const [last, rest] = core.split(/,\s*/);
  return rest ? `${rest} ${last}`.trim() : core;
}

export function sponsorRecord(raw) {
  if (!raw?.bioguideId) return null;
  return {
    bioguideId: raw.bioguideId,
    name: raw.firstName ? displayName(raw) : nameFromFullName(raw.fullName),
    party: raw.party || null,
    state: raw.state || null,
    district: Number.isInteger(raw.district) ? raw.district : null
  };
}

function cosponsorRecord(raw) {
  return {
    bioguideId: raw.bioguideId,
    name: displayName(raw),
    party: raw.party || null,
    state: raw.state || null,
    district: Number.isInteger(raw.district) ? raw.district : null,
    sponsorshipDate: raw.sponsorshipDate,
    isOriginalCosponsor: raw.isOriginalCosponsor === true
  };
}

/**
 * Fetch one bill's complete cosponsor list, or say exactly why it isn't complete.
 *
 * Completeness, all of which must hold:
 *   - every page arrived (429/5xx retried with backoff) and `pagination.next` was followed
 *     to the end;
 *   - every page reported the same counts (a list that changed mid-walk is not one list);
 *   - kept (not withdrawn) rows === pagination.count, which Congress.gov reports EXCLUDING
 *     withdrawals (verified 2026-11-10 on the 116th H.R. 51: count 227,
 *     countIncludingWithdrawnCosponsors 228, one withdrawal);
 *   - kept + withdrawn === countIncludingWithdrawnCosponsors, i.e. every row was received;
 *   - no Bioguide ID twice (a page boundary that shifted mid-walk duplicates a row);
 *   - every kept row has the fields the page needs.
 *
 * Returns { complete: true, cosponsors, count, withdrawnCount, pages, firstPage }
 *      or { complete: false, reason, firstPage }.
 * `firstPage` is the raw first page (or null), so the caller can still read its count.
 */
export async function fetchFullCosponsorList({ apiBase, congress, billType, number, apiKey, fetchOptions = {} }) {
  const path = `/v3/bill/${congress}/${billType}/${number}/cosponsors`;
  let url = `${apiBase}/bill/${congress}/${billType}/${number}/cosponsors?api_key=${apiKey}&limit=250&format=json`;
  const rows = [];
  const seenUrls = new Set();
  let counts = null;
  let firstPage = null;
  let pages = 0;

  while (url) {
    if (++pages > MAX_PAGES) return { complete: false, reason: `more than ${MAX_PAGES} pages`, firstPage };
    if (seenUrls.has(url)) return { complete: false, reason: 'pagination looped', firstPage };
    seenUrls.add(url);

    const res = await fetchJsonWithRetry(url, fetchOptions);
    if (!res.ok) {
      return { complete: false, reason: `page ${pages}: ${redactKey(res.reason)}`, firstPage };
    }
    const page = res.data || {};
    if (pages === 1) firstPage = page;
    const p = page.pagination || {};
    if (!Number.isInteger(p.count)) {
      return { complete: false, reason: `page ${pages}: no pagination.count`, firstPage };
    }
    const pageCounts = { count: p.count, withWithdrawn: p.countIncludingWithdrawnCosponsors ?? null };
    if (counts && (counts.count !== pageCounts.count || counts.withWithdrawn !== pageCounts.withWithdrawn)) {
      return { complete: false, reason: `counts changed mid-walk (${counts.count}→${pageCounts.count})`, firstPage };
    }
    counts = pageCounts;
    if (!Array.isArray(page.cosponsors)) {
      return { complete: false, reason: `page ${pages}: no cosponsors array`, firstPage };
    }
    rows.push(...page.cosponsors);
    if (p.next) {
      url = withKey(p.next, apiKey, path);
      if (!url) return { complete: false, reason: `page ${pages}: unexpected pagination.next ${redactKey(p.next)}`, firstPage };
    } else {
      url = null;
    }
  }

  const withdrawn = rows.filter(r => r.sponsorshipWithdrawnDate);
  const kept = rows.filter(r => !r.sponsorshipWithdrawnDate);
  if (kept.length !== counts.count) {
    return { complete: false, reason: `kept ${kept.length} ≠ pagination.count ${counts.count}`, firstPage };
  }
  const expectedRows = counts.withWithdrawn ?? counts.count;
  if (rows.length !== expectedRows) {
    return { complete: false, reason: `received ${rows.length} rows (kept ${kept.length} + withdrawn ${withdrawn.length}) ≠ ${expectedRows} expected incl. withdrawn`, firstPage };
  }
  const ids = new Set();
  for (const r of kept) {
    if (!r.bioguideId || !r.state || !r.party || !/^\d{4}-\d{2}-\d{2}$/.test(r.sponsorshipDate || '') || !r.lastName) {
      return { complete: false, reason: `row missing required fields (${r.bioguideId || 'no id'})`, firstPage };
    }
    if (ids.has(r.bioguideId)) return { complete: false, reason: `duplicate row ${r.bioguideId}`, firstPage };
    ids.add(r.bioguideId);
  }

  // Stable order, so an unchanged list produces an unchanged file: join date, then surname.
  kept.sort((a, b) =>
    a.sponsorshipDate.localeCompare(b.sponsorshipDate) ||
    a.lastName.localeCompare(b.lastName) ||
    a.bioguideId.localeCompare(b.bioguideId));

  return {
    complete: true,
    cosponsors: kept.map(cosponsorRecord),
    count: counts.count,
    withdrawnCount: withdrawn.length,
    pages,
    firstPage
  };
}

/**
 * Next stored record for one flagship entry.
 *   complete fetch → a fresh record, stamped checkedAt = now;
 *   anything else  → the previous record untouched (its list, its checkedAt), plus a
 *                    lastFailure note. Never stamps an incomplete list as checked.
 * A first-ever failure stores an explicit incomplete record with no list and no checkedAt.
 */
export function nextStoreRecord({ previous, entry, billMeta, fetchResult, now }) {
  if (fetchResult?.complete && billMeta) {
    return {
      id: entry.id,
      congress: entry.congress,
      billNumber: entry.billNumbers[0],
      chamber: chamberOf(entry.billNumbers[0]),
      title: billMeta.title || entry.title,
      sponsor: billMeta.sponsor,
      introducedDate: billMeta.introducedDate,
      latestAction: billMeta.latestAction,
      congressGovUrl: billMeta.congressGovUrl,
      complete: true,
      checkedAt: now,
      withdrawnCount: fetchResult.withdrawnCount,
      cosponsors: fetchResult.cosponsors
    };
  }
  const reason = fetchResult?.reason || 'bill record not fetched';
  if (previous) {
    return { ...previous, lastFailure: { at: now, reason: redactKey(reason) } };
  }
  return {
    id: entry.id,
    congress: entry.congress,
    billNumber: entry.billNumbers[0],
    chamber: chamberOf(entry.billNumbers[0]),
    title: entry.title,
    complete: false,
    cosponsors: [],
    lastFailure: { at: now, reason: redactKey(reason) }
  };
}

export function computeTotals(cosponsors, chamber) {
  const byParty = {};
  const byState = {};
  let original = 0;
  let nonVoting = 0;
  for (const c of cosponsors) {
    byParty[c.party] = (byParty[c.party] || 0) + 1;
    byState[c.state] = (byState[c.state] || 0) + 1;
    if (c.isOriginalCosponsor) original++;
    if (chamber === 'house' && NON_VOTING_STATES.has(c.state)) nonVoting++;
  }
  const sortKeys = obj => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
  return { cosponsors: cosponsors.length, original, nonVoting, byParty: sortKeys(byParty), byState: sortKeys(byState) };
}

/**
 * The published payload. One row per flagship entry in bills.json, House first.
 * `current` is true only for an entry in the Congress the tracker is checking now: after
 * the switch, the 119th rows stay published with their last checkedAt and current: false,
 * and are never re-stamped by a 120th-Congress check (Codex PRD review, finding 6).
 */
export function buildStatehoodPayload({ store, billsData, currentCongress, generatedAt }) {
  const flagships = (billsData.supportBills || []).filter(b => b.flagship === true);
  const rows = flagships.map(entry => {
    const rec = store.bills?.[entry.id];
    const chamber = chamberOf(entry.billNumbers[0]);
    const complete = rec?.complete === true;
    const cosponsors = complete ? rec.cosponsors : [];
    const row = {
      id: entry.id,
      chamber,
      congress: entry.congress,
      billNumber: entry.billNumbers[0],
      current: entry.congress === currentCongress,
      title: rec?.title || entry.title,
      sponsor: rec?.sponsor || null,
      introducedDate: rec?.introducedDate || entry.status?.introducedDate || null,
      latestAction: rec?.latestAction || null,
      congressGovUrl: rec?.congressGovUrl || entry.congressGovLink || null,
      complete
    };
    if (complete) row.checkedAt = rec.checkedAt;
    row.cosponsors = cosponsors;
    // Unavailable is not zero: without a complete list there are no totals to state.
    row.totals = complete ? computeTotals(cosponsors, chamber) : null;
    return row;
  });
  const order = { house: 0, senate: 1 };
  rows.sort((a, b) => (b.congress - a.congress) || (order[a.chamber] - order[b.chamber]));
  return {
    generatedAt,
    source: 'Congress.gov API, bill cosponsors endpoint (withdrawn cosponsors excluded), checked daily by the bill tracker',
    bills: rows
  };
}

#!/usr/bin/env node

/**
 * Congress.gov Bill Discovery Script
 * Searches for DC-related bills not yet tracked in bills.json
 * Uses three discovery channels: committee-based, title scanning, and subject-based
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { CURRENT_CONGRESS } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const CONGRESS_NUMBER = CURRENT_CONGRESS;
const API_BASE_URL = 'https://api.congress.gov/v3';
const RATE_LIMIT_MS = 300;

// CLI flags
const args = process.argv.slice(2);
const FULL_SCAN = args.includes('--full');
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

// Paths
const billsPath = join(__dirname, '../src/data/bills.json');
const lastRunPath = join(__dirname, '../.discover-last-run.json');
const metaPath = join(__dirname, '../discovery-meta.json');

// Channel health. Discovery must fail CLOSED: a lost channel or truncated scan is a
// failed run, never a quiet "zero candidates" run — that distinction is what let the
// pipeline die silently for three weeks in 2026-07/08.
const health = {
  committees: { attempted: 0, completed: 0, errors: [] },
  titleScan: { attempted: 0, completed: 0, errors: [], perType: {} },
  detailFetchFailures: [],
  validationFailures: [],
  notes: []
};

// The title scan is the load-bearing channel: any error there fails the run.
// Committee, detail-fetch, or validation failures degrade it. Both verdicts block
// the freshness stamp and the workflow's commit/deploy — a partially-blind scan
// must never look healthy to the staleness watchdog.
function healthVerdict() {
  const checkFailed = health.titleScan.errors.length > 0;
  const degraded = checkFailed || health.committees.errors.length > 0
    || health.detailFetchFailures.length > 0
    || health.validationFailures.length > 0;
  return { checkFailed, degraded };
}

// Written on EVERY exit path (healthy, degraded, early-exit, fatal) so the workflow
// email always has something truthful to say. Counts of what was actually added come
// from the validated list, never from pre-validation scoring.
function writeMeta({ autoAddCandidates = [], validatedAdds = [], validationFailures = [],
                     review = [], skipped = [], earlyExit = null, fatalError = null } = {}) {
  const { checkFailed, degraded } = healthVerdict();
  const tier = e => ({ displayNumber: e.displayNumber, title: e.title, score: e.score,
    url: `https://www.congress.gov/bill/${CONGRESS_NUMBER}th-congress/${{
      hr: 'house-bill', s: 'senate-bill', hjres: 'house-joint-resolution',
      sjres: 'senate-joint-resolution', hconres: 'house-concurrent-resolution',
      sconres: 'senate-concurrent-resolution', hres: 'house-resolution',
      sres: 'senate-resolution'
    }[e.billType] || e.billType}/${e.number}` });
  writeFileSync(metaPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    dryRun: DRY_RUN,
    checkFailed: Boolean(checkFailed || fatalError),
    degraded: Boolean(degraded || fatalError),
    fatalError,
    earlyExit,
    channels: { committees: health.committees, titleScan: health.titleScan },
    detailFetchFailures: health.detailFetchFailures,
    autoAddCandidatesCount: autoAddCandidates.length,
    // Full candidate rows, not just a count — a dry run has no validatedAdds, and its
    // email must still show what WOULD have been added.
    autoAddCandidates: autoAddCandidates.map(tier),
    validatedAdds: validatedAdds.map(tier),
    validationFailures: validationFailures.map(tier),
    review: review.map(tier),
    skippedCount: skipped.length,
    notes: health.notes
  }, null, 2));
  console.log(`💾 Meta saved to: ${metaPath}`);
}

// DC-relevant committees (chamber required for correct API URL format).
// `titleFilter`: the parent committees carry their ENTIRE dockets (the five together
// listed 1,775 bills on 2026-08-14, which blew the job timeout evaluating them), so
// their candidates must pass the DC title patterns before the expensive detail fetch.
// Only the DC subcommittee's docket is inherently DC-relevant and goes through whole.
const DC_COMMITTEES = [
  { code: 'hsgo10', chamber: 'house', name: 'House Oversight - DC Subcommittee', titleFilter: false },
  { code: 'hsgo00', chamber: 'house', name: 'House Oversight (parent)', titleFilter: true },
  { code: 'ssga00', chamber: 'senate', name: 'Senate HSGAC', titleFilter: true },
  { code: 'hsap00', chamber: 'house', name: 'House Appropriations', titleFilter: true },
  { code: 'ssap00', chamber: 'senate', name: 'Senate Appropriations', titleFilter: true }
];

// Bill types to scan
const BILL_TYPES = ['hr', 's', 'hjres', 'sjres'];

// DC keyword patterns (positive signals)
const DC_POSITIVE_PATTERNS = [
  /district\s+of\s+columbia/i,
  /\bD\.C\.(?!\w)/i,
  /\bDC\b(?!\s*(Comics?|power|current|voltage|motor|circuit|Universe))/,
  /home\s+rule/i,
  /DC\s+Council/i,
  /DC\s+Mayor/i,
  /DC\s+government/i,
  /Washington,?\s+D\.?C\.?/i
];

// Negative signals (likely not DC-targeted)
const DC_NEGATIVE_PATTERNS = [
  /washington\s+state/i,
  /DC\s+Comics/i,
  /DC\s+(power|current|voltage|motor|circuit)/i,
  /direct\s+current/i
];

// Non-authoritative hint only — surfaced in review-provisional.js's --report
// as a "look closer" flag for the human reviewer, never auto-classified.
// Matches recurring structural sign-offs Congress performs on an existing
// schedule (e.g. S. 1077, the DC Local Funds Act) — candidates for
// position: "routine" rather than "oppose". See METHODOLOGY.md.
const ROUTINE_HINT_PATTERNS = [
  /local\s+funds\s+act/i,
  /interim\s+appropriations/i,
  /continuing\s+appropriations/i,
  /budget\s+act/i
];

// Parse bill number to API format (duplicated from monitor-bills.js)
function parseBillNumber(billNumber) {
  const match = billNumber.match(/(H\.R\.|S\.|H\.J\.Res\.|S\.J\.Res\.|H\.Con\.Res\.|S\.Con\.Res\.)\s*(\d+)/i);
  if (!match) return null;

  const [, type, number] = match;
  let billType = '';

  if (type.toLowerCase().includes('h.r.')) billType = 'hr';
  else if (type.toLowerCase().includes('s.') && !type.toLowerCase().includes('res')) billType = 's';
  else if (type.toLowerCase().includes('h.j.res')) billType = 'hjres';
  else if (type.toLowerCase().includes('s.j.res')) billType = 'sjres';
  else if (type.toLowerCase().includes('h.con.res')) billType = 'hconres';
  else if (type.toLowerCase().includes('s.con.res')) billType = 'sconres';

  return { billType, number };
}

// Normalize a bill identifier to "type+number" format (e.g., "hr1234")
function normalizeBillId(billType, number) {
  return `${billType}${number}`;
}

// Format bill type for display (e.g., "hr" -> "H.R.", "sjres" -> "S.J.Res.")
function formatBillType(billType) {
  const map = {
    hr: 'H.R.',
    s: 'S.',
    hjres: 'H.J.Res.',
    sjres: 'S.J.Res.',
    hconres: 'H.Con.Res.',
    sconres: 'S.Con.Res.',
    hres: 'H.Res.',
    sres: 'S.Res.'
  };
  return map[billType] || billType.toUpperCase();
}

function log(msg) {
  if (VERBOSE) console.log(msg);
}

// Rate-limited fetch
let lastFetchTime = 0;
async function rateLimitedFetch(url) {
  const now = Date.now();
  const elapsed = now - lastFetchTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
  }
  lastFetchTime = Date.now();

  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 429) {
      console.log('  ⚠️  Rate limited, waiting 2s...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      const retry = await fetch(url);
      if (!retry.ok) {
        throw new Error(`API error after 429 retry: ${retry.status} ${retry.statusText}`);
      }
      return retry;
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response;
}

// A tracked id must read as a real legislative identifier. This keeps non-bill
// arrays (e.g. `categories`, whose ids are slugs like "crime") out of the set.
const LEGISLATIVE_ID_RE = /^(hr|s|hjres|sjres|hconres|sconres|hres|sres)\d+$/;

// Build set of all tracked bill IDs.
//
// Derived dynamically from EVERY top-level array in bills.json, judging each entry
// on its own, instead of a hardcoded section list. The hardcoded list is how the
// 2026-07/08 discovery outage happened: `routineBills` was added (2026-07-21)
// without updating this function, so S. 1077 was "rediscovered" weekly, auto-added
// as a duplicate, and the lint gate failed every run before commit or email.
function buildTrackedSet(billsData) {
  const tracked = new Set();

  for (const [section, value] of Object.entries(billsData)) {
    if (!Array.isArray(value)) continue;

    for (const entry of value) {
      if (typeof entry !== 'object' || entry === null) continue;

      let usable = false;

      if (typeof entry.id === 'string' && LEGISLATIVE_ID_RE.test(entry.id.toLowerCase())) {
        tracked.add(entry.id.toLowerCase());
        usable = true;
      }

      for (const bn of entry.billNumbers || []) {
        const parsed = parseBillNumber(bn);
        if (parsed) {
          tracked.add(normalizeBillId(parsed.billType, parsed.number));
          usable = true;
        }
      }

      // Only warn for entries that look like bills (carry bill-ish fields) yet
      // yielded no identity — a category or metadata entry stays silent.
      if (!usable && (entry.billNumbers || entry.status || entry.position)) {
        console.log(`  ⚠️  ${section}: entry without a usable bill identity (id: ${entry.id ?? 'none'})`);
      }
    }
  }

  return tracked;
}

// Get the date to filter from (for incremental scans)
function getFromDate() {
  if (FULL_SCAN) return null;

  try {
    if (existsSync(lastRunPath)) {
      const lastRun = JSON.parse(readFileSync(lastRunPath, 'utf-8'));
      if (lastRun.lastRun) {
        log(`  Using last run date: ${lastRun.lastRun}`);
        // Stamp may be a full ISO instant; the URL builder appends T00:00:00Z, so
        // hand back the date part (conservatively re-scans the stamped day).
        return lastRun.lastRun.split('T')[0];
      }
    }
  } catch {
    // Fall through to default
  }

  // Default: scan last 30 days
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
}

// Save last run timestamp — full ISO instant (a date-only stamp parses as midnight
// UTC and overstates age ~12h against the noon-UTC cron). Callers must only invoke
// this after a fully healthy LIVE scan: a dry, degraded, or failed run must not
// advance freshness, or the staleness watchdog reads a broken pipeline as healthy.
function saveLastRun() {
  const data = { lastRun: new Date().toISOString() };
  writeFileSync(lastRunPath, JSON.stringify(data, null, 2));
}

// ============================================================
// DISCOVERY CHANNEL 1: Committee-based
// ============================================================
async function discoverFromCommittees() {
  console.log('\n📋 Channel 1: Committee-based discovery');
  const candidates = new Map();

  for (const committee of DC_COMMITTEES) {
    log(`  Checking ${committee.name} (${committee.code})...`);
    health.committees.attempted++;

    let offset = 0;
    const limit = 250;
    let hasMore = true;
    let committeeBillCount = 0;
    let committeeFailed = false;

    while (hasMore) {
      try {
        // No `sort` param — this endpoint doesn't support it — so we must paginate
        // through the whole list rather than assume recent bills sort first.
        // Route per the documented API: /committee/{chamber}/{code}/bills — there is
        // NO congress segment on the bills sub-endpoint. The previous URL included
        // one and 404'd for every committee, silently zeroing this whole channel.
        const url = `${API_BASE_URL}/committee/${committee.chamber}/${committee.code}/bills?api_key=${CONGRESS_API_KEY}&limit=${limit}&offset=${offset}`;
        const response = await rateLimitedFetch(url);
        const data = await response.json();
        // This endpoint nests its list under "committee-bills" — reading data.bills
        // silently yielded 0 for every committee (found live 2026-08-14).
        const bills = data['committee-bills']?.bills || data.bills || [];

        committeeBillCount += bills.length;

        for (const bill of bills) {
          // Only look at current congress
          if (bill.congress !== CONGRESS_NUMBER) continue;

          const billType = bill.type?.toLowerCase();
          const number = bill.number?.toString();
          if (!billType || !number) continue;

          // Parent-committee dockets are mostly not DC bills — gate them on the DC
          // title patterns so evaluation stays bounded.
          if (committee.titleFilter) {
            const title = bill.title || '';
            const positive = DC_POSITIVE_PATTERNS.some(p => p.test(title));
            const negative = DC_NEGATIVE_PATTERNS.some(p => p.test(title));
            if (!positive || negative) continue;
          }

          const id = normalizeBillId(billType, number);
          if (!candidates.has(id)) {
            candidates.set(id, {
              billType,
              number,
              title: bill.title || '',
              source: [committee.name]
            });
          } else {
            candidates.get(id).source.push(committee.name);
          }
        }

        // Stop paginating once we get a short page back — no cap on total
        // offset here (unlike title-scan) since a single committee's full
        // bill list for one Congress is a bounded, much smaller set.
        if (bills.length < limit) {
          hasMore = false;
        } else {
          offset += limit;
        }
      } catch (error) {
        console.log(`  ⚠️  Error querying ${committee.name} at offset ${offset}: ${error.message}`);
        health.committees.errors.push({ committee: committee.code, offset, reason: error.message });
        committeeFailed = true;
        hasMore = false;

        // A 404 on a subcommittee code usually means the code itself is wrong or
        // retired. Ask the parent committee what its subcommittees actually are, so
        // the report shows the fix instead of a bare error.
        if (/404/.test(error.message) && committee.code.length > 6) {
          try {
            const parentCode = committee.code.slice(0, 6).replace(/\d\d$/, '00');
            const parentUrl = `${API_BASE_URL}/committee/${committee.chamber}/${parentCode}?api_key=${CONGRESS_API_KEY}`;
            const parentRes = await rateLimitedFetch(parentUrl);
            const parentData = await parentRes.json();
            const subs = (parentData.committee?.subcommittees || []).map(s => `${s.systemCode}: ${s.name}`);
            health.notes.push(`Subcommittees of ${parentCode}: ${subs.join('; ') || 'none listed'}`);
            console.log(`    ℹ️  Valid subcommittees of ${parentCode}: ${subs.join('; ') || 'none listed'}`);
          } catch {
            log('    Could not fetch parent committee for subcommittee validation');
          }
        }
      }
    }

    if (!committeeFailed) health.committees.completed++;
    log(`    Found ${committeeBillCount} bills`);
  }

  console.log(`  Found ${candidates.size} candidates from committees`);
  return candidates;
}

// ============================================================
// DISCOVERY CHANNEL 2: Bill title scanning
// ============================================================
// Sort ASCENDING by updateDate. Under offset pagination with a mutating sort key,
// desc order can silently SKIP a bill: any bill updated mid-scan jumps toward page 0,
// behind the cursor, never seen. Under asc order an updated bill moves toward the END
// (ahead of the cursor) — worst case it is seen twice, and the Map dedupes that.
// Suspected cause of the S. 5147 miss on 2026-08-10 (present in the list, absent from
// every scanned page).
const TITLE_SCAN_SORT = 'updateDate+asc';

// Verify the API actually honors ascending sort before trusting a scan to it — the
// value is documented, but the OpenAPI spec doesn't attach `sort` to this path, so
// fail closed rather than assume. Strictness requirements: every sampled bill must
// carry a parseable updateDate, the sequence must be non-decreasing, and the sample
// must contain at least two DISTINCT values — an all-equal (or empty-dated) sample
// proves nothing about ordering.
async function preflightAscSort(billType) {
  const url = `${API_BASE_URL}/bill/${CONGRESS_NUMBER}/${billType}?api_key=${CONGRESS_API_KEY}&limit=20&sort=${TITLE_SCAN_SORT}`;
  const response = await rateLimitedFetch(url);
  const data = await response.json();
  const bills = data.bills || [];
  if (bills.length < 2) throw new Error(`${billType} preflight returned fewer than 2 bills`);
  const dates = bills.map(b => b.updateDate);
  if (dates.some(d => !d || Number.isNaN(Date.parse(d)))) {
    throw new Error(`${billType} preflight: missing/unparseable updateDate in sample`);
  }
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] < dates[i - 1]) {
      throw new Error(`${billType}: sort=${TITLE_SCAN_SORT} not honored (${dates[i - 1]} then ${dates[i]})`);
    }
  }
  if (new Set(dates).size < 2) {
    throw new Error(`${billType} preflight: sample has no distinct updateDates — cannot confirm ordering`);
  }
  log(`  Preflight OK (${billType}): ascending updateDate confirmed (${dates[0]} → ${dates[dates.length - 1]})`);
}

// Shared title test for the walk and the reconciliation probe — one derivation.
function considerTitleCandidate(candidates, billType, number, title, source) {
  const matchesPositive = DC_POSITIVE_PATTERNS.some(p => p.test(title));
  const matchesNegative = DC_NEGATIVE_PATTERNS.some(p => p.test(title));
  if (matchesPositive && !matchesNegative) {
    const id = normalizeBillId(billType, number);
    if (!candidates.has(id)) {
      candidates.set(id, { billType, number: String(number), title, source: [source] });
    }
  }
}

// The Congress.gov list endpoint drops a small, varying subset of bills from paginated
// walks (measured live 2026-08-14: 26 of 10,108 hr bills, 5 of 5,367 s bills; the
// dropped set differs between runs — it hid the helmet bills on one day and S. 5147 on
// another). Bill numbers are dense (every introduced bill takes the next integer), so
// the walk can be reconciled exactly:
//  1. one newest-updated head page catches bills numbered above the walk's max
//     (recently introduced ⇒ recently updated), then
//  2. every unseen number in 1..max is probed directly — 404 means the number was
//     reserved/never used (not an error); 200 recovers a dropped bill.
async function reconcileTitleScan(billType, seenNumbers, candidates) {
  const headUrl = `${API_BASE_URL}/bill/${CONGRESS_NUMBER}/${billType}?api_key=${CONGRESS_API_KEY}&limit=250&sort=updateDate+desc`;
  const headData = await (await rateLimitedFetch(headUrl)).json();
  for (const bill of headData.bills || []) {
    const number = Number(bill.number);
    if (!Number.isInteger(number) || seenNumbers.has(number)) continue;
    seenNumbers.add(number);
    considerTitleCandidate(candidates, billType, number, bill.title || '', 'title-scan-reconcile');
  }

  const max = Math.max(...seenNumbers);
  const gaps = [];
  for (let n = 1; n <= max; n++) {
    if (!seenNumbers.has(n)) gaps.push(n);
  }
  // Reserved-but-unused numbers 404 harmlessly, but an explosion of gaps means the
  // walk lost far more than the API's known flakiness — fail closed instead of
  // hammering the API.
  const PROBE_CAP = 300;
  if (gaps.length > PROBE_CAP) {
    throw new Error(`${gaps.length} number gaps exceeds probe cap ${PROBE_CAP}`);
  }
  let recovered = 0;
  for (const n of gaps) {
    const url = `${API_BASE_URL}/bill/${CONGRESS_NUMBER}/${billType}/${n}?api_key=${CONGRESS_API_KEY}`;
    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
    const res = await fetch(url);
    if (res.status === 404) continue; // number never used
    if (!res.ok) throw new Error(`probe of ${billType} ${n} failed: HTTP ${res.status}`);
    const bill = (await res.json()).bill;
    seenNumbers.add(n);
    recovered++;
    considerTitleCandidate(candidates, billType, n, bill?.title || '', 'title-scan-reconcile');
  }
  log(`    Reconciled ${billType}: probed ${gaps.length} gaps, recovered ${recovered} dropped bills`);
  return { probed: gaps.length, recovered };
}

async function discoverFromTitleScan(fromDate) {
  console.log('\n🔍 Channel 2: Title scanning');
  const candidates = new Map();

  for (const billType of BILL_TYPES) {
    log(`  Scanning ${billType} bills...`);
    health.titleScan.attempted++;

    // Per-type preflight: each endpoint must prove it honors ascending sort before
    // its scan is trusted; a failed preflight fails that type's scan closed.
    try {
      await preflightAscSort(billType);
    } catch (error) {
      console.log(`  ❌ ${billType} ascending-sort preflight failed: ${error.message}`);
      health.titleScan.errors.push({ billType, phase: 'preflight', reason: error.message });
      continue;
    }

    let offset = 0;
    const limit = 250;
    let hasMore = true;
    let scanFailed = false;
    const seenIds = new Set();
    const seenNumbers = new Set();
    let apiCount = null;
    let pages = 0;
    // Hard bound against a pagination loop; generous vs the ~11k bills/Congress.
    const MAX_OFFSET = 30000;

    while (hasMore) {
      try {
        let url = `${API_BASE_URL}/bill/${CONGRESS_NUMBER}/${billType}?api_key=${CONGRESS_API_KEY}&limit=${limit}&offset=${offset}&sort=${TITLE_SCAN_SORT}`;
        if (fromDate) {
          url += `&fromDateTime=${fromDate}T00:00:00Z`;
        }

        const response = await rateLimitedFetch(url);
        const data = await response.json();
        const bills = data.bills || [];
        pages++;
        if (apiCount === null) apiCount = data.pagination?.count ?? null;

        log(`    Fetched ${bills.length} ${billType} bills (offset ${offset})`);

        for (const bill of bills) {
          const title = bill.title || '';
          const number = bill.number?.toString();
          if (!number) continue;
          seenIds.add(normalizeBillId(billType, number));
          if (Number.isInteger(Number(number))) seenNumbers.add(Number(number));

          considerTitleCandidate(candidates, billType, number, title, 'title-scan');
        }

        // Follow the API's own pagination signal rather than the short-page
        // heuristic — Congress.gov has a documented history of list anomalies, and
        // a malformed page that parses as [] must read as an error, not end-of-data.
        if (data.pagination?.next && offset + limit < MAX_OFFSET) {
          offset += limit;
        } else if (data.pagination?.next) {
          throw new Error(`scan truncated at safety cap (offset ${offset}, pagination.next still present)`);
        } else if (bills.length === 0 && offset === 0 && (apiCount ?? 0) > 0) {
          throw new Error(`empty first page but pagination.count=${apiCount}`);
        } else {
          hasMore = false;
        }
      } catch (error) {
        console.log(`  ❌ Error scanning ${billType} at offset ${offset}: ${error.message}`);
        health.titleScan.errors.push({ billType, offset, reason: error.message });
        scanFailed = true;
        hasMore = false;
      }
    }

    // Invariant: we must end up knowing at least as many unique bills as the API said
    // existed when we started (new bills arriving mid-scan can only add). The list
    // endpoint drops a small varying subset per walk, so a shortfall goes through the
    // exact number-gap reconciliation first; only an unreconcilable shortfall fails
    // the scan. Skipped for date-filtered scans, where numbers aren't dense.
    let reconcile = null;
    if (!scanFailed && !fromDate && apiCount !== null && seenNumbers.size < apiCount) {
      console.log(`  ⚠️  ${billType}: walk saw ${seenNumbers.size} unique bills, API counts ${apiCount} — reconciling`);
      try {
        reconcile = await reconcileTitleScan(billType, seenNumbers, candidates);
        if (seenNumbers.size < apiCount) {
          throw new Error(`still short after reconciliation: ${seenNumbers.size} < ${apiCount}`);
        }
        console.log(`  ✅ ${billType}: reconciled (probed ${reconcile.probed}, recovered ${reconcile.recovered})`);
      } catch (error) {
        const msg = `reconciliation failed: ${error.message}`;
        console.log(`  ❌ ${billType}: ${msg}`);
        health.titleScan.errors.push({ billType, reason: msg });
        scanFailed = true;
      }
    }

    health.titleScan.perType[billType] = {
      pages, apiCount, uniqueSeen: seenNumbers.size,
      ...(reconcile ? { probed: reconcile.probed, recovered: reconcile.recovered } : {})
    };
    if (!scanFailed) health.titleScan.completed++;
  }

  console.log(`  Found ${candidates.size} candidates from title scanning`);
  return candidates;
}

// ============================================================
// DISCOVERY CHANNEL 3: Subject-based
// ============================================================
async function discoverFromSubject() {
  console.log('\n🏷️  Channel 3: Subject-based discovery');
  const candidates = new Map();

  try {
    let offset = 0;
    const limit = 250;
    let hasMore = true;

    while (hasMore) {
      const url = `${API_BASE_URL}/bill?api_key=${CONGRESS_API_KEY}&limit=${limit}&offset=${offset}&congress=${CONGRESS_NUMBER}`;
      // The subject endpoint is per-bill, so we query bills and check subjects
      // Actually, we can search by subject directly
      const subjectUrl = `${API_BASE_URL}/bill/${CONGRESS_NUMBER}?api_key=${CONGRESS_API_KEY}&limit=${limit}&offset=${offset}&sort=updateDate+desc`;

      // Congress.gov API doesn't have a direct subject search endpoint for bill listing
      // Instead, we'll use the subject endpoint to find bills tagged with "District of Columbia"
      const searchUrl = `${API_BASE_URL}/bill?api_key=${CONGRESS_API_KEY}&limit=${limit}&offset=${offset}&congress=${CONGRESS_NUMBER}&sort=updateDate+desc`;

      try {
        const response = await rateLimitedFetch(searchUrl);
        const data = await response.json();
        const bills = data.bills || [];

        if (bills.length === 0) {
          hasMore = false;
          break;
        }

        // For subject-based, we need to check each bill's subjects
        // This is expensive, so we'll only check bills that look relevant from title
        // and bills from committees. The subject check happens in the detail fetch phase.
        // For this channel, we use a more targeted approach.

        hasMore = false; // We'll handle this differently
      } catch (error) {
        console.log(`  ⚠️  Error in subject search: ${error.message}`);
        hasMore = false;
      }
    }
  } catch (error) {
    console.log(`  ⚠️  Subject channel error: ${error.message}`);
  }

  // Alternative: Use the subjects endpoint directly
  try {
    const subjectUrl = `${API_BASE_URL}/bill/${CONGRESS_NUMBER}?api_key=${CONGRESS_API_KEY}&limit=250&sort=updateDate+desc`;
    // We'll check subjects during the detail-fetch phase instead
    // The subject channel primarily works by adding bonus score during scoring
    log('  Subject matching will be applied during detail-fetch scoring phase');
  } catch {
    // Ignore
  }

  console.log(`  Subject scoring will be applied during candidate evaluation`);
  return candidates;
}

// ============================================================
// FETCH FULL BILL DETAILS FOR SCORING
// ============================================================
async function fetchCandidateDetails(billType, number) {
  const billUrl = `${API_BASE_URL}/bill/${CONGRESS_NUMBER}/${billType}/${number}?api_key=${CONGRESS_API_KEY}`;

  try {
    const response = await rateLimitedFetch(billUrl);
    const data = await response.json();
    const bill = data.bill;

    // Fetch subjects
    let subjects = [];
    try {
      const subjectsUrl = `${API_BASE_URL}/bill/${CONGRESS_NUMBER}/${billType}/${number}/subjects?api_key=${CONGRESS_API_KEY}`;
      const subjectsResponse = await rateLimitedFetch(subjectsUrl);
      const subjectsData = await subjectsResponse.json();
      subjects = subjectsData.subjects?.legislativeSubjects?.map(s => s.name) || [];
      if (subjectsData.subjects?.policyArea?.name) {
        subjects.push(subjectsData.subjects.policyArea.name);
      }
    } catch {
      log(`    ⚠️  Could not fetch subjects`);
    }

    // Fetch summary
    let summary = '';
    try {
      const summaryUrl = `${API_BASE_URL}/bill/${CONGRESS_NUMBER}/${billType}/${number}/summaries?api_key=${CONGRESS_API_KEY}`;
      const summaryResponse = await rateLimitedFetch(summaryUrl);
      const summaryData = await summaryResponse.json();
      const summaries = summaryData.summaries || [];
      if (summaries.length > 0) {
        // Get the most recent summary, strip HTML
        summary = summaries[summaries.length - 1].text?.replace(/<[^>]+>/g, '') || '';
      }
    } catch {
      log(`    ⚠️  Could not fetch summary`);
    }

    // Fetch cosponsors count
    let cosponsorsCount = 0;
    try {
      const cosponsorsUrl = `${API_BASE_URL}/bill/${CONGRESS_NUMBER}/${billType}/${number}/cosponsors?api_key=${CONGRESS_API_KEY}`;
      const cosponsorsResponse = await rateLimitedFetch(cosponsorsUrl);
      const cosponsorsData = await cosponsorsResponse.json();
      cosponsorsCount = cosponsorsData.pagination?.count || 0;
    } catch {
      log(`    ⚠️  Could not fetch cosponsors`);
    }

    // Fetch committees from sub-endpoint (main bill endpoint returns a reference object, not an array)
    let committees = [];
    try {
      const committeesUrl = `${API_BASE_URL}/bill/${CONGRESS_NUMBER}/${billType}/${number}/committees?api_key=${CONGRESS_API_KEY}`;
      const committeesResponse = await rateLimitedFetch(committeesUrl);
      const committeesData = await committeesResponse.json();
      committees = (committeesData.committees || []).map(c => c.name).filter(Boolean);
    } catch {
      log(`    ⚠️  Could not fetch committees`);
    }

    return {
      title: bill.title || '',
      sponsors: bill.sponsors?.map(s => s.fullName) || [],
      latestAction: bill.latestAction?.text || '',
      latestActionDate: bill.latestAction?.actionDate || null,
      introducedDate: bill.introducedDate || null,
      committees,
      subjects,
      summary,
      cosponsorsCount,
      congressUrl: bill.url || `https://www.congress.gov/bill/${CONGRESS_NUMBER}th-congress/${billType}/${number}`
    };
  } catch (error) {
    log(`    ❌ Error fetching details: ${error.message}`);
    return null;
  }
}

// ============================================================
// RELEVANCE SCORING
// ============================================================
function scoreRelevance(candidate, details) {
  let score = 0;
  const reasons = [];

  const title = details.title || '';
  const summary = details.summary || '';
  const subjects = details.subjects || [];
  const committees = details.committees || [];

  // Title contains "District of Columbia" (+30)
  if (/district\s+of\s+columbia/i.test(title)) {
    score += 30;
    reasons.push('Title: "District of Columbia" (+30)');
  } else if (/\bD\.C\.(?!\w)/i.test(title) || /Washington,?\s+D\.?C\.?/i.test(title)) {
    score += 20;
    reasons.push('Title: DC reference (+20)');
  }

  // Has "District of Columbia" legislative subject (+25)
  if (subjects.some(s => /district\s+of\s+columbia/i.test(s))) {
    score += 25;
    reasons.push('Subject: "District of Columbia" (+25)');
  }

  // Referred to Oversight/HSGAC committee (+15)
  const dcCommitteeNames = ['oversight', 'homeland security and governmental affairs', 'hsgac'];
  if (committees.some(c => dcCommitteeNames.some(name => c.toLowerCase().includes(name)))) {
    score += 15;
    reasons.push('Committee: DC-relevant (+15)');
  }

  // Summary mentions DC terms (+5 per mention, max 20)
  let summaryMentions = 0;
  for (const pattern of DC_POSITIVE_PATTERNS) {
    const matches = summary.match(new RegExp(pattern.source, 'gi'));
    if (matches) summaryMentions += matches.length;
  }
  const summaryScore = Math.min(summaryMentions * 5, 20);
  if (summaryScore > 0) {
    score += summaryScore;
    reasons.push(`Summary: ${summaryMentions} DC mentions (+${summaryScore})`);
  }

  // Summary mentions "home rule" (+15)
  if (/home\s+rule/i.test(summary) || /home\s+rule/i.test(title)) {
    score += 15;
    reasons.push('Mentions "home rule" (+15)');
  }

  // Negative signals - generic exclusions
  if (DC_NEGATIVE_PATTERNS.some(p => p.test(title) || p.test(summary))) {
    score -= 30;
    reasons.push('Negative signal: likely not DC-targeted (-30)');
  }

  // Negative signals - bills that mention DC only as a geographic location
  // (memorials, monuments, federal facilities, commemorative works)
  if (/memorial|commemorative\s+work|monument|mural|statue|plaque/i.test(title)) {
    score -= 40;
    reasons.push('Negative signal: DC-located memorial/monument, not governance-related (-40)');
  }

  // Negative signals - honorary naming/renaming bills (programs, buildings,
  // streets, post offices). Common, high-scoring on DC keywords alone, but
  // not governance-related.
  if (/^\s*to\s+(re)?name\b/i.test(title) || /^\s*to\s+(re)?designate\b/i.test(title)) {
    score -= 40;
    reasons.push('Negative signal: honorary naming/designation bill, not governance-related (-40)');
  }

  // Negative signals - bills that help or restore DC autonomy (pro-DC, not anti-DC)
  if (/terminating\s+the\s+emergency|end\s+the\s+emergency|repeal.*emergency/i.test(title)) {
    score -= 50;
    reasons.push('Negative signal: pro-DC bill terminating federal emergency (-50)');
  }

  // Negative signals - forestry, wildlife, federal lands that incidentally cover DC
  if (/forestry|wildlife\s+restoration|sport\s+fish|McIntire|Pittman.Robertson/i.test(title)) {
    score -= 40;
    reasons.push('Negative signal: federal lands/wildlife bill with incidental DC mention (-40)');
  }

  // Bonus: found by multiple discovery channels
  if (candidate.source && candidate.source.length > 1) {
    score += 5;
    reasons.push(`Multi-channel: ${candidate.source.length} sources (+5)`);
  }

  return { score, reasons };
}

// ============================================================
// BUILD AUTO-ADD BILL ENTRY
// ============================================================
function buildBillEntry(billType, number, details, score) {
  const id = normalizeBillId(billType, number);
  const displayNumber = `${formatBillType(billType)} ${number}`;
  const today = new Date().toISOString().split('T')[0];

  // Build congress.gov link
  const typeSlugMap = {
    hr: 'house-bill',
    s: 'senate-bill',
    hjres: 'house-joint-resolution',
    sjres: 'senate-joint-resolution',
    hconres: 'house-concurrent-resolution',
    sconres: 'senate-concurrent-resolution',
    hres: 'house-resolution',
    sres: 'senate-resolution'
  };
  const typeSlug = typeSlugMap[billType] || billType;
  const congressGovLink = `https://www.congress.gov/bill/${CONGRESS_NUMBER}th-congress/${typeSlug}/${number}`;

  // Truncate summary for description
  let description = 'Auto-discovered.';
  if (details.summary) {
    const truncated = details.summary.length > 300
      ? details.summary.substring(0, 300) + '...'
      : details.summary;
    description += ` ${truncated}`;
  }

  const routineHintText = `${details.title || ''} ${details.summary || ''}`;
  const possibleRoutine = ROUTINE_HINT_PATTERNS.some(p => p.test(routineHintText));

  return {
    id,
    billNumbers: [displayNumber],
    title: details.title || 'Unknown Title',
    sponsors: details.sponsors || [],
    description,
    category: 'other',
    position: 'oppose',
    type: 'bill',
    priority: 'watching',
    prioritySource: 'auto-discovered',
    provisional: true,
    autoDiscovered: true,
    discoveredDate: today,
    relevanceScore: score,
    ...(possibleRoutine ? { provisionalHint: 'possible-routine' } : {}),
    congress: CONGRESS_NUMBER,
    congressValidated: true,
    congressValidatedDate: today,
    congressGovLink,
    status: {
      stage: null,
      lastAction: details.latestAction || 'Unknown',
      lastActionDate: details.latestActionDate || today,
      hasCommitteeHearing: false,
      hasCommitteeMarkup: false,
      hasFloorVote: false,
      cosponsors: details.cosponsorsCount || 0,
      committees: details.committees || []
    },
    attackType: 'unknown'
  };
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('🔎 DC Bill Discovery Script');
  console.log('='.repeat(60));
  console.log(`Mode: ${FULL_SCAN ? 'Full scan' : 'Incremental'} | ${DRY_RUN ? 'Dry run' : 'Live'} | ${VERBOSE ? 'Verbose' : 'Normal'}`);

  if (!CONGRESS_API_KEY) {
    console.error('❌ CONGRESS_API_KEY environment variable not set!');
    console.log('\n📝 To get an API key:');
    console.log('   1. Visit: https://api.congress.gov/sign-up/');
    console.log('   2. Set environment variable: export CONGRESS_API_KEY=your_key_here\n');
    writeMeta({ fatalError: 'CONGRESS_API_KEY not set' });
    process.exit(1);
  }

  // Load current bills and build tracked set
  const billsData = JSON.parse(readFileSync(billsPath, 'utf-8'));
  const trackedSet = buildTrackedSet(billsData);
  console.log(`\n📊 Currently tracking ${trackedSet.size} bill identifiers`);

  const fromDate = getFromDate();
  if (fromDate) {
    console.log(`📅 Scanning bills updated since: ${fromDate}`);
  } else {
    console.log('📅 Full scan of 119th Congress');
  }

  // Run discovery channels
  const allCandidates = new Map();

  // Channel 1: Committee-based
  const committeeCandidates = await discoverFromCommittees();
  for (const [id, candidate] of committeeCandidates) {
    if (allCandidates.has(id)) {
      allCandidates.get(id).source.push(...candidate.source);
    } else {
      allCandidates.set(id, candidate);
    }
  }

  // Channel 2: Title scanning
  const titleCandidates = await discoverFromTitleScan(fromDate);
  for (const [id, candidate] of titleCandidates) {
    if (allCandidates.has(id)) {
      allCandidates.get(id).source.push(...candidate.source);
    } else {
      allCandidates.set(id, candidate);
    }
  }

  // Channel 3: Subject-based (scoring applied during detail fetch)
  await discoverFromSubject();

  console.log(`\n📦 Total unique candidates across all channels: ${allCandidates.size}`);

  // Filter out already-tracked bills
  const newCandidates = new Map();
  let alreadyTrackedCount = 0;

  for (const [id, candidate] of allCandidates) {
    if (trackedSet.has(id)) {
      log(`  ✓ Already tracked: ${formatBillType(candidate.billType)} ${candidate.number}`);
      alreadyTrackedCount++;
    } else {
      newCandidates.set(id, candidate);
    }
  }

  console.log(`\n✅ Already tracked: ${alreadyTrackedCount}`);
  console.log(`🆕 New candidates to evaluate: ${newCandidates.size}`);

  if (newCandidates.size === 0) {
    console.log('\n🎉 No new DC-related bills found. Tracker is up to date!');
    writeMeta({ earlyExit: 'no-new-candidates' });
    const { degraded } = healthVerdict();
    if (!DRY_RUN && !degraded) {
      saveLastRun();
    } else {
      console.log('⚠️  Not stamping lastRun (dry run or degraded/unhealthy scan)');
    }
    return;
  }

  // Fetch details and score each new candidate
  console.log('\n📝 Fetching details and scoring candidates...');

  const results = {
    autoAdd: [],    // Score 40+
    review: [],     // Score 20-39
    skipped: []     // Score <20
  };

  let i = 0;
  for (const [id, candidate] of newCandidates) {
    i++;
    const displayNumber = `${formatBillType(candidate.billType)} ${candidate.number}`;
    console.log(`\n[${i}/${newCandidates.size}] Evaluating ${displayNumber}...`);
    log(`  Title: ${candidate.title}`);
    log(`  Sources: ${candidate.source.join(', ')}`);

    const details = await fetchCandidateDetails(candidate.billType, candidate.number);
    if (!details) {
      console.log(`  ⚠️  Could not fetch details, skipping`);
      health.detailFetchFailures.push({ bill: displayNumber });
      continue;
    }

    const { score, reasons } = scoreRelevance(candidate, details);
    console.log(`  Score: ${score}`);
    if (VERBOSE) {
      reasons.forEach(r => console.log(`    ${r}`));
    }

    const entry = {
      id,
      billType: candidate.billType,
      number: candidate.number,
      displayNumber,
      title: details.title,
      score,
      reasons,
      details,
      candidate
    };

    if (score >= 40) {
      console.log(`  🟢 AUTO-ADD (score ${score})`);
      results.autoAdd.push(entry);
    } else if (score >= 20) {
      console.log(`  🟡 REVIEW NEEDED (score ${score})`);
      results.review.push(entry);
    } else {
      console.log(`  ⚪ SKIPPED (score ${score})`);
      results.skipped.push(entry);
    }
  }

  // Print summary report
  console.log('\n' + '='.repeat(60));
  console.log('📊 DISCOVERY REPORT');
  console.log('='.repeat(60));

  if (results.autoAdd.length > 0) {
    console.log(`\n🟢 AUTO-ADD (${results.autoAdd.length} bills, score 40+):`);
    console.log('-'.repeat(60));
    results.autoAdd.forEach(entry => {
      console.log(`  ${entry.displayNumber} (score: ${entry.score})`);
      console.log(`    ${entry.title}`);
      console.log(`    Sponsors: ${entry.details.sponsors.join(', ') || 'Unknown'}`);
      console.log(`    Cosponsors: ${entry.details.cosponsorsCount}`);
      entry.reasons.forEach(r => console.log(`    • ${r}`));
    });
  }

  if (results.review.length > 0) {
    console.log(`\n🟡 NEEDS REVIEW (${results.review.length} bills, score 20-39):`);
    console.log('-'.repeat(60));
    results.review.forEach(entry => {
      console.log(`  ${entry.displayNumber} (score: ${entry.score})`);
      console.log(`    ${entry.title}`);
      console.log(`    Sponsors: ${entry.details.sponsors.join(', ') || 'Unknown'}`);
      entry.reasons.forEach(r => console.log(`    • ${r}`));
    });
  }

  if (VERBOSE && results.skipped.length > 0) {
    console.log(`\n⚪ SKIPPED (${results.skipped.length} bills, score <20):`);
    console.log('-'.repeat(60));
    results.skipped.forEach(entry => {
      console.log(`  ${entry.displayNumber} (score: ${entry.score}) - ${entry.title}`);
    });
  }

  console.log(`\nSummary: ${results.autoAdd.length} auto-add | ${results.review.length} review | ${results.skipped.length} skipped`);

  // Auto-add high-confidence bills to bills.json
  const validated = [];
  const validationFailures = [];
  if (!DRY_RUN && results.autoAdd.length > 0) {
    console.log('\n🔍 Validating auto-add candidates against Congress.gov...');

    for (const entry of results.autoAdd) {
      const url = `${API_BASE_URL}/bill/${CONGRESS_NUMBER}/${entry.billType}/${entry.number}?api_key=${CONGRESS_API_KEY}`;
      try {
        // rateLimitedFetch, not raw fetch: it status-checks the 429 retry, and any
        // non-OK response throws. A validation failure degrades the run (no stamp,
        // loud email) — otherwise a transient outage here silently drops the very
        // bills the scan exists to catch.
        await rateLimitedFetch(url);
        console.log(`  ✅ ${entry.displayNumber}: confirmed on Congress.gov`);
        validated.push(entry);
      } catch (error) {
        console.log(`  ❌ ${entry.displayNumber}: validation failed (${error.message}) — not added`);
        validationFailures.push(entry);
        health.validationFailures.push({ bill: entry.displayNumber, reason: error.message });
      }
    }

    if (validated.length === 0) {
      console.log('\nNo validated bills to add.');
    } else {
      console.log('\n💾 Adding validated bills to bills.json...');

      // Re-read bills.json to avoid clobbering concurrent edits
      const freshData = JSON.parse(readFileSync(billsPath, 'utf-8'));

      for (const entry of validated) {
        const billEntry = buildBillEntry(entry.billType, entry.number, entry.details, entry.score);
        freshData.bills.push(billEntry);
        console.log(`  ✓ Added ${entry.displayNumber}: ${entry.title}`);
      }

      freshData.lastUpdated = new Date().toISOString().split('T')[0];
      writeFileSync(billsPath, JSON.stringify(freshData, null, 2));
      console.log(`\n💾 Saved ${validated.length} new bills to bills.json`);
    }
  } else if (DRY_RUN && results.autoAdd.length > 0) {
    console.log('\n📋 DRY RUN - would have added these bills to bills.json:');
    results.autoAdd.forEach(entry => {
      console.log(`  ${entry.displayNumber}: ${entry.title}`);
    });
  }

  writeMeta({
    autoAddCandidates: results.autoAdd,
    validatedAdds: validated,
    validationFailures,
    review: results.review,
    skipped: results.skipped
  });

  // Stamp freshness only for a fully healthy live scan — the staleness watchdog
  // reads this stamp, and advancing it on a dry, degraded, or failed run would make
  // a broken pipeline look alive. `degraded` subsumes `checkFailed`.
  const { degraded } = healthVerdict();
  if (!DRY_RUN && !degraded) {
    saveLastRun();
  } else {
    console.log('⚠️  Not stamping lastRun (dry run or degraded/unhealthy scan)');
  }

  console.log('\n✅ Discovery complete!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  try {
    writeMeta({ fatalError: error.message });
  } catch (metaError) {
    console.error('Also failed to write discovery-meta.json:', metaError.message);
  }
  process.exit(1);
});

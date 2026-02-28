#!/usr/bin/env node

/**
 * Congress.gov Bill Discovery Script
 * Searches for DC-related bills not yet tracked in bills.json
 * Uses three discovery channels: committee-based, title scanning, and subject-based
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const CONGRESS_NUMBER = 119;
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

// DC-relevant committees
const DC_COMMITTEES = [
  { code: 'hsgo10', name: 'House Oversight - DC Subcommittee' },
  { code: 'hsgo00', name: 'House Oversight (parent)' },
  { code: 'ssga00', name: 'Senate HSGAC' }
];

// Bill types to scan
const BILL_TYPES = ['hr', 's', 'hjres', 'sjres'];

// DC keyword patterns (positive signals)
const DC_POSITIVE_PATTERNS = [
  /district\s+of\s+columbia/i,
  /\bD\.C\.\b/,
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
    sconres: 'S.Con.Res.'
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
      return fetch(url);
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response;
}

// Build set of all tracked bill IDs
function buildTrackedSet(billsData) {
  const tracked = new Set();

  const allBills = [
    ...(billsData.bills || []),
    ...(billsData.riders || []),
    ...(billsData.supportBills || [])
  ];

  for (const bill of allBills) {
    // Add the bill id directly
    tracked.add(bill.id);

    // Also parse each bill number and add normalized form
    for (const bn of bill.billNumbers || []) {
      const parsed = parseBillNumber(bn);
      if (parsed) {
        tracked.add(normalizeBillId(parsed.billType, parsed.number));
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
        return lastRun.lastRun;
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

// Save last run timestamp
function saveLastRun() {
  const data = { lastRun: new Date().toISOString().split('T')[0] };
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

    try {
      const url = `${API_BASE_URL}/committee/${committee.code}/bills?api_key=${CONGRESS_API_KEY}&limit=250`;
      const response = await rateLimitedFetch(url);
      const data = await response.json();
      const bills = data.bills || [];

      log(`    Found ${bills.length} bills`);

      for (const bill of bills) {
        // Only look at current congress
        if (bill.congress !== CONGRESS_NUMBER) continue;

        const billType = bill.type?.toLowerCase();
        const number = bill.number?.toString();
        if (!billType || !number) continue;

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
    } catch (error) {
      console.log(`  ⚠️  Error querying ${committee.name}: ${error.message}`);
    }
  }

  console.log(`  Found ${candidates.size} candidates from committees`);
  return candidates;
}

// ============================================================
// DISCOVERY CHANNEL 2: Bill title scanning
// ============================================================
async function discoverFromTitleScan(fromDate) {
  console.log('\n🔍 Channel 2: Title scanning');
  const candidates = new Map();

  for (const billType of BILL_TYPES) {
    log(`  Scanning ${billType} bills...`);

    let offset = 0;
    const limit = 250;
    let hasMore = true;

    while (hasMore) {
      try {
        let url = `${API_BASE_URL}/bill/${CONGRESS_NUMBER}/${billType}?api_key=${CONGRESS_API_KEY}&limit=${limit}&offset=${offset}&sort=updateDate+desc`;
        if (fromDate) {
          url += `&fromDateTime=${fromDate}T00:00:00Z`;
        }

        const response = await rateLimitedFetch(url);
        const data = await response.json();
        const bills = data.bills || [];

        log(`    Fetched ${bills.length} ${billType} bills (offset ${offset})`);

        if (bills.length === 0) {
          hasMore = false;
          break;
        }

        for (const bill of bills) {
          const title = bill.title || '';
          const number = bill.number?.toString();
          if (!number) continue;

          // Check if title matches DC patterns
          const matchesPositive = DC_POSITIVE_PATTERNS.some(p => p.test(title));
          const matchesNegative = DC_NEGATIVE_PATTERNS.some(p => p.test(title));

          if (matchesPositive && !matchesNegative) {
            const id = normalizeBillId(billType, number);
            if (!candidates.has(id)) {
              candidates.set(id, {
                billType,
                number,
                title,
                source: ['title-scan']
              });
            }
          }
        }

        // Stop paginating if we got fewer than limit or already scanned a lot
        if (bills.length < limit || offset >= 1000) {
          hasMore = false;
        } else {
          offset += limit;
        }
      } catch (error) {
        console.log(`  ⚠️  Error scanning ${billType} at offset ${offset}: ${error.message}`);
        hasMore = false;
      }
    }
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
  } else if (/\bD\.C\.\b/.test(title) || /Washington,?\s+D\.?C\.?/i.test(title)) {
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

  // Negative signals
  if (DC_NEGATIVE_PATTERNS.some(p => p.test(title) || p.test(summary))) {
    score -= 30;
    reasons.push('Negative signal: likely not DC-targeted (-30)');
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
    sconres: 'senate-concurrent-resolution'
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
    saveLastRun();
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
  if (!DRY_RUN && results.autoAdd.length > 0) {
    console.log('\n💾 Adding high-confidence bills to bills.json...');

    // Re-read bills.json to avoid clobbering concurrent edits
    const freshData = JSON.parse(readFileSync(billsPath, 'utf-8'));

    for (const entry of results.autoAdd) {
      const billEntry = buildBillEntry(entry.billType, entry.number, entry.details, entry.score);
      freshData.bills.push(billEntry);
      console.log(`  ✓ Added ${entry.displayNumber}: ${entry.title}`);
    }

    freshData.lastUpdated = new Date().toISOString().split('T')[0];
    writeFileSync(billsPath, JSON.stringify(freshData, null, 2));
    console.log(`\n💾 Saved ${results.autoAdd.length} new bills to bills.json`);
  } else if (DRY_RUN && results.autoAdd.length > 0) {
    console.log('\n📋 DRY RUN - would have added these bills to bills.json:');
    results.autoAdd.forEach(entry => {
      console.log(`  ${entry.displayNumber}: ${entry.title}`);
    });
  }

  // Save last run timestamp
  saveLastRun();

  console.log('\n✅ Discovery complete!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

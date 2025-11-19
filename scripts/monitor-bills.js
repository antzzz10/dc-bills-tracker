#!/usr/bin/env node

/**
 * Congress.gov Bill Monitoring Script
 * Checks all bills in the tracker for status updates
 * Sends notifications when changes are detected
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const CONGRESS_NUMBER = 119; // 119th Congress (2025-2026)
const API_BASE_URL = 'https://api.congress.gov/v3';

// Load bills data
const billsPath = join(__dirname, '../src/data/bills.json');
const billsData = JSON.parse(readFileSync(billsPath, 'utf-8'));

// Parse bill number to API format
function parseBillNumber(billNumber) {
  const match = billNumber.match(/(H\.R\.|S\.|H\.J\.Res\.|S\.J\.Res\.|H\.Con\.Res\.|S\.Con\.Res\.)\s*(\d+)/i);
  if (!match) return null;

  const [, type, number] = match;

  let billType = '';
  let chamber = '';

  if (type.toLowerCase().includes('h.r.')) {
    billType = 'hr';
    chamber = 'house';
  } else if (type.toLowerCase().includes('s.') && !type.toLowerCase().includes('res')) {
    billType = 's';
    chamber = 'senate';
  } else if (type.toLowerCase().includes('h.j.res')) {
    billType = 'hjres';
    chamber = 'house';
  } else if (type.toLowerCase().includes('s.j.res')) {
    billType = 'sjres';
    chamber = 'senate';
  } else if (type.toLowerCase().includes('h.con.res')) {
    billType = 'hconres';
    chamber = 'house';
  } else if (type.toLowerCase().includes('s.con.res')) {
    billType = 'sconres';
    chamber = 'senate';
  }

  return { billType, number, chamber };
}

// Fetch bill details from Congress.gov API
async function fetchBillStatus(billNumber) {
  const parsed = parseBillNumber(billNumber);
  if (!parsed) {
    console.log(`⚠️  Could not parse bill number: ${billNumber}`);
    return null;
  }

  const { billType, number } = parsed;
  const billUrl = `${API_BASE_URL}/bill/${CONGRESS_NUMBER}/${billType}/${number}?api_key=${CONGRESS_API_KEY}`;
  const actionsUrl = `${API_BASE_URL}/bill/${CONGRESS_NUMBER}/${billType}/${number}/actions?api_key=${CONGRESS_API_KEY}`;
  const cosponsorsUrl = `${API_BASE_URL}/bill/${CONGRESS_NUMBER}/${billType}/${number}/cosponsors?api_key=${CONGRESS_API_KEY}`;

  try {
    // Fetch basic bill info
    const response = await fetch(billUrl);
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`❌ Bill not found in API: ${billNumber}`);
        return null;
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const bill = data.bill;

    // Fetch detailed actions
    let actions = [];
    let hasCommitteeHearing = false;
    let hasCommitteeMarkup = false;
    let hasFloorVote = false;
    let committees = [];

    try {
      const actionsResponse = await fetch(actionsUrl);
      if (actionsResponse.ok) {
        const actionsData = await actionsResponse.json();
        actions = actionsData.actions || [];

        // Analyze actions for significant events
        actions.forEach(action => {
          const actionText = action.text?.toLowerCase() || '';
          const actionType = action.type?.toLowerCase() || '';

          if (actionText.includes('hearing') || actionType.includes('hearing')) {
            hasCommitteeHearing = true;
          }
          if (actionText.includes('markup') || actionText.includes('ordered to be reported')) {
            hasCommitteeMarkup = true;
          }
          if (actionText.includes('floor') || actionText.includes('vote') ||
              actionText.includes('passed') || actionText.includes('failed')) {
            hasFloorVote = true;
          }
        });
      }
    } catch (e) {
      console.log(`  ⚠️  Could not fetch actions for ${billNumber}`);
    }

    // Fetch cosponsors count
    let cosponsorsCount = 0;
    try {
      const cosponsorsResponse = await fetch(cosponsorsUrl);
      if (cosponsorsResponse.ok) {
        const cosponsorsData = await cosponsorsResponse.json();
        cosponsorsCount = cosponsorsData.pagination?.count || 0;
      }
    } catch (e) {
      console.log(`  ⚠️  Could not fetch cosponsors for ${billNumber}`);
    }

    // Extract committee info
    if (bill.committees) {
      committees = bill.committees.map(c => c.name);
    }

    return {
      billNumber,
      title: bill.title,
      latestAction: bill.latestAction?.text || 'No recent action',
      latestActionDate: bill.latestAction?.actionDate || null,
      status: getSimplifiedStatus(bill),
      sponsors: bill.sponsors?.map(s => s.fullName).join(', ') || 'Unknown',
      url: `https://www.congress.gov/bill/${CONGRESS_NUMBER}th-congress/${billType}/${number}`,
      // New fields
      cosponsorsCount,
      hasCommitteeHearing,
      hasCommitteeMarkup,
      hasFloorVote,
      committees,
      introducedDate: bill.introducedDate || null
    };
  } catch (error) {
    console.error(`Error fetching ${billNumber}:`, error.message);
    return null;
  }
}

// Simplify status for comparison
function getSimplifiedStatus(bill) {
  // Determine simplified status based on latest action
  const action = bill.latestAction?.text?.toLowerCase() || '';

  if (action.includes('became public law') || action.includes('signed by president')) {
    return 'ENACTED';
  }
  if (action.includes('passed senate') && action.includes('passed house')) {
    return 'PASSED_BOTH';
  }
  if (action.includes('passed senate') || action.includes('passed house')) {
    return 'PASSED_ONE_CHAMBER';
  }
  if (action.includes('reported') || action.includes('committee')) {
    return 'IN_COMMITTEE';
  }
  if (action.includes('introduced')) {
    return 'INTRODUCED';
  }

  return 'UNKNOWN';
}

// Determine priority based on legislative activity
function calculatePriority(billStatus, billData) {
  // Check if bill is manually marked as high priority in bills.json
  if (billData.priority === 'high' && billData.prioritySource === 'manual') {
    return { priority: 'high', source: 'manual', reason: 'Manually flagged' };
  }

  // Check if listed on FreeDC (you can set this in bills.json)
  if (billData.prioritySource === 'freedc') {
    return { priority: 'high', source: 'freedc', reason: 'Listed on FreeDC' };
  }

  // Auto-detect HIGH priority based on legislative activity
  if (billStatus.hasFloorVote) {
    return { priority: 'high', source: 'legislative', reason: 'Floor vote occurred' };
  }

  if (billStatus.hasCommitteeMarkup) {
    return { priority: 'high', source: 'legislative', reason: 'Committee markup held' };
  }

  if (billStatus.hasCommitteeHearing) {
    return { priority: 'high', source: 'legislative', reason: 'Committee hearing held' };
  }

  if (billStatus.cosponsorsCount >= 20) {
    return { priority: 'high', source: 'legislative', reason: `${billStatus.cosponsorsCount} cosponsors` };
  }

  // MEDIUM priority
  if (billStatus.cosponsorsCount >= 5) {
    return { priority: 'medium', source: 'legislative', reason: `${billStatus.cosponsorsCount} cosponsors` };
  }

  if (billStatus.status === 'IN_COMMITTEE') {
    return { priority: 'medium', source: 'legislative', reason: 'In committee' };
  }

  // LOW/WATCHING priority - recently introduced, no activity
  if (billStatus.status === 'INTRODUCED') {
    return { priority: 'watching', source: 'legislative', reason: 'Recently introduced' };
  }

  return { priority: 'low', source: 'legislative', reason: 'No significant activity' };
}

// Main monitoring function
async function monitorBills() {
  console.log('🔍 Starting bill monitoring...\n');
  console.log(`📊 Checking ${billsData.bills.length} bills\n`);

  if (!CONGRESS_API_KEY) {
    console.error('❌ CONGRESS_API_KEY environment variable not set!');
    console.log('\n📝 To get an API key:');
    console.log('   1. Visit: https://api.congress.gov/sign-up/');
    console.log('   2. Sign up for a free API key');
    console.log('   3. Set environment variable: export CONGRESS_API_KEY=your_key_here\n');
    process.exit(1);
  }

  const changes = [];
  const errors = [];

  // Check each bill (with rate limiting)
  for (let i = 0; i < billsData.bills.length; i++) {
    const bill = billsData.bills[i];
    const billNumber = bill.billNumbers[0]; // Primary bill number

    console.log(`[${i + 1}/${billsData.bills.length}] Checking ${billNumber}...`);

    const status = await fetchBillStatus(billNumber);

    if (status) {
      // Calculate priority
      const priorityInfo = calculatePriority(status, bill);

      // Check if status has changed (you'll need to track previous state)
      changes.push({
        id: bill.id,
        bill: bill.title,
        billNumber: status.billNumber,
        status: status.status,
        latestAction: status.latestAction,
        latestActionDate: status.latestActionDate,
        url: status.url,
        // New fields
        priority: priorityInfo.priority,
        prioritySource: priorityInfo.source,
        priorityReason: priorityInfo.reason,
        cosponsorsCount: status.cosponsorsCount,
        hasCommitteeHearing: status.hasCommitteeHearing,
        hasCommitteeMarkup: status.hasCommitteeMarkup,
        hasFloorVote: status.hasFloorVote,
        committees: status.committees,
        introducedDate: status.introducedDate
      });

      // Show priority in output
      const priorityBadge = priorityInfo.priority === 'high' ? '🔴' :
                           priorityInfo.priority === 'medium' ? '🟡' : '⚪';
      console.log(`  ${priorityBadge} Priority: ${priorityInfo.priority} (${priorityInfo.reason})`);
    } else {
      errors.push(billNumber);
    }

    // Rate limiting: wait 200ms between requests (3 requests per bill = actions + cosponsors)
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n✅ Monitoring complete!\n');

  // Generate report
  generateReport(changes, errors);
}

// Generate summary report
function generateReport(changes, errors) {
  console.log('📋 BILL STATUS REPORT');
  console.log('='.repeat(80));
  console.log(`Total bills checked: ${billsData.bills.length}`);
  console.log(`Successful checks: ${changes.length}`);
  console.log(`Errors: ${errors.length}\n`);

  // Group by priority
  const byPriority = {
    high: [],
    medium: [],
    watching: [],
    low: []
  };

  changes.forEach(change => {
    const priority = change.priority || 'low';
    if (byPriority[priority]) {
      byPriority[priority].push(change);
    }
  });

  // Print HIGH priority bills first
  console.log('\n🔴 HIGH PRIORITY BILLS (' + byPriority.high.length + ')');
  console.log('='.repeat(80));
  byPriority.high.forEach(change => {
    console.log(`\n  ${change.billNumber}: ${change.bill}`);
    console.log(`  Status: ${change.status}`);
    console.log(`  Priority reason: ${change.priorityReason}`);
    console.log(`  Latest: ${change.latestAction}`);
    console.log(`  Date: ${change.latestActionDate || 'Unknown'}`);
    console.log(`  Cosponsors: ${change.cosponsorsCount}`);
    if (change.hasCommitteeHearing) console.log(`  ✓ Committee hearing held`);
    if (change.hasCommitteeMarkup) console.log(`  ✓ Committee markup held`);
    if (change.hasFloorVote) console.log(`  ✓ Floor vote occurred`);
    console.log(`  URL: ${change.url}`);
  });

  // Print MEDIUM priority bills
  console.log('\n\n🟡 MEDIUM PRIORITY BILLS (' + byPriority.medium.length + ')');
  console.log('='.repeat(80));
  byPriority.medium.forEach(change => {
    console.log(`\n  ${change.billNumber}: ${change.bill}`);
    console.log(`  Status: ${change.status} | Cosponsors: ${change.cosponsorsCount}`);
    console.log(`  Latest: ${change.latestAction} (${change.latestActionDate || 'Unknown'})`);
  });

  // Print WATCHING bills
  console.log('\n\n⚪ WATCHING (' + byPriority.watching.length + ')');
  console.log('='.repeat(80));
  byPriority.watching.forEach(change => {
    console.log(`  ${change.billNumber}: ${change.bill}`);
  });

  if (errors.length > 0) {
    console.log('\n\n❌ ERRORS');
    console.log('-'.repeat(80));
    errors.forEach(bill => console.log(`  ${bill}`));
  }

  // Save results to file for future comparison
  const timestamp = new Date().toISOString();
  const resultsPath = join(__dirname, '../bill-status-history.json');

  try {
    let history = [];
    try {
      history = JSON.parse(readFileSync(resultsPath, 'utf-8'));
    } catch (e) {
      // File doesn't exist yet, start fresh
    }

    history.push({
      timestamp,
      changes,
      errors
    });

    // Keep last 30 checks
    if (history.length > 30) {
      history = history.slice(-30);
    }

    writeFileSync(resultsPath, JSON.stringify(history, null, 2));
    console.log(`\n💾 Results saved to: ${resultsPath}`);
  } catch (error) {
    console.error('Error saving results:', error);
  }

  console.log('\n' + '='.repeat(80));
}

// Run the monitoring
monitorBills().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

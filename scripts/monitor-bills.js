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

// Fetch roll call vote details
async function fetchRollCallVote(chamber, year, rollCallNumber) {
  try {
    // Determine session (session 1 for 119th Congress in 2025)
    const session = 1; // 119th Congress, 1st session (2025)

    // Use new house-vote/senate-vote endpoints (2025 API format)
    const chamberEndpoint = chamber === 'house' ? 'house-vote' : 'senate-vote';
    const voteUrl = `${API_BASE_URL}/${chamberEndpoint}/${CONGRESS_NUMBER}/${session}/${rollCallNumber}?api_key=${CONGRESS_API_KEY}`;
    const response = await fetch(voteUrl);

    if (!response.ok) {
      console.log(`  ⚠️  Could not fetch roll call vote ${chamber} ${rollCallNumber}`);
      return null;
    }

    const data = await response.json();
    // New API format uses houseRollCallVote or senateRollCallVote
    const vote = data.houseRollCallVote || data.senateRollCallVote;

    // Parse party breakdown from new API format (2025)
    // New format has votePartyTotal array instead of members
    const votePartyTotal = vote.votePartyTotal || [];

    let totalYeas = 0;
    let totalNays = 0;
    const partyVotes = {};

    votePartyTotal.forEach(partyData => {
      const party = partyData.voteParty || partyData.party?.type;
      totalYeas += partyData.yeaTotal || 0;
      totalNays += partyData.nayTotal || 0;

      if (party === 'R' || party === 'Republican') {
        partyVotes.republican = {
          yeas: partyData.yeaTotal || 0,
          nays: partyData.nayTotal || 0
        };
      } else if (party === 'D' || party === 'Democrat') {
        partyVotes.democrat = {
          yeas: partyData.yeaTotal || 0,
          nays: partyData.nayTotal || 0
        };
      }
    });

    return {
      date: vote.startDate || vote.actionDate,
      yeas: totalYeas,
      nays: totalNays,
      byParty: {
        republican: partyVotes.republican || { yeas: 0, nays: 0 },
        democrat: partyVotes.democrat || { yeas: 0, nays: 0 }
      }
    };
  } catch (error) {
    console.log(`  ⚠️  Error fetching roll call vote: ${error.message}`);
    return null;
  }
}

// Detect bill passage and fetch vote data from actions
async function detectPassage(actions, chamber) {
  const passageInfo = {
    hasPassedHouse: false,
    hasPassedSenate: false,
    houseVote: null,
    senateVote: null,
    stage: null
  };

  // Sort actions by date (most recent first)
  const sortedActions = [...actions].sort((a, b) => {
    const dateA = new Date(a.actionDate || 0);
    const dateB = new Date(b.actionDate || 0);
    return dateB - dateA;
  });

  for (const action of sortedActions) {
    const actionText = action.text || '';
    const actionDate = action.actionDate;

    // Detect House passage
    if (actionText.includes('On passage Passed by recorded vote') ||
        actionText.includes('On passage Passed by the Yeas and Nays') ||
        (actionText.includes('Passed House') && !actionText.includes('Passed/agreed to in House'))) {

      passageInfo.hasPassedHouse = true;

      // Extract roll call number
      const rollMatch = actionText.match(/Roll no\.\s*(\d+)|recorded vote:\s*(\d+)|Yeas and Nays:\s*(\d+)/i);
      if (rollMatch) {
        const rollNumber = rollMatch[1] || rollMatch[2] || rollMatch[3];
        console.log(`  🗳️  Detected House passage with roll call ${rollNumber}`);

        // Fetch vote details
        const voteData = await fetchRollCallVote('house', new Date(actionDate).getFullYear(), rollNumber);
        if (voteData) {
          passageInfo.houseVote = voteData;
          console.log(`  ✓ House vote data: ${voteData.yeas}-${voteData.nays}`);
        }
      }
    }

    // Detect Senate passage
    if (actionText.includes('Passed Senate') &&
        !actionText.includes('passed in Senate') &&
        !actionText.includes('Received in the Senate')) {

      passageInfo.hasPassedSenate = true;

      // Extract roll call number
      const rollMatch = actionText.match(/Roll Call Vote No\.\s*(\d+)|Vote Number:\s*(\d+)/i);
      if (rollMatch) {
        const rollNumber = rollMatch[1] || rollMatch[2];
        console.log(`  🗳️  Detected Senate passage with roll call ${rollNumber}`);

        // Fetch vote details
        const voteData = await fetchRollCallVote('senate', new Date(actionDate).getFullYear(), rollNumber);
        if (voteData) {
          passageInfo.senateVote = voteData;
          console.log(`  ✓ Senate vote data: ${voteData.yeas}-${voteData.nays}`);
        }
      }
    }
  }

  // Determine stage
  if (passageInfo.hasPassedHouse && passageInfo.hasPassedSenate) {
    passageInfo.stage = 'passed-both';
  } else if (passageInfo.hasPassedHouse) {
    passageInfo.stage = 'passed-house';
  } else if (passageInfo.hasPassedSenate) {
    passageInfo.stage = 'passed-senate';
  }

  return passageInfo;
}

// Fetch bill details from Congress.gov API
async function fetchBillStatus(billNumber) {
  const parsed = parseBillNumber(billNumber);
  if (!parsed) {
    console.log(`⚠️  Could not parse bill number: ${billNumber}`);
    return null;
  }

  const { billType, number, chamber } = parsed;
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
    let passageInfo = null;

    try {
      const actionsResponse = await fetch(actionsUrl);
      if (actionsResponse.ok) {
        const actionsData = await actionsResponse.json();
        actions = actionsData.actions || [];

        // Detect passage and fetch vote data
        passageInfo = await detectPassage(actions, chamber);

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
    if (bill.committees && Array.isArray(bill.committees)) {
      committees = bill.committees.map(c => c.name);
    }

    // Build return object
    const result = {
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
      introducedDate: bill.introducedDate || null,
      // Passage information
      passageInfo
    };

    console.log(`  ✓ Successfully fetched ${billNumber}`);
    return result;
  } catch (error) {
    console.log(`  ❌ Error in fetchBillStatus for ${billNumber}:`, error.message);
    console.log(`  Stack: ${error.stack}`);
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

// Update bills.json with passage information
function updateBillsJson(billId, passageInfo, status) {
  try {
    // Find and update the bill
    const billIndex = billsData.bills.findIndex(b => b.id === billId);
    if (billIndex === -1) {
      console.log(`  ⚠️  Could not find bill ${billId} in bills.json`);
      return false;
    }

    const bill = billsData.bills[billIndex];
    let updated = false;

    // Update status stage
    if (passageInfo.stage && bill.status.stage !== passageInfo.stage) {
      bill.status.stage = passageInfo.stage;
      bill.status.lastAction = passageInfo.hasPassedHouse ? 'Passed House' : 'Passed Senate';
      bill.status.lastActionDate = new Date().toISOString().split('T')[0];
      updated = true;
      console.log(`  ✓ Updated stage to: ${passageInfo.stage}`);
    }

    // Add passage data
    if (!bill.passage) {
      bill.passage = {};
    }

    if (passageInfo.houseVote && !bill.passage.house) {
      bill.passage.house = {
        date: passageInfo.houseVote.date,
        vote: {
          yeas: passageInfo.houseVote.yeas,
          nays: passageInfo.houseVote.nays,
          byParty: passageInfo.houseVote.byParty
        }
      };
      updated = true;
      console.log(`  ✓ Added House vote data: ${passageInfo.houseVote.yeas}-${passageInfo.houseVote.nays}`);
    }

    if (passageInfo.senateVote && !bill.passage.senate) {
      bill.passage.senate = {
        date: passageInfo.senateVote.date,
        vote: {
          yeas: passageInfo.senateVote.yeas,
          nays: passageInfo.senateVote.nays,
          byParty: passageInfo.senateVote.byParty
        }
      };
      updated = true;
      console.log(`  ✓ Added Senate vote data: ${passageInfo.senateVote.yeas}-${passageInfo.senateVote.nays}`);
    }

    // Update status flags
    bill.status.hasFloorVote = status.hasFloorVote;
    bill.status.hasCommitteeHearing = status.hasCommitteeHearing;
    bill.status.hasCommitteeMarkup = status.hasCommitteeMarkup;
    bill.status.cosponsors = status.cosponsorsCount;

    if (updated) {
      // Save updated bills.json
      billsData.lastUpdated = new Date().toISOString().split('T')[0];
      writeFileSync(billsPath, JSON.stringify(billsData, null, 2));
      console.log(`  💾 Updated bills.json`);
      return true;
    }

    return false;
  } catch (error) {
    console.log(`  ❌ Error updating bills.json:`, error.message);
    return false;
  }
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
  const passedBills = [];

  // Check each bill (with rate limiting)
  for (let i = 0; i < billsData.bills.length; i++) {
    const bill = billsData.bills[i];
    const billNumber = bill.billNumbers[0]; // Primary bill number

    console.log(`[${i + 1}/${billsData.bills.length}] Checking ${billNumber}...`);

    try {
      const status = await fetchBillStatus(billNumber);

      if (status) {
        // Calculate priority
        const priorityInfo = calculatePriority(status, bill);

        // Check for passage and update bills.json
        if (status.passageInfo && status.passageInfo.stage) {
          const wasUpdated = updateBillsJson(bill.id, status.passageInfo, status);
          if (wasUpdated) {
            passedBills.push({
              billNumber: status.billNumber,
              title: bill.title,
              stage: status.passageInfo.stage,
              houseVote: status.passageInfo.houseVote,
              senateVote: status.passageInfo.senateVote
            });
          }
        }

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
          introducedDate: status.introducedDate,
          passageInfo: status.passageInfo
        });

        // Show priority in output
        const priorityBadge = priorityInfo.priority === 'high' ? '🔴' :
                             priorityInfo.priority === 'medium' ? '🟡' : '⚪';
        console.log(`  ${priorityBadge} Priority: ${priorityInfo.priority} (${priorityInfo.reason})`);
      } else {
        console.log(`  ❌ No status returned for ${billNumber}`);
        errors.push(billNumber);
      }
    } catch (error) {
      console.log(`  ❌ Error processing ${billNumber}:`, error.message);
      errors.push(billNumber);
    }

    // Rate limiting: wait 300ms between requests (more requests now with vote data)
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('\n✅ Monitoring complete!\n');

  // Always update lastUpdated timestamp to show when monitoring last ran (EST timezone for DC)
  const estDate = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  billsData.lastUpdated = new Date(estDate).toISOString().split('T')[0];
  writeFileSync(billsPath, JSON.stringify(billsData, null, 2));
  console.log(`💾 Updated lastUpdated to: ${billsData.lastUpdated} (EST)\n`);

  // Show passage summary if any bills passed
  if (passedBills.length > 0) {
    console.log('\n🚨 BILLS THAT HAVE PASSED 🚨');
    console.log('='.repeat(80));
    passedBills.forEach(passed => {
      console.log(`\n📜 ${passed.billNumber}: ${passed.title}`);
      console.log(`   Stage: ${passed.stage}`);
      if (passed.houseVote) {
        console.log(`   House: ${passed.houseVote.yeas}-${passed.houseVote.nays} on ${passed.houseVote.date}`);
        console.log(`   Party breakdown: R ${passed.houseVote.byParty.republican.yeas}-${passed.houseVote.byParty.republican.nays}, D ${passed.houseVote.byParty.democrat.yeas}-${passed.houseVote.byParty.democrat.nays}`);
      }
      if (passed.senateVote) {
        console.log(`   Senate: ${passed.senateVote.yeas}-${passed.senateVote.nays} on ${passed.senateVote.date}`);
        console.log(`   Party breakdown: R ${passed.senateVote.byParty.republican.yeas}-${passed.senateVote.byParty.republican.nays}, D ${passed.senateVote.byParty.democrat.yeas}-${passed.senateVote.byParty.democrat.nays}`);
      }
    });
    console.log('\n' + '='.repeat(80) + '\n');
  }

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

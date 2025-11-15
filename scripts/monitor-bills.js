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
  const url = `${API_BASE_URL}/bill/${CONGRESS_NUMBER}/${billType}/${number}?api_key=${CONGRESS_API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`❌ Bill not found in API: ${billNumber}`);
        return null;
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const bill = data.bill;

    return {
      billNumber,
      title: bill.title,
      latestAction: bill.latestAction?.text || 'No recent action',
      latestActionDate: bill.latestAction?.actionDate || null,
      status: getSimplifiedStatus(bill),
      sponsors: bill.sponsors?.map(s => s.fullName).join(', ') || 'Unknown',
      url: `https://www.congress.gov/bill/${CONGRESS_NUMBER}th-congress/${billType}/${number}`
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
      // Check if status has changed (you'll need to track previous state)
      changes.push({
        bill: bill.title,
        billNumber: status.billNumber,
        status: status.status,
        latestAction: status.latestAction,
        latestActionDate: status.latestActionDate,
        url: status.url
      });
    } else {
      errors.push(billNumber);
    }

    // Rate limiting: wait 100ms between requests to be nice to the API
    await new Promise(resolve => setTimeout(resolve, 100));
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

  // Group by status
  const byStatus = {};
  changes.forEach(change => {
    if (!byStatus[change.status]) {
      byStatus[change.status] = [];
    }
    byStatus[change.status].push(change);
  });

  // Print grouped results
  Object.keys(byStatus).sort().forEach(status => {
    console.log(`\n${status} (${byStatus[status].length} bills)`);
    console.log('-'.repeat(80));

    byStatus[status].forEach(change => {
      console.log(`\n  ${change.billNumber}: ${change.bill}`);
      console.log(`  Latest: ${change.latestAction}`);
      console.log(`  Date: ${change.latestActionDate || 'Unknown'}`);
      console.log(`  URL: ${change.url}`);
    });
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

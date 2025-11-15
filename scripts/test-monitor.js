#!/usr/bin/env node

/**
 * Test Script for Bill Monitoring
 * Demonstrates the monitoring flow without requiring an API key
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load bills data
const billsPath = join(__dirname, '../src/data/bills.json');
const billsData = JSON.parse(readFileSync(billsPath, 'utf-8'));

console.log('🧪 DC Bills Monitor - Test Mode\n');
console.log('='.repeat(80));
console.log('This test demonstrates the monitoring system without calling the API\n');

// Parse bill number function (same as in monitor-bills.js)
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

// Test parsing
console.log('📋 BILL PARSING TEST\n');
console.log('Testing bill number parsing:\n');

const sampleBills = [
  'H.R. 5214',
  'S. 1234',
  'H.J.Res. 45',
  'S.Con.Res. 12'
];

sampleBills.forEach(billNumber => {
  const parsed = parseBillNumber(billNumber);
  if (parsed) {
    const url = `https://api.congress.gov/v3/bill/119/${parsed.billType}/${parsed.number}`;
    console.log(`  ${billNumber}`);
    console.log(`    → Type: ${parsed.billType}, Number: ${parsed.number}, Chamber: ${parsed.chamber}`);
    console.log(`    → API URL: ${url}\n`);
  } else {
    console.log(`  ❌ Failed to parse: ${billNumber}\n`);
  }
});

// Analyze the bills data
console.log('\n' + '='.repeat(80));
console.log('📊 BILLS DATA ANALYSIS\n');

console.log(`Total bills to monitor: ${billsData.bills.length}`);
console.log(`Categories: ${billsData.categories.length}`);
console.log(`Last updated: ${billsData.lastUpdated}\n`);

// Group by category
const byCategory = {};
billsData.bills.forEach(bill => {
  const category = bill.category;
  if (!byCategory[category]) {
    byCategory[category] = [];
  }
  byCategory[category].push(bill);
});

console.log('Bills by category:');
Object.keys(byCategory).sort().forEach(category => {
  console.log(`  ${category}: ${byCategory[category].length} bills`);
});

// Find highlighted bills
const highlightedBills = billsData.bills.filter(b => b.highlight === 'floor-vote');
console.log(`\nHighlighted floor vote bills: ${highlightedBills.length}`);
highlightedBills.forEach(bill => {
  console.log(`  - ${bill.billNumbers[0]}: ${bill.title}`);
});

// Test bill number parsing for all bills
console.log('\n' + '='.repeat(80));
console.log('🔍 PARSING ALL BILLS\n');

let parseSuccessCount = 0;
let parseFailCount = 0;
const parseErrors = [];

billsData.bills.forEach(bill => {
  const billNumber = bill.billNumbers[0]; // Primary bill number
  const parsed = parseBillNumber(billNumber);

  if (parsed) {
    parseSuccessCount++;
  } else {
    parseFailCount++;
    parseErrors.push(billNumber);
  }
});

console.log(`✅ Successfully parsed: ${parseSuccessCount} bills`);
console.log(`❌ Failed to parse: ${parseFailCount} bills`);

if (parseErrors.length > 0) {
  console.log('\nFailed bills:');
  parseErrors.forEach(bill => console.log(`  - ${bill}`));
}

// Show what the API calls would look like
console.log('\n' + '='.repeat(80));
console.log('📡 SAMPLE API CALLS\n');
console.log('First 5 bills would generate these API calls:\n');

billsData.bills.slice(0, 5).forEach((bill, i) => {
  const billNumber = bill.billNumbers[0];
  const parsed = parseBillNumber(billNumber);

  if (parsed) {
    const url = `https://api.congress.gov/v3/bill/119/${parsed.billType}/${parsed.number}?api_key=YOUR_KEY_HERE`;
    console.log(`${i + 1}. ${billNumber}`);
    console.log(`   GET ${url}\n`);
  }
});

console.log('='.repeat(80));
console.log('\n✅ Test complete!\n');
console.log('Next steps:');
console.log('1. Get your Congress.gov API key: https://api.congress.gov/sign-up/');
console.log('2. Set environment variable: export CONGRESS_API_KEY=your_key_here');
console.log('3. Run the real monitor: node scripts/monitor-bills.js');
console.log('4. Set up GitHub Actions for automation (see MONITORING-SETUP.md)\n');

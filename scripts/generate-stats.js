#!/usr/bin/env node

/**
 * Generates stats.json from bills.json
 * This file is deployed with the site and can be fetched by the main site
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load bills data
const billsPath = join(__dirname, '../src/data/bills.json');
const billsData = JSON.parse(readFileSync(billsPath, 'utf-8'));

// Calculate stats
const bills = billsData.bills || [];
const riders = billsData.riders || [];
const supportBills = billsData.supportBills || [];

const passedBills = bills.filter(bill =>
  bill.status?.stage &&
  (bill.status.stage.startsWith('passed-') || bill.status.stage === 'enacted')
);

const pendingBills = bills.filter(bill =>
  !bill.status?.stage ||
  (!bill.status.stage.startsWith('passed-') && bill.status.stage !== 'enacted')
);

const totalOpposeBills = bills.length + riders.length;
const pendingOpposeBills = pendingBills.length + riders.length;

const stats = {
  lastUpdated: billsData.lastUpdated,
  totalBills: totalOpposeBills,
  pendingBills: pendingOpposeBills,
  passedBills: passedBills.length,
  breakdown: {
    bills: bills.length,
    riders: riders.length,
    supportBills: supportBills.length
  },
  passed: passedBills.map(bill => ({
    id: bill.id,
    number: bill.billNumbers[0],
    title: bill.title,
    stage: bill.status.stage
  }))
};

// Ensure public/api directory exists
const apiDir = join(__dirname, '../public/api');
try {
  mkdirSync(apiDir, { recursive: true });
} catch (e) {
  // Directory already exists
}

// Write stats file
const statsPath = join(apiDir, 'stats.json');
writeFileSync(statsPath, JSON.stringify(stats, null, 2));

console.log('✓ Generated stats.json');
console.log(`  Total bills: ${stats.totalBills}`);
console.log(`  Pending: ${stats.pendingBills}`);
console.log(`  Passed: ${stats.passedBills}`);
console.log(`  Last updated: ${stats.lastUpdated}`);

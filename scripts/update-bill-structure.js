#!/usr/bin/env node

/**
 * Script to update bills.json with new structure
 * Adds priority, type, position fields and separates riders and support bills
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const billsPath = join(__dirname, '../src/data/bills.json');
const billsData = JSON.parse(readFileSync(billsPath, 'utf-8'));

// Bills from FreeDC's high-priority list
const freedcHighPriorityBills = [
  'hr4922-s2686',    // DC CRIMES Act
  'hr5140',          // Juvenile Charging Age
  'hr5125-s2854',    // Judicial Nominations
  'hr5143',          // Police Pursuits
  'hr5242-secondchance', // Incarceration/Second Chance (H.R. 5242)
  'hr2056-s1522',    // Sanctuary Values
  'hr884-s2636',     // Voting Rights (noncitizen)
  'hr2096',          // Police Employment
  'hr5103',          // Immigration Oversight
  'hr5107-s2687',    // Policing Reform (CLEAN DC)
  'hr5163',          // Homelessness
  'hr5172',          // Sentencing
  'hr5179',          // Attorney General
  'hr5181',          // Education Funding
  'hr5183',          // Legislative Process
  'hr5214'           // Pre-trial Detention
];

// Riders in H.R. 5166 and other appropriations bills
const riderIds = [
  'hr5166-police',
  'hr5166-youth',
  'hr5166-noncitizen',
  'hr5166-emissions',
  'hr5166-oilgas',
  'hr5166-abortion',
  'hr5166-reprohealth',
  'hr5166-deathwithdignity',
  'hr5166-covid',
  'hr5166-insurance',
  'hr5166-marijuana',
  'hr5166-rightturn',
  'hr5166-cameras',
  'hr5166-slapp',
  'hr5166-guns',
  'hr5166-sistercity',
  'hr5166-shield'
];

// Pro-DC bills to support (will be tracked separately)
const supportBillIds = [
  'hr51-s51',        // DC Statehood (if it exists in your data)
  'hr5093-s2688',    // National Guard Home Rule
  'hr5092-s2689',    // Police Home Rule
  'hr5070',          // Federal Officer Body Cameras
  'hr5051',          // Armed Forces Body Cameras
  'hr2693'           // Electronic Legislation Transmittal
];

console.log('🔄 Updating bills.json structure...\n');

// Process existing bills
const updatedBills = [];
const riders = [];
const supportBills = [];

billsData.bills.forEach(bill => {
  // Create base updated bill object
  const updatedBill = {
    ...bill,
    position: 'oppose',  // default
    type: 'bill',
    priority: 'low',
    prioritySource: 'manual'
  };

  // Determine if it's a rider
  if (riderIds.includes(bill.id)) {
    updatedBill.type = 'rider';
    updatedBill.priority = 'high';
    updatedBill.prioritySource = 'freedc';
    updatedBill.fiscalYear = '2026';
    riders.push(updatedBill);
    console.log(`📋 Rider: ${bill.id}`);
    return;
  }

  // Determine if it's a support bill
  if (supportBillIds.includes(bill.id)) {
    updatedBill.position = 'support';
    updatedBill.priority = 'high';
    supportBills.push(updatedBill);
    console.log(`💚 Support bill: ${bill.id}`);
    return;
  }

  // Check if it's a FreeDC high-priority bill
  if (freedcHighPriorityBills.includes(bill.id)) {
    updatedBill.priority = 'high';
    updatedBill.prioritySource = 'freedc';
    console.log(`🔴 High priority: ${bill.id}`);
  }

  // Add status object (will be populated by monitor script)
  updatedBill.status = {
    stage: null,
    lastAction: null,
    lastActionDate: null,
    hasCommitteeHearing: false,
    hasCommitteeMarkup: false,
    hasFloorVote: false,
    cosponsors: 0,
    committees: []
  };

  updatedBills.push(updatedBill);
});

// Create new structure
const newData = {
  lastUpdated: new Date().toISOString().split('T')[0],
  categories: billsData.categories,
  bills: updatedBills,
  riders: riders,
  supportBills: supportBills
};

// Write back to file
writeFileSync(billsPath, JSON.stringify(newData, null, 2));

console.log('\n✅ Structure update complete!');
console.log(`📊 Bills to oppose: ${updatedBills.length}`);
console.log(`📋 Riders: ${riders.length}`);
console.log(`💚 Support bills: ${supportBills.length}`);
console.log(`🔴 High priority (FreeDC): ${updatedBills.filter(b => b.priority === 'high').length}`);
console.log(`\n💾 Saved to: ${billsPath}`);

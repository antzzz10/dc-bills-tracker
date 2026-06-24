#!/usr/bin/env node

/**
 * Validates bills against the Congress.gov API to confirm they exist
 * in the specified congress session.
 *
 * Usage:
 *   node scripts/validate-bills.js           # validate all unvalidated bills
 *   node scripts/validate-bills.js hr1234    # validate a single bill by ID
 *   node scripts/validate-bills.js --all     # re-validate all bills (including already-validated)
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { CURRENT_CONGRESS } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const API_BASE_URL = 'https://api.congress.gov/v3';
const RATE_LIMIT_MS = 300;

const args = process.argv.slice(2);
const REVALIDATE_ALL = args.includes('--all');
const SINGLE_ID = args.find(a => !a.startsWith('--'));

if (!CONGRESS_API_KEY) {
  console.error('Error: CONGRESS_API_KEY environment variable is not set.');
  console.error('Get a key at https://api.congress.gov/sign-up/');
  process.exit(1);
}

const billsPath = join(__dirname, '../src/data/bills.json');
const billsData = JSON.parse(readFileSync(billsPath, 'utf-8'));

function parseBillNumber(billNumber) {
  const match = billNumber.match(/(H\.R\.|S\.|H\.J\.Res\.|S\.J\.Res\.|H\.Con\.Res\.|S\.Con\.Res\.)\s*(\d+)/i);
  if (!match) return null;

  const [, type, number] = match;
  let billType = '';

  const t = type.toLowerCase();
  if (t.includes('h.r.')) billType = 'hr';
  else if (t.includes('h.j.res')) billType = 'hjres';
  else if (t.includes('h.con.res')) billType = 'hconres';
  else if (t.includes('s.j.res')) billType = 'sjres';
  else if (t.includes('s.con.res')) billType = 'sconres';
  else if (t.includes('s.')) billType = 's';

  return { billType, number };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function validateBill(bill) {
  // A bill may have multiple bill numbers (e.g. "H.R. 1234 / S. 567")
  const rawNumbers = bill.billNumbers || (bill.billNumber ? [bill.billNumber] : []);
  if (rawNumbers.length === 0) {
    console.log(`  ⚠️  ${bill.id}: no billNumbers field — skipping`);
    return { validated: false, skipped: true };
  }

  for (const raw of rawNumbers) {
    const parsed = parseBillNumber(raw);
    if (!parsed) {
      console.log(`  ⚠️  ${bill.id}: could not parse "${raw}"`);
      continue;
    }

    const congress = bill.congress || CURRENT_CONGRESS;
    const url = `${API_BASE_URL}/bill/${congress}/${parsed.billType}/${parsed.number}?api_key=${CONGRESS_API_KEY}`;

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const title = data.bill?.title || data.bill?.officialTitle || '';
      console.log(`  ✅  ${bill.id} (${raw}): confirmed — ${title.slice(0, 70)}${title.length > 70 ? '…' : ''}`);
      return { validated: true, skipped: false };
    } else if (res.status === 404) {
      console.log(`  ❌  ${bill.id} (${raw}): NOT FOUND on Congress.gov (${congress}th Congress)`);
    } else {
      console.log(`  ⚠️  ${bill.id} (${raw}): API error ${res.status} — skipping`);
      return { validated: false, skipped: true };
    }
  }

  // All bill numbers in this entry came back 404
  return { validated: false, skipped: false };
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const allBills = [
    ...(billsData.bills || []),
    ...(billsData.riders || []),
    ...(billsData.supportBills || []),
  ];

  let candidates;
  if (SINGLE_ID) {
    candidates = allBills.filter(b => b.id === SINGLE_ID);
    if (candidates.length === 0) {
      console.error(`No bill found with id "${SINGLE_ID}"`);
      process.exit(1);
    }
  } else if (REVALIDATE_ALL) {
    candidates = allBills;
  } else {
    candidates = allBills.filter(b => !b.congressValidated);
  }

  console.log(`\nValidating ${candidates.length} bill(s) against Congress.gov (${CURRENT_CONGRESS}th Congress)\n`);

  let confirmed = 0;
  let failed = 0;
  let skipped = 0;

  for (const bill of candidates) {
    const result = await validateBill(bill);
    if (result.skipped) {
      skipped++;
    } else if (result.validated) {
      bill.congressValidated = true;
      bill.congressValidatedDate = today;
      confirmed++;
    } else {
      failed++;
      // Leave congressValidated: false — human decides whether to remove the bill
    }
    await sleep(RATE_LIMIT_MS);
  }

  writeFileSync(billsPath, JSON.stringify(billsData, null, 2) + '\n');

  console.log(`\n--- Results ---`);
  console.log(`✅  Confirmed: ${confirmed}`);
  console.log(`❌  Not found: ${failed}`);
  console.log(`⚠️  Skipped (parse/API error): ${skipped}`);
  console.log(`\nbills.json updated.`);

  if (failed > 0) {
    console.log(`\nNote: ${failed} bill(s) were not found on Congress.gov.`);
    console.log(`These have NOT been removed — review them manually before deleting.`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

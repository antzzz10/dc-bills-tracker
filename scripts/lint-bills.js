#!/usr/bin/env node

/**
 * Offline consistency lint + golden-label eval for src/data/bills.json.
 * No API key required — run before deploying any data change:
 *
 *   node scripts/lint-bills.js
 *
 * Checks:
 *   1. No duplicate bill IDs across bills/riders/supportBills
 *   2. Section/position agreement (bills+riders oppose, supportBills support,
 *      routineBills routine)
 *   3. Every non-provisional oppose/routine bill has attackType "direct" or
 *      "partial"; support bills carry no attackType unless golden-labeled as
 *      an edge case
 *   4. No high-priority partial attack without legislative momentum
 *      (mirrors the runtime cap in monitor-bills.js calculatePriority)
 *   5. Categories exist in the taxonomy
 *   6. bills.json matches scripts/eval/golden-labels.json
 *
 * Exits 1 on any error. See METHODOLOGY.md ("Quality control").
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, '../src/data/bills.json'), 'utf-8'));
const golden = JSON.parse(readFileSync(join(__dirname, 'eval/golden-labels.json'), 'utf-8'));

const errors = [];
const warnings = [];

const sections = [
  ['bills', data.bills, 'oppose'],
  ['riders', data.riders, 'oppose'],
  ['supportBills', data.supportBills, 'support'],
  ['routineBills', data.routineBills || [], 'routine']
];

// 1. Duplicate IDs
const seenIds = new Map();
for (const [section, items] of sections) {
  for (const bill of items) {
    if (seenIds.has(bill.id)) {
      errors.push(`Duplicate id "${bill.id}" in ${section} (also in ${seenIds.get(bill.id)})`);
    }
    seenIds.set(bill.id, section);
  }
}

const validCategories = new Set(data.categories.map(c => c.id));
const hasMomentum = s =>
  s.hasFloorVote || s.hasCommitteeMarkup || s.hasCommitteeHearing || (s.cosponsors || 0) >= 20;

for (const [section, items, expectedPosition] of sections) {
  for (const bill of items) {
    const label = `${section}/${bill.id}`;

    // 2. Section/position agreement
    if (bill.position !== expectedPosition) {
      errors.push(`${label}: position "${bill.position}" but section expects "${expectedPosition}"`);
    }

    // 3. attackType discipline — oppose and routine both require it once reviewed;
    // routine's stakes/severity signal lives in attackType, never in the position label
    if (expectedPosition === 'oppose' || expectedPosition === 'routine') {
      if (!bill.provisional && !['direct', 'partial'].includes(bill.attackType)) {
        errors.push(`${label}: non-provisional ${expectedPosition} bill missing valid attackType (got "${bill.attackType}")`);
      }
    } else if (bill.attackType && golden.labels[bill.id]?.attackType !== bill.attackType) {
      warnings.push(`${label}: support bill carries attackType "${bill.attackType}" without a golden-label edge case`);
    }

    // 4. Priority cap: no high partial without momentum
    if (bill.attackType === 'partial' && bill.priority === 'high' && !hasMomentum(bill.status || {})) {
      errors.push(`${label}: partial attack ranked high without legislative momentum (violates cap)`);
    }

    // 5. Category exists
    if (bill.category && !validCategories.has(bill.category)) {
      errors.push(`${label}: unknown category "${bill.category}"`);
    }
  }
}

// 6. Golden labels
const allById = new Map(sections.flatMap(([, items]) => items.map(b => [b.id, b])));
for (const [id, expected] of Object.entries(golden.labels)) {
  const bill = allById.get(id);
  if (!bill) {
    errors.push(`golden/${id}: labeled bill missing from bills.json (${expected.note})`);
    continue;
  }
  if (bill.position !== expected.position) {
    errors.push(`golden/${id}: position is "${bill.position}", golden expects "${expected.position}" (${expected.source})`);
  }
  const actualAttackType = bill.attackType ?? null;
  if (actualAttackType !== expected.attackType) {
    errors.push(`golden/${id}: attackType is ${JSON.stringify(actualAttackType)}, golden expects ${JSON.stringify(expected.attackType)} (${expected.source})`);
  }
}

const total = sections.reduce((n, [, items]) => n + items.length, 0);
console.log(`Checked ${total} entries against ${Object.keys(golden.labels).length} golden labels.`);
warnings.forEach(w => console.log(`⚠️  ${w}`));
if (errors.length) {
  errors.forEach(e => console.error(`❌ ${e}`));
  console.error(`\n${errors.length} error(s).`);
  process.exit(1);
}
console.log(`✅ Lint + golden-label eval passed (${warnings.length} warning(s)).`);

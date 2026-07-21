#!/usr/bin/env node

/**
 * Review tool for provisional (auto-discovered, not-yet-human-reviewed) bills.
 *
 * Usage:
 *   node scripts/review-provisional.js --report
 *     Writes PROVISIONAL-REVIEW.md (also prints to stdout) listing every
 *     provisional bill/rider/supportBill, sorted by relevanceScore desc.
 *
 *   node scripts/review-provisional.js --confirm <id> --position <oppose|support> --attackType <direct|partial> [--priority <high|medium|low|watching>] [--category <id>]
 *     Clears provisional, applies the reviewed classification, and moves the
 *     entry into the correct section (bills vs supportBills) if position
 *     changed — lint-bills.js requires position to match section.
 *
 *   node scripts/review-provisional.js --reject <id>
 *     Removes the entry entirely (use when auto-discovery pulled in
 *     something irrelevant, e.g. a false-positive DC keyword match).
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const billsPath = join(__dirname, '../src/data/bills.json');
const reportPath = join(__dirname, '../PROVISIONAL-REVIEW.md');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};

const SECTIONS = ['bills', 'riders', 'supportBills'];

function loadBills() {
  return JSON.parse(readFileSync(billsPath, 'utf-8'));
}

function saveBills(data) {
  data.lastUpdated = new Date().toISOString().split('T')[0];
  writeFileSync(billsPath, JSON.stringify(data, null, 2) + '\n');
}

function findBill(data, id) {
  for (const section of SECTIONS) {
    const arr = data[section] || [];
    const idx = arr.findIndex(b => b.id === id);
    if (idx !== -1) return { section, idx, bill: arr[idx] };
  }
  return null;
}

function report() {
  const data = loadBills();
  const provisional = [];

  for (const section of SECTIONS) {
    for (const bill of data[section] || []) {
      if (bill.provisional) provisional.push({ ...bill, _section: section });
    }
  }

  provisional.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

  const lines = [
    '# Provisional Bill Review',
    '',
    `Generated ${new Date().toISOString().split('T')[0]} — ${provisional.length} bill(s) awaiting human review.`,
    '',
    'Each entry was auto-added with `position: "oppose"` as a placeholder default, regardless of actual content —',
    'do not treat that as a finding. Confirm or reject each one:',
    '',
    '```',
    'node scripts/review-provisional.js --confirm <id> --position <oppose|support> --attackType <direct|partial> [--priority <high|medium|low|watching>]',
    'node scripts/review-provisional.js --reject <id>',
    '```',
    '',
    '| ID | Bill | Title | Sponsor | Score | Section | Link |',
    '|---|---|---|---|---|---|---|',
  ];

  for (const b of provisional) {
    const title = (b.title || '').replace(/\|/g, '\\|').slice(0, 90);
    const sponsor = (b.sponsors || []).join(', ').replace(/\|/g, '\\|');
    lines.push(
      `| ${b.id} | ${(b.billNumbers || []).join(', ')} | ${title} | ${sponsor} | ${b.relevanceScore ?? ''} | ${b._section} | [congress.gov](${b.congressGovLink || ''}) |`
    );
  }

  const output = lines.join('\n') + '\n';
  writeFileSync(reportPath, output);
  console.log(output);
  console.log(`\nWritten to ${reportPath}`);
}

function confirm(id) {
  const data = loadBills();
  const found = findBill(data, id);
  if (!found) {
    console.error(`No bill found with id "${id}"`);
    process.exit(1);
  }

  const position = flag('--position');
  const attackType = flag('--attackType');
  const priority = flag('--priority');
  const category = flag('--category');

  if (!position || !['oppose', 'support'].includes(position)) {
    console.error('--position <oppose|support> is required');
    process.exit(1);
  }
  // lint-bills.js only requires attackType on non-provisional bills/riders
  // (the oppose side) — supportBills entries mostly go without one.
  if (position === 'oppose' && (!attackType || !['direct', 'partial'].includes(attackType))) {
    console.error('--attackType <direct|partial> is required when --position oppose');
    process.exit(1);
  }
  if (attackType && !['direct', 'partial'].includes(attackType)) {
    console.error('--attackType must be "direct" or "partial"');
    process.exit(1);
  }

  const { section, idx, bill } = found;
  bill.position = position;
  if (attackType) {
    bill.attackType = attackType;
  } else {
    delete bill.attackType;
  }
  bill.provisional = false;
  if (priority) bill.priority = priority;
  if (category) bill.category = category;
  bill.prioritySource = bill.prioritySource === 'auto-discovered' ? 'manual' : bill.prioritySource;

  const targetSection = position === 'support' ? 'supportBills' : 'bills';
  if (targetSection !== section) {
    data[section].splice(idx, 1);
    data[targetSection] = data[targetSection] || [];
    data[targetSection].push(bill);
    console.log(`Moved ${id} from "${section}" to "${targetSection}"`);
  }

  saveBills(data);
  console.log(`Confirmed ${id}: position=${position}${attackType ? `, attackType=${attackType}` : ''}${priority ? `, priority=${priority}` : ''}`);
}

function reject(id) {
  const data = loadBills();
  const found = findBill(data, id);
  if (!found) {
    console.error(`No bill found with id "${id}"`);
    process.exit(1);
  }
  data[found.section].splice(found.idx, 1);
  saveBills(data);
  console.log(`Rejected and removed ${id} from "${found.section}"`);
}

function main() {
  if (args.includes('--report') || args.length === 0) {
    report();
  } else if (args.includes('--confirm')) {
    confirm(flag('--confirm'));
  } else if (args.includes('--reject')) {
    reject(flag('--reject'));
  } else {
    console.error('Usage: --report | --confirm <id> ... | --reject <id>');
    process.exit(1);
  }
}

main();

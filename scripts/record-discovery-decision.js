#!/usr/bin/env node

/**
 * Record a human decision on a review-tier discovery bill.
 *
 * Usage:
 *   node scripts/record-discovery-decision.js <not_relevant|support_parked|track> <billId> [issueNumber] [source] [actionDateReviewed]
 *     billId is the normalized form the discovery email links carry (hr1234, s56,
 *     hjres7, hres5, ...). The decision applies to the current Congress.
 *     actionDateReviewed (YYYY-MM-DD) is the bill's latest-action date shown in the
 *     email; any later action returns the bill to review.
 *
 * Called by .github/workflows/discovery-decision.yml with the issue number, which
 * orders decisions: GitHub issue numbers only increase, so a delayed run for an OLDER
 * issue never overwrites a newer decision on the same bill. Prints GITHUB_OUTPUT
 * lines: `display=`, `changed=true|false`, and `superseded_by=<issue>` when a newer
 * decision already stands (nothing is written). Exits 2 on invalid input, writing
 * nothing; the inputs come from an issue title, so they are validated here as well as
 * in the workflow.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { CURRENT_CONGRESS } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const decisionsPath = join(__dirname, 'discovery-decisions.json');

const DECISIONS = ['not_relevant', 'support_parked', 'track'];
// Same id set as discover-bills.js loadDecisions() and the workflow's title pattern.
const ID_RE = /^(hr|s|hjres|sjres|hconres|sconres|hres|sres)([1-9][0-9]{0,4})$/;
const DISPLAY = {
  hr: 'H.R.', s: 'S.', hjres: 'H.J.Res.', sjres: 'S.J.Res.',
  hconres: 'H.Con.Res.', sconres: 'S.Con.Res.', hres: 'H.Res.', sres: 'S.Res.'
};

const [decision, id, issueArg = '', source = 'manual', asOf = ''] = process.argv.slice(2);
const issue = issueArg === '' ? null : Number(issueArg);
const isCalendarDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d)
  && !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
if (!DECISIONS.includes(decision) || !ID_RE.test(id || '')
    || (issue !== null && !Number.isInteger(issue)) || (asOf !== '' && !isCalendarDate(asOf))) {
  console.error(`Invalid input: decision="${decision}" id="${id}" issue="${issueArg}" asOf="${asOf}"`);
  console.error(`Expected: <${DECISIONS.join('|')}> <billId> [issueNumber] [source]`);
  process.exit(2);
}

const [, type, number] = ID_RE.exec(id);
const displayNumber = `${DISPLAY[type]} ${number}`;
console.log(`display=${displayNumber}`);

const data = existsSync(decisionsPath)
  ? JSON.parse(readFileSync(decisionsPath, 'utf-8'))
  : { decisions: {} };
data.decisions ||= {};

const previous = data.decisions[id];
const sameCongress = previous?.congress === CURRENT_CONGRESS;
if (sameCongress && issue !== null && Number.isInteger(previous.issue) && previous.issue > issue) {
  console.log('changed=false');
  console.log(`superseded_by=${previous.issue}`);
  process.exit(0);
}

// Re-running the SAME issue leaves the file byte-identical (the workflow treats that as
// already recorded). A NEW issue is a fresh review, even with the same answer: it
// resets the dates, so re-affirming a bill that resurfaced stops it resurfacing.
if (sameCongress && issue !== null && previous.issue === issue) {
  console.log('changed=false');
  process.exit(0);
}
const changed = !sameCongress || previous.decision !== decision;
data.decisions[id] = {
  decision,
  congress: CURRENT_CONGRESS,
  displayNumber,
  ...(sameCongress && previous.title ? { title: previous.title } : {}),
  decidedAt: new Date().toISOString().split('T')[0],
  ...(asOf ? { actionDateReviewed: asOf } : {}),
  ...(issue !== null ? { issue } : {}),
  source
};

writeFileSync(decisionsPath, JSON.stringify(data, null, 2) + '\n');
console.log(`changed=${changed}`);

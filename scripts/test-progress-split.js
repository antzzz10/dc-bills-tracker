// Checks for the split shown under the headline count (src/lib/progressSplit.js).
// Run: node scripts/test-progress-split.js
import assert from 'node:assert/strict';
import { progressSplit, contextParts, shortParts, movingPhrase } from '../src/lib/progressSplit.js';

let checks = 0;
const eq = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks += 1; };

const bill = (n, stage, extra = {}) => ({ id: `b${n}`, billNumbers: [`H.R. ${n}`], status: stage ? { stage } : {}, ...extra });
const rider = (n, stage) => ({ id: `r${n}`, type: 'rider', billNumbers: ['H.R. 5166'], status: stage ? { stage } : {} });

// Three groups add up to the total; archived and unreviewed entries are outside it.
const mix = [
  bill(1, 'enacted'), bill(2, 'passed-house'), bill(3, 'passed-house'), bill(4), bill(5),
  bill(6, 'passed-house', { outcome: { archived: true } }), bill(7, null, { provisional: true }),
];
const split = progressSplit(mix);
eq([split.total, split.law, split.moving, split.notPassed], [5, 1, 2, 2], 'counts');
eq(split.law + split.moving + split.notPassed, split.total, 'adds up');
eq(split.movingWhere, 'house', 'all House');
eq(contextParts(split), ['1 is law', '2 passed the House and await the Senate', '2 have not passed either chamber'], 'context line');
eq(shortParts(split), ['1 law', '2 passed the House', '2 not passed either chamber'], 'short line');

// A law stored as three provision entries is one measure; each rider counts once.
const law3 = [1, 2, 3].map(i => ({ id: `hr1968-${i}`, billNumbers: ['H.R. 1968'], status: { stage: 'enacted' } }));
eq(progressSplit([...law3, rider(1, 'enacted'), rider(2, 'enacted'), rider(3)]).law, 3, 'measures, not entries');
eq(progressSplit([...law3, rider(1, 'enacted'), rider(2, 'enacted'), rider(3)]).notPassed, 1, 'pending rider');

// The chamber is named only while it is true of every measure in the group.
eq(progressSplit([bill(1, 'passed-senate'), bill(2, 'agreed-senate')]).movingWhere, 'senate', 'all Senate');
eq(progressSplit([bill(1, 'passed-house'), bill(2, 'passed-senate')]).movingWhere, 'mixed', 'both chambers');
eq(progressSplit([bill(1, 'passed-house'), bill(2, 'passed-both')]).movingWhere, 'mixed', 'passed both is not House-only');
eq(progressSplit([bill(1, 'sent-to-states')]).movingWhere, 'mixed', 'sent to the states');
eq(progressSplit([bill(1)]).movingWhere, null, 'nothing moving');
eq(contextParts(progressSplit([bill(1, 'passed-house'), bill(2, 'passed-senate')]))[0],
  '2 cleared at least one chamber and are not yet law', 'mixed wording');

// Singular agreement, and empty groups are left out.
eq(movingPhrase(1, 'house'), 'passed the House and awaits the Senate', 'singular House');
eq(movingPhrase(1, 'mixed'), 'cleared at least one chamber and is not yet law', 'singular mixed');
eq(contextParts(progressSplit([bill(1)])), ['1 has not passed either chamber'], 'only one group');
eq(contextParts(progressSplit([])), [], 'nothing tracked');

// No group is ever called "pending".
for (const items of [mix, law3, [bill(1, 'passed-senate')], [bill(1)]]) {
  const s = progressSplit(items);
  assert.ok(![...contextParts(s), ...shortParts(s)].some(p => /pending/i.test(p)), 'no "pending"');
  checks += 1;
}

console.log(`All ${checks} checks passed`);

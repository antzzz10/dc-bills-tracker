// Checks for the split shown under the headline count (src/lib/progressSplit.js).
// Run: node scripts/test-progress-split.js
import assert from 'node:assert/strict';
import { progressSplit, contextParts, shortParts, movingPhrase, listHeading } from '../src/lib/progressSplit.js';

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

// One measure stored as entries at different stages is still one measure, in one group
// (the furthest stage), so the groups always add up to the headline.
const torn = ['enacted', 'passed-house', undefined].map((stage, i) =>
  ({ id: `hr1-${i}`, billNumbers: ['H.R. 1'], status: stage ? { stage } : {} }));
const tornSplit = progressSplit(torn);
eq([tornSplit.total, tornSplit.law, tornSplit.moving, tornSplit.notPassed], [1, 1, 0, 0], 'one measure, one group');

// The chamber is named only while it is the whole truth for every measure in the group.
const res = (number, stage) => ({ id: number, billNumbers: [number], status: { stage } });
eq(progressSplit([bill(1, 'passed-senate'), res('S.J.Res. 9', 'passed-senate')]).movingWhere, 'senate', 'all Senate');
eq(progressSplit([bill(1, 'passed-house'), bill(2, 'passed-senate')]).movingWhere, 'mixed', 'both chambers');
eq(progressSplit([bill(1, 'passed-house'), bill(2, 'passed-both')]).movingWhere, 'mixed', 'passed both is not House-only');
eq(progressSplit([bill(1, 'sent-to-states')]).movingWhere, 'mixed', 'sent to the states');
eq(progressSplit([bill(1)]).movingWhere, null, 'nothing moving');
// A simple resolution agreed to by the House is finished there: it awaits nothing.
eq(progressSplit([bill(1, 'passed-house'), res('H.Res. 5', 'agreed-house')]).movingWhere, 'mixed', 'simple resolution');
eq(progressSplit([res('H.Con.Res. 5', 'agreed-house')]).movingWhere, 'mixed', 'concurrent resolution');
// Both chambers passed different texts: the stage stays passed-house, but it does not await the Senate.
eq(progressSplit([bill(1, 'passed-house'), { ...bill(2), status: { stage: 'passed-house', bothChambersPassed: true } }]).movingWhere,
  'mixed', 'other chamber has passed it too');
eq(contextParts(progressSplit([bill(1, 'passed-house'), bill(2, 'passed-senate')]))[0],
  '2 cleared at least one chamber and are not law', 'mixed wording');

// Singular agreement, and empty groups are left out.
eq(movingPhrase(1, 'house'), 'passed the House and awaits the Senate', 'singular House');
eq(movingPhrase(1, 'mixed'), 'cleared at least one chamber and is not law', 'singular mixed');
eq(contextParts(progressSplit([bill(1)])), ['1 has not passed either chamber'], 'only one group');
eq(contextParts(progressSplit([])), [], 'nothing tracked');

// The list heading: the headline never changes with a search; the match line adds up.
const overall = progressSplit(mix);
eq(listHeading({ overall, archived: 18, routine: 1, barriers: 1 }), {
  headline: '5 threats to D.C. home rule',
  breakdown: '1 law, 2 passed the House, 2 not passed either chamber',
  also: 'Also listed: 18 archived, 1 routine, 1 barrier to statehood',
}, 'heading, nothing filtered');
eq(listHeading({ overall, matching: progressSplit([bill(1, 'enacted'), bill(4)]), archived: 16 }), {
  headline: '5 threats to D.C. home rule',
  breakdown: '1 law, 2 passed the House, 2 not passed either chamber',
  also: 'Showing 18 matches: 1 law, 1 not passed either chamber, 16 archived',
}, 'heading during a search');
eq(listHeading({ overall, matching: progressSplit([]) }).also, 'No matches', 'search with no matches');
eq(listHeading({ overall, matching: progressSplit([bill(4)]) }).also, 'Showing 1 match: 1 not passed either chamber', 'one match');
eq(listHeading({ overall: progressSplit([bill(1)]) }), { headline: '1 threat to D.C. home rule', breakdown: '1 not passed either chamber', also: '' }, 'singular headline');

// No group is ever called "pending".
for (const items of [mix, law3, [bill(1, 'passed-senate')], [bill(1)]]) {
  const s = progressSplit(items);
  assert.ok(![...contextParts(s), ...shortParts(s)].some(p => /pending/i.test(p)), 'no "pending"');
  checks += 1;
}

console.log(`All ${checks} checks passed`);

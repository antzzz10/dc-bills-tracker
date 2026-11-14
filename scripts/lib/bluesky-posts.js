// Bluesky posts built from the daily check. Plan: docs/2026-11-10-bluesky-auto-posting-plan.md
// (v0.2, answers 2026-11-13). Pure functions only: nothing here reads the network or posts.
//
// What can be posted (Andria, 2026-11-13): changes to a measure's status, a new measure
// added after review, and changes to cosponsor counts. Only from a healthy daily check,
// only for reviewed entries that aren't archived, and only facts the monitor read from
// Congress.gov this run and wrote to bills.json, never a hand correction to our own data.
//
// Not posted, by design:
//   - committee hearings and markups: the monitor flags them from any action whose text
//     contains "hearing" or "markup", which is too loose to publish as fact;
//   - riders, amendments and other provisions, including any entry that shares a bill
//     number with another entry (H.R. 5242's two floor amendments, H.R. 1968's three
//     provisions are stored as bills): the number's status and cosponsors are the parent
//     bill's, not the provision's;
//   - entries under manualOverride or with a hand-verified outcome: the monitor doesn't
//     write their status, so a Congress.gov reading is not what the site says;
//   - routine measures.
//
// A ledger (bluesky-ledger.json, committed with the day's bills.json) records each entry's
// measure, stage and cosponsor count as last posted, so an event is posted once. The first
// run with no ledger records a baseline and posts nothing.

import { isActive, isProvision, measureType, isConstitutionalAmendment } from '../../src/lib/measureStatus.js';

export const TRACKER_LINK = 'billtracker.representdc.org';
export const MAX_POSTS_PER_RUN = 3;
export const MAX_GRAPHEMES = 300;
export const POSTABLE_SECTIONS = ['bills', 'supportBills', 'statehoodBarriers'];
const ALL_SECTIONS = ['bills', 'riders', 'supportBills', 'routineBills', 'statehoodBarriers'];

// Order on a busy day and in the email: the most consequential first.
const STAGE_WEIGHT = {
  enacted: 0, 'sent-to-states': 0,
  'passed-both': 1, 'agreed-both': 1,
  'passed-house': 2, 'passed-senate': 2, 'agreed-house': 2, 'agreed-senate': 2
};
const KIND_WEIGHT = { stage: 0, new: 3, cosponsors: 4 };

const graphemes = text => [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text)].length;
const normalizeNumber = raw => String(raw || '').replace(/\s+/g, '').toUpperCase();

/** "H.J.Res.142" → "H.J.Res. 142"; "H.R. 5103" unchanged. */
export function displayNumber(raw) {
  const compact = String(raw || '').replace(/\s+/g, '');
  const m = compact.match(/^([A-Za-z.]+?)(\d+)$/);
  return m ? `${m[1]} ${m[2]}` : String(raw || '').trim();
}

/** Which measure an entry is: Congress and first bill number. */
export const measureKey = entry => `${entry.congress}:${normalizeNumber(entry.billNumbers?.[0])}`;

function kindWord(entry) {
  if (isConstitutionalAmendment(entry)) return 'constitutional amendment';
  const type = measureType(entry);
  if (type === 'bill') return 'bill';
  if (type === 'joint' || type === 'concurrent' || type === 'simple') return 'resolution';
  return 'measure';
}

const formatDate = iso => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return null;
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  });
};

const isRollCall = vote => Number.isInteger(vote?.yeas) && Number.isInteger(vote?.nays);

// Measures (Congress + first bill number) carried by more than one entry anywhere in the
// data. The monitor looks an entry up by its first number, so entries sharing one share
// a reading. (A companion listed second, like S. 900's H.R. 1421, is its own measure and
// own lookup; the same number in another Congress is a different measure.)
function sharedMeasures(billsData) {
  const seen = new Map();
  for (const section of ALL_SECTIONS) {
    for (const entry of billsData[section] || []) {
      const key = measureKey(entry);
      seen.set(key, (seen.get(key) || 0) + 1);
    }
  }
  return new Set([...seen].filter(([, count]) => count > 1).map(([key]) => key));
}

// Every reviewed entry of this Congress in a postable section, each marked whether it may
// be posted about. The ledger remembers all of them, so an entry that becomes postable
// later (a provision moved to its own number, an override lifted) is never "new".
function candidates(billsData, currentCongress) {
  const shared = sharedMeasures(billsData);
  return POSTABLE_SECTIONS.flatMap(section =>
    (billsData[section] || [])
      .filter(entry => !entry.provisional && entry.congress === currentCongress && (entry.billNumbers || []).length > 0)
      .map(entry => ({
        section,
        entry,
        postable: isActive(entry) &&
          !isProvision(entry) &&
          !entry.manualOverride &&
          !entry.outcome &&
          !shared.has(measureKey(entry))
      })));
}

// A cosponsor count counts only if Congress.gov returned it this run and the monitor
// wrote that same number to bills.json (what the site shows).
function observedCosponsors(entry, freshCosponsors) {
  const fresh = freshCosponsors.get(entry.id);
  return Number.isInteger(fresh) && entry.status?.cosponsors === fresh ? fresh : null;
}

const newRecord = (entry, freshCosponsors) => ({
  measure: measureKey(entry),
  stage: entry.status?.stage ?? null,
  cosponsors: observedCosponsors(entry, freshCosponsors)
});

/** The ledger as it would be if everything in the data had already been posted. */
export function seedLedger(billsData, currentCongress, now, freshCosponsors = new Map()) {
  const ledger = { seededAt: now, updatedAt: now, entries: {} };
  for (const { entry } of candidates(billsData, currentCongress)) {
    ledger.entries[entry.id] = newRecord(entry, freshCosponsors);
  }
  return ledger;
}

const isPlainObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);

/** Throws unless the ledger has the shape this module writes. A damaged ledger must never
 *  be read as "nothing posted yet" (every entry would be announced as new). */
export function assertValidLedger(ledger) {
  if (!isPlainObject(ledger) || !isPlainObject(ledger.entries)) throw new Error('Bluesky ledger has no entries object');
  for (const [id, record] of Object.entries(ledger.entries)) {
    const ok = isPlainObject(record) &&
      typeof record.measure === 'string' && /^\d+:.+/.test(record.measure) &&
      (record.stage === null || typeof record.stage === 'string') &&
      (record.cosponsors === null || (Number.isInteger(record.cosponsors) && record.cosponsors >= 0));
    if (!ok) throw new Error(`Bluesky ledger record for ${id} is malformed`);
  }
}

/**
 * Today's postable events, and the ledger after them.
 *
 * passed: the monitor's stage changes this run, each { id, section, stage, houseVote,
 *   senateVote }. They come only from Congress.gov actions, never from hand edits.
 * looked: ids of entries whose Congress.gov lookup succeeded this run.
 * freshCosponsors: Map id → cosponsor count read from Congress.gov this run.
 */
export function collectEvents({ billsData, passed = [], looked = new Set(), freshCosponsors = new Map(), ledger, currentCongress, now }) {
  // Only a missing file (passed as undefined) seeds. Anything read from an existing file,
  // null included, must be a valid ledger.
  if (ledger === undefined) {
    return { events: [], ledger: seedLedger(billsData, currentCongress, now, freshCosponsors), seeded: true };
  }
  assertValidLedger(ledger);
  const all = candidates(billsData, currentCongress);
  // A seeded ledger remembers every entry. An empty one next to real data has been wiped,
  // and reading it would announce every entry as new.
  if (Object.keys(ledger.entries).length === 0 && all.length > 0) throw new Error('Bluesky ledger is empty');
  const next = { ...ledger, updatedAt: now, entries: { ...ledger.entries } };
  const events = [];
  const candidateIds = new Set(all.map(({ entry }) => entry.id));
  const knownMeasures = new Set(Object.values(next.entries).map(r => r.measure));

  for (const { section, entry, postable } of all) {
    const measure = measureKey(entry);
    let known = next.entries[entry.id];

    const sameCongress = known && known.measure.split(':')[0] === String(entry.congress);
    if (known && known.measure !== measure && sameCongress) {
      // Same id and Congress, different number: a correction to our data, never news. The
      // measure and count are re-baselined silently; the stage is kept, so a passage
      // Congress.gov reports this same run is still posted below.
      next.entries[entry.id] = { ...known, measure, cosponsors: observedCosponsors(entry, freshCosponsors) };
      knownMeasures.add(measure);
      continue;
    }
    if (known && !sameCongress) {
      // An id reused in a new Congress is a different measure: drop the old record and
      // treat the entry like any other unknown one.
      delete next.entries[entry.id];
      known = undefined;
    }
    if (!known) {
      // A record for the same measure under an id no longer in the data: the entry was
      // renamed. Carry the record over and carry on.
      const renamedFrom = Object.keys(next.entries).find(id => next.entries[id].measure === measure && !candidateIds.has(id));
      if (renamedFrom) {
        known = next.entries[renamedFrom];
        delete next.entries[renamedFrom];
        next.entries[entry.id] = known;
      } else if (!postable || knownMeasures.has(measure)) {
        // Remembered silently: an entry that can't be posted about, or a second entry for
        // a measure already known.
        next.entries[entry.id] = newRecord(entry, freshCosponsors);
        continue;
      } else {
        // New only once its own lookup has succeeded, so a number that doesn't resolve on
        // Congress.gov is never announced. Until then it stays out of the ledger.
        if (!looked.has(entry.id)) continue;
        events.push({ kind: 'new', section, entry });
        next.entries[entry.id] = newRecord(entry, freshCosponsors);
        knownMeasures.add(measure);
        continue;
      }
    }

    const count = observedCosponsors(entry, freshCosponsors);
    if (!postable) {
      // Kept current, but never posted: when it becomes postable, its first reading there
      // starts fresh rather than comparing against an old count.
      next.entries[entry.id] = { ...known, cosponsors: count };
      continue;
    }
    if (count === null) continue;
    if (Number.isInteger(known.cosponsors) && known.cosponsors !== count) {
      events.push({ kind: 'cosponsors', section, entry, from: known.cosponsors, to: count });
    }
    next.entries[entry.id] = { ...known, cosponsors: count };
  }

  const postableById = new Map(all.filter(x => x.postable).map(x => [x.entry.id, x]));
  for (const p of passed) {
    const match = postableById.get(p.id);
    if (!match || match.section !== p.section) continue;
    const { entry } = match;
    // The stored stage must agree with what the monitor reported; anything else is a
    // write that didn't land, and is not posted.
    if (entry.status?.stage !== p.stage || !(p.stage in STAGE_WEIGHT)) continue;
    const record = next.entries[entry.id];
    if (!record || record.stage === p.stage) continue;
    // A new entry is posted as new; its stage that same day is part of that record.
    if (!events.some(e => e.kind === 'new' && e.entry.id === entry.id)) {
      events.push({ kind: 'stage', section: p.section, entry, stage: p.stage, houseVote: p.houseVote, senateVote: p.senateVote });
    }
    next.entries[entry.id] = { ...record, stage: p.stage };
  }

  events.sort((a, b) => weight(a) - weight(b) || POSTABLE_SECTIONS.indexOf(a.section) - POSTABLE_SECTIONS.indexOf(b.section));
  return { events, ledger: next, seeded: false };
}

const weight = e => KIND_WEIGHT[e.kind] + (e.kind === 'stage' ? STAGE_WEIGHT[e.stage] / 10 : 0);

// "anti-DC bill H.R. 5103"; a barrier keeps the tracker's own wording, "a barrier to statehood".
function subject(event, num) {
  const kind = kindWord(event.entry);
  if (event.section === 'statehoodBarriers') return `${kind} ${num} (a barrier to statehood)`;
  return `${event.section === 'supportBills' ? 'pro-DC' : 'anti-DC'} ${kind} ${num}`;
}

const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);

function eventSentence(event, withTitle) {
  const num = displayNumber(event.entry.billNumbers?.[0]);
  // A title that ends in its own period ("…and for other purposes.") would read "purposes.,".
  const title = withTitle ? String(event.entry.title || '').trim().replace(/[.;:,]+$/, '') : '';
  const named = title ? `${subject(event, num)}, ${title}` : subject(event, num);

  if (event.kind === 'stage') {
    const tally = vote => (isRollCall(vote) ? ` (${vote.yeas}-${vote.nays})` : '');
    switch (event.stage) {
      case 'passed-house': return `Passed the House: ${named}${tally(event.houseVote)}.`;
      case 'passed-senate': return `Passed the Senate: ${named}${tally(event.senateVote)}.`;
      case 'agreed-house': return `Agreed to by the House: ${named}${tally(event.houseVote)}.`;
      case 'agreed-senate': return `Agreed to by the Senate: ${named}${tally(event.senateVote)}.`;
      // No "next step": a check can catch up after a veto, and the stage alone can't say
      // where a bill is now.
      case 'passed-both': return `Passed both chambers: ${named}.`;
      case 'agreed-both': return `Agreed to by both chambers: ${named}.`;
      case 'sent-to-states': return `Passed both chambers: ${named}. It goes to the states for ratification.`;
      case 'enacted': return `Became law: ${named}.`;
      default: return null;
    }
  }
  if (event.kind === 'new') {
    const date = formatDate(event.entry.status?.introducedDate);
    const kind = kindWord(event.entry);
    const what = title ? `${num}, ${title}` : num;
    const lead = event.section === 'statehoodBarriers'
      ? `New barrier to statehood: ${kind} ${what}`
      : `New ${event.section === 'supportBills' ? 'pro-DC' : 'anti-DC'} ${kind}: ${what}`;
    return `${lead}${date ? `, introduced ${date}` : ''}.`;
  }
  if (event.kind === 'cosponsors') {
    const noun = event.to === 1 ? 'cosponsor' : 'cosponsors';
    const direction = event.to > event.from ? 'up' : 'down';
    const who = title ? `${capitalize(subject(event, num))}, ${title},` : capitalize(subject(event, num));
    return `${who} now has ${event.to} ${noun}, ${direction} from ${event.from}.`;
  }
  return null;
}

/** One post's text: with the tracker's title if it fits, otherwise the number alone. */
export function postText(event) {
  for (const withTitle of [true, false]) {
    const sentence = eventSentence(event, withTitle);
    if (!sentence) return null;
    const text = `${sentence} ${TRACKER_LINK}`;
    if (graphemes(text) <= MAX_GRAPHEMES) return text;
  }
  return null;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const NEW_NOUN = {
  bills: ['new anti-DC measure', 'new anti-DC measures'],
  supportBills: ['new pro-DC measure', 'new pro-DC measures'],
  statehoodBarriers: ['new barrier to statehood', 'new barriers to statehood']
};

/** The busy-day post: counts by kind, in the same order as the posts would have been. */
export function summaryText(events) {
  const parts = [];
  const stages = events.filter(e => e.kind === 'stage');
  const law = stages.filter(e => e.stage === 'enacted').length;
  const states = stages.filter(e => e.stage === 'sent-to-states').length;
  const chamber = stages.length - law - states;
  if (law) parts.push(`${plural(law, 'measure', 'measures')} became law`);
  if (states) parts.push(`${plural(states, 'constitutional amendment', 'constitutional amendments')} passed both chambers`);
  if (chamber) parts.push(`${plural(chamber, 'measure', 'measures')} passed or ${chamber === 1 ? 'was' : 'were'} agreed to in a chamber`);
  for (const section of POSTABLE_SECTIONS) {
    const added = events.filter(e => e.kind === 'new' && e.section === section).length;
    if (added) parts.push(`${plural(added, ...NEW_NOUN[section])} added`);
  }
  const cos = events.filter(e => e.kind === 'cosponsors').length;
  if (cos) parts.push(`${plural(cos, 'measure', 'measures')} gained or lost cosponsors`);
  const text = `Tracker update: ${parts.join('; ')}. ${TRACKER_LINK}`;
  return graphemes(text) <= MAX_GRAPHEMES ? text : `Tracker update: ${plural(events.length, 'change', 'changes')} today. ${TRACKER_LINK}`;
}

/** What would be posted: one post per event, or a single summary on a busy day. */
export function composePosts(events) {
  if (events.length === 0) return [];
  if (events.length > MAX_POSTS_PER_RUN) return [{ kind: 'summary', text: summaryText(events), events }];
  return events.map(event => ({ kind: event.kind, text: postText(event), events: [event] })).filter(p => p.text);
}

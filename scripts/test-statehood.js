#!/usr/bin/env node

/**
 * Offline tests for the statehood-bill cosponsor fetch and store (scripts/lib/statehood.js).
 * No API key, no network: the Congress.gov responses are mocked.
 *
 *   node scripts/test-statehood.js
 */

import assert from 'assert/strict';
import { fetchFullCosponsorList, nextStoreRecord, computeTotals, buildStatehoodPayload } from './lib/statehood.js';
import { fetchJsonWithRetry, redactKey } from './lib/congress-api.js';

const API = 'https://api.congress.gov/v3';
const NEXT = offset => `${API}/bill/119/hr/51/cosponsors?offset=${offset}&limit=250&format=json`;
const row = (id, extra = {}) => ({
  bioguideId: id, firstName: 'A', lastName: id, party: 'D', state: 'NY', district: 1,
  sponsorshipDate: '2025-01-03', isOriginalCosponsor: true, ...extra
});
const json = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: k => headers[k.toLowerCase()] ?? null },
  json: async () => body
});
// Routes by offset in the URL; each route is a queue of responses.
function mockFetch(routes) {
  const calls = [];
  const impl = async url => {
    calls.push(url);
    const offset = new URL(url).searchParams.get('offset') || '0';
    const queue = routes[offset];
    if (!queue?.length) throw new Error(`no mock for offset ${offset}`);
    return queue.length > 1 ? queue.shift() : queue[0];
  };
  return { impl, calls };
}
const run = (routes, extra = {}) => {
  const { impl, calls } = mockFetch(routes);
  return fetchFullCosponsorList({
    apiBase: API, congress: 119, billType: 'hr', number: 51, apiKey: 'KEY',
    fetchOptions: { fetchImpl: impl, sleepImpl: async () => {}, ...extra }
  }).then(r => ({ r, calls }));
};
const page = (rows, count, withWithdrawn, next) => ({
  pagination: { count, countIncludingWithdrawnCosponsors: withWithdrawn, ...(next ? { next } : {}) },
  cosponsors: rows
});

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('two pages, one withdrawal: complete, withdrawn dropped, key re-added to next', async () => {
  const { r, calls } = await run({
    0: [json(200, page([row('A1'), row('A2', { sponsorshipWithdrawnDate: '2025-02-01' })], 2, 3, NEXT(2)))],
    2: [json(200, page([row('A3', { sponsorshipDate: '2025-01-02' })], 2, 3))]
  });
  assert.equal(r.complete, true, r.reason);
  assert.deepEqual(r.cosponsors.map(c => c.bioguideId), ['A3', 'A1']); // sorted by join date
  assert.equal(r.withdrawnCount, 1);
  assert.match(calls[0], /limit=250/);
  assert.match(calls[1], /api_key=KEY/);
  assert.equal(r.cosponsors[0].name, 'A A3');
});

test('429 then success: retried, complete', async () => {
  const { r, calls } = await run({ 0: [json(429, {}, { 'retry-after': '1' }), json(200, page([row('A1')], 1, 1))] });
  assert.equal(r.complete, true, r.reason);
  assert.equal(calls.length, 2);
});

test('persistent 503: incomplete with reason', async () => {
  const { r, calls } = await run({ 0: [json(503, {})] });
  assert.equal(r.complete, false);
  assert.match(r.reason, /HTTP 503/);
  assert.equal(calls.length, 5); // 1 + 4 retries
});

test('404 is not retried', async () => {
  const { calls, r } = await run({ 0: [json(404, {})] });
  assert.equal(r.complete, false);
  assert.equal(calls.length, 1);
});

test('kept rows fewer than pagination.count: incomplete', async () => {
  const { r } = await run({ 0: [json(200, page([row('A1')], 2, 2))] });
  assert.equal(r.complete, false);
  assert.match(r.reason, /kept 1/);
});

test('rows missing against countIncludingWithdrawn: incomplete', async () => {
  const { r } = await run({ 0: [json(200, page([row('A1')], 1, 2))] });
  assert.equal(r.complete, false);
});

test('duplicate member across pages: incomplete', async () => {
  const { r } = await run({
    0: [json(200, page([row('A1')], 2, 2, NEXT(1)))],
    1: [json(200, page([row('A1')], 2, 2))]
  });
  assert.equal(r.complete, false);
  assert.match(r.reason, /kept|duplicate/);
});

test('counts change mid-walk: incomplete', async () => {
  const { r } = await run({
    0: [json(200, page([row('A1')], 2, 2, NEXT(1)))],
    1: [json(200, page([row('A2')], 3, 3))]
  });
  assert.equal(r.complete, false);
  assert.match(r.reason, /mid-walk/);
});

test('pagination.next off the API, or carrying credentials: refused, key never sent or reported', async () => {
  for (const bad of ['https://evil.example/v3/bill/119/hr/51/cosponsors?offset=1',
    'https://user:pass@api.congress.gov/v3/bill/119/hr/51/cosponsors?offset=1',
    `${API}/bill/119/s/51/cosponsors?offset=1`]) {
    const { r, calls } = await run({ 0: [json(200, page([row('A1')], 2, 2, bad))] });
    assert.equal(r.complete, false);
    assert.match(r.reason, /unexpected pagination.next/);
    assert.equal(calls.length, 1);
    assert.doesNotMatch(r.reason, /KEY|pass/);
  }
});

test('network error text carrying the key is redacted', async () => {
  const res = await fetchJsonWithRetry('u', {
    retries: 0, sleepImpl: async () => {},
    fetchImpl: async () => { throw new Error('Failed to parse URL from https://user:pw@api.congress.gov/x?api_key=SECRET123&y=1'); }
  });
  assert.equal(res.ok, false);
  assert.doesNotMatch(res.reason, /SECRET123|pw@/);
  assert.equal(redactKey('a?api_key=K"'), 'a?api_key=REDACTED"');
});

const entry = { id: 'hr51', congress: 119, billNumbers: ['H.R. 51'], title: 'T', supportBills: true };
const meta = { title: 'T', sponsor: { bioguideId: 'N000147' }, introducedDate: '2025-01-03', latestAction: { actionDate: '2025-01-03', text: 'x' }, congressGovUrl: 'u' };

test('store: failure keeps previous list and checkedAt, notes failure', () => {
  const previous = nextStoreRecord({ entry, billMeta: meta, fetchResult: { complete: true, cosponsors: [{ bioguideId: 'A1' }], withdrawnCount: 0 }, now: 'T1' });
  const next = nextStoreRecord({ previous, entry, billMeta: meta, fetchResult: { complete: false, reason: 'HTTP 503 api_key=SECRET' }, now: 'T2' });
  assert.equal(next.checkedAt, 'T1');
  assert.equal(next.cosponsors.length, 1);
  assert.equal(next.lastFailure.at, 'T2');
  assert.doesNotMatch(next.lastFailure.reason, /SECRET/);
});

test('store: first-ever failure is incomplete, no checkedAt, no rows', () => {
  const rec = nextStoreRecord({ entry, fetchResult: undefined, now: 'T' });
  assert.equal(rec.complete, false);
  assert.equal(rec.checkedAt, undefined);
  assert.deepEqual(rec.cosponsors, []);
});

test('totals: non-voting counted in the House only', () => {
  const list = [{ party: 'D', state: 'PR', isOriginalCosponsor: true }, { party: 'R', state: 'NY', isOriginalCosponsor: false }];
  assert.deepEqual(computeTotals(list, 'house'), { cosponsors: 2, original: 1, nonVoting: 1, byParty: { D: 1, R: 1 }, byState: { NY: 1, PR: 1 } });
  assert.equal(computeTotals(list, 'senate').nonVoting, 0);
});

test('payload: incomplete row has no checkedAt; past-Congress row is not current', () => {
  const billsData = { supportBills: [{ ...entry, flagship: true }, { id: 's51', congress: 119, billNumbers: ['S. 51'], flagship: true }] };
  const store = { bills: { hr51: { complete: true, checkedAt: 'T1', cosponsors: [{ bioguideId: 'A', party: 'D', state: 'DC', isOriginalCosponsor: true }] }, s51: { complete: false, cosponsors: [] } } };
  const p = buildStatehoodPayload({ store, billsData, currentCongress: 120, generatedAt: 'G' });
  const [house, senate] = p.bills;
  assert.equal(house.chamber, 'house');
  assert.equal(house.checkedAt, 'T1');
  assert.equal(house.current, false);
  assert.equal(house.totals.nonVoting, 1);
  assert.equal('checkedAt' in senate, false);
  assert.equal(senate.totals, null); // unavailable, not zero
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`✗ ${name}\n   ${e.message}`);
  }
}
if (failed) {
  console.error(`\n${failed} of ${tests.length} failed`);
  process.exit(1);
}
console.log(`\n✅ ${tests.length} statehood tests passed`);

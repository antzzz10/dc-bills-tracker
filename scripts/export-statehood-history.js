#!/usr/bin/env node

/**
 * One-time export: the statehood bill in earlier Congresses, for the comparison table on
 * representdc.org/statehood-bill (PRD #4: end-of-Congress totals, 115th-119th).
 *
 *   node scripts/export-statehood-history.js [path/to/representdc-data]
 *
 * Reads representdc-data (GovInfo BILLSTATUS records, read-only) and writes
 * src/data/statehood-bill-history.json. The bills come from that repo's hand-reviewed
 * `dc-statehood-admission` family, never from a bill number guessed here.
 *
 * Counts exclude withdrawn cosponsors. The 119th row is a snapshot of a Congress still in
 * session (`final: false`); the live count is in statehood-cosponsors.json. Re-run only
 * to refresh that snapshot or after the archive is corrected; lint-bills.js pins the
 * values it must produce.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { CURRENT_CONGRESS } from './config.js';
import { nameFromFullName, congressGovBillUrl } from './lib/statehood.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const archive = process.argv[2] || join(homedir(), 'Projects/representdc-data');
const FAMILY_ID = 'dc-statehood-admission';
const FIRST_CONGRESS = 115;

const families = JSON.parse(readFileSync(join(archive, 'families.json'), 'utf-8')).families;
const family = families.find(f => f.id === FAMILY_ID);
if (!family) throw new Error(`family ${FAMILY_ID} not found in ${archive}/families.json`);

const LABEL = { hr: 'H.R.', s: 'S.' };

// The Library of Congress's own passage action ("Passed/agreed to in House: ..."), which
// appears once per chamber passage; the chamber's floor-action duplicate is ignored.
function passageDate(actions, chamber) {
  const prefix = `Passed/agreed to in ${chamber}`;
  const dates = (actions || []).filter(a => (a.text || '').startsWith(prefix)).map(a => a.actionDate);
  return dates.length ? dates.sort()[0] : null;
}

function measureRow({ congress, type, number }) {
  const record = JSON.parse(readFileSync(join(archive, `bills/${congress}/${type}/${number}.json`), 'utf-8'));
  const cosponsors = record.cosponsors || [];
  const withdrawn = cosponsors.filter(c => c.sponsorshipWithdrawnDate).length;
  const sponsor = record.sponsors?.[0];
  return {
    billNumber: `${LABEL[type]} ${number}`,
    title: record.title,
    sponsor: sponsor ? {
      bioguideId: sponsor.bioguideId,
      name: nameFromFullName(sponsor.fullName),
      party: sponsor.party || null,
      state: sponsor.state || null
    } : null,
    introducedDate: record.introducedDate,
    cosponsors: cosponsors.length - withdrawn,
    withdrawnCosponsors: withdrawn,
    passedHouse: passageDate(record.actions, 'House'),
    passedSenate: passageDate(record.actions, 'Senate'),
    // The GovInfo BILLSTATUS record itself. (GovInfo has no /app/details page for
    // BILLSTATUS packages: that URL form returned HTTP 500 on 2026-11-10.)
    url: record.provenance?.url || `https://www.govinfo.gov/bulkdata/BILLSTATUS/${congress}/${type}/BILLSTATUS-${congress}${type}${number}.xml`,
    congressGovUrl: congressGovBillUrl(congress, type, number),
    retrievedAt: record.provenance?.retrievedAt || null
  };
}

const congresses = [];
for (let congress = FIRST_CONGRESS; congress <= CURRENT_CONGRESS; congress++) {
  const measures = family.measures.filter(m => m.congress === congress);
  const house = measures.find(m => m.type === 'hr');
  const senate = measures.find(m => m.type === 's');
  const row = {
    congress,
    startYear: 1789 + (congress - 1) * 2,
    endYear: 1789 + congress * 2,
    final: congress < CURRENT_CONGRESS,
    house: house ? measureRow(house) : null,
    senate: senate ? measureRow(senate) : null
  };
  // The furthest official step either chamber's bill reached, for the table's last column.
  const passages = [row.house, row.senate].filter(Boolean).flatMap(m => [
    m.passedSenate && { text: 'Passed Senate', date: m.passedSenate, rank: 2 },
    m.passedHouse && { text: 'Passed House', date: m.passedHouse, rank: 1 }
  ]).filter(Boolean).sort((a, b) => b.rank - a.rank || a.date.localeCompare(b.date));
  row.furthestAction = passages.length ? { text: passages[0].text, date: passages[0].date } : null;
  congresses.push(row);
}

const out = {
  generatedFrom: `representdc-data families.json "${FAMILY_ID}" (reviewed ${family.reviewed}); GovInfo BILLSTATUS bulk data`,
  note: 'Cosponsor counts exclude withdrawn cosponsors. Rows with final: false are a snapshot of a Congress still in session; the live count is in statehood-cosponsors.json.',
  congresses
};
const outPath = join(__dirname, '../src/data/statehood-bill-history.json');
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
for (const c of congresses) {
  console.log(`${c.congress}th: House ${c.house?.billNumber} ${c.house?.cosponsors} · Senate ${c.senate?.billNumber} ${c.senate?.cosponsors} · ${c.furthestAction ? `${c.furthestAction.text} ${c.furthestAction.date}` : 'no passage'}`);
}
console.log(`💾 ${outPath}`);

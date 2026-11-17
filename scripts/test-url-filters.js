// Offline checks for links that open the tracker with a category selected.
import process from 'node:process';
import { readFileSync } from 'node:fs';
import { categoriesFromQuery, withoutFilterParams } from '../src/lib/urlFilters.js';

const { categories } = JSON.parse(readFileSync(new URL('../src/data/bills.json', import.meta.url)));
let failed = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) { failed++; console.log(`    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`); }
}

check('no query: nothing selected', categoriesFromQuery('', categories), []);
check('a known category', categoriesFromQuery('?category=crime', categories), ['crime']);
check('old name "health" still works', categoriesFromQuery('?category=health', categories), ['healthcare']);
check('old name "cannabis" still works', categoriesFromQuery('?category=cannabis', categories), ['marijuana']);
check('unknown category is ignored', categoriesFromQuery('?category=budget', categories), []);
check('case and spaces are forgiven', categoriesFromQuery('?category=%20Crime%20', categories), ['crime']);
check('two categories, no duplicates', categoriesFromQuery('?category=crime&category=elections&category=crime', categories), ['crime', 'elections']);
check('search text in the address is never read', categoriesFromQuery('?search=budget', categories), []);
check('other parameters are ignored', categoriesFromQuery('?v=1&utm_source=email', categories), []);

// Every link the main site sends must select exactly one category here.
for (const id of ['crime', 'healthcare', 'elections', 'transportation', 'marijuana', 'civic-spaces']) {
  check(`main-site link ?category=${id} selects it`, categoriesFromQuery(`?category=${id}`, categories), [id]);
}

check('the filter is removed from the address', withoutFilterParams('https://billtracker.representdc.org/?category=crime'), '/');
check('other parameters and the hash are kept', withoutFilterParams('https://billtracker.representdc.org/?utm_source=email&category=crime#how-we-track'), '/?utm_source=email#how-we-track');

if (failed) { console.log(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\nAll checks passed');

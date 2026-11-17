// Offline checks for links that open the tracker already filtered.
import { filtersFromQuery } from '../src/lib/urlFilters.js';
import { readFileSync } from 'node:fs';

const { categories } = JSON.parse(readFileSync(new URL('../src/data/bills.json', import.meta.url)));
let failed = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) { failed++; console.log(`    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`); }
}

check('no query: nothing selected', filtersFromQuery('', categories), { categories: [], search: '' });
check('a known category', filtersFromQuery('?category=crime', categories), { categories: ['crime'], search: '' });
check('old name "health" still works', filtersFromQuery('?category=health', categories).categories, ['healthcare']);
check('old name "cannabis" still works', filtersFromQuery('?category=cannabis', categories).categories, ['marijuana']);
check('unknown category is ignored', filtersFromQuery('?category=budget', categories).categories, []);
check('case and spaces are forgiven', filtersFromQuery('?category=%20Crime%20', categories).categories, ['crime']);
check('two categories, no duplicates', filtersFromQuery('?category=crime&category=elections&category=crime', categories).categories, ['crime', 'elections']);
check('a search term', filtersFromQuery('?search=budget', categories), { categories: [], search: 'budget' });
check('a very long search is cut', filtersFromQuery(`?search=${'a'.repeat(500)}`, categories).search.length, 80);
check('other parameters are ignored', filtersFromQuery('?v=1&utm_source=email', categories), { categories: [], search: '' });

// Every link the main site sends must select something here.
for (const query of ['category=crime', 'category=healthcare', 'category=elections', 'category=transportation', 'category=marijuana', 'category=civic-spaces']) {
  check(`main-site link ?${query} selects a category`, filtersFromQuery(`?${query}`, categories).categories.length, 1);
}

if (failed) { console.log(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\nAll checks passed');

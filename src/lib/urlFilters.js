// Filters carried in the page address, so another page can link straight to a topic:
//   /?category=crime        opens with that category selected
//   /?search=budget         opens with that search typed in
// representdc.org's "The case" page links here this way (its categoryDetails.js).
// Unknown categories are ignored, so a stale link shows the whole list, never an
// empty one.

// Names the main site used before 2026-11-16, kept so old links still work.
const CATEGORY_ALIASES = { health: 'healthcare', cannabis: 'marijuana' }

const MAX_SEARCH_LENGTH = 80

/**
 * @param {string} query      location.search, e.g. "?category=crime"
 * @param {{id: string}[]} categories  the tracker's own category list
 * @returns {{ categories: string[], search: string }}
 */
export function filtersFromQuery(query = '', categories = []) {
  const params = new URLSearchParams(query)
  const known = new Set(categories.map(category => category.id))
  const selected = []
  for (const raw of params.getAll('category')) {
    const id = raw.trim().toLowerCase()
    const resolved = known.has(id) ? id : CATEGORY_ALIASES[id]
    if (resolved && known.has(resolved) && !selected.includes(resolved)) selected.push(resolved)
  }
  const search = (params.get('search') || '').trim().slice(0, MAX_SEARCH_LENGTH)
  return { categories: selected, search }
}

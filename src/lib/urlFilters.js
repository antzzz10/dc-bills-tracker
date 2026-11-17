// A filter carried in the page address, so another page can link straight to a topic:
//   /?category=crime        opens with that category selected
// representdc.org's "The case" page links here this way (its categoryDetails.js).
// Unknown categories are ignored, so a stale link shows the whole list, never an
// empty one.
//
// Only categories, never search text: what someone searches for must not sit in the
// address, where analytics events would pick it up (src/lib/analytics.js).

// Names the main site used before 2026-11-16, kept so old links still work.
const CATEGORY_ALIASES = { health: 'healthcare', cannabis: 'marijuana' }

/**
 * @param {string} query      location.search, e.g. "?category=crime"
 * @param {{id: string}[]} categories  the tracker's own category list
 * @returns {string[]} the category ids to select
 */
export function categoriesFromQuery(query = '', categories = []) {
  const params = new URLSearchParams(query)
  const known = new Set(categories.map(category => category.id))
  const selected = []
  for (const raw of params.getAll('category')) {
    const id = raw.trim().toLowerCase()
    const resolved = known.has(id) ? id : CATEGORY_ALIASES[id]
    if (resolved && known.has(resolved) && !selected.includes(resolved)) selected.push(resolved)
  }
  return selected
}

/**
 * The same address with the filter removed, other parameters and the #hash kept.
 * Once the filter has been read it is taken out of the address bar, so clearing the
 * filter on the page and then reloading or sharing the link doesn't bring it back.
 */
export function withoutFilterParams(href) {
  const url = new URL(href)
  url.searchParams.delete('category')
  return url.pathname + url.search + url.hash
}

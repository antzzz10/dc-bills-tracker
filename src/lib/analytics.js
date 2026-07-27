/**
 * Thin analytics wrapper — the only file that knows which vendor we use.
 *
 * Everything else in the app calls `track('event_name', { ...props })`. Swapping
 * PostHog for something else, or removing tracking entirely, is a change to this
 * file alone. Decided 2026-07-27; see decisions/2026-07-27-analytics.md.
 *
 * Privacy posture (deliberate, and the reason for the config in index.html):
 * no cookies, no autocapture, no session recording. This site's visitors are
 * people researching legislation against their own city — recording their
 * sessions or fingerprinting them across visits would be a poor trade for
 * marginal analytics. Cookieless also means no consent banner is required.
 *
 * Search terms are deliberately NOT tracked. They can reveal what a visitor is
 * personally worried about.
 */

/** PostHog is loaded by an async snippet in index.html, so it may not exist yet. */
function client() {
  return typeof window !== 'undefined' ? window.posthog : undefined
}

/** True once a project key was configured at build time and the snippet loaded. */
export function isEnabled() {
  const ph = client()
  return Boolean(ph && typeof ph.capture === 'function')
}

/**
 * Record an event. Safe to call anywhere: no-ops silently when analytics is
 * absent (local dev, or a production build with no key set), so call sites never
 * need to guard. Never throws — a broken tracker must not break the UI.
 */
export function track(event, properties = {}) {
  const ph = client()
  if (!ph || typeof ph.capture !== 'function') return
  try {
    ph.capture(event, properties)
  } catch {
    // Analytics is never worth surfacing an error to a visitor.
  }
}

/** Event names, centralised so call sites can't drift or typo them apart. */
export const EVENTS = {
  /** A visitor followed a bill through to its record on Congress.gov. */
  BILL_SOURCE_OPENED: 'bill_source_opened',
  /** A visitor expanded a bill card to read the detail. */
  BILL_EXPANDED: 'bill_expanded',
  /** A visitor exported the bill list. */
  EXPORT_DOWNLOADED: 'export_downloaded',
  /** A visitor filtered by category. */
  CATEGORY_FILTERED: 'category_filtered',
}

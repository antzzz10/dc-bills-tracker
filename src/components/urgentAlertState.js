// Timing for the hand-authored UrgentAlert, kept separate from the component so both
// the alert and App can read it without breaking fast-refresh.
//
// Set PUBLISHED_AT whenever the alert copy is replaced. Both the alert and the
// auto-generated UpdateBanner key off this single date: while the alert is active the
// banner stays suppressed, and when it expires the banner comes back automatically.
// Previously the suppression was a hand-maintained `HAS_URGENT_ALERT = true` in App.jsx,
// which had no expiry — so stale alert copy could outlive its usefulness while also
// hiding the one element on the page that updates itself.

export const PUBLISHED_AT = new Date('2026-07-22')

// 7 days, matching the standing rule for urgent alerts. This was 14 days, which left
// hand-written copy sitting under a "NEW" badge at the top of the page for two weeks,
// making the whole tracker look frozen even while bill data updated underneath it.
export const ALERT_DURATION_MS = 7 * 24 * 60 * 60 * 1000

// The "NEW" badge is a recency claim, so it expires well before the alert itself.
export const BADGE_DURATION_MS = 2 * 24 * 60 * 60 * 1000

export const alertAgeMs = () => Date.now() - PUBLISHED_AT.getTime()

export const isUrgentAlertActive = () => alertAgeMs() <= ALERT_DURATION_MS

export const isUrgentAlertNew = () => alertAgeMs() <= BADGE_DURATION_MS

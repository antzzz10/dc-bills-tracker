// Where a tracked entry stands. Decided 2026-11-09 (step 1a of
// docs/2026-11-09-support-page-and-congress-switch-plan.md) after the site counted 18
// riders and amendments as pending: two riders were already law in the FY2026 funding
// law, and the rest were never voted on or were left out of it. Every surface that
// sorts entries into pending, advanced, law or archived asks this module, so no two
// surfaces can disagree.
//
// Two separate facts, never mixed:
//   status.stage — furthest progress, read from official actions by the monitor;
//   outcome      — a hand-verified final result with its source, for entries the monitor
//                  can't read (riders and amendments have no status of their own).
//
// Measure types follow different paths (Andria's guardrails, 2026-11-09):
//   bills, ordinary joint resolutions: passed-house / passed-senate / passed-both / enacted
//   joint resolutions proposing a constitutional amendment: passed a chamber, then
//     sent-to-states (two-thirds of each chamber, no President); never "law"
//   concurrent resolutions: agreed-house / agreed-senate, final at agreed-both
//   simple resolutions: agreed-house / agreed-senate, final in their own chamber

// Stages that mean an entry has cleared at least one chamber.
export const ADVANCED_STAGES = new Set([
  'passed-house', 'passed-senate', 'passed-both', 'enacted',
  'agreed-house', 'agreed-senate', 'agreed-both',
  'sent-to-states'
])

/** Archived: final, and outside every active count. Kept in bills.json for the record. */
export const isArchived = item => Boolean(item?.outcome?.archived)

/** Reviewed and not archived: what the public anti-DC lists and counts are made of. */
export const isActive = item => Boolean(item) && !item.provisional && !isArchived(item)

/** Cleared at least one chamber (or became law), and not archived. */
export const hasAdvanced = item =>
  isActive(item) && ADVANCED_STAGES.has(item.status?.stage)

export const isEnacted = item => isActive(item) && item.status?.stage === 'enacted'

/** Active and not yet past any chamber. */
export const isPending = item => isActive(item) && !ADVANCED_STAGES.has(item.status?.stage)

const firstNumber = item => String((item.billNumbers || [])[0] || '').replace(/\s+/g, '').toUpperCase()

/**
 * What kind of measure an entry's first number is. Order matters: "H.RES." must be
 * tested before "S." would match inside it.
 */
export function measureType(item) {
  const n = firstNumber(item)
  if (/^H\.CON\.RES\./.test(n) || /^S\.CON\.RES\./.test(n)) return 'concurrent'
  if (/^H\.J\.RES\./.test(n) || /^S\.J\.RES\./.test(n)) return 'joint'
  if (/^H\.RES\./.test(n) || /^S\.RES\./.test(n)) return 'simple'
  if (/^H\.R\./.test(n) || /^S\.\d/.test(n)) return 'bill'
  return 'unknown'
}

/**
 * A joint resolution proposing a constitutional amendment: no President, and never "law".
 * Recorded on the entry (H.J.Res. 31), since the tracker's own title is not the official one.
 */
export const isConstitutionalAmendment = item => item?.constitutionalAmendment === true

/** An entry that is a provision or amendment rather than a whole measure. */
export const isProvision = item =>
  item?.type === 'rider' || (item?.billNumbers || []).some(n => /AMDT\./i.test(String(n).replace(/\s+/g, '')))

const STAGE_LABELS = {
  'passed-house': 'Passed House',
  'passed-senate': 'Passed Senate',
  'passed-both': 'Passed both chambers',
  'enacted': 'Law',
  'agreed-house': 'Agreed to by the House',
  'agreed-senate': 'Agreed to by the Senate',
  'agreed-both': 'Agreed to by both chambers',
  'sent-to-states': 'Sent to the states'
}

/** Short status tag for a card, or null for a pending entry. Words are Congress.gov's. */
export const stageLabel = item => STAGE_LABELS[item?.status?.stage] || null

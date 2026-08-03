import './PageSummary.css'
import Icon from './Icon'
import { CURRENT_CONGRESS } from '../data/config'

// How recent a legislative action has to be before it is worth calling out as
// "latest movement". Congress recesses for weeks at a time, so a short window
// would blank this sentence out for most of August — and a long one would dress
// up a stale committee referral as news. 60 days splits it, and the sentence
// always carries its own date so the reader can judge for themselves.
const MOVEMENT_WINDOW_DAYS = 60

// Dates in bills.json are date-only ("2026-07-22"). `new Date()` parses those as
// UTC midnight, which renders a day early west of Greenwich — the same trap
// parseLocalDate() exists for in PassedBillsSection.
function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDate(dateString) {
  return parseLocalDate(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Plain-language intro for someone arriving cold, shown only when nothing more
 * urgent is occupying the top of the page.
 *
 * Every figure is derived, never written down: hardcoded counts in copy are how a
 * page starts lying quietly as the data moves underneath it. The one thing this
 * deliberately does NOT claim is a rate of new bills — `introducedDate` is absent
 * from all 94 oppose entries and only 37 carry `lastActionDate`, so any
 * "N introduced this month" line would be measuring the gaps in our own data.
 */
function PageSummary({ bills = [], riders = [], routineBills = [] }) {
  const tracked = [...bills, ...riders, ...routineBills].filter(item => !item.provisional)
  if (tracked.length === 0) return null

  const isAdvanced = item =>
    item.status?.stage &&
    (item.status.stage.startsWith('passed-') || item.status.stage === 'enacted')

  const advanced = tracked.filter(isAdvanced)
  const enacted = tracked.filter(item => item.status?.stage === 'enacted')
  const passedBoth = tracked.filter(item => item.status?.stage === 'passed-both')

  // Latest action across everything we actually have action data for.
  const withActions = tracked
    .filter(item => item.status?.lastActionDate && (item.billNumbers || []).length > 0)
    .sort((a, b) => b.status.lastActionDate.localeCompare(a.status.lastActionDate))

  const latest = withActions[0]
  const daysSinceLatest = latest
    ? Math.floor((Date.now() - parseLocalDate(latest.status.lastActionDate)) / 86400000)
    : null
  const showMovement = latest && daysSinceLatest <= MOVEMENT_WINDOW_DAYS

  // "bills and budget riders" rather than "bills": 17 of the riders are provisions
  // of one appropriations bill, so calling all 94 separate bills would overstate it.
  const scope = riders.length > 0 ? 'bills and budget riders' : 'bills'

  // Reads as one clause or two depending on how far things have got, so the
  // sentence stays true whether nothing has passed or something is already law.
  const advancedDetail = [
    passedBoth.length > 0 && `${passedBoth.length} ${passedBoth.length === 1 ? 'has' : 'have'} passed both chambers`,
    enacted.length > 0 && `${enacted.length} ${enacted.length === 1 ? 'is' : 'are'} now law`,
  ].filter(Boolean).join(', and ')

  return (
    <aside className="page-summary" aria-label="What this tracker covers">
      <Icon name="info" size={18} className="page-summary-icon" />
      <p className="page-summary-text">
        This tracker follows <strong>{tracked.length} {scope}</strong> in the{' '}
        {CURRENT_CONGRESS}th Congress that would override D.C.&rsquo;s local laws or
        limit its self-government.{' '}
        {advanced.length > 0 && (
          <>
            <strong>{advanced.length} {advanced.length === 1 ? 'has' : 'have'} already
            cleared at least one chamber</strong>
            {advancedDetail && <> &mdash; {advancedDetail}</>}.{' '}
          </>
        )}
        {showMovement && (
          <>
            Latest movement: {latest.billNumbers[0]} on {formatDate(latest.status.lastActionDate)}.
          </>
        )}
      </p>
    </aside>
  )
}

export default PageSummary

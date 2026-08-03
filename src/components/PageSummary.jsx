import './PageSummary.css'
import Icon from './Icon'
import { CURRENT_CONGRESS } from '../data/config'
import {
  getPageSummaryFacts,
  advancedDetailText,
  formatSummaryDate,
} from './pageSummaryFacts'

/**
 * Plain-language intro for someone arriving cold, shown only when nothing more urgent
 * holds the top of the page.
 *
 * All figures come from getPageSummaryFacts so that scripts/check-published-claims.js
 * asserts the same numbers this renders — see that module for why the split exists.
 */
function PageSummary({ bills = [], riders = [], routineBills = [] }) {
  const facts = getPageSummaryFacts({ bills, riders, routineBills })
  if (!facts) return null

  const detail = advancedDetailText(facts)

  return (
    <aside className="page-summary" aria-label="What this tracker covers">
      <Icon name="info" size={18} className="page-summary-icon" />
      <p className="page-summary-text">
        This tracker follows <strong>{facts.trackedCount} {facts.scopeNoun}</strong> in the{' '}
        {CURRENT_CONGRESS}th Congress that would override D.C.&rsquo;s local laws or
        limit its self-government.{' '}
        {facts.advancedCount > 0 && (
          <>
            <strong>{facts.advancedCount} {facts.advancedCount === 1 ? 'has' : 'have'} already
            cleared at least one chamber</strong>
            {detail && <> &mdash; {detail}</>}.{' '}
          </>
        )}
        {facts.showMovement && (
          <>
            Latest movement: {facts.latest.billNumbers[0]} on{' '}
            {formatSummaryDate(facts.latest.status.lastActionDate)}.
          </>
        )}
      </p>
    </aside>
  )
}

export default PageSummary

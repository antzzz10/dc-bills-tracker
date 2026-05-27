import { useState } from 'react'
import './UrgentAlert.css'

const PUBLISHED_AT = new Date('2026-05-20')
const ALERT_DURATION_MS = 14 * 24 * 60 * 60 * 1000

function UrgentAlert() {
  const [isExpanded, setIsExpanded] = useState(false)

  if (Date.now() - PUBLISHED_AT.getTime() > ALERT_DURATION_MS) return null

  return (
    <div className="urgent-alert" id="urgent">
      <div className="urgent-alert-inner">
        <div className="urgent-alert-badge">UPDATE</div>
        <h2 className="urgent-alert-headline">
          House Committee Advances Bill to Permanently Ban DC Congestion Pricing
        </h2>
        <p className="urgent-alert-subhead">
          Passed House Oversight Committee May 20 &middot; Largely party-line &middot; Two Democrats crossed over: Reps. Subramanyam (VA) and Mfume (MD)
        </p>
        <p className="urgent-alert-summary">
          The House Oversight Committee passed H.R. 8801, the DC ROADS Act, which would
          permanently prohibit DC from ever implementing congestion pricing — stripping
          the DC Council of a transportation policy tool before they've even voted on it.
          The bill now heads to the full House floor.
        </p>

        <button
          className="urgent-alert-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          {isExpanded ? 'Hide details ▲' : 'Show details ▼'}
        </button>

        {isExpanded && (
          <div className="urgent-alert-details">
            <div className="urgent-alert-explainer">
              <div className="urgent-alert-what">
                <h3>What happened</h3>
                <p>
                  Rep. Scott Perry (R-PA) introduced H.R. 8801, which amends the DC Home
                  Rule Act to permanently bar DC from imposing any charge for entry into
                  or passage through the District. The House Oversight Committee passed it
                  on May 20, 2026 on a largely party-line vote. Two Democrats from
                  neighboring states crossed over — Rep. Suhas Subramanyam (VA) and
                  Rep. Kweisi Mfume (MD) — giving Republicans bipartisan cover in
                  commuter-heavy districts wary of new tolls.
                </p>
              </div>

              <div className="urgent-alert-stake">
                <h3>What's at stake</h3>
                <p>
                  DC has studied but not enacted congestion pricing. This bill would remove
                  that option permanently — regardless of future DC Council decisions or
                  what DC residents want. It's a preemptive override of DC's right to set
                  its own transportation policy, and the third markup this Congress targeting
                  DC's local authority under the Home Rule Act.
                </p>
              </div>

              <div className="urgent-alert-why">
                <h3>Where things stand</h3>
                <p>
                  The bill awaits a House floor vote. If it passes the full House, it faces
                  the Senate. The bipartisan committee vote signals it could attract
                  Democratic support on the floor, particularly from members representing
                  suburban Maryland and Virginia constituencies.
                </p>
              </div>
            </div>

            <div className="urgent-alert-sources">
              <p>
                Sources:{' '}
                <a href="https://www.congress.gov/bill/119th-congress/house-bill/8801" target="_blank" rel="noopener noreferrer">
                  Congress.gov
                </a>
                {' '}&middot;{' '}
                <a href="https://norton.house.gov/media/press-releases/after-oversight-committee-markup-two-anti-dc-bills-norton-calls-republican" target="_blank" rel="noopener noreferrer">
                  Rep. Norton statement
                </a>
                {' '}&middot;{' '}
                <a href="https://oversight.house.gov/release/markup-wrap-up-oversight-committee-advances-legislation-to-codify-president-trumps-efforts-to-make-d-c-safe-and-beautiful/" target="_blank" rel="noopener noreferrer">
                  House Oversight markup wrap-up
                </a>
              </p>
            </div>

            <div className="urgent-alert-link-hint">
              <a href="#hr8801">See full bill details below</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default UrgentAlert

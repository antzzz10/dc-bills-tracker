import { useState } from 'react'
import './UrgentAlert.css'

const PUBLISHED_AT = new Date('2026-06-04')
const ALERT_DURATION_MS = 14 * 24 * 60 * 60 * 1000

function UrgentAlert() {
  const [isExpanded, setIsExpanded] = useState(false)

  if (Date.now() - PUBLISHED_AT.getTime() > ALERT_DURATION_MS) return null

  return (
    <div className="urgent-alert" id="urgent">
      <div className="urgent-alert-inner">
        <div className="urgent-alert-badge">NEW</div>
        <h2 className="urgent-alert-headline">
          Congress Moves to Override Two DC Police Oversight Laws
        </h2>
        <p className="urgent-alert-dateline">June 4, 2026</p>
        <div className="urgent-alert-laws">
          <p>Body-worn camera transparency law targeted</p>
          <p>Arrest reporting law targeted</p>
        </div>
        <p className="urgent-alert-chambernote">House &amp; Senate companion resolutions introduced</p>

        <button
          className="urgent-alert-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          {isExpanded ? 'Hide details ▲' : 'Show details ▼'}
        </button>

        {isExpanded && (
          <div className="urgent-alert-details">
            <p className="urgent-alert-summary">
              Companion resolutions in both chambers would nullify two DC Council laws — one on
              body-worn camera transparency, one on arrest reporting. If passed, Congress overrides
              laws DC residents and their elected Council already enacted.
            </p>
            <div className="urgent-alert-explainer">
              <div className="urgent-alert-what">
                <h3>What happened</h3>
                <p>
                  Sen. Hagerty (R-TN) introduced S.J.Res. 194–195 on June 3; Rep. Gosar (R-AZ)
                  introduced companion H.J.Res. 192–193 on June 4. Both sets target DC Council
                  laws on police body cameras and arrest reporting passed in 2026.
                </p>
              </div>

              <div className="urgent-alert-stake">
                <h3>What's at stake</h3>
                <p>
                  Both laws expand accountability for how DC police use force and make arrests.
                  Nullifying them overrides the DC Council's judgment on local public safety —
                  eliminating transparency measures DC residents specifically chose to enact.
                </p>
              </div>

              <div className="urgent-alert-why">
                <h3>Where things stand</h3>
                <p>
                  All four resolutions are newly introduced, not yet in committee. With companion
                  bills in both chambers they are more likely to advance than single-chamber
                  resolutions.
                </p>
              </div>
            </div>

            <div className="urgent-alert-sources">
              <p>
                Sources:{' '}
                <a href="https://www.congress.gov/bill/119th-congress/house-joint-resolution/192" target="_blank" rel="noopener noreferrer">
                  H.J.Res. 192 (Congress.gov)
                </a>
                {' '}&middot;{' '}
                <a href="https://www.congress.gov/bill/119th-congress/house-joint-resolution/193" target="_blank" rel="noopener noreferrer">
                  H.J.Res. 193 (Congress.gov)
                </a>
                {' '}&middot;{' '}
                <a href="https://www.congress.gov/bill/119th-congress/senate-joint-resolution/194" target="_blank" rel="noopener noreferrer">
                  S.J.Res. 194 (Congress.gov)
                </a>
                {' '}&middot;{' '}
                <a href="https://www.congress.gov/bill/119th-congress/senate-joint-resolution/195" target="_blank" rel="noopener noreferrer">
                  S.J.Res. 195 (Congress.gov)
                </a>
              </p>
            </div>

            <div className="urgent-alert-link-hint">
              <a href="#hjres192-sjres195">See arrest reporting resolution below</a>
              {' '}&middot;{' '}
              <a href="#hjres193-sjres194">See body-worn camera resolution below</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default UrgentAlert

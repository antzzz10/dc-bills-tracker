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
        <p className="urgent-alert-subhead">
          4 disapproval resolutions introduced June 3–4 &middot; Both chambers &middot; Target body-worn camera transparency and arrest reporting laws
        </p>
        <p className="urgent-alert-summary">
          Rep. Paul Gosar (R-AZ) and Sen. Bill Hagerty (R-TN) introduced companion disapproval
          resolutions in both chambers to nullify two DC Council laws: one expanding transparency
          for police body camera footage, and one requiring fuller public reporting of arrests.
          If passed, Congress would void laws DC residents and their elected Council already enacted.
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
                  Sen. Hagerty (R-TN) introduced S.J.Res. 194 and S.J.Res. 195 on June 3, 2026.
                  Rep. Gosar (R-AZ) introduced the companion House versions — H.J.Res. 192 and
                  H.J.Res. 193 — on June 4. The four resolutions target two DC Council laws passed
                  in 2026: the Body-Worn Camera Transparency for Use of Force Temporary Amendment
                  Act and the Full Accountability in Arrest Reporting Temporary Amendment Act.
                </p>
              </div>

              <div className="urgent-alert-stake">
                <h3>What's at stake</h3>
                <p>
                  Both DC laws expand accountability and transparency for policing in DC — giving
                  residents more information about how force is used and arrests are made. Congress
                  using disapproval resolutions to nullify them would override the DC Council's
                  judgment on local public safety policy, eliminating transparency measures DC
                  residents and their elected representatives specifically chose to enact.
                </p>
              </div>

              <div className="urgent-alert-why">
                <h3>Where things stand</h3>
                <p>
                  All four resolutions were just introduced and have not yet been assigned to
                  committee. Disapproval resolutions require passage in both chambers and
                  presidential signature — the same path as regular legislation. With companion
                  bills in both chambers, they are more likely to advance than single-chamber
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

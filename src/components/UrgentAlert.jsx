import { useState } from 'react'
import './UrgentAlert.css'

const PUBLISHED_AT = new Date('2026-07-22')
const ALERT_DURATION_MS = 14 * 24 * 60 * 60 * 1000

function UrgentAlert() {
  const [isExpanded, setIsExpanded] = useState(false)

  if (Date.now() - PUBLISHED_AT.getTime() > ALERT_DURATION_MS) return null

  return (
    <div className="urgent-alert" id="urgent">
      <div className="urgent-alert-inner">
        <div className="urgent-alert-badge">NEW</div>
        <h2 className="urgent-alert-headline">
          House Committee Advances Bill to Cut Off DC's Taxing Authority
        </h2>
        <p className="urgent-alert-dateline">July 22, 2026</p>
        <div className="urgent-alert-laws">
          <p>H.R. 9720 — D.C. Taxing Authority Review Act</p>
        </div>
        <p className="urgent-alert-chambernote">Passed House Oversight &amp; Government Reform Committee, party-line vote</p>

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
              H.R. 9720 would require an affirmative resolution of congressional approval — within
              a 60-day review period — for any DC Council act involving Title 47 of the DC Code, or
              that imposes or increases a tax or fee. It applies to both increases and decreases,
              with a narrow exception for fee changes under $500 that don't touch any other tax or
              fee.
            </p>
            <div className="urgent-alert-explainer">
              <div className="urgent-alert-what">
                <h3>What happened</h3>
                <p>
                  Introduced by Rep. James Comer (R-KY) on July 16 with 21 original Republican
                  cosponsors, including Jim Jordan, Andy Biggs, Paul Gosar, and Lauren Boebert. The
                  House Oversight and Government Reform Committee passed it on a party-line vote on
                  July 22 — without a public hearing.
                </p>
              </div>

              <div className="urgent-alert-stake">
                <h3>What's at stake</h3>
                <p>
                  DC Council Chairman Phil Mendelson objected in writing before the markup (letter
                  to Chairman Comer, July 20): the bill would freeze routine DC fiscal management —
                  pension-contribution timing, targeted tax exemptions, CFO bond flexibility — and
                  also freezes the District's General License Law, since that's under Title 47 too.
                  Mendelson also cited a Moody's rating action (July 10) flagging federal revenue
                  restrictions as a factor that could raise DC's cost of borrowing.
                </p>
              </div>

              <div className="urgent-alert-why">
                <h3>Where things stand</h3>
                <p>
                  Passed committee on a party-line vote; also referred to the Rules Committee. 21
                  cosponsors already clears the high-priority threshold for legislative momentum.
                </p>
              </div>
            </div>

            <div className="urgent-alert-sources">
              <p>
                Sources:{' '}
                <a href="https://www.congress.gov/bill/119th-congress/house-bill/9720" target="_blank" rel="noopener noreferrer">
                  H.R. 9720 (Congress.gov)
                </a>
                {' '}&middot;{' '}
                Letter from DC Council Chairman Phil Mendelson to Chairman James Comer, July 20, 2026
              </p>
            </div>

            <div className="urgent-alert-link-hint">
              <a href="#hr9720">See bill details below</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default UrgentAlert

import { useState } from 'react'
import './UrgentAlert.css'

const PUBLISHED_AT = new Date('2026-02-24')
const ALERT_DURATION_MS = 7 * 24 * 60 * 60 * 1000

function UrgentAlert() {
  const [isExpanded, setIsExpanded] = useState(false)

  if (Date.now() - PUBLISHED_AT.getTime() > ALERT_DURATION_MS) return null

  return (
    <div className="urgent-alert" id="urgent">
      <div className="urgent-alert-inner">
        <div className="urgent-alert-badge">UPDATE</div>
        <h2 className="urgent-alert-headline">
          H.J.Res. 142 Found Invalid — DC AG Says Override Missed Deadline, CFO Directs Normal Tax Filing
        </h2>
        <p className="urgent-alert-subhead">
          Passed House 215-210 on Feb 4 &middot; Passed Senate 49-47 on Feb 12 &middot; Signed by President Trump &middot; <strong>Validity disputed by DC government</strong>
        </p>
        <p className="urgent-alert-summary">
          DC Attorney General Brian Schwalb formally declared the disapproval resolution
          invalid on February 24 — the Senate voted one day after the 30-day review window
          closed. The DC CFO is now directing residents to file their 2025 taxes under DC's
          decoupled rules. <strong>DC tax deadline: April 15.</strong>
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
                  Congress passed — and President Trump signed — a disapproval resolution
                  to overturn the DC Council's decision to decouple its tax code from
                  costly federal tax cuts in the One Big Beautiful Bill Act. The House
                  voted 215-210 on February 4 (party-line, no Democrats supported).
                  The Senate followed 49-47 on February 12. But DC Council Chairman
                  Phil Mendelson says the resolution is invalid: the Senate acted{' '}
                  <em>after</em> the congressionally mandated review period had already expired.
                </p>
              </div>

              <div className="urgent-alert-stake">
                <h3>The dispute</h3>
                <p>
                  The Home Rule Act gives Congress 30 calendar days to disapprove DC
                  legislation, beginning{' '}
                  <strong>"on the day such act is transmitted by the Chairman to the
                  Speaker of the House…and the President of the Senate."</strong>
                </p>
                <ul>
                  <li>
                    <strong>DC's position:</strong> The Chairman transmitted the
                    law on <strong>December 30</strong>. The 30-day period expired{' '}
                    <strong>February 11</strong> — the day <em>before</em> the Senate voted.
                    Chairman Mendelson maintains the decoupling law is already in effect.
                  </li>
                  <li>
                    <strong>Congress's position:</strong> The period begins when notice
                    is published in the Congressional Record by the second chamber —{' '}
                    <strong>January 7</strong> — making the Senate vote within the window.
                  </li>
                </ul>
                <p style={{ marginTop: '0.5rem' }}>
                  DC Attorney General Brian Schwalb sided with the Council's interpretation
                  in 2023, arguing the Home Rule Act "unambiguously" starts the countdown
                  upon Council transmission. No court has ruled on this question yet.
                </p>
              </div>

              <div className="urgent-alert-why">
                <h3>Where things stand now</h3>
                <p>
                  On February 24, DC Attorney General Brian Schwalb formally declared
                  the override invalid, arguing Congress missed its own deadline. The DC
                  CFO followed, directing residents to file their 2025 taxes under DC's
                  decoupled tax rules — meaning DC's expanded EITC, child tax credits,
                  and other provisions remain in effect for this filing season.
                  DC's tax deadline is <strong>April 15</strong>.
                  No court action has been filed by either side, but DC is proceeding
                  as though the disapproval resolution has no legal force.
                </p>
              </div>
            </div>

            <div className="urgent-alert-cta">
              <div className="urgent-alert-freedc-credit">
                <strong>What's at stake:</strong> $658 million in local revenue over four years, DC's
                expanded Earned Income Tax Credit, a $1,000-per-child tax credit
                reaching 78,000 children, and a projected 20% reduction in DC child poverty.
              </div>
            </div>

            <div className="urgent-alert-sources">
              <p>
                Sources:{' '}
                <a href="https://rollcall.com/2026/02/12/senate-votes-to-overturn-dc-tax-decoupling/" target="_blank" rel="noopener noreferrer">
                  Roll Call
                </a>
                {' '}&middot;{' '}
                <a href="https://51st.news/tax-bill-dc-decouple-repeal-congress/" target="_blank" rel="noopener noreferrer">
                  The 51st
                </a>
                {' '}&middot;{' '}
                <a href="https://51st.news/time-to-file-dc-taxes-april-15/" target="_blank" rel="noopener noreferrer">
                  51st (tax filing)
                </a>
                {' '}&middot;{' '}
                <a href="https://news.bloombergtax.com/daily-tax-report/congress-votes-to-repeal-dc-tax-code-decoupling-from-gop-law" target="_blank" rel="noopener noreferrer">
                  Bloomberg Tax
                </a>
                {' '}&middot;{' '}
                <a href="https://www.congress.gov/bill/119th-congress/house-joint-resolution/142" target="_blank" rel="noopener noreferrer">
                  Congress.gov
                </a>
                {' '}&middot;{' '}
                <a href="https://freedcproject.org/news/dcs-money-belongs-to-dc" target="_blank" rel="noopener noreferrer">
                  FreeDC
                </a>
              </p>
            </div>

            <div className="urgent-alert-link-hint">
              <a href="#hjres142-sjres102">See full bill details below</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default UrgentAlert

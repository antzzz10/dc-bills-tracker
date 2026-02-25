import { useState } from 'react'
import './UrgentAlert.css'

function UrgentAlert() {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="urgent-alert" id="urgent">
      <div className="urgent-alert-inner">
        <div className="urgent-alert-badge">UPDATE</div>
        <h2 className="urgent-alert-headline">
          Trump Signed H.J.Res. 142 — But DC Says It's Already Too Late
        </h2>
        <p className="urgent-alert-subhead">
          Passed House 215-210 on Feb 4 &middot; Passed Senate 49-47 on Feb 12 &middot; Signed by President Trump &middot; <strong>Validity disputed</strong>
        </p>
        <p className="urgent-alert-summary">
          DC Council Chairman Phil Mendelson maintains the disapproval resolution is
          invalid — the Senate voted February 12, one day after the 30-day review
          window closed. City officials are debating whether to formally challenge it
          in court, but no action has been filed yet.
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
                <h3>What DC is doing — and debating</h3>
                <p>
                  City officials are quietly discussing next steps, but there is no
                  consensus. Shadow Senator Ankit Jain says DC has "a very strong legal
                  case" and that the law should be followed. But some councilmembers are
                  hesitant: Ward 5's Zachary Parker questioned whether any fight over
                  this issue is worth the broader risk to home rule, given 15+ other
                  anti-DC bills moving through Congress. No formal legal action has
                  been filed yet.
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
                  51st
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

import './UrgentAlert.css'

function UrgentAlert() {
  return (
    <div className="urgent-alert" id="urgent">
      <div className="urgent-alert-inner">
        <div className="urgent-alert-badge">URGENT</div>
        <h2 className="urgent-alert-headline">
          Congress Is Trying to Take DC's Money
        </h2>
        <p className="urgent-alert-subhead">
          House vote expected <strong>Tuesday, February 3</strong> on H.J.Res. 142
        </p>

        <div className="urgent-alert-explainer">
          <div className="urgent-alert-what">
            <h3>What's happening</h3>
            <p>
              In November, the DC Council passed temporary legislation to unlink
              the DC tax code from costly federal tax cuts in the One Big Beautiful
              Bill Act (OBBBA), preventing the District from losing{' '}
              <strong>$658 million in local revenue</strong> over five years. Congress
              is now using a <strong>disapproval resolution</strong> (H.J.Res. 142)
              to overturn that local law. Ten other states have taken similar
              decoupling action.
            </p>
          </div>

          <div className="urgent-alert-stake">
            <h3>What's at stake</h3>
            <ul>
              <li>
                <strong>$658 million</strong> in local revenue over five years
              </li>
              <li>
                DC's expanded <strong>Earned Income Tax Credit</strong> (accelerated
                to a full 100% local match)
              </li>
              <li>
                A new <strong>$1,000-per-child tax credit</strong> for families
                earning under $75K/$90K
              </li>
              <li>
                Together, these credits reach <strong>78,000 children</strong> and
                are projected to <strong>reduce child poverty in DC by 20%</strong>
              </li>
              <li>
                DC's credit rating — Moody's already downgraded DC after a 2025
                continuing resolution forced $1B in local spending cuts
              </li>
            </ul>
          </div>

          <div className="urgent-alert-why">
            <h3>Why this matters</h3>
            <p>
              The OBBBA tax cuts overwhelmingly benefit DC households with incomes
              over $1.3 million. Those households still get their federal tax cut.
              DC simply chose not to replicate those cuts locally, and instead
              invested in proven tools for reducing poverty and racial inequity.
              This resolution would override that local decision — stripping tax
              relief from working families who need it most, to fund tax cuts for
              those who need them least.
            </p>
          </div>
        </div>

        <div className="urgent-alert-cta">
          <div className="urgent-alert-freedc-credit">
            Action items organized by <strong>FreeDC</strong> — leading the fight to protect DC's autonomy
          </div>
          <a
            href="https://freedcproject.org/news/dcs-money-belongs-to-dc"
            target="_blank"
            rel="noopener noreferrer"
            className="urgent-alert-button"
          >
            Take Action with FreeDC
          </a>
          <p className="urgent-alert-actions-preview">
            Call Congress &middot; Write your representatives &middot; Join the Feb 2 organizing call &middot; Show up Feb 4 at the Senate
          </p>
        </div>

        <div className="urgent-alert-sources">
          <p>
            Sources:{' '}
            <a href="https://freedcproject.org/news/dcs-money-belongs-to-dc" target="_blank" rel="noopener noreferrer">
              FreeDC
            </a>
            {' '}&middot;{' '}
            <a href="https://www.dcfpi.org/all/tell-congress-vote-no-on-interfering-in-dcs-local-lawmaking/" target="_blank" rel="noopener noreferrer">
              DC Fiscal Policy Institute
            </a>
            {' '}&middot;{' '}
            <a href="https://dccouncil.gov/council-separates-elements-of-district-tax-code-from-the-federal-to-fund-family-tax-savings-and-youth-tax-credit-reinstates-temporary-juvenile-curfew/" target="_blank" rel="noopener noreferrer">
              DC Council
            </a>
            {' '}&middot;{' '}
            <a href="https://www.congress.gov/bill/119th-congress/house-joint-resolution/142" target="_blank" rel="noopener noreferrer">
              Congress.gov
            </a>
          </p>
        </div>

        <div className="urgent-alert-link-hint">
          <a href="#hjres142-sjres102">See full bill details below</a>
        </div>
      </div>
    </div>
  )
}

export default UrgentAlert

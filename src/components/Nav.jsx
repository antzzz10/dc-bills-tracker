import { Logo, Wordmark } from './Logo'
import './Nav.css'

/**
 * Mirrors representdc-main's Nav, but this repo has no router — every
 * destination is an absolute cross-site URL. "Bill tracker" is the current
 * site, so it renders as a non-link current-page marker instead.
 */
function Nav() {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <a
          className="nav-brand"
          href="https://www.representdc.org"
          aria-label="RepresentDC — main site"
        >
          <Logo size={26} />
          <Wordmark size={15} />
        </a>
        <div className="nav-links">
          <a className="nav-link" href="https://www.representdc.org">Home</a>
          <a className="nav-link" href="https://www.representdc.org/the-case">The case</a>
          <a className="nav-link" href="https://www.representdc.org/myths-and-faq">Myths &amp; FAQ</a>
          <span className="nav-link nav-link-current" aria-current="page">Bill tracker</span>
          <a
            className="nav-link"
            href="https://candidates.representdc.org"
            title="For D.C. voters — 2026 primary candidate positions on statehood"
          >
            Candidates
          </a>
          <a className="nav-cta" href="https://www.representdc.org/take-action">Take action</a>
        </div>
      </div>
    </nav>
  )
}

export default Nav

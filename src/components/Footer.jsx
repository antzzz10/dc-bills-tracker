import Icon from './Icon'
import { Logo, Wordmark } from './Logo'
import './Footer.css'

/**
 * Mirrors representdc-main's Footer. This site is the bill tracker, so the
 * tools column points outward to the other two properties instead of listing
 * itself. Keeps the existing advocacy statement, which main's footer has no
 * equivalent for.
 */
function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <p className="footer-statement">
          D.C. statehood is a civil rights issue. These bills undermine the
          democratic rights of D.C. residents.
        </p>

        <div className="footer-sections">
          <div className="footer-section">
            <h3>RepresentDC tools</h3>
            <div className="footer-links">
              <a href="https://www.representdc.org">
                Main site <Icon name="arrow-right" size={15} />
              </a>
              <a href="https://candidates.representdc.org">
                Candidate tracker (for D.C. voters) <Icon name="arrow-right" size={15} />
              </a>
            </div>
          </div>

          <div className="footer-section">
            <h3>About this site</h3>
            <p>
              This is an independent, volunteer-run project created by a proud
              D.C. resident to track anti-DC legislation. Not affiliated with any
              organization.
            </p>
            <a
              className="footer-feedback-link"
              href="https://docs.google.com/forms/d/e/1FAIpQLScoQfgfU-vHBN0EXqGp51Vv79oT2iS-1_uPTzoPtpmFlQ58kQ/viewform"
              target="_blank"
              rel="noopener noreferrer"
            >
              Send feedback <Icon name="external-link" size={15} />
            </a>
          </div>
        </div>

        <div className="footer-brand">
          <Logo variant="reversed" size={20} />
          <Wordmark variant="reversed" size={12} />
        </div>
        <p className="footer-copyright">Copyright © 2026 RepresentDC</p>
      </div>
    </footer>
  )
}

export default Footer

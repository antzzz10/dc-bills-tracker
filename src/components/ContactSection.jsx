import { useState } from 'react'
import './ContactSection.css'

function ContactSection() {
  const [isExpanded, setIsExpanded] = useState(false)

  // TODO: Replace with your Google Form ID from the setup guide
  // Get this from your Google Form embed code: forms.google.com/forms/d/e/YOUR_FORM_ID/viewform
  const GOOGLE_FORM_ID = 'REPLACE_WITH_YOUR_FORM_ID'

  // If you haven't set up the form yet, this will show a message
  const isFormConfigured = GOOGLE_FORM_ID !== 'REPLACE_WITH_YOUR_FORM_ID'

  return (
    <div className="contact-section">
      <div
        className="contact-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="contact-title">
          <span className="contact-icon">💬</span>
          <h2>Send Feedback</h2>
        </div>
        <span className="expand-icon-contact">{isExpanded ? '−' : '+'}</span>
      </div>

      {isExpanded && (
        <div className="contact-content">
          {isFormConfigured ? (
            <>
              <p className="contact-intro">
                Have a bug report, feature request, or general feedback? We'd love to hear from you!
              </p>
              <div className="contact-form-container">
                <iframe
                  src={`https://docs.google.com/forms/d/e/${GOOGLE_FORM_ID}/viewform?embedded=true`}
                  width="100%"
                  height="800"
                  frameBorder="0"
                  marginHeight="0"
                  marginWidth="0"
                  title="Feedback Form"
                >
                  Loading…
                </iframe>
              </div>
            </>
          ) : (
            <div className="contact-setup-message">
              <p>
                <strong>Contact form is being set up!</strong>
              </p>
              <p>
                In the meantime, please email us at:{' '}
                <a href="mailto:feedback@representdc.org">feedback@representdc.org</a>
              </p>
              <p className="setup-note">
                Note: To set up the feedback form, follow the instructions in{' '}
                <code>FEEDBACK-SETUP.md</code>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ContactSection

import { useState } from 'react'
import './UpdateBanner.css'

function UpdateBanner() {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) return null

  return (
    <div className="update-banner">
      <div className="update-banner-content">
        <span className="update-icon">📢</span>
        <p className="update-text">
          <strong>Updated November 14, 2025:</strong> Site launched with 96 anti-DC bills tracked.
          Now featuring collapsible categories and downloadable reports.
        </p>
        <button
          className="update-banner-close"
          onClick={() => setIsVisible(false)}
          aria-label="Close banner"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default UpdateBanner

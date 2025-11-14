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
          <strong>November 14, 2025:</strong> Two bills expected on House floor - H.R. 5214 (Cash Bail) & H.R. 5107 (CLEAN DC Act)
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

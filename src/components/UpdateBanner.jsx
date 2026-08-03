import { useState } from 'react'
import './UpdateBanner.css'
import Icon from './Icon'
import { getUpdateBannerMessage } from './updateBannerMessage'

function UpdateBanner({ passedBills = [], upcomingFloorVotes = [], allBills = [] }) {
  const [isVisible, setIsVisible] = useState(true)

  const bannerData = getUpdateBannerMessage({ passedBills, upcomingFloorVotes, allBills })

  // Don't show banner if no important updates or user closed it
  if (!bannerData || !isVisible) return null

  return (
    <div className="update-banner">
      <div className="update-banner-content">
        <span className="update-icon"><Icon name={bannerData.icon} size={22} /></span>
        <p className="update-text">
          <strong>{bannerData.date}:</strong> {bannerData.message}
        </p>
        <button
          className="update-banner-close"
          onClick={() => setIsVisible(false)}
          aria-label="Close banner"
        >
          <Icon name="x" size={17} />
        </button>
      </div>
    </div>
  )
}

export default UpdateBanner

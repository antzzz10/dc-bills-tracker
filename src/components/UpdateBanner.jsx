import { useState } from 'react'
import './UpdateBanner.css'

function UpdateBanner({ passedBills = [], upcomingFloorVotes = [], allBills = [] }) {
  const [isVisible, setIsVisible] = useState(true)

  // Generate banner message based on current data
  const getBannerMessage = () => {
    // Check for newly introduced bills (within last 7 days)
    const recentlyIntroduced = allBills.filter(bill => {
      if (!bill.status?.lastActionDate) return false

      const actionDate = new Date(bill.status.lastActionDate)
      const daysSince = Math.floor((Date.now() - actionDate) / (1000 * 60 * 60 * 24))

      // Check if it's a new introduction and within 7 days
      const isIntroduction = bill.status.lastAction &&
        (bill.status.lastAction.includes('Referred to') ||
         bill.status.lastAction.includes('Introduced'))

      return isIntroduction && daysSince <= 7
    }).sort((a, b) => {
      // Sort by date descending (most recent first)
      return new Date(b.status.lastActionDate) - new Date(a.status.lastActionDate)
    })

    // Prioritize showing newly introduced bills
    if (recentlyIntroduced.length > 0) {
      const newest = recentlyIntroduced[0]
      const actionDate = new Date(newest.status.lastActionDate)
      const formattedDate = actionDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })

      // Handle provisional bills without bill numbers yet
      const billNumberText = newest.provisional
        ? 'New bill (number pending)'
        : newest.billNumbers.join('/')

      return {
        icon: '🆕',
        date: formattedDate,
        message: `${billNumberText} just introduced: ${newest.title}. ${newest.description}`
      }
    }

    // Check for recently passed bills (within last 30 days)
    const recentlyPassed = passedBills.filter(bill => {
      if (!bill.passage?.house?.date && !bill.passage?.senate?.date) return false

      const dateString = bill.passage.house?.date || bill.passage.senate?.date
      // Parse as local date to avoid timezone issues
      const [year, month, day] = dateString.split('-').map(Number)
      const passageDate = new Date(year, month - 1, day)
      const daysSince = Math.floor((Date.now() - passageDate) / (1000 * 60 * 60 * 24))
      return daysSince <= 30
    })

    // Check for bills with upcoming floor votes
    const floorVoteBills = upcomingFloorVotes.filter(bill => bill.highlight === 'floor-vote')

    // Prioritize showing passed bills
    if (recentlyPassed.length > 0) {
      const mostRecent = recentlyPassed[0]
      const dateString = mostRecent.passage.house?.date || mostRecent.passage.senate?.date
      // Parse as local date to avoid timezone issues (YYYY-MM-DD format)
      const [year, month, day] = dateString.split('-').map(Number)
      const passageDate = new Date(year, month - 1, day) // month is 0-indexed
      const formattedDate = passageDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })

      const chamber = mostRecent.passage.house ? 'House' : 'Senate'
      const vote = mostRecent.passage.house?.vote || mostRecent.passage.senate?.vote

      if (recentlyPassed.length === 1) {
        return {
          icon: '🚨',
          date: formattedDate,
          message: `${mostRecent.billNumbers[0]} passed the ${chamber} (${vote.yeas}-${vote.nays}). Now headed to ${chamber === 'House' ? 'Senate' : 'President'}.`
        }
      } else {
        return {
          icon: '🚨',
          date: formattedDate,
          message: `${recentlyPassed.length} bills have passed! Most recent: ${mostRecent.billNumbers[0]} (${chamber}, ${vote.yeas}-${vote.nays}). Click "Bills That Have Passed" section below for details.`
        }
      }
    }

    // Show upcoming floor votes if no recent passages
    if (floorVoteBills.length > 0) {
      const billNumbers = floorVoteBills.slice(0, 3).map(b => b.billNumbers[0]).join(', ')
      return {
        icon: '📢',
        date: 'Alert',
        message: `${floorVoteBills.length} bill${floorVoteBills.length > 1 ? 's' : ''} scheduled for floor vote: ${billNumbers}`
      }
    }

    // No important updates
    return null
  }

  const bannerData = getBannerMessage()

  // Don't show banner if no important updates or user closed it
  if (!bannerData || !isVisible) return null

  return (
    <div className="update-banner">
      <div className="update-banner-content">
        <span className="update-icon">{bannerData.icon}</span>
        <p className="update-text">
          <strong>{bannerData.date}:</strong> {bannerData.message}
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

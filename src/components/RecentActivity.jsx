import { useState, useMemo } from 'react'
import './RecentActivity.css'

// Helper to parse date strings as local dates (avoiding timezone issues)
const parseLocalDate = (dateString) => {
  if (!dateString) return null
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day) // month is 0-indexed
}

function RecentActivity({ allBills, allRiders }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const recentActivities = useMemo(() => {
    const activities = []
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Helper to check if date is recent
    const isRecent = (dateString) => {
      if (!dateString) return false
      const date = parseLocalDate(dateString)
      return date > thirtyDaysAgo
    }

    // Helper to format bill numbers
    const formatBillNumbers = (billNumbers) => {
      return billNumbers.join(', ')
    }

    // Process all bills
    const allItems = [...allBills, ...allRiders]

    allItems.forEach(item => {
      const lastActionDate = item.status?.lastActionDate

      // Skip if no recent action
      if (!isRecent(lastActionDate)) return

      // Determine activity type and description
      let activityType = ''
      let description = ''
      let icon = '📋'

      // Passed bills
      if (item.status?.stage?.startsWith('passed-')) {
        activityType = 'passed'
        icon = '⚠️'
        if (item.status.stage === 'passed-house') {
          description = `Passed the House`
        } else if (item.status.stage === 'passed-senate') {
          description = `Passed the Senate`
        } else if (item.status.stage === 'passed-both') {
          description = `Passed both chambers`
        }
      }
      // New bills (introduced recently)
      else if (item.status?.lastAction === 'Introduced' || item.provisional) {
        activityType = 'introduced'
        icon = '🆕'
        description = 'Introduced'
      }
      // Committee activity
      else if (item.status?.hasCommitteeMarkup) {
        activityType = 'markup'
        icon = '📝'
        description = 'Committee markup'
      } else if (item.status?.hasCommitteeHearing) {
        activityType = 'hearing'
        icon = '👂'
        description = 'Committee hearing held'
      }
      // Other status changes
      else if (item.status?.lastAction) {
        activityType = 'status-change'
        icon = '🔄'
        description = item.status.lastAction
      }

      if (description) {
        activities.push({
          date: lastActionDate,
          type: activityType,
          icon,
          billNumbers: formatBillNumbers(item.billNumbers),
          title: item.title,
          description,
          priority: item.priority,
          category: item.category,
          isPassed: item.status?.stage?.startsWith('passed-')
        })
      }
    })

    // Sort by date (newest first) and take top 10
    return activities
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10)
  }, [allBills, allRiders])

  // Helper to format date
  const formatDate = (dateString) => {
    const date = parseLocalDate(dateString)
    if (!date) return ''

    const now = new Date()
    now.setHours(0, 0, 0, 0) // Reset to midnight for accurate comparison

    const diffTime = now - date
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return 'Today'
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays > 1 && diffDays <= 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      })
    }
  }

  if (recentActivities.length === 0) {
    return null
  }

  return (
    <div className="recent-activity-section">
      <div
        className="recent-activity-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="recent-activity-title">
          <span className="activity-icon">📅</span>
          <h2>Recent Activity</h2>
          <span className="activity-count">{recentActivities.length}</span>
          <span className="activity-timeframe">Last 30 Days</span>
        </div>
        <span className="expand-icon-large">{isExpanded ? '−' : '+'}</span>
      </div>

      {isExpanded && (
        <div className="recent-activity-content">
          <p className="recent-activity-intro">
            Latest updates and changes to anti-DC bills. This feed is automatically generated
            from bill status changes and new introductions.
          </p>

          <div className="activity-list">
            {recentActivities.map((activity, idx) => (
              <div
                key={idx}
                className={`activity-item ${activity.isPassed ? 'activity-passed' : ''}`}
              >
                <div className="activity-date">
                  <span className="date-text">{formatDate(activity.date)}</span>
                </div>
                <div className="activity-details">
                  <span className="activity-type-icon">{activity.icon}</span>
                  <span className="activity-bill-number">{activity.billNumbers}</span>
                  <span className={`activity-priority priority-${activity.priority}`}>
                    {activity.priority}
                  </span>
                  <span className="activity-title">{activity.title}</span>
                  <span className="activity-description">{activity.description}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="activity-footer">
            <p>
              Activity is automatically detected from bill status updates.
              Daily monitoring ensures this feed stays current.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecentActivity

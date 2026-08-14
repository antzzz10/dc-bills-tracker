import { useState, useMemo } from 'react'
import './RecentActivity.css'
import Icon from './Icon'
import { getCongressGovUrl } from './congressLink'

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
      let icon = 'file-text'

      // Passed bills
      if (item.status?.stage?.startsWith('passed-')) {
        activityType = 'passed'
        icon = 'alert-triangle'
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
        icon = 'eye'
        description = 'Introduced'
      }
      // Committee activity
      else if (item.status?.hasCommitteeMarkup) {
        activityType = 'markup'
        icon = 'pencil'
        description = 'Committee markup'
      } else if (item.status?.hasCommitteeHearing) {
        activityType = 'hearing'
        icon = 'ear'
        description = 'Committee hearing held'
      }
      // Other status changes
      else if (item.status?.lastAction) {
        activityType = 'status-change'
        icon = 'refresh-cw'
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
          isPassed: item.status?.stage?.startsWith('passed-'),
          url: item.congressGovLink || getCongressGovUrl(item.billNumbers?.[0], item.congress)
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
          <Icon name="calendar" size={20} />
          <h2>Recent activity</h2>
          <span className="activity-count">{recentActivities.length}</span>
          <span className="activity-timeframe">Last 30 days</span>
        </div>
        <span className="expand-icon-large">
          <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} />
        </span>
      </div>

      {isExpanded && (
        <div className="recent-activity-content">
          <div className="activity-list">
            {recentActivities.map((activity, idx) => {
              const rowContent = (
                <>
                  <div className="activity-date">
                    <span className="date-text">{formatDate(activity.date)}</span>
                  </div>
                  <div className="activity-details">
                    <span className="activity-type-icon"><Icon name={activity.icon} size={16} /></span>
                    <span className="activity-bill-number">{activity.billNumbers}</span>
                    <span className={`activity-priority priority-${activity.priority}`}>
                      {activity.priority}
                    </span>
                    <span className="activity-title">{activity.title}</span>
                    <span className="activity-description">{activity.description}</span>
                    {activity.url && (
                      <span className="activity-external"><Icon name="external-link" size={14} /></span>
                    )}
                  </div>
                </>
              )
              const className = `activity-item ${activity.isPassed ? 'activity-passed' : ''}`
              return activity.url ? (
                <a
                  key={idx}
                  className={className}
                  href={activity.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {rowContent}
                </a>
              ) : (
                <div key={idx} className={className}>
                  {rowContent}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default RecentActivity

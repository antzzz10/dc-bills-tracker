import { useState } from 'react'
import './BillCard.css'
import billsData from '../data/bills.json'
import sponsorsData from '../data/sponsors.json'

function BillCard({ bill }) {
  // Start with all bills collapsed for better scanning
  const [isExpanded, setIsExpanded] = useState(false)
  const category = billsData.categories.find(cat => cat.id === bill.category)

  // Look up sponsor info from sponsors.json
  const getSponsorInfo = (sponsorName) => {
    return sponsorsData[sponsorName] || null
  }

  const getCongressLink = (billNumber) => {
    // Parse bill number like "H.R. 1089" or "S. 440"
    const match = billNumber.match(/(H\.R\.|S\.|H\.J\.Res\.|S\.J\.Res\.|H\.Con\.Res\.|S\.Con\.Res\.)\s*(\d+)/i)
    if (!match) return null

    const [, type, number] = match
    const congress = 119 // 119th Congress for 2025

    let billType = ''
    if (type.toLowerCase().includes('h.r.')) billType = 'hr'
    else if (type.toLowerCase().includes('s.') && !type.toLowerCase().includes('res')) billType = 's'
    else if (type.toLowerCase().includes('h.j.res')) billType = 'hjres'
    else if (type.toLowerCase().includes('s.j.res')) billType = 'sjres'
    else if (type.toLowerCase().includes('h.con.res')) billType = 'hconres'
    else if (type.toLowerCase().includes('s.con.res')) billType = 'sconres'

    return `https://www.congress.gov/bill/${congress}th-congress/house-bill/${number}`
      .replace('house-bill', billType === 's' || billType === 'sjres' || billType === 'sconres' ? 'senate-bill' : 'house-bill')
      .replace('/house-bill/', `/${billType}/`)
      .replace('/senate-bill/', `/${billType}/`)
  }

  // Get priority class for color coding
  const priorityClass = bill.priority ? `priority-${bill.priority}` : 'priority-low'
  const typeClass = bill.type === 'rider' ? 'type-rider' : ''

  return (
    <div
      className={`bill-card ${isExpanded ? 'expanded' : 'collapsed'} ${priorityClass} ${typeClass} ${bill.highlight ? 'highlighted-' + bill.highlight : ''}`}
      data-category={bill.category}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="bill-header">
        <div className="bill-numbers">
          {bill.billNumbers.map((billNum, index) => {
            const link = getCongressLink(billNum)
            return (
              <span key={index}>
                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bill-number-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {billNum}
                  </a>
                ) : (
                  <span className="bill-number">{billNum}</span>
                )}
                {index < bill.billNumbers.length - 1 && ' / '}
              </span>
            )
          })}
        </div>
        <div className="bill-header-right">
          {bill.highlight === 'floor-vote' && (
            <span className="floor-vote-badge">FLOOR VOTE</span>
          )}
          <span className="expand-icon">{isExpanded ? '−' : '+'}</span>
        </div>
      </div>

      <h3 className="bill-title">{bill.title}</h3>

      {isExpanded && (
        <div className="bill-details">
          <div className="bill-sponsors">
            <strong>Sponsor{bill.sponsors.length > 1 ? 's' : ''}:</strong>
            <div className="sponsors-list">
              {bill.sponsors.map((sponsorName, index) => {
                const sponsorInfo = getSponsorInfo(sponsorName)
                return (
                  <div key={index} className="sponsor-item">
                    <span className="sponsor-name">{sponsorName}</span>
                    {sponsorInfo && (
                      <span className={`sponsor-badge party-${sponsorInfo.party.toLowerCase()}`}>
                        {sponsorInfo.party}-{sponsorInfo.state.substring(0, 2).toUpperCase()}
                        {sponsorInfo.district && ` ${sponsorInfo.district}`}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <p className="bill-description">{bill.description}</p>
        </div>
      )}
    </div>
  )
}

export default BillCard

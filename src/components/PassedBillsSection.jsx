import { useState } from 'react'
import './PassedBillsSection.css'
import sponsorsData from '../data/sponsors.json'
import { stateAbbreviations } from '../data/stateAbbreviations'

function PassedBillsSection({ passedBills }) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Look up sponsor info from sponsors.json
  const getSponsorInfo = (sponsorName) => {
    return sponsorsData[sponsorName] || null
  }

  // Get state abbreviation
  const getStateAbbr = (stateName) => {
    return stateAbbreviations[stateName] || stateName
  }

  // Helper to parse date strings as local dates (avoiding timezone issues)
  const parseLocalDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day) // month is 0-indexed
  }

  // Helper to generate correct Congress.gov URL
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

  if (passedBills.length === 0) {
    return null
  }

  return (
    <div className="passed-bills-section">
      <div
        className="passed-bills-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="passed-bills-title">
          <span className="alert-icon">⚠️</span>
          <h2>Bills That Have Passed the House</h2>
          <span className="bill-count-passed">{passedBills.length}</span>
        </div>
        <span className="expand-icon-large">{isExpanded ? '−' : '+'}</span>
      </div>

      {isExpanded && (
        <div className="passed-bills-content">
          <p className="passed-bills-intro">
            These anti-DC bills have passed the House and are now headed to the Senate.
            They pose an immediate threat to DC's autonomy.
          </p>

          <div className="passed-bills-list">
            {passedBills.map(bill => (
              <div key={bill.id} className="passed-bill-card">
                <div className="passed-bill-header">
                  <div className="passed-bill-info">
                    <div className="passed-bill-numbers">
                      {bill.billNumbers.map((num, idx) => {
                        const url = getCongressLink(num)
                        return url ? (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bill-number-link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {num}
                          </a>
                        ) : (
                          <span key={idx} className="bill-number">{num}</span>
                        )
                      })}
                    </div>
                    <h3 className="passed-bill-title">
                      {bill.fullTitle || bill.title}
                    </h3>
                    <p className="passed-bill-description">{bill.description}</p>
                    <div className="passed-bill-sponsors">
                      <strong>Sponsor{bill.sponsors.length > 1 ? 's' : ''}:</strong>
                      <div className="sponsors-list">
                        {bill.sponsors.map((sponsorName, idx) => {
                          const sponsorInfo = getSponsorInfo(sponsorName)
                          return (
                            <div key={idx} className="sponsor-item">
                              <span className="sponsor-name">{sponsorName}</span>
                              {sponsorInfo && (
                                <span className={`sponsor-badge party-${sponsorInfo.party.toLowerCase()}`}>
                                  {sponsorInfo.party}-{getStateAbbr(sponsorInfo.state)}
                                  {sponsorInfo.district && ` ${sponsorInfo.district}`}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {bill.passage?.house && (
                    <div className="vote-info">
                      <div className="vote-date">
                        Passed: {parseLocalDate(bill.passage.house.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                      <div className="vote-total">
                        <span className="vote-yeas">{bill.passage.house.vote.yeas}</span>
                        {' - '}
                        <span className="vote-nays">{bill.passage.house.vote.nays}</span>
                      </div>
                      <div className="vote-breakdown">
                        <div className="party-vote republican">
                          <span className="party-label">R:</span>
                          <span className="party-votes">
                            {bill.passage.house.vote.byParty.republican.yeas}-{bill.passage.house.vote.byParty.republican.nays}
                          </span>
                        </div>
                        <div className="party-vote democrat">
                          <span className="party-label">D:</span>
                          <span className="party-votes">
                            {bill.passage.house.vote.byParty.democrat.yeas}-{bill.passage.house.vote.byParty.democrat.nays}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default PassedBillsSection

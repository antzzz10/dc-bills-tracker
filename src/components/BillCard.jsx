import { useState, useEffect, useRef } from 'react'
import './BillCard.css'
import billsData from '../data/bills.json'
import sponsorsData from '../data/sponsors.json'
import { stateAbbreviations } from '../data/stateAbbreviations'
import { CURRENT_CONGRESS } from '../data/config'
import { getCongressGovUrl } from './congressLink'
import Icon from './Icon'
import { track, EVENTS } from '../lib/analytics'

const ATTACK_TYPE_LABEL = {
  direct: 'Direct attack',
  partial: 'Partial attack',
}

const ATTACK_TYPE_DESCRIPTION = {
  direct: "Targeting D.C. is this bill's purpose.",
  partial: "This bill undermines D.C.'s self-governance, but D.C. is not its primary target — it attacks D.C. along the way.",
}

function BillCard({ bill, variant = 'attack' }) {
  const isTargeted = window.location.hash === `#${bill.id}`
  const [isExpanded, setIsExpanded] = useState(isTargeted)
  const cardRef = useRef(null)

  useEffect(() => {
    if (isTargeted && cardRef.current) {
      setTimeout(() => {
        cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    }
  }, [isTargeted])
  const category = billsData.categories.find(cat => cat.id === bill.category)

  // Look up sponsor info from sponsors.json
  const getSponsorInfo = (sponsorName) => {
    return sponsorsData[sponsorName] || null
  }

  // Get state abbreviation
  const getStateAbbr = (stateName) => {
    return stateAbbreviations[stateName] || stateName
  }

  const getCongressLink = (billNumber) =>
    getCongressGovUrl(billNumber, bill.congress || CURRENT_CONGRESS)

  // Get priority class for color coding
  const priorityClass = bill.priority ? `priority-${bill.priority}` : 'priority-low'
  const typeClass = bill.type === 'rider' ? 'type-rider' : ''
  const variantClass = variant === 'support' ? 'variant-support' : ''

  // Support cards never show the attackType badge — even S. 402's documented
  // edge case (support position, direct attackType) reads as confusing paired
  // with the positive styling here, and its description already explains the
  // nuance in prose. See docs/support-section-and-badges-draft.md.
  const showAttackTypeBadge = variant !== 'support' && ['direct', 'partial'].includes(bill.attackType)

  return (
    <div
      ref={cardRef}
      id={bill.id}
      className={`bill-card ${isExpanded ? 'expanded' : 'collapsed'} ${priorityClass} ${typeClass} ${variantClass} ${bill.highlight ? 'highlighted-' + bill.highlight : ''} ${isTargeted ? 'deep-linked' : ''}`}
      data-category={bill.category}
      onClick={() => {
        // Only the opening direction is interesting — a collapse is just cleanup.
        if (!isExpanded) {
          track(EVENTS.BILL_EXPANDED, {
            billId: bill.id,
            category: bill.category,
            priority: bill.priority,
          })
        }
        setIsExpanded(!isExpanded)
      }}
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
                    onClick={(e) => {
                      e.stopPropagation()
                      track(EVENTS.BILL_SOURCE_OPENED, {
                        billId: bill.id,
                        billNumber: billNum,
                        category: bill.category,
                      })
                    }}
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
          {showAttackTypeBadge && (
            <span
              className={`attack-type-badge attack-type-${bill.attackType}`}
              title={ATTACK_TYPE_DESCRIPTION[bill.attackType]}
              aria-label={ATTACK_TYPE_DESCRIPTION[bill.attackType]}
            >
              {ATTACK_TYPE_LABEL[bill.attackType]}
            </span>
          )}
          {bill.highlight === 'floor-vote' && (
            <span className="floor-vote-badge"><span className="dot"></span>FLOOR VOTE</span>
          )}
          <span className="expand-icon">
            <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={17} />
          </span>
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
                        {sponsorInfo.party}-{getStateAbbr(sponsorInfo.state)}
                        {sponsorInfo.district && ` ${sponsorInfo.district}`}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {bill.description && <p className="bill-description">{bill.description}</p>}

          {(bill.congressGovLink || getCongressLink(bill.billNumbers[0])) && (
            <a
              className="congress-gov-link"
              href={bill.congressGovLink || getCongressLink(bill.billNumbers[0])}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation()
                track(EVENTS.BILL_SOURCE_OPENED, {
                  billId: bill.id,
                  billNumber: bill.billNumbers[0],
                  category: bill.category,
                })
              }}
            >
              View on Congress.gov <Icon name="external-link" size={14} />
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export default BillCard

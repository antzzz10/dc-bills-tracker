import { useState } from 'react'
import './PassedBillsSection.css'
import sponsorsData from '../data/sponsors.json'
import { stateAbbreviations } from '../data/stateAbbreviations'

// Update this date to control which enacted bills appear in the "Enacted Into Law" section
const ENACTED_SINCE = new Date('2025-01-20')

const CONGRESS_PATH = {
  'h.r.': 'house-bill',
  's.': 'senate-bill',
  'h.j.res.': 'house-joint-resolution',
  's.j.res.': 'senate-joint-resolution',
  'h.con.res.': 'house-concurrent-resolution',
  's.con.res.': 'senate-concurrent-resolution',
}

function getCongressLink(billNumber) {
  const match = billNumber.match(/(H\.R\.|S\.|H\.J\.Res\.|S\.J\.Res\.|H\.Con\.Res\.|S\.Con\.Res\.)\s*(\d+)/i)
  if (!match) return null
  const [, type, number] = match
  const path = CONGRESS_PATH[type.toLowerCase()]
  if (!path) return null
  return `https://www.congress.gov/bill/119th-congress/${path}/${number}`
}

function getRelevantVote(bill) {
  const stage = bill.status?.stage
  if ((stage === 'enacted' || stage === 'passed-both' || stage === 'passed-senate') && bill.passage?.senate) {
    return { chamber: 'Senate', ...bill.passage.senate }
  }
  if (bill.passage?.house) return { chamber: 'House', ...bill.passage.house }
  return null
}

function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function BillCard({ bill }) {
  const getSponsorInfo = (name) => sponsorsData[name] || null
  const getStateAbbr = (state) => stateAbbreviations[state] || state
  const vote = getRelevantVote(bill)
  const stage = bill.status?.stage

  return (
    <div className="passed-bill-card">
      <div className="passed-bill-header">
        <div className="passed-bill-info">
          <div className="passed-bill-numbers-row">
            <div className="passed-bill-numbers">
              {bill.billNumbers.map((num, idx) => {
                const url = getCongressLink(num)
                return url ? (
                  <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                     className="bill-number-link" onClick={e => e.stopPropagation()}>
                    {num}
                  </a>
                ) : (
                  <span key={idx} className="bill-number">{num}</span>
                )
              })}
            </div>
            <div className="bill-status-tags">
              {stage === 'passed-both' && <span className="bill-status-tag tag-passed-both">Passed Both Chambers</span>}
              {stage === 'passed-senate' && <span className="bill-status-tag tag-passed-senate">Passed Senate</span>}
              {stage === 'passed-house' && <span className="bill-status-tag tag-passed-house">Passed House</span>}
              {bill.disputedByDC && <span className="bill-status-tag tag-disputed">Disputed by DC</span>}
            </div>
          </div>

          <h3 className="passed-bill-title">{bill.fullTitle || bill.title}</h3>
          <p className="passed-bill-description">{bill.description}</p>

          <div className="passed-bill-sponsors">
            <strong>Sponsor{bill.sponsors.length > 1 ? 's' : ''}:</strong>
            <div className="sponsors-list">
              {bill.sponsors.map((sponsorName, idx) => {
                const info = getSponsorInfo(sponsorName)
                return (
                  <div key={idx} className="sponsor-item">
                    <span className="sponsor-name">{sponsorName}</span>
                    {info && (
                      <span className={`sponsor-badge party-${info.party.toLowerCase()}`}>
                        {info.party}-{getStateAbbr(info.state)}{info.district && ` ${info.district}`}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {vote && (
          <div className="vote-info">
            <div className="vote-date">
              {vote.chamber} vote: {parseLocalDate(vote.date).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
              })}
            </div>
            <div className="vote-total">
              <span className="vote-yeas">{vote.vote.yeas}</span>
              {' - '}
              <span className="vote-nays">{vote.vote.nays}</span>
            </div>
            {vote.vote.byParty && (
              <div className="vote-breakdown">
                <div className="party-vote republican">
                  <span className="party-label">R:</span>
                  <span className="party-votes">
                    {vote.vote.byParty.republican.yeas}-{vote.vote.byParty.republican.nays}
                  </span>
                </div>
                <div className="party-vote democrat">
                  <span className="party-label">D:</span>
                  <span className="party-votes">
                    {vote.vote.byParty.democrat.yeas}-{vote.vote.byParty.democrat.nays}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AccordionSection({ title, count, bills, intro, expanded, onToggle, className }) {
  return (
    <div className={`passed-bills-section ${className || ''}`}>
      <div className="passed-bills-header" onClick={onToggle}>
        <div className="passed-bills-title">
          <span className="alert-icon">⚠️</span>
          <h2>{title}</h2>
          <span className="bill-count-passed">{count}</span>
        </div>
        <span className="expand-icon-large">{expanded ? '−' : '+'}</span>
      </div>
      {expanded && (
        <div className="passed-bills-content">
          <p className="passed-bills-intro">{intro}</p>
          <div className="passed-bills-list">
            {bills.map(bill => <BillCard key={bill.id} bill={bill} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function PassedBillsSection({ passedBills }) {
  const [enactedExpanded, setEnactedExpanded] = useState(false)
  const [advancedExpanded, setAdvancedExpanded] = useState(false)

  const enactedBills = passedBills.filter(b => {
    if (b.status?.stage !== 'enacted') return false
    const d = b.passage?.senate?.date || b.passage?.house?.date || b.status?.lastActionDate
    return !d || new Date(d) >= ENACTED_SINCE
  })

  const advancedBills = passedBills.filter(b => b.status?.stage !== 'enacted')

  if (passedBills.length === 0) return null

  return (
    <>
      {enactedBills.length > 0 && (
        <AccordionSection
          title="Enacted Into Law"
          count={enactedBills.length}
          bills={enactedBills}
          intro="These anti-DC bills have been signed into law since January 20, 2025. Review each for ongoing legal challenges or DC government responses."
          expanded={enactedExpanded}
          onToggle={() => setEnactedExpanded(e => !e)}
          className="enacted-section"
        />
      )}
      {advancedBills.length > 0 && (
        <AccordionSection
          title="Bills That Have Advanced"
          count={advancedBills.length}
          bills={advancedBills}
          intro="These anti-DC bills have cleared at least one chamber of Congress. Bills that have passed both chambers are headed to the President for signature."
          expanded={advancedExpanded}
          onToggle={() => setAdvancedExpanded(e => !e)}
        />
      )}
    </>
  )
}

export default PassedBillsSection

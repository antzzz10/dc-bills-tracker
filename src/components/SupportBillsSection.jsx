import { useState } from 'react'
import './SupportBillsSection.css'
import BillCard from './BillCard'

// H.R. 51 is the flagship — always first, regardless of everything else.
// Everything else sorts by priority tier (the spec's original hand-curated
// order predates the 2026-07-21 provisional-review batch that roughly
// tripled this list from 11 to ~36 bills — a fixed ID list doesn't scale to
// that, so this falls back to the same priority signal the rest of the site
// already uses, tie-broken alphabetically for a stable order).
const FLAGSHIP_ID = 'hr51'
const PRIORITY_RANK = { high: 0, medium: 1, watching: 2, low: 3 }

function sortSupportBills(bills) {
  return [...bills].sort((a, b) => {
    if (a.id === FLAGSHIP_ID) return -1
    if (b.id === FLAGSHIP_ID) return 1
    const rankA = PRIORITY_RANK[a.priority] ?? 4
    const rankB = PRIORITY_RANK[b.priority] ?? 4
    if (rankA !== rankB) return rankA - rankB
    return a.title.localeCompare(b.title)
  })
}

function SupportBillsSection({ supportBills }) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (!supportBills || supportBills.length === 0) return null

  const sorted = sortSupportBills(supportBills)

  return (
    <div className="support-bills-section">
      <div className="support-bills-header" onClick={() => setIsExpanded(e => !e)}>
        <div className="support-bills-title">
          <span className="support-icon">✓</span>
          <h2>Bills to Support</h2>
          <span className="bill-count-support">{sorted.length}</span>
        </div>
        <span className="expand-icon-large">{isExpanded ? '−' : '+'}</span>
      </div>
      {isExpanded && (
        <div className="support-bills-content">
          <p className="support-bills-intro">
            Not every DC bill in Congress is an attack. These bills would expand DC's power to
            govern itself — from full statehood to control over its own police, courts, and
            clemency. When you contact members of Congress about the bills above, ask them to
            champion these too.
          </p>
          <div className="support-bills-list">
            {sorted.map(bill => (
              <BillCard key={bill.id} bill={bill} variant="support" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default SupportBillsSection

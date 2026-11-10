import { useState } from 'react'
import './PassedBillsSection.css'
import Icon from './Icon'
import { countUnits } from '../lib/measureCounts'

// Measures that are final but outside the active counts (Andria, 2026-11-09: archive
// failed, withdrawn, superseded and never-voted measures, but keep the historical record
// of everything for and against D.C.). Each card states the official outcome in the
// record's own terms and links the source it was checked against.
//
// Collapsed by default, like the passed sections: it is reference material, not news.

function ArchivedCard({ item }) {
  const { outcome } = item
  return (
    <div className="passed-bill-card">
      <div className="passed-bill-header">
        <div className="passed-bill-info">
          <div className="passed-bill-numbers-row">
            <div className="passed-bill-numbers">
              {item.billNumbers.map((num, idx) => (
                <span key={idx} className="bill-number">{num}</span>
              ))}
            </div>
          </div>
          <h3 className="passed-bill-title">{item.fullTitle || item.title}</h3>
          <p className="passed-bill-description">{item.description}</p>
          <p className="passed-bill-description">
            <strong>{outcome.summary}</strong>{' '}
            {outcome.source && (
              <a href={outcome.source} target="_blank" rel="noopener noreferrer"
                 className="vote-source-link">
                Official record ↗
              </a>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

function ArchivedSection({ items }) {
  const [expanded, setExpanded] = useState(false)
  if (!items || items.length === 0) return null

  return (
    <div className="passed-bills-section archived-section">
      <div className="passed-bills-header" onClick={() => setExpanded(e => !e)}>
        <div className="passed-bills-title">
          <Icon name="archive" size={20} />
          <h2>Archived this Congress</h2>
          <span className="bill-count-passed">{countUnits(items).total}</span>
        </div>
        <span className="expand-icon-large">
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={18} />
        </span>
      </div>
      {expanded && (
        <div className="passed-bills-content">
          <div className="passed-bills-list">
            {items.map(item => <ArchivedCard key={item.id} item={item} />)}
          </div>
        </div>
      )}
    </div>
  )
}

export default ArchivedSection

import { useState } from 'react'
import './CategoryGroup.css'
import BillCard from './BillCard'
import Icon from './Icon'

function CategoryGroup({ category, bills }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="category-group">
      <div
        className="category-group-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="category-group-title">
          <h2>{category.name}</h2>
          <span className="bill-count">{bills.length} {bills.length === 1 ? 'bill' : 'bills'}</span>
        </div>
        <span className="expand-icon-large">
          <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} />
        </span>
      </div>

      {isExpanded && (
        <div className="category-group-content">
          {bills.map(bill => (
            <BillCard key={bill.id} bill={bill} />
          ))}
        </div>
      )}
    </div>
  )
}

export default CategoryGroup

import { useState, useMemo } from 'react'
import './App.css'
import billsData from './data/bills.json'
import CategoryFilter from './components/CategoryFilter'
import CategoryGroup from './components/CategoryGroup'
import SearchBar from './components/SearchBar'
import DownloadButton from './components/DownloadButton'
import UpdateBanner from './components/UpdateBanner'
import PassedBillsSection from './components/PassedBillsSection'
// import ContactSection from './components/ContactSection' // Hidden until Google Form is set up

function App() {
  const [selectedCategories, setSelectedCategories] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showOtherBills, setShowOtherBills] = useState(false)

  const { filteredBills, filteredRiders, passedBills, highPriorityGroups, otherBillsGroups, riderGroups, totalCount, pendingCount, passedCount } = useMemo(() => {
    const allBills = billsData.bills || []
    const allRiders = billsData.riders || []

    // Separate passed bills from pending bills
    const passedBills = allBills.filter(bill =>
      bill.status?.stage &&
      (bill.status.stage.startsWith('passed-') || bill.status.stage === 'enacted')
    )
    const pendingBills = allBills.filter(bill =>
      !bill.status?.stage ||
      (!bill.status.stage.startsWith('passed-') && bill.status.stage !== 'enacted')
    )

    // Filter bills
    let filtered = pendingBills
    let filteredRiders = allRiders

    // Filter by selected categories
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(bill =>
        selectedCategories.includes(bill.category)
      )
      filteredRiders = filteredRiders.filter(rider =>
        selectedCategories.includes(rider.category)
      )
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      const searchFilter = item =>
        item.title.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        item.sponsors.some(sponsor => sponsor.toLowerCase().includes(term)) ||
        item.billNumbers.some(num => num.toLowerCase().includes(term))

      filtered = filtered.filter(searchFilter)
      filteredRiders = filteredRiders.filter(searchFilter)
    }

    // Separate high priority from other bills (only pending bills)
    const highPriorityBills = filtered.filter(bill => bill.priority === 'high')
    const otherBills = filtered.filter(bill => bill.priority !== 'high')

    // Group high priority bills by category
    const highPriorityGroups = billsData.categories.map(category => ({
      category,
      bills: highPriorityBills.filter(bill => bill.category === category.id)
    })).filter(group => group.bills.length > 0)

    // Group other bills by category
    const otherBillsGroups = billsData.categories.map(category => ({
      category,
      bills: otherBills.filter(bill => bill.category === category.id)
    })).filter(group => group.bills.length > 0)

    // Group riders by category
    const riderGroups = billsData.categories.map(category => ({
      category,
      bills: filteredRiders.filter(rider => rider.category === category.id)
    })).filter(group => group.bills.length > 0)

    const pendingCount = filtered.length + filteredRiders.length
    const passedCount = passedBills.length
    const totalCount = pendingCount + passedCount

    return {
      filteredBills: filtered,
      filteredRiders,
      passedBills,
      highPriorityGroups,
      otherBillsGroups,
      riderGroups,
      totalCount,
      pendingCount,
      passedCount
    }
  }, [selectedCategories, searchTerm])

  const toggleCategory = (categoryId) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  const clearFilters = () => {
    setSelectedCategories([])
    setSearchTerm('')
  }

  return (
    <div className="app">
      <UpdateBanner
        passedBills={passedBills}
        upcomingFloorVotes={filteredBills.filter(b => b.highlight === 'floor-vote')}
        allBills={billsData.bills}
      />
      <header className="header">
        <h1>Anti-DC Bills Tracker</h1>
        <p className="subtitle">
          Tracking bills in Congress that threaten D.C. home rule and autonomy
        </p>
        <p className="last-updated">
          Last checked: {new Date(billsData.lastUpdated).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • Monitoring runs daily
        </p>
      </header>

      <div className="container">
        <SearchBar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />

        <CategoryFilter
          categories={billsData.categories}
          selectedCategories={selectedCategories}
          toggleCategory={toggleCategory}
        />

        <div className="results-header">
          <h2>
            {totalCount} {totalCount === 1 ? 'Item' : 'Items'} Found
            {passedCount > 0 && (
              <span className="count-breakdown"> ({pendingCount} pending, {passedCount} passed)</span>
            )}
          </h2>
          <div className="results-actions">
            {(selectedCategories.length > 0 || searchTerm) && (
              <button className="clear-filters" onClick={clearFilters}>
                Clear All Filters
              </button>
            )}
            <DownloadButton
              filteredBills={filteredBills}
              filteredRiders={filteredRiders}
            />
          </div>
        </div>

        <div className="bills-list">
          {/* Passed Bills Section - Always visible when there are passed bills */}
          <PassedBillsSection passedBills={passedBills} />

          {totalCount === 0 ? (
            <div className="no-results">
              <p>No bills found matching your criteria.</p>
            </div>
          ) : (
            <>
              {/* High Priority Bills Section */}
              {highPriorityGroups.length > 0 && (
                <div className="priority-section">
                  <div className="section-header high-priority-header">
                    <h2>🔴 High Priority Bills ({highPriorityGroups.reduce((sum, g) => sum + g.bills.length, 0)})</h2>
                    <p className="section-description">
                      Bills with significant legislative activity or identified as high-priority threats by FreeDC
                    </p>
                  </div>
                  {highPriorityGroups.map(group => (
                    <CategoryGroup
                      key={`high-${group.category.id}`}
                      category={group.category}
                      bills={group.bills}
                    />
                  ))}
                </div>
              )}

              {/* Budget Riders Section */}
              {riderGroups.length > 0 && (
                <div className="priority-section">
                  <div className="section-header riders-header">
                    <h2>📋 Budget Riders ({riderGroups.reduce((sum, g) => sum + g.bills.length, 0)})</h2>
                    <p className="section-description">
                      Policy restrictions attached to appropriations bills (H.R. 5166)
                    </p>
                  </div>
                  {riderGroups.map(group => (
                    <CategoryGroup
                      key={`rider-${group.category.id}`}
                      category={group.category}
                      bills={group.bills}
                    />
                  ))}
                </div>
              )}

              {/* Other Bills Section (Collapsible) */}
              {otherBillsGroups.length > 0 && (
                <div className="priority-section other-bills-section">
                  <div
                    className="section-header other-bills-header collapsible"
                    onClick={() => setShowOtherBills(!showOtherBills)}
                  >
                    <div>
                      <h2>
                        ⚪ Other Introduced Bills ({otherBillsGroups.reduce((sum, g) => sum + g.bills.length, 0)})
                        <span className="expand-icon-section">{showOtherBills ? '−' : '+'}</span>
                      </h2>
                      <p className="section-description">
                        Bills introduced but with no significant activity yet
                      </p>
                    </div>
                  </div>
                  {showOtherBills && otherBillsGroups.map(group => (
                    <CategoryGroup
                      key={`other-${group.category.id}`}
                      category={group.category}
                      bills={group.bills}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* <ContactSection /> */}
        {/* Contact section hidden until Google Form is set up - see FEEDBACK-SETUP.md */}
      </div>

      <footer className="footer">
        <div className="footer-content">
          <p className="footer-statement">
            D.C. statehood is a civil rights issue. These bills undermine the democratic rights of D.C. residents.
          </p>

          <div className="footer-about">
            <h3>About This Site</h3>
            <p>
              This is an independent, volunteer-run project created by a proud DC resident
              to track anti-DC legislation. Not affiliated with any organization.
            </p>
          </div>

          <p className="footer-copyright">
            Copyright © 2025 Represent DC
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App

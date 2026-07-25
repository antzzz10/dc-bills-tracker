import { useState, useMemo } from 'react'
import './App.css'
import billsData from './data/bills.json'
import CategoryFilter from './components/CategoryFilter'
import CategoryGroup from './components/CategoryGroup'
import SearchBar from './components/SearchBar'
import DownloadButton from './components/DownloadButton'
import UpdateBanner from './components/UpdateBanner'
import UrgentAlert from './components/UrgentAlert'
import { isUrgentAlertActive } from './components/urgentAlertState'
import PassedBillsSection from './components/PassedBillsSection'
import SupportBillsSection from './components/SupportBillsSection'
import RecentActivity from './components/RecentActivity'
import NewsFeed from './components/NewsFeed'
// import ContactSection from './components/ContactSection' // Hidden until Google Form is set up

// Bill-data freshness. `lastChecked` is stamped by scripts/monitor-bills.js on every
// run that successfully reaches Congress.gov, so it reflects when the DATA was verified
// — not when the bundle was built. The old build-date display kept reading "today" even
// when monitoring had stalled, because fetch-news rebuilds and redeploys the whole site
// twice a day regardless of whether any bill was checked.
const STALE_AFTER_MS = 48 * 60 * 60 * 1000
const LAST_CHECKED = billsData.lastChecked || null
const IS_DATA_STALE = LAST_CHECKED
  ? Date.now() - new Date(LAST_CHECKED).getTime() > STALE_AFTER_MS
  : false

// Freshness is rendered in Eastern Time regardless of where it's read from — the audience
// is DC, and "last checked" shouldn't shift meaning based on the reader's own timezone.
// Safe to pin a timezone here only because `lastChecked` is a true instant (ISO-8601 with
// Z). Never pin one on a date-only value like "2026-07-22": that parses as UTC midnight
// and renders a day backwards in ET — the reason parseLocalDate() exists in
// PassedBillsSection.jsx and RecentActivity.jsx.
const ET_TIME_ZONE = 'America/New_York'

const formatCheckedInstant = (isoInstant) =>
  `${new Date(isoInstant).toLocaleString('en-US', {
    timeZone: ET_TIME_ZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })} ET`

// Fallback only, for data written before `lastChecked` existed. __BUILD_DATE__ is
// date-only, so it must be split into local parts rather than timezone-converted.
const formatBuildDate = (dateOnly) => {
  const [year, month, day] = dateOnly.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function App() {
  const [selectedCategories, setSelectedCategories] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showOtherBills, setShowOtherBills] = useState(false)

  const { filteredBills, filteredRiders, filteredSupportBills, passedBills, highPriorityGroups, otherBillsGroups, riderGroups, routineGroups, totalCount, pendingCount, passedCount } = useMemo(() => {
    // Exclude provisional (auto-discovered, not-yet-human-reviewed) entries from
    // the public oppose/support/routine sections — their `position` is an
    // unverified default, not a reviewed classification. They still surface in
    // Recent Activity (via the raw billsData passed there) as "Introduced".
    const allBills = (billsData.bills || []).filter(bill => !bill.provisional)
    const allRiders = (billsData.riders || []).filter(rider => !rider.provisional)
    const allRoutineBills = (billsData.routineBills || []).filter(bill => !bill.provisional)
    const allSupportBills = (billsData.supportBills || []).filter(bill => !bill.provisional)

    // Start with all bills and apply filters
    let filteredAllBills = allBills
    let filteredRiders = allRiders
    let filteredRoutineBills = allRoutineBills
    let filteredSupportBills = allSupportBills

    const searchFilter = (term) => item =>
      item.title.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      item.sponsors.some(sponsor => sponsor.toLowerCase().includes(term)) ||
      item.billNumbers.some(num => num.toLowerCase().includes(term))

    // Filter by selected categories
    if (selectedCategories.length > 0) {
      filteredAllBills = filteredAllBills.filter(bill =>
        selectedCategories.includes(bill.category)
      )
      filteredRiders = filteredRiders.filter(rider =>
        selectedCategories.includes(rider.category)
      )
      filteredRoutineBills = filteredRoutineBills.filter(bill =>
        selectedCategories.includes(bill.category)
      )
      filteredSupportBills = filteredSupportBills.filter(bill =>
        selectedCategories.includes(bill.category)
      )
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filteredAllBills = filteredAllBills.filter(searchFilter(term))
      filteredRiders = filteredRiders.filter(searchFilter(term))
      filteredRoutineBills = filteredRoutineBills.filter(searchFilter(term))
      filteredSupportBills = filteredSupportBills.filter(searchFilter(term))
    }

    // NOW separate passed bills from pending bills (after filters applied)
    const passedBills = filteredAllBills.filter(bill =>
      bill.status?.stage &&
      (bill.status.stage.startsWith('passed-') || bill.status.stage === 'enacted')
    )
    const filtered = filteredAllBills.filter(bill =>
      !bill.status?.stage ||
      (!bill.status.stage.startsWith('passed-') && bill.status.stage !== 'enacted')
    )

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

    // Group routine bills by category
    const routineGroups = billsData.categories.map(category => ({
      category,
      bills: filteredRoutineBills.filter(bill => bill.category === category.id)
    })).filter(group => group.bills.length > 0)

    const pendingCount = filtered.length + filteredRiders.length + filteredRoutineBills.length
    const passedCount = passedBills.length
    const totalCount = pendingCount + passedCount

    return {
      filteredBills: filtered,
      filteredRiders,
      filteredSupportBills,
      passedBills,
      highPriorityGroups,
      otherBillsGroups,
      riderGroups,
      routineGroups,
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
      <UrgentAlert />
      {!isUrgentAlertActive() && (
        <UpdateBanner
          passedBills={passedBills}
          upcomingFloorVotes={filteredBills.filter(b => b.highlight === 'floor-vote')}
          allBills={billsData.bills}
        />
      )}
      <header className="header">
        <h1>Anti-DC Bills Tracker</h1>
        <p className="subtitle">
          Tracking bills in Congress that threaten D.C. home rule and autonomy
        </p>
        <p className={`last-updated${IS_DATA_STALE ? ' last-updated-stale' : ''}`}>
          {LAST_CHECKED ? (
            IS_DATA_STALE ? (
              <>⚠️ Bill data last verified {formatCheckedInstant(LAST_CHECKED)} — daily monitoring may be stalled</>
            ) : (
              <>Bill data last checked: {formatCheckedInstant(LAST_CHECKED)} • Monitoring runs daily</>
            )
          ) : (
            <>Site last built: {formatBuildDate(__BUILD_DATE__)}</>
          )}
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

        {/* Recent Activity - Auto-generated from bill changes */}
        {!searchTerm && selectedCategories.length === 0 && (
          <RecentActivity
            allBills={billsData.bills}
            allRiders={billsData.riders}
          />
        )}

        {!searchTerm && selectedCategories.length === 0 && <NewsFeed />}

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
              {/* Pending Bills Section - Non-collapsible header */}
              <div className="pending-bills-section">
                <div className="pending-bills-header">
                  <div className="pending-bills-title">
                    <span className="alert-icon">📋</span>
                    <h2>Pending Bills</h2>
                    <span className="bill-count-pending">{pendingCount}</span>
                  </div>
                </div>

                <div className="pending-bills-content">
                  <p className="pending-bills-intro">
                    These bills are currently under consideration in Congress and have not yet passed either chamber.
                  </p>

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

              {/* Everyday Indignities Section — bills that are neither attacks nor
                  advocacy wins: Congress performing a routine, recurring structural
                  obligation over DC that a state legislature would never need to ask
                  permission for. Still a real structural incursion (attackType is
                  mandatory on every entry) — see METHODOLOGY.md. */}
              {routineGroups.length > 0 && (
                <div className="priority-section">
                  <div className="section-header routine-header">
                    <h2>📎 Everyday Indignities ({routineGroups.reduce((sum, g) => sum + g.bills.length, 0)})</h2>
                    <p className="section-description">
                      The routine paperwork of not being a state — sign-offs Congress requires from DC that no state legislature would ever need to ask for.
                    </p>
                  </div>
                  {routineGroups.map(group => (
                    <CategoryGroup
                      key={`routine-${group.category.id}`}
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
                </div>
              </div>
            </>
          )}

          {/* Bills to Support — the constructive closer. Rendered unconditionally
              (outside the totalCount===0 branch above) so it still shows even
              when a search/filter matches zero oppose bills. */}
          <SupportBillsSection supportBills={filteredSupportBills} />
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
            <p className="footer-feedback">
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLScoQfgfU-vHBN0EXqGp51Vv79oT2iS-1_uPTzoPtpmFlQ58kQ/viewform"
                target="_blank"
                rel="noopener noreferrer"
              >
                Send Feedback →
              </a>
            </p>
            <p className="footer-feedback">
              <a href="https://www.representdc.org">Main Site</a> · <a href="https://candidates.representdc.org">Candidates</a>
            </p>
          </div>

          <p className="footer-copyright">
            Copyright © 2026 Represent DC
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App

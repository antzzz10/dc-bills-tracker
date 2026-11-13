import { useState, useMemo } from 'react'
import './App.css'
import billsData from './data/bills.json'
import Icon from './components/Icon'
import Nav from './components/Nav'
import Footer from './components/Footer'
import CategoryFilter from './components/CategoryFilter'
import CategoryGroup from './components/CategoryGroup'
import BillCard from './components/BillCard'
import SearchBar from './components/SearchBar'
import DownloadButton from './components/DownloadButton'
import UpdateBanner from './components/UpdateBanner'
import UrgentAlert from './components/UrgentAlert'
import { isUrgentAlertActive } from './components/urgentAlertState'
import PageSummary from './components/PageSummary'
import { getUpdateBannerMessage } from './components/updateBannerMessage'
import PassedBillsSection from './components/PassedBillsSection'
import ArchivedSection from './components/ArchivedSection'
import RecentActivity from './components/RecentActivity'
import { countUnits } from './lib/measureCounts'
import { isActive, isPending, hasAdvanced, isArchived } from './lib/measureStatus'
// import ContactSection from './components/ContactSection' // Hidden until Google Form is set up

// Bill-data freshness. `lastChecked` is stamped by scripts/monitor-bills.js on every
// run that successfully reaches Congress.gov, so it reflects when the DATA was verified
// — not when the bundle was built. The old build-date display kept reading "today" even
// when monitoring had stalled, because the (since removed) news job rebuilt and
// redeployed the whole site twice a day regardless of whether any bill was checked.
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

// Recent Activity and the banner read raw data on purpose (Recent Activity shows newly
// introduced, unreviewed bills); archived entries are never news.
const activeOrUnreviewed = list => (list || []).filter(item => !isArchived(item))

function App() {
  const [selectedCategories, setSelectedCategories] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showOtherBills, setShowOtherBills] = useState(false)

  const { filteredBills, filteredRiders, passedBills, archivedItems, highPriorityGroups, otherBillsGroups, riderGroups, routineGroups, barrierBills, totalCount, archivedCount, pendingCount, passedCount, routineCount, barrierCount } = useMemo(() => {
    // Exclude provisional (auto-discovered, not-yet-human-reviewed) entries from
    // the public oppose/routine sections — their `position` is an unverified
    // default, not a reviewed classification. They still surface in Recent
    // Activity (via the raw billsData passed there) as "Introduced".
    //
    // `billsData.supportBills` is deliberately not read here: pro-DC bills are
    // parked (see decisions/2026-08-03-park-support-bills.md). The data is kept
    // and still linted, it just does not render — this page is oppose-only so it
    // can be shared without a reader having to sort attacks from allies.
    //
    // Archived entries (final, with an official outcome) are kept in bills.json for the
    // record but leave every active list and count; they render in their own section.
    const allBills = (billsData.bills || []).filter(isActive)
    const allRiders = (billsData.riders || []).filter(isActive)
    const allRoutineBills = (billsData.routineBills || []).filter(isActive)
    // Barriers to statehood: their own section and count, never anti-DC (2026-11-12).
    let barrierBills = (billsData.statehoodBarriers || []).filter(isActive)
    let archivedItems = ['bills', 'riders', 'routineBills', 'statehoodBarriers']
      .flatMap(section => billsData[section] || [])
      .filter(item => !item.provisional && isArchived(item))

    // Start with all bills and apply filters
    let filteredAllBills = allBills
    let filteredRiders = allRiders
    let filteredRoutineBills = allRoutineBills

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
      barrierBills = barrierBills.filter(bill => selectedCategories.includes(bill.category))
      archivedItems = archivedItems.filter(item => selectedCategories.includes(item.category))
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filteredAllBills = filteredAllBills.filter(searchFilter(term))
      filteredRiders = filteredRiders.filter(searchFilter(term))
      filteredRoutineBills = filteredRoutineBills.filter(searchFilter(term))
      barrierBills = barrierBills.filter(searchFilter(term))
      archivedItems = archivedItems.filter(searchFilter(term))
    }

    // NOW separate passed bills from pending bills (after filters applied)
    // Riders can advance too: a rider enacted in a funding law is law (2026-11-09).
    const passedBills = [...filteredAllBills, ...filteredRiders].filter(hasAdvanced)
    const filtered = filteredAllBills.filter(isPending)
    filteredRiders = filteredRiders.filter(isPending)

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

    // Measures, not entries: H.R. 1968 is three entries but one law (src/lib/measureCounts.js).
    // Routine measures are counted on their own, never as anti-DC (2026-11-09).
    const pendingCount = countUnits([...filtered, ...filteredRiders]).total
    const passedCount = countUnits(passedBills).total
    const routineCount = countUnits(filteredRoutineBills).total
    const barrierCount = countUnits(barrierBills).total
    const archivedCount = countUnits(archivedItems).total
    // Everything the search found, archived matches included, so a search that only
    // matches an archived amendment doesn't say "0 items found" above its card.
    const totalCount = pendingCount + passedCount + routineCount + barrierCount + archivedCount

    return {
      filteredBills: filtered,
      filteredRiders,
      passedBills,
      archivedItems,
      highPriorityGroups,
      otherBillsGroups,
      riderGroups,
      routineGroups,
      barrierBills,
      totalCount,
      archivedCount,
      pendingCount,
      passedCount,
      routineCount,
      barrierCount
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

  // The top slot holds at most one thing. UrgentAlert (hand-written, expires) outranks
  // UpdateBanner (auto, only speaks when something moved), which outranks PageSummary
  // (orientation for a first-time reader). Asking the banner for its message rather than
  // for its presence matters: it renders null on a quiet week, and that is exactly when
  // the summary should take the slot.
  //
  // Deliberately keyed to whether the banner HAS a message, not to whether the reader
  // dismissed it — swapping in different copy under someone who just closed a banner
  // reads as a bug, not a feature.
  const hasBannerMessage = Boolean(
    !isUrgentAlertActive() &&
    getUpdateBannerMessage({
      passedBills,
      upcomingFloorVotes: filteredBills.filter(b => b.highlight === 'floor-vote'),
      allBills: activeOrUnreviewed(billsData.bills),
    })
  )
  const showPageSummary = !isUrgentAlertActive() && !hasBannerMessage

  return (
    <div className="app">
      <Nav />
      <UrgentAlert />
      {!isUrgentAlertActive() && (
        <UpdateBanner
          passedBills={passedBills}
          upcomingFloorVotes={filteredBills.filter(b => b.highlight === 'floor-vote')}
          allBills={activeOrUnreviewed(billsData.bills)}
        />
      )}
      {/* Sub-page hero: eyebrow + h1 + one-line subtitle. Max 3 blocks
          (DESIGN-GUARDRAILS.md) — the freshness line sits outside the hero. */}
      <header className="header">
        <p className="eyebrow">Bill tracker</p>
        <h1>Anti-DC bills tracker</h1>
        <p className="subtitle">
          Tracking bills in Congress that threaten D.C. home rule and autonomy
        </p>
      </header>
      <p className={`last-updated${IS_DATA_STALE ? ' last-updated-stale' : ''}`}>
        {LAST_CHECKED ? (
          IS_DATA_STALE ? (
            <>
              <Icon name="alert-triangle" size={15} />
              Bill data last verified {formatCheckedInstant(LAST_CHECKED)} — daily monitoring may be stalled
            </>
          ) : (
            <>Bill data last checked: {formatCheckedInstant(LAST_CHECKED)} • Monitoring runs daily</>
          )
        ) : (
          <>Site last built: {formatBuildDate(__BUILD_DATE__)}</>
        )}
      </p>

      <div className="container">
        {showPageSummary && (
          <PageSummary
            bills={billsData.bills}
            riders={billsData.riders}
            routineBills={billsData.routineBills}
          />
        )}

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
            allBills={activeOrUnreviewed(billsData.bills)}
            allRiders={activeOrUnreviewed(billsData.riders)}
          />
        )}

        {/* The news feed lives at representdc.org/news. Its pipeline moved to the
            representdc-main repo (2026-09) and this repo's copy was removed 2026-10-14. */}

        <div className="results-header">
          <h2>
            {totalCount} {totalCount === 1 ? 'item' : 'items'} found
            {(passedCount > 0 || routineCount > 0 || barrierCount > 0 || archivedCount > 0) && (
              <span className="count-breakdown"> ({[
                `${pendingCount} pending`,
                passedCount > 0 && `${passedCount} passed`,
                barrierCount > 0 && `${barrierCount} ${barrierCount === 1 ? 'barrier' : 'barriers'} to statehood`,
                routineCount > 0 && `${routineCount} routine`,
                archivedCount > 0 && `${archivedCount} archived`,
              ].filter(Boolean).join(', ')})</span>
            )}
          </h2>
          <div className="results-actions">
            {(selectedCategories.length > 0 || searchTerm) && (
              <button className="clear-filters" onClick={clearFilters}>
                Clear All Filters
              </button>
            )}
            {/* Every active entry the results show, passed ones included: an enacted rider
                found by search must be in the filtered export too. */}
            <DownloadButton
              filteredBills={[...filteredBills, ...passedBills.filter(b => b.type !== 'rider')]}
              filteredRiders={[...filteredRiders, ...passedBills.filter(b => b.type === 'rider')]}
              filteredBarriers={barrierBills}
            />
          </div>
        </div>

        <div className="bills-list">
          {/* Passed Bills Section - Always visible when there are passed bills */}
          <PassedBillsSection passedBills={passedBills} />
          <ArchivedSection items={archivedItems} />

          {totalCount === 0 ? (
            <div className="no-results">
              <p>No bills found matching your criteria.</p>
            </div>
          ) : (
            <>
              {/* Pending Bills Section - Non-collapsible header */}
              {pendingCount > 0 && (
              <div className="pending-bills-section">
                <div className="pending-bills-header">
                  <div className="pending-bills-title">
                    <Icon name="list" size={20} />
                    <h2>Pending bills</h2>
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
                    <h2><Icon name="alert-circle" size={18} /> High priority bills ({countUnits(highPriorityGroups.flatMap(g => g.bills)).total})</h2>
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
                    <h2><Icon name="file-text" size={18} /> Budget riders ({countUnits(riderGroups.flatMap(g => g.bills)).total})</h2>
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
                        <Icon name="circle" size={18} /> Other introduced bills ({countUnits(otherBillsGroups.flatMap(g => g.bills)).total})
                        <span className="expand-icon-section">
                          <Icon name={showOtherBills ? 'chevron-up' : 'chevron-down'} size={18} />
                        </span>
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
              )}
              {/* Barriers to statehood: measures that would make statehood harder to win without
                  changing how D.C. is governed today (H.J.Res. 141). Not home-rule attacks, so
                  they sit outside the pending section and every anti-DC count, and carry no
                  direct/partial tag. See METHODOLOGY.md. */}
              {barrierBills.length > 0 && (
                <div className="priority-section">
                  <div className="section-header barriers-header">
                    <h2><Icon name="alert-triangle" size={18} /> Barriers to statehood ({barrierCount})</h2>
                    <p className="section-description">
                      Measures that would make D.C. statehood harder to win without changing how D.C. is governed today. Counted separately from the bills above.
                    </p>
                  </div>
                  {barrierBills.map(bill => (
                    <BillCard key={bill.id} bill={bill} />
                  ))}
                </div>
              )}

              {/* Outside the pending section on purpose: a routine measure can have passed a
                  chamber (S. 1077 passed the Senate), and the pending intro says none have.
                  Everyday Indignities Section — bills that are neither attacks nor
                  advocacy wins: Congress performing a routine, recurring structural
                  obligation over D.C. that a state legislature would never need to ask
                  permission for. Still a real structural incursion (attackType is
                  mandatory on every entry) — see METHODOLOGY.md. */}
              {routineGroups.length > 0 && (
                <div className="priority-section">
                  <div className="section-header routine-header">
                    <h2><Icon name="paperclip" size={18} /> Everyday indignities ({countUnits(routineGroups.flatMap(g => g.bills)).total})</h2>
                    <p className="section-description">
                      The routine paperwork of not being a state — sign-offs Congress requires from D.C. that no state legislature would ever need to ask for.
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

            </>
          )}

        </div>

        {/* <ContactSection /> */}
        {/* Contact section hidden until Google Form is set up - see FEEDBACK-SETUP.md */}
      </div>

      <Footer />
    </div>
  )
}

export default App

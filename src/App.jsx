import { useState, useMemo } from 'react'
import './App.css'
import billsData from './data/bills.json'
import CategoryFilter from './components/CategoryFilter'
import CategoryGroup from './components/CategoryGroup'
import SearchBar from './components/SearchBar'
import DownloadButton from './components/DownloadButton'

function App() {
  const [selectedCategories, setSelectedCategories] = useState([])
  const [searchTerm, setSearchTerm] = useState('')

  const { filteredBills, groupedByCategory } = useMemo(() => {
    let filtered = billsData.bills

    // Filter by selected categories
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(bill =>
        selectedCategories.includes(bill.category)
      )
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(bill =>
        bill.title.toLowerCase().includes(term) ||
        bill.description.toLowerCase().includes(term) ||
        bill.sponsors.some(sponsor => sponsor.toLowerCase().includes(term)) ||
        bill.billNumbers.some(num => num.toLowerCase().includes(term))
      )
    }

    // Group bills by category
    const grouped = billsData.categories.map(category => ({
      category,
      bills: filtered.filter(bill => bill.category === category.id)
    })).filter(group => group.bills.length > 0)

    return { filteredBills: filtered, groupedByCategory: grouped }
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
      <header className="header">
        <h1>Anti-DC Bills Tracker</h1>
        <p className="subtitle">
          Bills pending in Congress that threaten D.C. home rule and autonomy
        </p>
        <p className="last-updated">
          Last updated: {billsData.lastUpdated}
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
            {filteredBills.length} {filteredBills.length === 1 ? 'Bill' : 'Bills'} Found
          </h2>
          <div className="results-actions">
            {(selectedCategories.length > 0 || searchTerm) && (
              <button className="clear-filters" onClick={clearFilters}>
                Clear All Filters
              </button>
            )}
            <DownloadButton filteredBills={filteredBills} />
          </div>
        </div>

        <div className="bills-list">
          {filteredBills.length === 0 ? (
            <div className="no-results">
              <p>No bills found matching your criteria.</p>
            </div>
          ) : (
            groupedByCategory.map(group => (
              <CategoryGroup
                key={group.category.id}
                category={group.category}
                bills={group.bills}
              />
            ))
          )}
        </div>
      </div>

      <footer className="footer">
        <p>
          D.C. statehood is a civil rights issue. These bills undermine the democratic rights of D.C. residents.
        </p>
      </footer>
    </div>
  )
}

export default App

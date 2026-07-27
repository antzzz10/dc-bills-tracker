import './SearchBar.css'
import Icon from './Icon'

function SearchBar({ searchTerm, setSearchTerm }) {
  return (
    <div className="search-bar">
      <input
        type="text"
        placeholder="Search bills by title, sponsor, bill number, or keyword..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-input"
      />
      {searchTerm && (
        <button
          className="clear-search"
          onClick={() => setSearchTerm('')}
          aria-label="Clear search"
        >
          <Icon name="x" size={17} />
        </button>
      )}
    </div>
  )
}

export default SearchBar

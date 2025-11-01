import './SearchBar.css'

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
          ✕
        </button>
      )}
    </div>
  )
}

export default SearchBar

import './CategoryFilter.css'

function CategoryFilter({ categories, selectedCategories, toggleCategory }) {
  return (
    <div className="category-filter">
      <h3>Filter by Category</h3>
      <div className="category-tags">
        {categories.map(category => {
          const isSelected = selectedCategories.includes(category.id)
          const billCount = document.querySelectorAll(`[data-category="${category.id}"]`).length

          return (
            <button
              key={category.id}
              className={`category-tag ${isSelected ? 'selected' : ''}`}
              onClick={() => toggleCategory(category.id)}
              aria-pressed={isSelected}
            >
              <span className="category-name">{category.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default CategoryFilter

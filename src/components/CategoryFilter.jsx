import './CategoryFilter.css'
import { track, EVENTS } from '../lib/analytics'

function CategoryFilter({ categories, selectedCategories, toggleCategory }) {
  return (
    <div className="category-filter">
      <h3>Filter by category</h3>
      <div className="category-tags">
        {categories.map(category => {
          const isSelected = selectedCategories.includes(category.id)
          const billCount = document.querySelectorAll(`[data-category="${category.id}"]`).length

          return (
            <button
              key={category.id}
              className={`category-tag ${isSelected ? 'selected' : ''}`}
              onClick={() => {
                // Report the direction, so "which categories do people reach for"
                // isn't muddied by the deselect click that always follows.
                track(EVENTS.CATEGORY_FILTERED, {
                  category: category.id,
                  action: isSelected ? 'deselect' : 'select',
                })
                toggleCategory(category.id)
              }}
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

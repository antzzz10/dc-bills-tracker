import { useState, useEffect } from 'react'
import Icon from './Icon'

// Pinned to Eastern Time for the DC audience. Both values passed in here are true
// instants — news.json's `lastUpdated` is ISO-8601 with Z, and article `pubDate` is
// RFC-2822 with an offset — so converting them to a timezone is well-defined.
const ET_TIME_ZONE = 'America/New_York'

function formatRelativeDate(pubDate) {
  const date = new Date(pubDate)
  if (isNaN(date)) return ''
  const days = Math.floor((Date.now() - date) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString('en-US', {
    timeZone: ET_TIME_ZONE,
    month: 'short',
    day: 'numeric',
  })
}

export default function NewsFeed() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/news.json`)
      .then(r => {
        if (!r.ok) throw new Error('not found')
        return r.json()
      })
      .then(setData)
      .catch(() => setError(true))
  }, [])

  // Don't render if no data or error (graceful degradation)
  if (error || !data || !data.articles?.length) return null

  return (
    <div className="news-feed-section">
      <div className="news-feed-header">
        <h3><Icon name="newspaper" size={17} /> In the news</h3>
        <span className="news-feed-meta">
          Updated {formatRelativeDate(data.lastUpdated)}
        </span>
      </div>
      <ul className="news-feed-list">
        {data.articles.map((article, i) => (
          <li key={i} className="news-feed-item">
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="news-feed-title"
            >
              {article.title}
            </a>
            <span className="news-feed-byline">
              {article.source && <span className="news-feed-source">{article.source}</span>}
              {article.source && article.pubDate && <span className="news-feed-dot"> · </span>}
              {article.pubDate && <span className="news-feed-date">{formatRelativeDate(article.pubDate)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

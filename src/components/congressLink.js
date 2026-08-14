import { CURRENT_CONGRESS } from '../data/config'

// Single derivation of a Congress.gov bill URL from a display bill number
// ("H.R. 1089", "S. 440"). BillCard, PassedBillsSection, and RecentActivity all
// need this; keeping one copy is what stops the three from drifting.
const TYPE_SLUGS = [
  ['h.j.res', 'house-joint-resolution'],
  ['s.j.res', 'senate-joint-resolution'],
  ['h.con.res', 'house-concurrent-resolution'],
  ['s.con.res', 'senate-concurrent-resolution'],
  ['h.r.', 'house-bill'],
  ['s.', 'senate-bill'],
]

export function getCongressGovUrl(billNumber, congress = CURRENT_CONGRESS) {
  if (!billNumber) return null
  const match = billNumber.match(/(H\.R\.|S\.|H\.J\.Res\.|S\.J\.Res\.|H\.Con\.Res\.|S\.Con\.Res\.)\s*(\d+)/i)
  if (!match) return null

  const [, type, number] = match
  const lower = type.toLowerCase()
  const slug = TYPE_SLUGS.find(([prefix]) => lower.startsWith(prefix))?.[1]
  if (!slug) return null

  return `https://www.congress.gov/bill/${congress}th-congress/${slug}/${number}`
}

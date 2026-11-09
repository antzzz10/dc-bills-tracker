// Message computation for UpdateBanner, extracted so App.jsx can ask "is the banner
// going to say anything?" without rendering it.
//
// PageSummary occupies the same slot and must yield to a real alert — but "is there an
// alert" is not the same as "is the banner mounted": the banner returns null whenever
// nothing is newsworthy. Keeping this a pure function is what lets both components read
// the same verdict instead of duplicating the rules and drifting apart. Same reason
// urgentAlertState.js exists.

// YYYY-MM-DD as a local date. new Date('2026-03-18') is UTC midnight, which renders as
// the previous day anywhere west of Greenwich.
const parseLocalDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// Official introduction date. Older entries without one fall back to a last action that
// is itself the introduction.
export function introductionDate(bill) {
  if (bill.status?.introducedDate) return bill.status.introducedDate
  if (bill.status?.lastActionDate && /^Introduced/i.test(bill.status?.lastAction || '')) {
    return bill.status.lastActionDate
  }
  return null
}

export function getUpdateBannerMessage({ passedBills = [], upcomingFloorVotes = [], allBills = [] }) {
  // Check for newly introduced bills (within last 7 days), keyed off the official
  // introduction date. Action text can't tell: "Referred to..." also describes a later
  // re-referral, which the old text match announced as a new bill.
  const recentlyIntroduced = allBills.filter(bill => {
    if (bill.status?.stage) return false
    const introduced = introductionDate(bill)
    if (!introduced) return false
    const daysSince = Math.floor((Date.now() - parseLocalDate(introduced)) / (1000 * 60 * 60 * 24))
    return daysSince >= 0 && daysSince <= 7
  }).sort((a, b) => introductionDate(b).localeCompare(introductionDate(a)))

  // Prioritize showing newly introduced bills
  if (recentlyIntroduced.length > 0) {
    const newest = recentlyIntroduced[0]
    const actionDate = parseLocalDate(introductionDate(newest))
    const formattedDate = actionDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })

    // Bill number when it exists (nearly always, provisional or not); the bare
    // fallback covers a bill announced before Congress.gov assigns a number.
    const billNumberText = newest.billNumbers?.length
      ? newest.billNumbers.join('/')
      : 'New bill'

    // Title only — it is Congress.gov's own text. The stored description is
    // pipeline metadata and has no business in reader-facing copy.
    return {
      icon: '🆕',
      date: formattedDate,
      message: `${billNumberText} introduced: ${newest.title}`
    }
  }

  // Check for recently passed bills (within last 30 days)
  const recentlyPassed = passedBills.filter(bill => {
    if (!bill.passage?.house?.date && !bill.passage?.senate?.date) return false

    const dateString = bill.passage.house?.date || bill.passage.senate?.date
    // Parse as local date to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number)
    const passageDate = new Date(year, month - 1, day)
    const daysSince = Math.floor((Date.now() - passageDate) / (1000 * 60 * 60 * 24))
    return daysSince <= 30
  })

  // Check for bills with upcoming floor votes
  // `highlight` is hand-set and nothing in the pipeline ever clears it, so it has no
  // expiry — the same shape of bug as the old HAS_URGENT_ALERT boolean. On 2026-08-03
  // all three flagged bills had long since moved: H.R. 5107 and H.R. 5214 passed the
  // House in November 2025 and H.J.Res.142 was signed into law, while the banner still
  // announced "3 bills scheduled for floor vote". A bill that has already reached a
  // stage cannot be awaiting one, so the stage overrules the flag.
  const floorVoteBills = upcomingFloorVotes.filter(bill =>
    bill.highlight === 'floor-vote' && !bill.status?.stage
  )

  // Prioritize showing passed bills
  if (recentlyPassed.length > 0) {
    const mostRecent = recentlyPassed[0]
    const dateString = mostRecent.passage.senate?.date || mostRecent.passage.house?.date
    // Parse as local date to avoid timezone issues (YYYY-MM-DD format)
    const [year, month, day] = dateString.split('-').map(Number)
    const passageDate = new Date(year, month - 1, day) // month is 0-indexed
    const formattedDate = passageDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })

    // Determine the most recent chamber passage
    const passedBoth = mostRecent.passage.house && mostRecent.passage.senate
    const chamber = passedBoth ? 'Senate' : (mostRecent.passage.house ? 'House' : 'Senate')
    const vote = passedBoth
      ? mostRecent.passage.senate.vote
      : (mostRecent.passage.house?.vote || mostRecent.passage.senate?.vote)

    if (recentlyPassed.length === 1) {
      const isEnacted = mostRecent.status?.stage === 'enacted'
      const nextStep = isEnacted
        ? 'Signed into law. D.C. Council disputes its validity.'
        : passedBoth
          ? 'Awaiting presidential signature.'
          : `Now headed to ${chamber === 'House' ? 'Senate' : 'President'}.`
      return {
        icon: 'siren',
        date: formattedDate,
        message: `${mostRecent.billNumbers[0]} passed the ${chamber} (${vote.yeas}-${vote.nays}). ${nextStep}`
      }
    } else {
      return {
        icon: 'siren',
        date: formattedDate,
        message: `${recentlyPassed.length} bills have passed! Most recent: ${mostRecent.billNumbers[0]} (${chamber}, ${vote.yeas}-${vote.nays}). Click "Bills that have passed" section below for details.`
      }
    }
  }

  // Show upcoming floor votes if no recent passages
  if (floorVoteBills.length > 0) {
    const billNumbers = floorVoteBills.slice(0, 3).map(b => b.billNumbers[0]).join(', ')
    return {
      icon: 'megaphone',
      date: 'Alert',
      message: `${floorVoteBills.length} bill${floorVoteBills.length > 1 ? 's' : ''} scheduled for floor vote: ${billNumbers}`
    }
  }

  // No important updates
  return null
}

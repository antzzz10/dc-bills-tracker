import { useEffect, useRef } from 'react'
import './HowWeTrack.css'

// Reader-facing summary of METHODOLOGY.md (the full, technical version in the repo).
// Anchor #how-we-track is the link to share when someone asks how measures are chosen.
// Keep the two in step: a rule change there needs a wording change here.
function HowWeTrack() {
  const ref = useRef(null)
  // The page renders client-side, so a shared #how-we-track link can load before this
  // section exists; scroll to it once it does (same approach as BillCard's #bill-id links).
  useEffect(() => {
    if (window.location.hash === '#how-we-track') ref.current?.scrollIntoView()
  }, [])

  return (
    <section ref={ref} className="how-we-track" id="how-we-track" aria-labelledby="how-we-track-title">
      <h2 id="how-we-track-title">How we decide what's tracked</h2>
      <p>
        A person reviews every bill, resolution and budget rider against the rules below before
        it's classified or counted. A measure our automated search has just found can appear under
        Recent activity before that review. Once a measure is tracked, an automated check of its
        status on Congress.gov is scheduled every day; the time of the last successful check is shown
        near the top of this page.
      </p>

      <h3>Measures against D.C.</h3>
      <p>
        First we ask whether a measure interferes with D.C.'s self-government, using the{' '}
        <a href="https://www.dcstatehoodscorecard.org/" target="_blank" rel="noopener noreferrer">
          D.C. Statehood Scorecard
        </a>
        's three-part test. It does if it:
      </p>
      <ol>
        <li>interferes with how D.C. is governed under the Home Rule Act;</li>
        <li>interferes with how D.C. governs itself; or</li>
        <li>
          does something Congress couldn't do if D.C. were a state, such as overriding local
          criminal law or blocking a D.C. Council law.
        </li>
      </ol>
      <p>
        A measure that interferes and harms D.C. or its residents is listed here, however small it
        is and however unlikely it is to pass. Each is marked <strong>direct</strong>, when going
        after D.C. is its purpose, or <strong>partial</strong>, when it overrides D.C. as part of
        something broader. A measure that interferes but helps D.C., such as one replacing offensive
        terms in D.C.'s court code, is tracked with the measures that support D.C.
      </p>
      <p>
        Budget riders sit inside spending bills, so the daily check follows the spending bill. A
        person confirms whether a rider made it into the final law.
      </p>

      <h3>Barriers to statehood</h3>
      <p>
        Measures that change nothing about how D.C. is governed today but would make statehood
        harder to win, such as a constitutional amendment requiring two-thirds of both chambers to
        admit a new state. They're counted separately, never in the totals of measures against D.C.
      </p>

      <h3>Everyday indignities</h3>
      <p>
        Measures Congress passes only because D.C. isn't a state, such as approving the budget D.C.
        raises from its own taxes. They aren't new restrictions, but they're a cost D.C. pays every
        year. They're also counted separately.
      </p>

      <h3>Measures that support D.C.</h3>
      <p>
        We also track measures that expand D.C.'s self-government or help its residents, such as
        the Washington, D.C. Admission Act (H.R. 51 and S. 51). They aren't listed on this page;
        the statehood bill's progress is on{' '}
        <a href="https://www.representdc.org/statehood-bill">representdc.org/statehood-bill</a>.
      </p>

      <h3>How measures are found</h3>
      <p>
        From{' '}
        <a href="https://freedcproject.org/congress" target="_blank" rel="noopener noreferrer">
          Free DC
        </a>
        's list of bills it opposes, the D.C. Statehood Scorecard, news coverage and readers' tips,
        and a weekly automated search of Congress.gov for bills that mention D.C. The search only
        finds candidates: it can tell that a bill mentions D.C., not whether the bill harms D.C., so
        a person decides.
      </p>

      <h3>Priority</h3>
      <p>
        Priority mostly shows how much is happening to a measure in Congress: hearings, committee
        votes, floor votes and cosponsors. A measure against D.C. is also high priority when Free DC
        lists it or we flag it, except a partial one, which needs activity in Congress to be high
        priority. Priority doesn't rank how harmful a measure is.
      </p>
    </section>
  )
}

export default HowWeTrack

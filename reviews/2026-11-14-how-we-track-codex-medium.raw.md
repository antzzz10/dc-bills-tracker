**0 BLOCKER, 5 MATERIAL, 1 NOTE. Fix the five accuracy issues before publishing.** No files changed.

1. **MATERIAL — Human review does not precede every addition.**  
   [HowWeTrack.jsx:21](/Users/andriathomas/Projects/dc-bills-tracker/src/components/HowWeTrack.jsx:21) says every measure is reviewed “before it’s added.” Discovery automatically adds unreviewed entries ([discover-bills.js:946](/Users/andriathomas/Projects/dc-bills-tracker/scripts/discover-bills.js:946), [1207](/Users/andriathomas/Projects/dc-bills-tracker/scripts/discover-bills.js:1207)). They are excluded from classified lists and counts but can appear in Recent Activity ([App.jsx:75](/Users/andriathomas/Projects/dc-bills-tracker/src/App.jsx:75), [285](/Users/andriathomas/Projects/dc-bills-tracker/src/App.jsx:285)). This matches METHODOLOGY.md:12. There are currently no provisional entries in the data, but the claim misstates the process.  
   **Smallest fix:** Say human review happens before classification and counting, and disclose that unreviewed candidates may appear in Recent Activity.

2. **MATERIAL — Discovery runs weekly, not daily.**  
   [HowWeTrack.jsx:76](/Users/andriathomas/Projects/dc-bills-tracker/src/components/HowWeTrack.jsx:76) promises “a daily search.” The discovery workflow runs Mondays ([discover-bills.yml:32](/Users/andriathomas/Projects/dc-bills-tracker/.github/workflows/discover-bills.yml:32)). Daily status monitoring is a separate workflow.  
   **Smallest fix:** Replace “daily search” with “weekly scan.”

3. **MATERIAL — Priority is not solely a measure of congressional activity.**  
   [HowWeTrack.jsx:83](/Users/andriathomas/Projects/dc-bills-tracker/src/components/HowWeTrack.jsx:83) omits manual and Free DC overrides. Both can produce High priority without momentum ([monitor-bills.js:650](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:650)); partial attacks are capped without momentum. METHODOLOGY.md:72–77 documents this. H.R. 6578 is an actual example: manually High, two cosponsors, no hearing, markup, or floor vote ([bills.json:68](/Users/andriathomas/Projects/dc-bills-tracker/src/data/bills.json:68)).  
   **Smallest fix:** Add that editorial flags and Free DC listings also affect priority, with the exception for partial attacks.

4. **MATERIAL — Passing the three-part test does not automatically mean placement under “Measures against D.C.”**  
   [HowWeTrack.jsx:31](/Users/andriathomas/Projects/dc-bills-tracker/src/components/HowWeTrack.jsx:31) presents structural interference as the complete inclusion rule for that section. The methodology separates structural interference from the judgment that a measure harms residents (METHODOLOGY.md:16–39). S. 402 satisfies the structural test but is classified as supported ([bills.json:3695](/Users/andriathomas/Projects/dc-bills-tracker/src/data/bills.json:3695)); routine measures also satisfy it.  
   **Smallest fix:** Explain that the test identifies interference, while placement among measures opposed also depends on the measure’s content. Keep those two judgments distinct in ordinary language.

5. **MATERIAL — “Its status is checked … every day” overpromises, especially for riders.**  
   [HowWeTrack.jsx:22](/Users/andriathomas/Projects/dc-bills-tracker/src/components/HowWeTrack.jsx:22) applies this assurance to every bill, resolution, and rider. Monitoring is *scheduled* daily, but failures can leave previous data in place ([monitor-bills.js:1630](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:1630)). For riders, it checks the parent spending bill; it explicitly cannot establish whether the rider survived ([monitor-bills.js:1132](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:1132)).  
   **Smallest fix:** Describe scheduled daily bill-status checks and separately state that rider outcomes require manual verification.

6. **NOTE — Make the full-methodology link reader-facing.**  
   [HowWeTrack.jsx:90](/Users/andriathomas/Projects/dc-bills-tracker/src/components/HowWeTrack.jsx:90) displays the repository filename.  
   **Smallest fix:** Use “Read the full methodology.” The remaining copy avoids internal field names.

The barrier and routine descriptions and separate anti-DC counts match the methodology, data, and `generate-stats.js`. Support bills are correctly described as absent from this page; `/statehood-bill` exists in the main site’s router. The [Free DC](https://freedcproject.org/congress) and [Scorecard](https://www.dcstatehoodscorecard.org/) destinations resolve. Live availability of the methodology and statehood-page URLs could not be verified from this environment.

Static inspection found no defect in the footer anchor, initial hash-scroll effect, or new section’s accessibility structure: heading hierarchy, labelled section, native links, decorative icon handling, and sticky-nav offset are sound. Browser scrolling and keyboard behavior remain unverified.

Focused component lint and the bill/golden-label checks passed. Including `App.jsx` in lint reports the pre-existing `__BUILD_DATE__` error. No build was run because it writes generated files.
# Decision: Scorecard Methodology Alignment (Non-UI Half)

**Date:** 2026-07-12
**Context:** The author of the D.C. Statehood Scorecard (dcstatehoodscorecard.org) compared their entries against our tracker and flagged 11 bills as attacks they thought we were missing. Investigation showed all 11 were already tracked and live (added 2026-02-24, commit `ecd276b`) — but the exchange prompted a methodology comparison and this alignment work.

## Decisions

### 1. Inclusion stays broad (Free DC standard) — no change
Options considered: (a) adopt the Scorecard's three-prong test as an inclusion *filter*, (b) keep categorical inclusion. **Chose (b):** any incursion on DC's local governance is tracked, however minor — "any incursion hurts us." The three-prong test is adopted as the *definition* of what an attack is, not as a gate that narrows the list. Net inclusion change: zero bills added or removed by the policy itself.

### 2. Scorecard logic applies to classification + prioritization, not inclusion
- **Two-axis model formalized:** `position` (our advocacy stance on content) is independent of `attackType` (structural classification under the three-prong test). This resolves the S. 402 divergence cleanly (see below).
- **Partial-attack cap added to `calculatePriority`** (`scripts/monitor-bills.js`): a `partial` attack reaches High priority only via legislative momentum (floor vote, markup, hearing, 20+ cosponsors) — never via manual flag or Free DC listing alone. **Verified no-op on 2026-07-12 data: 0 bills change priority.** The cap is a guard rail against future drift, not a reshuffle.
- Rejected alternative: a severity *floor* (direct attacks start at Medium) — would have promoted 33 low/direct bills and diluted the Medium tier into noise.

### 3. UI tagging deferred
`attackType` badges on bill cards wait until the design-system rollout (in progress in a parallel session) lands, to avoid conflicts in `BillCard.jsx`/`BillCard.css`. Data and logic are ready; UI is a follow-up.

### 4. Eval process established (v1)
Accuracy is the credibility product, so classification is now checkable:
- **`scripts/eval/golden-labels.json`** — 22 pinned classifications: the 13 bills reviewed today plus the Scorecard author's external labels for the bills they flagged (their `*` = our `partial`; their designations matched our pre-existing partial flags 4/4).
- **`scripts/lint-bills.js`** — offline lint + golden eval: duplicate IDs, section/position agreement, attackType discipline, the priority cap, category validity, golden-label drift. Exits 1 on error. **Negative-tested:** two injected violations (golden drift on hr8455, uncapped high partial on hjres31) were both caught.
- Complement to the existing `validate-bills.js` (API-based existence check).

## Provisional bill review (all 13, three-prong test applied)

The auto-discovery scoring detects DC-*relatedness*, not hostility, and defaulted everything to `position: "oppose"` — 9 of the 13 provisional bills were actually pro-DC bills sitting in the attacks list, including the DC Admission Act itself.

| Bill | Title | Ruling | Verification |
|---|---|---|---|
| H.R. 51 | Washington, D.C. Admission Act | **support** — the statehood bill | CRS summary |
| H.R. 7881 | DC Superior Court juror pay parity (Norton) | **support** — court fix only Congress can make | title+sponsor |
| H.R. 1537 | Senior jury duty opt-out (Norton) | **support** — same | title+sponsor |
| H.R. 5698 | DC Clemency Home Rule Act (Norton) | **support** — grants DC a power every state has | CRS summary |
| H.R. 5092 | DC Police Home Rule Act (Norton) | **support** — DC control of MPD | **title+sponsor only** (Congress.gov blocked fetch) |
| H.R. 2693 | Electronic Transmittal of Legislation (Norton) | **support** — modernizes congressional review | CRS summary |
| H.R. 9362 | Automatic DC judge appointments (Norton) | **support** — reduces federal control of DC courts | full title |
| H.R. 6950 | DC Transportation Funding Equality (Norton) | **support** — DOT grant parity | CRS summary |
| S. 4837 | Companion to H.R. 9362 (Van Hollen) | **support** | full title |
| S. 4150 | 60-day review of all DC laws + veto of DC executive orders (Rick Scott) | **oppose, direct** — prongs 1–3 | full title |
| H.R. 5103 | Make DC Safe and Beautiful Act | **oppose, direct** — federal commission over local functions | CRS summary |
| H.R. 8297 | Overrides DC firearm laws (Crenshaw) | **oppose, direct** — prong 3 | full title |
| H.R. 8455 | Make DC Square Again Act (McCormick) | **oppose, partial** — redraws DC's boundaries without consent (prong 3), but primarily a Virginia redistricting play | press coverage + press release |

All 13: `provisional: false`, `reviewedDate: 2026-07-12`, `reviewMethod: manual-three-prong`, real descriptions written. Counts moved from 82/18/2 (bills/riders/support) to **73/18/11**.

**Review flag:** H.R. 5092's classification rests on title + sponsor only. Confidence is high (Norton "Home Rule Act" naming pattern matches her other bills), but it should be confirmed against the CRS summary when the Congress.gov API key is available.

## Documented divergence from the Scorecard: S. 402

The Scorecard author lists S. 402 (Words Matter for the DC Courts Act) as a full attack — structurally correct under prong 3 (a state would update its own code). We keep `position: support` because the content is benign and Norton sponsors the House companion, while retaining `attackType: direct` to record the structural incursion. Pinned in golden labels with this note so it never silently flips.

## Follow-ups (not done here)
1. **UI badges** for direct/partial once the design system lands.
2. **Methodology blurb on the site** (public-facing summary of METHODOLOGY.md).
3. **CI wiring:** add `node scripts/lint-bills.js` to the monitor/discover workflows so bad data fails the run. Not done blind — workflows were recently fragile; test locally first.
4. **H.R. 2522 anomaly:** has `hasCommitteeMarkup: true` but sits at Medium; per `calculatePriority` markup → High. Investigate why the monitor didn't escalate.
5. **Verify H.R. 5092** against CRS summary (see review flag above).
6. **Reply to the Scorecard author** — their flagged bills are all live on the site; also worth requesting their full decision tree (the embedded sheet is access-restricted).

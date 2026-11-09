# Decision: published numbers count measures, not entries

**Date:** 2026-11-09 · **Approved by:** Andria ("Yes, fix counts now"; resolution and routine rules from her guardrail answers the same day) · **Found by:** Codex high review of the support-page plan

## What was wrong

- **The tracker said "14 have already cleared at least one chamber — 4 are now law".** The main site said "14 already passed a chamber". The true figures are **12 and 2**. Every count was a count of `bills.json` entries:
  - H.R. 1968, the 2025 full-year funding law, is three entries, one per anti-DC provision;
  - H.R. 5242 is also three entries.
- **S. 1077 (D.C.'s own FY2025 local budget) passed the Senate by voice vote on 2025-03-14,** but its stage was null. Routine bills aren't in the daily check, so nothing ever corrected it.
- **The main site showed the total as "pending" and "moving through Congress",** called mixed totals "bills", and showed hardcoded January counts (74, 61, 13) while loading or after a failed fetch.

## What changed

- **One counting module, `src/lib/measureCounts.js`, defines the units:**
  - one per official measure: entries sharing any bill number, companions included, are one measure;
  - one per budget-rider provision.

  Every published number uses it: the summary, results header, section and category headers, passed sections, banner, PDF and download counts, and `stats.json`.
- **Counted separately:**
  - **Resolutions** are counted apart from bills, per Andria's 2026-11-09 rule.
  - **Routine measures** are counted apart from anti-DC totals, since they're structural consequences of denied statehood. `stats.json` now has a `routine` block.
- **`stats.json`:**
  - `totalBills`, `pendingBills` and `passedBills` are anti-DC measures (92 / 80 / 12);
  - `breakdown` and `passedBreakdown` are in the same units, and they add up;
  - `passed` lists one row per measure, with a `provisions` count.
- **S. 1077:** `passed-senate`, with its Congress.gov actions page as the source. It's no longer in any anti-DC count.
- **Banner:**
  - counts measures;
  - picks the genuinely latest passage;
  - says "headed to the House" after a Senate passage (it used to say "President");
  - no longer prints a tally for a voice vote;
  - dropped "D.C. Council disputes its validity" from every enactment.
- **Main site (`representdc-main`):**
  - names bills, resolutions and riders;
  - uses the pending figure where it says "pending";
  - shows "—" rather than a stale number until real stats arrive.
- **Gates:**
  - `check-published-claims.js` recounts with its own independent code (union-find over bill numbers) and checks the summary, enacted count, the bill/resolution split, the banner's "N have passed", and that `stats.json`'s breakdown, passed rows and routine block agree;
  - `lint-bills.js` fails if entries of the same measure disagree on stage.

## Not covered by a gate

Section headers, category headers, the PDF and the main-site sentences use the same module, but nothing checks them directly (Codex recheck: PARTIAL). Rendering-level checks belong with step 0 of `docs/2026-11-09-support-page-and-congress-switch-plan.md`.

## Reviews

- Codex medium and high: 0 BLOCKER; 4 MATERIAL each, all fixed.
- Codex high recheck: no new issues; gate coverage partial, as above.
- Raw output: `reviews/2026-11-09-measure-counts-fix-codex-*.raw.md`.

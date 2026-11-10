# Decision: each measure type gets its own status path; finished riders and amendments are archived, not counted

**Date:** 2026-11-09 · **Approved by:** Andria. On `docs/2026-11-09-step-1a-findings.md` she answered #1 yes and #2 A, "as long as the archive of bills / riders introduced still captures them so we have the historical record of everything for and against DC". · **Plan:** step 1a of `docs/2026-11-09-support-page-and-congress-switch-plan.md`

## What was wrong

- **The tracker counted 20 rider and amendment entries as pending.**
  - **Two riders were already law.** The FY2026 funding law, P.L. 119-75 (H.R. 7148, signed 2026-02-03), carries the abortion and marijuana riders in Division E, Secs. 810 and 809.
  - **Fifteen House riders from H.R. 5166 are not in that law.** H.R. 5166 is still on the House calendar.
  - **Three Senate amendments were submitted and never voted on:**
    - S.Amdt. 4253 (cameras, to H.R. 7148);
    - S.Amdt. 2195 (noncitizen voting, to H.Con.Res. 14);
    - S.Amdt. 919 (legislative authority, to S.Con.Res. 7).
- **The site had no way to show any of this.** Only the main bill list could ever move out of "pending". Riders and amendments have no status of their own in the monitor, and six separate places each decided "pending or passed".
- **Resolutions and constitutional amendments followed the bill path:**
  - a concurrent or simple resolution could never show as agreed to;
  - a constitutional amendment passed by both chambers would have read "headed to the President".
- **The parser read "H.Res. 12" as "S. 12".** That is a different bill, a Senate one. No simple resolution was tracked yet.

## What changed

- **`src/lib/measureStatus.js`** is the one module that answers "pending, advanced, law or archived". It defines a path for each measure type:
  - **bills and ordinary joint resolutions:** passed a chamber, then law;
  - **constitutional amendments:** sent to the states (`constitutionalAmendment: true` on the entry);
  - **concurrent resolutions:** agreed to by both chambers;
  - **simple resolutions:** agreed to by their own chamber.

  Every surface and both gates use it: the page, page summary, banner, Recent Activity, export, `stats.json`, weekly digest and lint. The claims gate keeps its own independent filter.
- **`outcome` records on the 20 entries.** Each one has a result, date, summary, official source and verification date:
  - **2 `became-law`:** these stay active, with stage `enacted`;
  - **15 `not-included` and 3 `not-voted-on`:** these are archived.

  Furthest progress (`status.stage`) and the final outcome are kept as separate facts.
- **"Archived this Congress"** is a searchable section on the tracker page, with the official record linked from each card.
- **Archived entries are never deleted or moved** (Andria's condition):
  - they stay in `bills.json`;
  - the archive repo (`representdc-data`) now exports each entry's `outcome` and full bill numbers, amendments included, in its labels;
  - it keeps every parent bill's official history permanently.
- **`stats.json`:**
  - `totalBills` is the active count (74);
  - the new `introducedThisCongress` (92) feeds the main site's "introduced in this Congress" sentence, since archiving a measure doesn't un-introduce it;
  - enacted riders are listed under H.R. 7148, with `proposedIn: "H.R. 5166"`;
  - there is a new `archived` block.
- **Monitor:**
  - an anchored parser;
  - "agreed to" stages for resolutions;
  - `sent-to-states` for constitutional amendments;
  - a final stage only once both chambers agree to identical text;
  - voice votes detected through Congress.gov's standardized "Passed/agreed to in" marker;
  - provisions and outcome entries never take their parent bill's status.
- **Gates:**
  - `lint-bills.js` check 13: a provision shows a stage only with a verified became-law outcome;
  - check 14: a constitutional amendment is never enacted;
  - `check-published-claims.js` requires an official source on every outcome and names riders in "now law".

## Public numbers

| | Before | After |
|---|---|---|
| Tracked (active anti-DC measures) | 92 | 74 |
| Introduced this Congress (main site) | 92 | 92 |
| Pending | 80 | 60 |
| Cleared a chamber or became law | 12 | 14 |
| Law | 2 | 4 (1 bill, 1 resolution, 2 budget riders) |
| Archived | — | 18 |

## Known limitation

The monitor never moves a stage backwards. A stored final stage (`passed-both`, `agreed-both` or `sent-to-states`) that later proves premature would need a hand correction. No entry holds one of those stages today.

## Reviews

- **Codex high fact-check of the findings:** 2 MATERIAL, both accepted. That produced the v0.2 split into #1 and #2.
- **Build reviews:** medium (7 MATERIAL) and high (10 MATERIAL), heavily overlapping. All fixed.
- **Rechecks:** three high rechecks, the last with 0 BLOCKER and 0 MATERIAL.
- **Raw output:** `reviews/2026-11-09-step-1a-*.raw.md`.

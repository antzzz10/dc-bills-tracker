# Decision: a separate "Barriers to statehood" category

**Date:** 2026-11-12 · **Approved by:** Andria ("let's go with a separate bars to statehood category"; "Yes, build it") · **Prompted by:** comparing our list with the League of Women Voters of DC tracker

## The question

LWV DC lists H.J.Res. 141 (Rep. Barrett) among its attacks on home rule. It is a constitutional amendment requiring two-thirds of both chambers to admit any new state. We didn't track it. Should we, and where?

- It doesn't mention DC and changes nothing about how DC is governed, so it fails all three prongs of the attack test.
- It would raise the bar for DC statehood above what an ordinary law requires today.

## Decision

Track it in a new section, **Barriers to statehood**, with its own `position` (`statehood-barrier`) and its own count.

- **No `attackType`.** The direct/partial tag describes home-rule incursions.
- **Counted apart.** The anti-DC figures (92 introduced, 74 tracked, 60 pending on the day of the decision) don't change. `stats.json` gains a `statehoodBarriers` block: `{ total, advanced }`.
- **Shown** on the tracker page after the pending sections and before "Everyday indignities".
- **Monitored daily**, like every other section.

## Alternatives rejected

- **List it as a partial attack.** No new code, and it would match LWV's list today. Rejected by Andria: a list of partial attacks waters down the attack list, and "partial" sounds lesser when a two-thirds bar is a large impediment to statehood. It would also have meant stretching the three-prong test, or adding a fourth prong.
- **Leave it out.** Keeps the test clean but hides a measure advocates need to know about.

## Consequences

- LWV counts this resolution inside its 74. Unless LWV adopts the same label, this stays a known difference between the two lists. The outreach note to LWV proposes the label.
- The section starts with one measure.
- `representdc-main` doesn't read the new `stats.json` block, so the main site doesn't change.

## What changed

- `src/data/bills.json`: new top-level `statehoodBarriers` array with `hjres141`.
- `src/App.jsx`, `src/App.css`: the section, its count in the results header, search and category filtering.
- `scripts/generate-stats.js`, `scripts/check-published-claims.js`: the new block, recounted independently.
- `scripts/lint-bills.js`: section/position agreement; a barrier must not carry `attackType`.
- `scripts/monitor-bills.js`, `scripts/validate-bills.js`, `scripts/review-provisional.js`, `.github/workflows/monitor-bills.yml`: the section is scanned, validated and reviewable.
- `scripts/eval/golden-labels.json`: a label for `hjres141`.
- `METHODOLOGY.md`: the fourth position.

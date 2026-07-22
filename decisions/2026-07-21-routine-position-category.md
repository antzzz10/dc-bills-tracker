# Decision: A Third `position` Value — `routine`

**Date:** 2026-07-21
**Context:** While reviewing the provisional backlog uncovered by fixing `discover-bills.js`'s scan-depth bug (see the H.R. 9720 investigation earlier this session), S. 1077 (District of Columbia Local Funds Act, 2025) surfaced a bill that didn't fit either existing `position` value. It's not an attack — nobody introduced it to harm DC. It's not really a support win either — passing it isn't advocacy progress, it's Congress performing an obligation that already exists *because* DC isn't a state. A state legislature would never need to ask Congress to approve its own already-raised local budget.

## Decision

Added a third `position` value: `oppose` | `support` | `routine`.

### Why a third position value, not a tag on top of oppose/support
Considered layering a boolean flag (e.g. `routineHomeRuleArtifact: true`) on top of the existing binary instead of extending `position`. Rejected: the whole point is a dedicated, equally-prominent site section making the "everyday cost" argument visible — burying it as a filter on the oppose list undersells it. The structural cost (touching `lint-bills.js`, `App.jsx`, `discover-bills.js`, `review-provisional.js`) is comparable to when `supportBills` was introduced, not a new architecture.

### Qualification test
A bill is `routine` (not `oppose`) when Congress is performing an **existing, expected, recurring** structural obligation — not adding a **new** restriction. It must still satisfy the three-prong test the same as any attack.

### `attackType` is mandatory on `routine` bills, same as `oppose`
This was the key naming concern raised in conversation: calling something "routine" risks implying it's harmless, when the actual stakes (e.g. Congress could simply decline to approve DC's budget) can be real. Resolution: the severity/stakes signal lives entirely in `attackType` (`direct`/`partial`), never in the `routine` label. `routine` bills never carry `attackType: null` the way benign `support` bills do — `lint-bills.js` enforces this identically to `oppose`.

### Priority
Momentum-based priority (`calculatePriority` in `monitor-bills.js`) applies to `routine` bills exactly as it does to `oppose` bills — a routine bill stalling past its usual cadence is itself worth flagging, not exempted from the ranking system.

### Site placement
Own top-level section, "Everyday Indignities," given equal billing alongside High Priority and Budget Riders — not a collapsed/secondary section. Placed directly after High Priority Bills in `App.jsx`.

### Discovery
`discover-bills.js` does not auto-classify `routine` — position still requires human review via `review-provisional.js`, same as everything else. Added a non-authoritative heuristic (`ROUTINE_HINT_PATTERNS`: local funds act / interim appropriations / continuing appropriations / budget act) that tags candidates with `provisionalHint: "possible-routine"`, surfaced as a column in `PROVISIONAL-REVIEW.md` — a "look closer" suggestion for the reviewer, not a classification.

## What was NOT done

- **No retroactive audit** of the ~100 already-tracked `oppose` bills/riders for other `routine` candidates (e.g. the appropriations rider family, H.R. 5166). Deliberately deferred — seeded the category with S. 1077 only. Revisit if it turns out to matter.
- **No PDF/CSV export wiring** for `routineBills` in `DownloadButton.jsx` — exports currently only cover `bills`/`riders`. Known gap, not in scope for this pass.

## Implementation

- `METHODOLOGY.md` — documents the third position value and the mandatory-attackType rule
- `src/data/bills.json` — new top-level `routineBills` array; S. 1077 moved there (`position: routine`, `attackType: direct`, `priority: high` via existing floor-vote momentum)
- `scripts/lint-bills.js` — extended section/position agreement and attackType-discipline checks to include `routineBills`
- `scripts/review-provisional.js` — `--confirm --position routine` routes to `routineBills`, requires `--attackType`
- `scripts/discover-bills.js` — `ROUTINE_HINT_PATTERNS` heuristic, non-authoritative
- `src/App.jsx` / `src/App.css` — new "Everyday Indignities" section, `.routine-header` styling (muted indigo, distinct from the oppose red / rider orange / support tones)

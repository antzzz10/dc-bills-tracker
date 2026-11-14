**0 BLOCKER / 0 MATERIAL.** The prior concrete failure cases are fixed. I found no new regression in the supplied votes, nomination handling, or House path. Jan 1–3 support still has limits.

| Prior finding | Recheck result |
|---|---|
| Missing/unrecognised identity silently skips | **Fixed.** Missing document/type/number, malformed numbers, and unknown types fail without `skip`. Mocked monitor execution sets `voteFetchFailed`. [Identity checks](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/senate-votes.js:81) |
| Impossible/out-of-session dates accepted | **Original reproducers fixed.** February 31, non-leap February 29, wrong-session March dates, and prior-year dates fail. Valid leap days and next-year Jan 1–3 pass. Boundary qualifications below. [Date checks](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/senate-votes.js:41) |
| `document_congress` ignored | **Fixed when present.** Wrong, malformed, or empty values fail. An entirely absent tag remains permitted. [Congress check](/Users/andriathomas/Projects/dc-bills-tracker/scripts/lib/senate-votes.js:93) |

- **NOTE — Jan 1–3 is not fully supported end to end.** The parser accepts next-year Jan 1–3 for the requested session, but the [caller](/Users/andriathomas/Projects/dc-bills-tracker/scripts/monitor-bills.js:125) derives the session solely from the calendar year. A synthetic session-1 vote dated January 2, 2026 requests session 2 and fails; a session-2 vote dated January 2, 2027 is skipped without fetching. This routing exists in `HEAD`; the fixes did not introduce it. Such carryover votes are legitimate—for example, [H.R. 8 passed on January 1, 2013 in the 112th Congress’s second session](https://www.senate.gov/legislative/LIS/roll_call_votes/vote1122/vote_112_2_00251.htm). Separately, the new date check remains approximate: it accepts January 1–2, 2025 for Congress 119 and ignores the Jan 3 noon cutoff. The [Senate’s session dates](https://www.senate.gov/legislative/DatesofSessionsofCongress.htm) establish those boundaries.

- **NOTE — The prior question/result limitation remains unchanged.** The parser does not independently distinguish passage from a same-bill procedural vote. It continues to rely on upstream passage-action selection. I found no supplied record misattributed through that path.

- **NOTE — Runner access remains accepted as unverified.** Mocked HTTP 403, error-page, request-error, and body-timeout cases all reach failure accounting. No live-runner verification was attempted.

Nomination handling passes: `PN` skips before bill-number/Congress validation, including a hyphenated nomination number with no `document_congress`.

Validation passed: Senate suite, **39 independent in-memory checks**, statehood suite, bill lint/golden labels, published claims, syntax, and diff whitespace checks. House success/rejection/error results matched `HEAD`. The new [workflow test step](/Users/andriathomas/Projects/dc-bills-tracker/.github/workflows/monitor-bills.yml:73) gates downstream publication.

**No files edited; the live monitor was not run.**
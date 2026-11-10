# Methodology: How This Tracker Classifies and Prioritizes Bills

*Adopted 2026-07-12. See `decisions/2026-07-12-scorecard-methodology-alignment.md` for the reasoning and per-bill review record behind this policy.*

## What gets included

**Inclusion is broad and categorical:** any congressional bill, resolution, or budget rider that interferes with DC's local governance in any way is tracked, regardless of how small the incursion or whether DC is the primary target. This mirrors [Free DC's](https://freedcproject.org/congress) position that the bills attacking DC's power are a unified attack deserving unified opposition — we do not exclude a bill because it seems minor or unlikely to pass.

Bills enter the tracker two ways:

1. **Manual curation** — from Free DC's opposition list, the [D.C. Statehood Scorecard](https://www.dcstatehoodscorecard.org/), news monitoring, and community submissions.
2. **Automated discovery** — `scripts/discover-bills.js` scans the Congress.gov API for DC-related bills and scores their relevance (title/subject/committee signals, with penalties for incidental DC mentions like memorials or federal-lands bills). Auto-discovered bills land as `provisional: true` and **must pass human review before being treated as classified** — the automation detects DC-relatedness, not hostility.

## How bills are classified: two independent axes

Every tracked item carries two separate judgments. Keeping them separate is deliberate — a bill can be a structural incursion on self-governance while its content is benign, and conflating the two axes produces classification errors.

### Axis 1 — `position`: our advocacy stance on the bill's content

- `oppose` — the bill harms DC or its residents (listed under attacks)
- `support` — the bill expands DC's self-governance or helps DC residents (listed under bills to support)
- `routine` — the bill is Congress performing an *existing, expected, recurring* structural obligation over DC (not a new restriction), listed under "Everyday Indignities." See below.

### Axis 2 — `attackType`: is this a structural incursion, and how targeted?

We adopt the D.C. Statehood Scorecard's three-prong test. A bill is an **attack** if it does any of the following:

1. Interferes with how the District of Columbia **is governed** under Home Rule;
2. Interferes with how the District of Columbia **governs itself** under Home Rule;
3. Does something Congress **would lack the constitutional authority to do if DC were a state** (the counterfactual test — e.g., overriding local criminal law, vetoing local legislation, or redrawing DC's boundaries without consent).

Attacks are tagged by targeting:

- `direct` — going after DC is the bill's purpose.
- `partial` — the bill attacks DC's self-governance, but DC is not the primary target (e.g., a nationwide bill that overrides DC law along the way, or a boundary bill motivated by another state's politics). Equivalent to the Scorecard's `*` designation.

Bills we support (e.g., the Washington, D.C. Admission Act, or Del. Norton's home-rule expansion bills) are not incursions and carry no `attackType`.

**A documented edge case:** S. 402 (Words Matter for the DC Courts Act) updates offensive terminology in DC's court code. Structurally it satisfies prong 3 — a state would fix its own code, so the Scorecard counts it as an attack. But its content is benign and DC's delegate sponsors the House companion, so our `position` is `support` while `attackType` remains `direct`. The two-axis model is what lets both facts be recorded.

### A third `position`: `routine` — the everyday cost of not being a state

Some bills are neither an attack nor an advocacy win: they're Congress performing a structural obligation that already exists *because* DC isn't a state — a state legislature would never need to ask permission for the equivalent action. The clearest example is **S. 1077** (District of Columbia Local Funds Act, 2025): it appropriates DC's own, already-locally-raised local budget. Nobody introduced it to harm DC, and passing it isn't a win for advocates — it's Congress doing the thing DC has to let it do every year regardless.

`routine` is for exactly this case, and it's still a real structural incursion:

- It must satisfy the three-prong test the same as any `oppose`/`attackType`-bearing bill — the difference from `oppose` is that Congress is performing an **existing, expected, recurring** obligation, not adding a **new** restriction.
- `attackType` (`direct` or `partial`) is **mandatory** on every non-provisional `routine` bill, same as `oppose` — never omitted the way benign `support` bills omit it. The severity/stakes signal lives in `attackType`, not in the `routine` label itself, so `routine` never reads as "harmless."
- Priority is computed identically to `oppose`/`support` bills (momentum-based) — a routine bill that stalls past its usual cadence is itself worth flagging.
- Displayed in its own top-level site section, "Everyday Indignities" — given equal billing to attacks and support bills, since the accumulation of these is itself part of the case for statehood.

See `decisions/2026-07-21-routine-position-category.md` for the full design discussion.

## How priority is assigned

Priority measures **legislative momentum** — how urgently advocates need to pay attention — not severity of harm. Severity is carried by `attackType` and the bill's category, not by rank. Assigned by `calculatePriority` in `scripts/monitor-bills.js`, recomputed daily from Congress.gov data:

| Priority | Trigger (any of) |
|---|---|
| **High** | Manual flag · Free DC listing · floor vote · committee markup · committee hearing · 20+ cosponsors |
| **Medium** | 5–19 cosponsors · in committee |
| **Watching** | Recently introduced, no activity |
| **Low** | No significant activity |

**The partial-attack cap:** a `partial` attack can reach High only through real legislative momentum (floor vote, markup, hearing, or 20+ cosponsors) — never on a manual flag or Free DC listing alone. This encodes the Scorecard's severity distinction into prioritization without letting it shrink what we track.

## Quality control

Accuracy is the product. Three mechanisms guard it:

- **`scripts/validate-bills.js`** — confirms every tracked bill exists on Congress.gov for the stated Congress (requires `CONGRESS_API_KEY`).
- **`scripts/lint-bills.js`** — offline consistency checks: no duplicate IDs, every non-provisional `oppose`/`routine` bill has a valid `attackType`, positions match their section, no High partial attack without momentum, categories are valid.
- **Golden-label eval (`scripts/eval/golden-labels.json`)** — a reviewed set of expected classifications, including external labels from the D.C. Statehood Scorecard's author. `lint-bills.js` fails if `bills.json` drifts from a golden label. When a classification legitimately changes, update the golden file in the same commit and say why.

Run before deploying data changes:

```bash
node scripts/lint-bills.js
```

## The statehood bill's cosponsors (data for representdc.org/statehood-bill)

The tracker publishes three files for the statehood-bill page on the main site (PRD `docs/2026-11-10-cosponsor-page-and-120th-overview-prd.md`, decision #7). Every number in them is counted from the rows; none is typed.

| Published file | Built from | Refreshed | Source |
|---|---|---|---|
| `api/statehood-cosponsors.json` | `src/data/statehood-cosponsors.json` (tracked), derived at every build by `scripts/generate-stats.js` | Daily, by the monitor | Congress.gov API, bill cosponsors endpoint |
| `api/members-<congress>.json` | `scripts/build-member-roster.js` (tracked file) | Weekly, `refresh-member-roster.yml` | Congress.gov API, member endpoints (`currentMember=true`) |
| `api/statehood-bill-history.json` | `src/data/statehood-bill-history.json` (tracked), copied at build | One-time export (`scripts/export-statehood-history.js`) | GovInfo BILLSTATUS, via `representdc-data` |

- **Which bills.** Entries in `supportBills` marked `flagship: true` (today H.R. 51 and S. 51 of the 119th). The scripts find them by that flag, never by bill number, because the numbers change every Congress.
- **Cosponsor lists.** For flagship entries only, the daily check fetches the whole list (`limit=250`, following `pagination.next`), retrying rate limits and server errors with backoff. Withdrawn cosponsors are dropped. A list is accepted as complete only if the rows kept equal Congress.gov's `pagination.count` (which already excludes withdrawals), kept plus withdrawn equal `countIncludingWithdrawnCosponsors`, and no member appears twice. Otherwise the previous complete list and its `checkedAt` stay, and that bill's lookup counts as failed in the run's health. `checkedAt` therefore always means "a complete list was fetched at this time". All other bills still read the count only.
- **Non-voting members.** The House list can include the delegates and the resident commissioner (D.C., Puerto Rico, Guam, the Virgin Islands, American Samoa, the Northern Mariana Islands). The totals say how many are included; the page states recorded counts, never a fraction of the chamber.
- **Member roster.** Who currently serves, with party, state, district, chamber, whether the member votes on the floor and the official website Congress.gov records. Written only if every member record arrived and the chamber counts are plausible (House 430–441 including non-voting members, Senate 98–100); otherwise last week's roster stays.
- **Earlier Congresses.** End-of-Congress cosponsor counts (withdrawals excluded) and passage dates for the 115th–119th, from the `dc-statehood-admission` family in `representdc-data`. The 119th row is a snapshot (`final: false`); the live count is in `statehood-cosponsors.json`.
- **Gates.** `lint-bills.js` checks 15–18 and section 4 of `check-published-claims.js` recompute every published total from the rows, refuse a `checkedAt` on an incomplete list, check the roster's counts and bounds, keep `stats.json`'s existing fields, and pin the history to the values verified on 2026-11-10.

## How we differ from our sources

| | This tracker | D.C. Statehood Scorecard | Free DC |
|---|---|---|---|
| Unit tracked | Bills | Members of Congress (graded A+–F−) | Campaigns |
| Inclusion | Broad: any interference | Three-prong attack test | Broad: any interference |
| Severity nuance | `direct`/`partial` tag + priority cap | Full vs. partial (`*`) attacks | None by design |
| Ranking | Momentum-based priority | None (grades members, not bills) | None by design |

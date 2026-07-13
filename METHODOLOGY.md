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
- **`scripts/lint-bills.js`** — offline consistency checks: no duplicate IDs, every non-provisional attack has a valid `attackType`, positions match their section, no High partial attack without momentum, categories are valid.
- **Golden-label eval (`scripts/eval/golden-labels.json`)** — a reviewed set of expected classifications, including external labels from the D.C. Statehood Scorecard's author. `lint-bills.js` fails if `bills.json` drifts from a golden label. When a classification legitimately changes, update the golden file in the same commit and say why.

Run before deploying data changes:

```bash
node scripts/lint-bills.js
```

## How we differ from our sources

| | This tracker | D.C. Statehood Scorecard | Free DC |
|---|---|---|---|
| Unit tracked | Bills | Members of Congress (graded A+–F−) | Campaigns |
| Inclusion | Broad: any interference | Three-prong attack test | Broad: any interference |
| Severity nuance | `direct`/`partial` tag + priority cap | Full vs. partial (`*`) attacks | None by design |
| Ranking | Momentum-based priority | None (grades members, not bills) | None by design |

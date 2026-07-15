# UI Draft: "Bills to Support" Section + Attack-Type Badges

**Status:** content finalized 2026-07-13, awaiting design system. This is the reference
spec for the post-design-system UI batch — apply the finalized tokens/components to this
content; don't re-derive the copy. Classification background: `METHODOLOGY.md` and
`decisions/2026-07-12-scorecard-methodology-alignment.md`.

**Why this exists:** `App.jsx` currently renders only `billsData.bills` and
`billsData.riders`. The `supportBills` array (11 entries as of 2026-07-13, including the
DC Admission Act and nine Del. Norton home-rule bills reclassified out of the attack
lists) is invisible on the site. Separately, every attack now carries an `attackType`
("direct" | "partial") that no component displays.

---

## Part 1 — "Bills to Support" section

### Placement
After the attack sections (Passed Bills → High Priority → Riders → Other Bills →
**Bills to Support**). Rationale: the site's primary job is threat-tracking; support
bills are the constructive closer — "here's what to ask for, not just what to fight."
Collapsible like PassedBillsSection, but **expanded by default** (it's short and it's
the call to action).

### Section copy

**Heading:** `Bills to Support`

**Subheading / intro paragraph:**
> Not every DC bill in Congress is an attack. These bills would expand DC's power to
> govern itself — from full statehood to control over its own police, courts, and
> clemency. When you contact members of Congress about the bills above, ask them to
> champion these too.

**Empty state** (if the array is ever empty): omit the section entirely — no
placeholder text.

### Ordering (curated, not alphabetical)
1. **H.R. 51 — Washington, D.C. Admission Act** (the flagship; always first)
2. Home-rule power expansions: H.R. 5092 (police), H.R. 5093 (National Guard),
   H.R. 5698 (clemency), H.R. 9362 / S. 4837 (judge appointments)
3. Parity/fairness fixes: H.R. 6950 (DOT grant parity), H.R. 7881 (juror pay),
   H.R. 1537 (senior jury opt-out), H.R. 2693 (electronic transmittal), S. 402
   (court-code terminology)

Implementation note: hardcode H.R. 51 first, then group by a simple order field or
sort in the component; don't rely on array order in bills.json (the discovery script
appends).

### Card content (reuse BillCard where possible)
Same fields as attack cards — bill number(s), title, sponsors, description, status,
Congress.gov link — with two differences:
- **No attackType badge** (support bills are not incursions; S. 402 is the one
  exception, see Part 2).
- Positive accent color (design-system token for success/support) instead of the red
  attack styling — the section should read as visually distinct from threats at a
  glance.

### S. 402 note (edge case, keep this nuance)
S. 402 sits in this section but carries `attackType: "direct"` deliberately — it's a
benign-content bill that still illustrates the home-rule problem (DC can't update its
own court code). If the design allows, give it the partial/direct badge WITH its
support styling plus its existing description sentence explaining the paradox. If that
reads as confusing in practice, drop the badge here and let the description carry it.

---

## Part 2 — Attack-type badges (direct / partial)

### What they show
Every bill/rider in the attack sections has `attackType`:
- `direct` → badge label **"Direct attack"** — going after DC is the bill's purpose.
- `partial` → badge label **"Partial attack"** — attacks DC's self-governance, but DC
  isn't the primary target.

### Tooltip / accessible description text
- Direct: `Targeting DC is this bill's purpose.`
- Partial: `This bill undermines DC's self-governance, but DC is not its primary
  target — it attacks DC along the way.`

Use `title` + `aria-label` at minimum; a design-system tooltip component if one exists.

### Visual guidance (finalize against design system)
- Placement: alongside the existing priority indicator on the card header row.
- Direct = the stronger/filled treatment; partial = outlined/muted variant of the same
  badge family. Color must not rely on hue alone (WCAG): differentiate by fill vs.
  outline + label text.
- Badges appear on attack cards only (bills + riders), never on support cards (S. 402
  exception above).

### Data contract (already live in bills.json)
- `attackType` is present on all 91 non-provisional attack entries; provisional
  auto-discovered bills may have `attackType: "unknown"` — render **no badge** for
  unknown/missing, never a literal "unknown" badge.
- `scripts/lint-bills.js` (runs in CI) guarantees non-provisional attacks are always
  "direct" or "partial", so the UI needs no other fallback.

---

## Wiring checklist (for the implementation session)
- [ ] `App.jsx`: read `billsData.supportBills`, render new section after Other Bills.
- [ ] New `SupportBillsSection.jsx` (mirror PassedBillsSection's collapse mechanics).
- [ ] `BillCard.jsx`: accept a `variant="support"` prop (or equivalent) + render
      attackType badge for attack variants.
- [ ] Check Vite bundle: `supportBills` may currently be tree-shaken out of the
      bundle since nothing references it — verify it appears after wiring.
- [ ] Keep cross-site nav links intact (CLAUDE.md rule).
- [ ] After deploy: verify H.R. 51 renders first and S. 402 shows its edge-case
      treatment.

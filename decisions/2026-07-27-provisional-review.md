# Provisional review: H.R. 7196, S. 2748, H.R. 9741

**Date:** 2026-07-27
**Status:** Decided and applied. Provisional queue is now empty.

These three entries were auto-discovered by `scripts/discover-bills.js` and had sat
`provisional: true` — excluded from every published count — since the last review
sweep on 2026-07-12. All three were verified against primary sources: govinfo
`BILLSTATUS` XML and the introduced/calendar bill texts. (Congress.gov returns 403
to automated fetches; govinfo bulk data is the working route, as recorded in
`decisions/2026-07-12-scorecard-methodology-alignment.md`.)

## H.R. 7196 — `oppose` / `direct`, category `healthcare`

Rep. Tom Barrett (R-MI-7), 1 cosponsor (Crawford), introduced 2026-01-22, referred
to Oversight and Government Reform. No hearing or markup, so priority stays
`watching`.

The title undersells it. The text does two distinct things:

- **§1(a)** amends **section 602(a) of the Home Rule Act** — the enumerated list of
  subjects the Council may not legislate on — adding a new paragraph barring any
  law permitting assisted suicide.
- **§1(b)** separately **repeals DC's Death With Dignity Act of 2016** outright.

All three prongs are satisfied. Congress could neither strip a policy area from a
state legislature's authority nor repeal a state's duly enacted statute, so the
counterfactual prong is met twice over. Golden label added.

## S. 2748 — not a separate bill; folded into the H.R. 5103 entry

Sen. Eric Schmitt (R-MO), introduced 2025-09-09, placed directly on the Senate
Legislative Calendar (No. 155) under Rule XIV without committee referral.

Congress.gov lists **no** related-bill relationship to H.R. 5103, so this was
checked by diffing the texts rather than inferring from the near-identical title.
The operative provisions are the same bill: **87% character-identical**, and every
difference is drafting style — definitions hoisted into a new Sec. 2, "which" →
"that", committee ordering, hyphenation. Both establish an Interior Department
beautification program over federal land in DC and a "Safe and Beautiful
Commission" whose chair monitors DC's sanctuary-city status and compliance with
federal immigration enforcement.

Folded into the existing `hr5103` entry with `billNumbers: ["H.R. 5103", "S. 2748"]`,
matching the companion convention already used by `hr5107-s2687`, `hr2056-s1522`
and others.

**Deviation from that convention:** the entry id stays `hr5103` rather than becoming
`hr5103-s2748`. The id is referenced in `scripts/update-bill-structure.js`, keys the
golden label, and serves as the page anchor (`#hr5103`) that newsletters and
cross-site links may already point at. The id is an internal key; `billNumbers` is
what the UI renders, and it now shows both. Renaming for cosmetic consistency was
not worth breaking three live references.

## H.R. 9741 — removed from the tracker entirely

Rep. Robert Garcia (D-CA-42), no cosponsors, introduced 2026-07-16. Renames the DC
Tuition Assistance Grant program the "Eleanor Holmes Norton District of Columbia
Tuition Assistance Grant Program."

`discover-bills.js` had defaulted it to `oppose`, which was plainly wrong — it is an
honorific for DC's own delegate, introduced by an ally. The live question was
whether it belonged in `supportBills` (with or without an `attackType`, given the
S. 402 edge case where Congress editing the D.C. Code counts structurally as an
attack despite benign content).

**Decision: drop it.** In the user's words:

> "Let's drop it because the support bills give us some extra control and that's
> not true here — it's just a renaming that recognizes our leadership but gives us
> no real value."

The reasoning generalizes into a rule worth applying to future support-bill
candidates: **`supportBills` is for legislation that would give DC or its advocates
actual leverage — self-governance restored, a federal veto removed, a concrete
benefit to residents.** Symbolic recognition, however welcome, does not qualify.
Listing it would pad the "bills to support" section with something no advocate can
usefully act on, which dilutes the section's meaning as a call to action.

Note this is a narrower standard than the tracker's deliberately broad *inclusion*
rule, which governs what counts as an incursion. A bill can fail to be an attack
and still not earn a place among bills to support.

## Correction found during this review: H.R. 5103's vote data was wrong and live

Checked because S. 2748 folds into this entry. The stored `passage.house` did not
match the official record and was being rendered publicly in the passed-bills
section:

| | Was stored | Official (House Clerk roll call 101) |
|---|---|---|
| Date | 2025-04-10 | **2026-03-25** |
| Total | 211–215 | **218–206** (8 not voting) |
| Republican | 0–215 | **212–0** |
| Democratic | 211–0 | **5–206** |
| Independent | — | **1–0** |

The stored totals matched no roll call on the bill (the motion to recommit was
207–214), **211–215 would mean the bill failed** while the site displayed it as
passed, and the party split was inverted — showing Republicans unanimously opposing
a Republican-sponsored anti-DC bill. Corrected from `clerk.house.gov/evs/2026/roll101.xml`,
cross-checked by tallying individual member records against the published totals.

Also corrected on that entry: `lastAction`/`lastActionDate` (the real latest action
is **2026-06-16 — placed on the Senate Legislative Calendar, No. 437**, not the
stored 2026-03-30), the committee-hearing flag (a subcommittee hearing was held
2025-12-02), and `priority`, which was `watching` despite `hasFloorVote: true`.

`PassedBillsSection.jsx` was also updated to render party rows from whichever
caucuses are present. It previously hardcoded R and D, which would have shown
212 + 5 against a displayed total of 218 — one vote short, because of the
independent yea.

## Follow-ups

1. **`priority` appears not to be persisted back to `bills.json` by the monitor.**
   H.R. 5103 sat at `watching` with `hasFloorVote: true`, which `calculatePriority`
   scores `high`. Fixed by hand here; the systemic question is whether any
   auto-discovered bill's priority ever gets written back. Worth an audit —
   other entries may be similarly stale.
2. **The stored vote data was wrong in a way no check would catch.** Nothing
   validates that `passage.*.vote.yeas > nays` for a bill marked passed, or that
   party rows sum to the total. Both are cheap assertions for `lint-bills.js`.
3. Both H.R. 5103 and S. 2748 are now on the Senate Legislative Calendar. That is
   real momentum on a federal-takeover bill and may warrant an UrgentAlert when the
   current H.R. 9720 alert expires on 2026-07-29.

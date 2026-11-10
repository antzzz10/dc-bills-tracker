# Step 1a findings: the tracker counts 20 rider and amendment entries as pending

**Version:** v0.2, 2026-11-09 (revised after the Codex high fact-check and confirmation through the Congress.gov API) · Findings and two decisions; nothing changed on the site · Step 1a of `2026-11-09-support-page-and-congress-switch-plan.md`

## ✏️ YOUR INPUT GOES HERE

| # | Question | Your answer | My default |
|---|---|---|---|
| 1 | Fix the 5 entries whose outcome is official: mark the **2 enacted riders as law**, and archive the **3 amendments that were never voted on** | **Yes** (2026-11-09) | **Yes.** These are official facts, not judgments. |
| 2 | The **15 House riders left out of the FY2026 funding law**: **A**, archive them as "Not included in the FY2026 funding law (P.L. 119-75); H.R. 5166 is still on the House calendar"; or **B**, keep counting them as pending | **A**, "as long as the archive of bills / riders introduced still captures them so we have the historical record of everything for and against DC" (2026-11-09) | **A.** Calling them pending tells readers they still threaten FY2026 funding, which has been settled since February. This is a RepresentDC judgment, so it's labelled as one. It applies your "superseded" archive rule. |

**Codex (high) said: "Do not approve the correction as written."** All the facts checked out. The earlier draft had presented #2 as an official outcome. It isn't one, because H.R. 5166 was never withdrawn or voted down. This version separates the two (Codex raw: `reviews/2026-11-09-step-1a-findings-codex-high.raw.md`).

Effect on the numbers. The wording stays the same, and the figures are Codex's, computed with the tracker's own counting code:

| | Today | #1 only (2 = B) | #1 and 2 = A |
|---|---|---|---|
| Tracked anti-DC measures (bills, resolutions, riders) | 92 | 89 | **74** |
| Pending | 80 | 75 | **60** |
| Passed a chamber or became law | 12 | 14 | **14** |
| Law | 2 | 4 | **4** |

"4 law" means four counting units: 2 measures, plus 2 provisions of one new law. The site must never say "four laws".

**How the historical record is kept (Andria's condition on #2):** archived entries are never deleted or moved out of `bills.json`. Each one stays in its section and gains an `outcome` record: the result, the date, the official source and the date it was checked. Only counting and display treat it as archived. The bill-history archive (`representdc-data`) rebuilds its RepresentDC labels from these entries every run, so it keeps every rider and amendment for and against D.C., now with its outcome. It also keeps permanently the official records of every bill they ride on.

## What the official record shows

**Sources:**
- the Congress.gov API, using the new local key in Keychain;
- GovInfo's enrolled text of H.R. 7148 (Public Law 119-75, signed 2026-02-03), which the API links to as the bill's text;
- GovInfo BILLSTATUS amendment records.

Codex independently searched the full law text, using several phrasings per rider, the D.C. law names and the D.C. Code citations.

1. **FY2026 D.C. funding is law.** H.R. 7148, Division E, funds D.C. for FY2026. Its D.C. general provisions include two tracked riders:
   - **Sec. 809:** the marijuana commercialization ban, which is the tracker's `hr5166-marijuana`;
   - **Sec. 810:** the abortion funding ban (with exceptions for life endangerment, rape and incest), which is `hr5166-abortion`.
2. **The other 15 tracked H.R. 5166 riders are not in P.L. 119-75:**
   - the police, youth, noncitizen voting, emissions, oil and gas, reproductive health, death with dignity, COVID, insurance, right turn, cameras, anti-SLAPP, guns, sister city and shield-law riders;
   - one qualification: the law has a *different* COVID mask restriction, on Department of Transportation funds (Division D, Sec. 193). The tracked D.C. rider isn't in it.
   - H.R. 5166 itself is still "Placed on the Union Calendar" (2025-09-05). It was never withdrawn or voted down.
3. **Three tracked amendments were submitted and never voted on.** Each one's only action is "Senate amendment submitted":

   | Amendment | What | Submitted |
   |---|---|---|
   | S.Amdt. 4253 | Cruz, traffic cameras, to H.R. 7148 | 2026-01-29 |
   | S.Amdt. 2195 | Cruz, noncitizen voting reserve fund, to H.Con.Res. 14 | 2025-04-04 |
   | S.Amdt. 919 | Lee, "legislative authority over D.C." reserve fund, to S.Con.Res. 7 | 2025-02-20 |

   The only Lee amendment to S.Con.Res. 7 that was adopted, S.Amdt. 922, is about federal agency rules, not D.C.

## Why the tracker missed it

- **The tracker doesn't track a rider's or an amendment's own outcome.** It only follows the bill each one is attached to. Numbered amendments have their own official action histories, and the tracker never read them. Whether a rider survived into a law is a fact about that law's text, and nothing checked the text.
- **Step 1b (shipped today) deliberately writes no stage to riders.** Copying H.R. 7148's "became law" onto S.Amdt. 4253 would have been false.

## Proposed fix (step 1a)

- **Record each provision's own outcome, with its source:**
  - **Became law:** `hr5166-abortion` (Sec. 810) and `hr5166-marijuana` (Sec. 809), as provisions of P.L. 119-75.
  - **Submitted, never voted on:** S.Amdt. 4253, 2195 and 919. Archived.
  - **Not included in P.L. 119-75** (the 15 riders): archived under A, or kept pending under B.
- **"Archived this Congress" list** (plan step 2b, brought forward): searchable, with each entry's outcome and source, outside the active counts.
- **Each measure type gets its own status path** (the rest of 1a):
  - **bills and ordinary joint resolutions:** passed a chamber, then law;
  - **constitutional amendments (H.J.Res. 31):** passed a chamber, then sent to the states; never "law";
  - **concurrent resolutions:** agreed to by one chamber, then by both, which is final;
  - **simple resolutions:** agreed to by their own chamber, which is final.
- **One status module** replaces the six places that each decide "pending or passed" on their own. Today `App.jsx` puts every rider in pending whatever its data says.
- **Parser fix:** the monitor would read "H.Res. 12" as "S. 12", a different, Senate bill. No simple resolution is tracked yet, so it hasn't caused harm.
- **No silent drift:** the archive records each provision's verdict and its source, and rechecks it monthly.

## Also found

- **FY2027:** the tracker has no FY2027 D.C. appropriations riders. Whether the House has reported an FY2027 bill with D.C. riders still needs checking. That's the next discovery check.
- **H.R. 1968 (FY2025)** already uses this model: its enacted provisions are entries marked as law.

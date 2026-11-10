# Build plan: support page, honest counts, visible reviews, Congress switch

**Version:** v0.2, 2026-11-09 (revised after Codex high review: 2 BLOCKER, 8 MATERIAL, 2 NOTE, all accepted; raw review in `reviews/2026-11-09-support-page-plan-codex-high.raw.md`; v0.1 in `docs/outdated/`) · Plan for review; nothing built · Goal 2 of `representdc-main/docs/2026-11-08-value-updates-plan.md`. Decisions are Andria's answers of 2026-11-09, recorded in `PUBLIC-LISTING-GUARDRAILS-DRAFT.md`.

## ✏️ YOUR INPUT GOES HERE

Reply "defaults", or give the number and your change.

| #   | Question                                                                                                                                                               | Your answer                                                  | My default                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | **Fix the live count now, ahead of everything else?** (see "Found by the review")                                                                                      | **Done 2026-11-09** ("Yes, fix counts now"; `1b398ab`, live) | Yes. Same treatment as H.R. 5525: Codex passes, then deploy.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 1   | What a headline count counts                                                                                                                                           | agree with default                                           | **Distinct measures.** H.R. 1968 counts once, as a law with 3 anti-DC provisions. Bills, resolutions, budget riders and routine measures are each counted separately, never added together.                                                                                                                                                                                                                                                                                         |
| 2   | Main site headline wording                                                                                                                                             | ___                                                          | **Revised 2026-11-09: nothing to write.** Keep what went live this morning: "92 anti-DC bills, resolutions and riders introduced in this Congress". The numbers update themselves daily; the wording is fixed.                                                                                                                                                                                                                                                                      |
| 3   | `/support` heading and one-line intro                                                                                                                                  | ___                                                          | **Revised: Claude drafts, you pick.** Two or three options built from wording already on your sites, checked against the guardrails in #8 and by a Codex copy pass. Written once.                                                                                                                                                                                                                                                                                                   |
| 4   | "What to watch in the 120th Congress": which measures                                                                                                                  | ___                                                          | Statehood (H.R. 51 / S. 51), budget autonomy, legislative autonomy. Each is "expected" until it has a bill number. You approve the wording.                                                                                                                                                                                                                                                                                                                                         |
| 5   | How you classify a waiting bill                                                                                                                                        | ___                                                          | You tell Claude Code "review the waiting bills". It shows each one's text and evidence and records **both** judgments (position, and how directly it targets D.C.) plus a one-line reason. No click-to-classify links, because one click can't record two judgments.                                                                                                                                                                                                                |
| 6   | Review reminder                                                                                                                                                        | ___                                                          | One pinned GitHub issue, "Bills waiting for review", which the pipeline keeps current. A box at the top of every daily email while anything is waiting. From day 7, the subject line starts "Review overdue".                                                                                                                                                                                                                                                                       |
| 7   | Org updates on /news (goal 4): links only — org name, their headline, date, their own one-line excerpt — with no AI summary?                                           | ___                                                          | Yes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 8   | Copy guardrails: Claude writes public wording within these, and **flags every wording change to you (old → new) before it ships**. Number-only updates aren't flagged. | ___                                                          | (a) Build from wording already on your sites, or Congress.gov's own words; no new framing. (b) Name the unit: bills, resolutions, riders, routine measures, never mixed. (c) Every number comes from the counting module, never typed in. (d) "Anti-DC" is for oppose measures only; routine measures are consequences of D.C. not being a state. (e) Existing site rules: no self-descriptive copy, no subheading that repeats the heading. (f) A Codex copy pass on anything new. |

## Found by the review: the live site overcounts today

The tracker says "**14 have already cleared at least one chamber — 4 are now law**". Both numbers count entries, not measures:
- **H.R. 1968** (the 2025 full-year funding law) is stored as 3 entries, one per anti-DC provision, so it's counted 3 times.
- **H.J.Res. 142** is a resolution, which your rule says to count separately.
- **What's true:**
  - **12 measures** have passed at least one chamber: 11 bills and 1 resolution.
  - **2 have become law:** H.R. 1968, which carries 3 anti-DC provisions, and H.J.Res. 142.
- **Also wrong:** the passed-bills intro says bills that passed both chambers "are headed to the President". Both of those measures are already law.
- **The main site** uses the same numbers: "14 already passed a chamber".

**Proposed fix (step 0):**
- Count distinct measures.
- Name resolutions separately.
- Correct the intro sentence.
- Add a gate that fails if any published count is a count of entries.

It's small, and it changes public numbers, so it goes first (✏️ 0).

## What's decided (2026-11-09)

1. **Archive:** failed, withdrawn, superseded and past-Congress measures leave the active counts and go to a separate, searchable archive.
2. **Resolutions are counted separately from bills,** and still feed the overall support-vs-oppose indicators.
3. **Congress.gov settles that a bill exists and what its status is.** A newly found bill is published right away as "not yet reviewed". It gets a label only after a RepresentDC review. **Pending reviews must be impossible to miss.**
4. **Routine measures are described as structural consequences** of D.C. not being a state, never as "anti-DC".
5. **Support bills get their own `/support` page.**
6. **The daily check covers support bills.**
7. **Later:** a navigation review across all three sites (`representdc-main/WHATS-NEXT.md`).

## Step 0: honest counting units (first, small)

- **One counting module, used everywhere.** `src/lib/measureCounts.js` defines four units:
  - a **measure**: one official bill or resolution, with companions grouped together;
  - **bill** vs **resolution**, from the bill number;
  - a **rider** or provision: counted as provisions, with the number of spending bills they ride on;
  - **routine**: counted apart from anti-DC measures.

  The page summary, passed section, banner, export, `generate-stats.js`, the weekly digest and the published-claims gate all use it, so no two surfaces can disagree.
- **Stats contract:** a new nested block, `counts: { oppose: {...}, routine: {...}, support: {...} }`, each with bills, resolutions, provisions and per-stage counts. The old flat fields (`totalBills`, `pendingBills`, `passedBills`) keep their current meaning until the main site has switched, then are removed in a later, announced change.
- **Main site:** `useBillStats.js` passes the new block through; it currently drops unknown fields. All four `totalBills` uses (Home ×3, How Congress Controls DC ×1) and the passed/pending figures (Home) switch over, with the wording from ✏️ 2.
- **Gates:**
  - **`lint-bills.js`:** every count must come from the counting module.
  - **`check-published-claims.js`:** every rendered number is compared, field by field, with a fresh calculation from `bills.json`, not just checked to add up.
  - **Fixtures** cover: a law with several provisions, companion bills, a resolution that passed, a routine measure, and a provisional entry.
- **Clean-up:** `public/api/stats.json` is committed but last updated Aug 14 (it says 15 and 97). The build regenerates it, so the live file is right, but the stale copy should be removed from git or kept current.

## Phase 1: before the end of November

Each step ships separately: Codex medium and high passes, a local preview, then a deploy only on your yes.

### 1a. Statuses for every measure type, in every section
- **Monitor parsing:** add simple resolutions (H.Res., S.Res.) to the bill-number parser, the Congress.gov link helper and passage detection. They aren't handled today.
- **Status paths:**
  - **bills and ordinary joint resolutions:** introduced → passed House/Senate → passed both → law;
  - **joint resolutions proposing a constitutional amendment** (H.J.Res. 31, already tracked): introduced → passed House/Senate → **sent to the states**, two-thirds of each chamber, with no President. They're never shown as "law" or "headed to the President";
  - **concurrent resolutions:** agreed to by one or both chambers, final;
  - **simple resolutions:** agreed to by that chamber, final.
- **Every section gets real status sections.** Today only the main bill list can move into "passed"; riders and routine measures are always counted as pending. Each section maps every lifecycle state to exactly one public status, per the guardrails' "exactly once" rule.
- **Two things kept apart:** *furthest progress* (passed the House) and *final outcome* (law, sent to the states, died at the end of the Congress, withdrawn, superseded).

### 1b. The daily check covers every section, end to end
- **The check loop, the per-bill update function and the reload logic** all cover `bills`, `riders`, `supportBills` and `routineBills`. Today the update function searches only `bills`, and reloading drops support and routine.
- **Health reporting** (the error-rate check, the "N checked" counts and the email) uses the total across all sections.
- **Support priority** comes from momentum only. The partial-attack cap applies to oppose bills alone.
- **Before `/support` goes live:**
  - fill in the 4 missing `congress` values;
  - run one check;
  - compare all 36 support bills with the archive (`representdc-data`), as I did for the oppose list on 11-08.

### 1c. Reviews that can't be missed, with no leaks
- **Publishing unreviewed bills:** a neutral section, "Newly introduced: not yet reviewed". It shows official facts only (title, number, sponsor, status, date found), with no position, priority, description or attack type.
- **Kept out of every other surface:**
  - Recent Activity, which currently shows provisional entries with their priority;
  - the banner, which can announce them with no "unreviewed" label;
  - the weekly digest, which counts them in anti-DC copy;
  - the export, stats and all counts.

  A gate fails if a provisional entry reaches any of these.
- **Which new bills qualify:** discovery currently subtracts 50 points from pro-D.C. bills and sends some to "park". Under the new rules, a likely pro-D.C. bill is a candidate like any other: it's published as unreviewed and gets its label in review. The penalty becomes a hint ("likely support") shown to the reviewer.
  - **Auto-publish threshold:** unchanged, at a score of 40.
  - **Score 20–39:** keep the email decision links. Those bills aren't tracked until you choose "track".
- **Making reviews impossible to miss (✏️ 6):**
  - a pinned "Bills waiting for review" issue that the pipeline keeps current. One issue, not one per bill, so nothing has to stay in sync;
  - a box at the top of every daily email while any bill is waiting;
  - "Review overdue" in the subject line from day 7;
  - the freshness watchdog (runs twice a day) flags reviews older than 7 days.

  The weekly digest is paused (its Kit key is broken), so nothing relies on it.
- **Classifying (✏️ 5):** the existing review tool records position, how directly the bill targets D.C., and a one-line reason with its source. Nothing is defaulted.

### 1d. The `/support` page
- **A second Vite entry** (`support/index.html`), with no router, per the domain's bundle rule. Support data ships only to that page.
- **Its own 200 status:** the main site's prerender script assumes React Router, so it can't be reused. The tracker gets its own small build step that writes `support/index.html` and adds it to a sitemap.
- **Content:**
  - your heading and intro (✏️ 3);
  - the "What to watch" list (✏️ 4);
  - support measures grouped by category, with counts in the same units as step 0;
  - `--support-green`.
- **Links:** one to and from the main tracker. The navigation review comes later.
- **Code:** revives the parked `SupportBillsSection` after checking it for drift since August.

## Phase 2: the Congress switch, rehearsed in December, run Jan 3–4, 2027

### 2a. One atomic migration
- **One script** moves every 119th-Congress entry to `src/data/archive/119.json` and switches the active Congress, in one commit, gated by the existing checks. Changing the Congress number first would make the monitor look up 119th numbers in the 120th.
- **Pinned identities:** every entry, decision link and Congress.gov link carries its own Congress number:
  - passed-bill links are hardcoded to 119 today;
  - decision links currently take whichever Congress is current when clicked.
- **An empty new Congress is a normal state,** not a monitor failure. Today, zero bills reads as a 100% error rate.

### 2b. Archive page and outcomes
- **`/archive/119`,** the same multi-page pattern. Each measure shows its furthest progress and its final outcome, in the units from step 0.
- **In-Congress archive:** a withdrawn or superseded measure in the current Congress moves to an "archived this Congress" list, not the active counts. This completes decision 1.
- **Corrections:** if Congress.gov later corrects an archived record, the archive (`representdc-data`) catches it in its monthly full download, and the change is applied with a note.

### 2c. The 120th Congress pipeline
- **Discovery** already uses the `CURRENT_CONGRESS` constant; only a log line says 119th. The constant becomes date-derived, with a test.
- **Reintroductions:** a 120th-Congress bill whose title matches an archived bill is listed for review as "possible reintroduction of H.R. N (119th)". It's linked to the old bill only after you confirm.
- **"What to watch" entries** change from "expected" to the real bill once it exists, and never show a guessed number.

### 2d. Rehearsals (December)
- On a branch, run the migration on a copy of the data. Check:
  - Jan 3 at the boundary;
  - an empty 120th;
  - the first new bill;
  - a decision link clicked after the switch;
  - a reintroduced H.R. 51;
  - a correction to an archived record.
- Every count, page and gate is checked each time.

## Risks and how they're handled

| Risk | Handling |
|---|---|
| Counts mix units (today's live error) | One counting module; the gate compares each field with a fresh calculation; fixtures |
| Unreviewed bills read as classified | Neutral section only; filtered from Recent Activity, banner, digest, export and stats; the gate fails if one leaks |
| Reviews pile up | Pinned issue, daily email box, "Review overdue" from day 7, watchdog flag |
| A constitutional amendment shown as "law" | Its own status path, with a gate check |
| The main site breaks when `stats.json` changes | Additive nested block; old fields kept until the main site switches |
| The Jan 3 switch fails | One atomic migration, pinned identities, rehearsals of the six cases |

## Order and rough size

0. **Honest counting units:** 1 session. **Proposed now.**
1. **1a, statuses:** 1 session.
2. **1b, daily check, all sections:** under 1 session.
3. **1c, reviews:** 1 session.
4. **1d, `/support`:** 1 session, once your copy is in.
5. **Phase 2:** 2 sessions in December, plus the Jan 3–4 switch.

## Codex findings and what changed

| # | Severity | Finding | Change |
|---|---|---|---|
| 1 | BLOCKER | Constitutional-amendment resolutions don't follow the bill path | Own status path (1a) |
| 2 | BLOCKER | Unreviewed bills leak through Recent Activity, the banner and the digest | Every surface filtered, plus a gate (1c) |
| 3 | MATERIAL | The stats fields contradicted each other; the main site drops new fields | Nested `counts` block; `useBillStats` updated (step 0) |
| 4 | MATERIAL | "88 bills and riders" mixed units: routine, and H.R. 1968 counted 3 times | Counting units (step 0); live overcount found |
| 5 | MATERIAL | Riders and routine can never show as passed; simple resolutions unsupported | 1a |
| 6 | MATERIAL | The monitor's update, reload and health logic cover only `bills` | 1b |
| 7 | MATERIAL | Current-Congress archive missing; progress and outcome mixed | 2b, 1a |
| 8 | MATERIAL | Congress switch not atomic; identities not pinned; empty Congress treated as failure | 2a, 2d |
| 9 | MATERIAL | Click links can't record two judgments | Review tool records both (✏️ 5) |
| 10 | MATERIAL | Pro-D.C. penalty suppresses support discovery | Penalty becomes a hint (1c) |
| 11 | NOTE | Four `totalBills` uses; watchdog runs twice a day; digest paused | Corrected |
| 12 | NOTE | Issue-per-bill overbuilt; main site's prerender script needs React Router | One pinned issue; tracker gets its own build step |

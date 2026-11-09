# Build plan: support page, separate resolution counts, visible reviews, Congress switch

**Version:** v0.1, 2026-11-09 · Plan for review; nothing built · Goal 2 of the 2026-11-08 value-updates plan (`representdc-main/docs/2026-11-08-value-updates-plan.md`, section B). Decisions are Andria's answers of 2026-11-09, recorded in `PUBLIC-LISTING-GUARDRAILS-DRAFT.md`.

## ✏️ YOUR INPUT GOES HERE

Each question has a default. Reply "defaults", or give the number and your change.

| # | Question | Your answer | My default |
|---|---|---|---|
| 1 | Which measures count as **resolutions**? | ___ | All six resolution types: H.J.Res., S.J.Res., H.Con.Res., S.Con.Res., H.Res., S.Res. Joint resolutions can become law (H.J.Res. 142 did), so their cards still say "became law", but they're counted as resolutions, not bills. |
| 2 | Wording of the main site's headline count | ___ | "**88 anti-DC bills and riders, plus 9 resolutions,** introduced in this Congress" (today's numbers) |
| 3 | `/support` page heading and one-line intro | ___ | You write these: public copy uses your words. My placeholder is "Bills to back", with the intro left blank. |
| 4 | "What to watch in the 120th Congress" list: which measures | ___ | Statehood (H.R. 51 / S. 51), budget autonomy, legislative autonomy. Each is marked "expected" until it has a bill number. You approve the list and its wording. |
| 5 | Where newly found, not-yet-classified bills appear | ___ | Their own section at the bottom of the tracker's main page, "Newly introduced: not yet reviewed". They're kept out of every count, and each card shows the day it was found. |
| 6 | Review reminder | ___ | A box at the top of every daily email while any bill is waiting. From day 7 on, the email subject starts "Review overdue". |

## What's decided (2026-11-09)

1. **Archive:** failed, withdrawn, superseded and past-Congress measures go to a separate, searchable archive and leave the active counts.
2. **Resolutions are counted separately from bills,** so references to "bills" never look inflated. They still count toward the overall support-vs-oppose indicators.
3. **Congress.gov settles that a bill exists and what its status is.** A newly found bill is published right away as "not yet reviewed". It gets an oppose or support label only after a RepresentDC review (the September 8 rule). **Pending reviews must be impossible to miss.**
4. **"Routine" measures are described as structural consequences** of D.C. not being a state, not as "anti-DC". The site's "Everyday indignities" section already does this; the guardrails page will say so too.
5. **Support bills get their own `/support` page,** never mixed into the anti-DC list.
6. **The daily check covers support bills.**
7. **Later, not in this plan:** a navigation review across all three sites, in case the party leading Congress changes (`representdc-main/WHATS-NEXT.md`).

## Today's facts this plan is built on

- The tracker lists 78 bills, 18 riders and 1 routine bill. **9 of the 78 are resolutions**: 6 H.J.Res., 1 S.J.Res., 1 H.Con.Res., 1 S.Con.Res. The public count of 97 therefore includes them. Without them, it's 88 bills and riders.
- There are 36 support bills, all hidden since 2026-08-03. The daily check has never scanned them, so their data is stale. Four of them have no `congress` field.
- There are no provisional (unreviewed) bills right now. Discovery adds a bill as provisional when it scores 40 or more; such bills are hidden, and the only reminder is a line in the weekly discovery email. Bills scoring 20–39 already get two-click decision links in that email.
- The Congress number is a constant (`CURRENT_CONGRESS = 119`) in `scripts/config.js` and `src/data/config.js`. Discovery is also hardcoded to the 119th. `SESSION_END` is 2027-01-03.
- The main site reads `totalBills`, `pendingBills` and `passedBills` from the tracker's `/api/stats.json`. It says "{totalBills} anti-DC bills and riders introduced in this Congress", which already overstates "bills" while 9 resolutions are in the count.

## Phase 1: before the end of November

Each step ships separately: Codex medium and high passes on the code, then a local preview, then a deploy only on your yes.

### 1a. Count resolutions separately (fixes today's overcount)
- Add `measureKind` (`bill` or `resolution`) to `stats.json`, derived from the bill number. Nothing is entered by hand.
- `stats.json` gains new fields (`bills`, `resolutions`, `passedBills`, `passedResolutions`, and the same for pending). The existing `totalBills`, `pendingBills` and `passedBills` stay, unchanged in meaning, so the main site can't break mid-rollout.
- **Tracker copy:** every sentence that says "N bills" counts bills only and names resolutions separately.
- **Main site copy:** the three places that use `totalBills` (Home ×3, How Congress Controls DC ×1) switch to the new fields with wording you approve (✏️ 2).
- **Status labels by resolution type:**
  - joint resolutions follow the bill path, including "became law";
  - concurrent resolutions are "agreed to by the House", "by the Senate", or "by both chambers" (final; no President);
  - simple resolutions are "agreed to by the House" or "by the Senate" (final in that chamber).

  A simple resolution is never shown as "headed to the Senate".
- **Gates:**
  - `lint-bills.js` asserts that the stats fields add up;
  - `check-published-claims.js` checks every rendered "N bills" sentence against the bills-only count.

### 1b. Make pending reviews impossible to miss
- **Shown publicly:** provisional bills appear in their own section, "Newly introduced: not yet reviewed" (✏️ 5). Each shows its official title, number, sponsor, status and the date it was found, with no position, priority or description. They're excluded from every count, both pages, `stats.json` and the export.
- **One GitHub issue per waiting bill,** opened by discovery and titled "Review: H.R. N (found YYYY-MM-DD)". The issue holds three classify links, Oppose, Support and Routine, plus a Not relevant link. Each opens a pre-filled issue that a workflow applies, like the existing discovery-decision workflow. That workflow already handles title validation, owner-only access, and retrying if two decisions conflict. Classifying closes the review issue. Your open issues list is then the to-do list.
- **The daily email** gets a box at the top whenever a review is waiting: "N bills waiting for review, oldest found D days ago", with the issue links. From day 7 the subject line starts "Review overdue" (✏️ 6). The weekly digest repeats the box.
- **The watchdog** (already runs daily) reports a stuck review the way it reports stale data, so a missed email doesn't hide it.
- **What it doesn't do:** label a bill automatically. Discovery's 20–39 tier keeps its existing decision links; those bills aren't tracked until you choose "track".

### 1c. The daily check covers support bills
- `monitor-bills.js` loops over `bills`, `riders`, `supportBills` and `routineBills`. The archive work already added `limit=250` and syncing of official dates; both apply to every section.
- **Priority for support bills:** the "partial attack" cap is skipped, and priority comes from momentum only (hearing, markup, floor vote, cosponsors).
- **Backfill** the 4 support bills that have no `congress` field. Then run one check and compare all 36 against the archive (`representdc-data`), as I did for the oppose bills on 11-08.
- **The weekly digest** reports support-bill movement in its own section, never mixed with the oppose list.

### 1d. The `/support` page
- A second Vite entry (`support/index.html`), with no router, following the domain's bundle-discipline rule. It builds as its own page and stays small; the 36 support bills are no longer shipped to the main tracker page's bundle.
- **Content:**
  - your heading and intro (✏️ 3);
  - support bills grouped like the main page;
  - its own colour (`--support-green`, already in the design tokens).
- **Search and filter:** the same components as the main page.
- **Links:** one to `/support` from the main tracker and one back. The navigation review comes later.
- **Counts on `/support`** use the same rule: "N bills and M resolutions". `stats.json` gains a `support` block, so the main site can show it later if you want.
- **SEO:** the 404 fix from 11-08 (prerendered route plus sitemap entry) applies, so `/support` returns 200.
- **Revives** the parked `SupportBillsSection`, which needs a check for drift since August.

## Phase 2: the Congress switch, ready before Jan 3, 2027

### 2a. Archive the 119th Congress
- On the switch, every 119th-Congress entry moves to `src/data/archive/119.json`, a separate file loaded only by the archive view, so the main page stays small.
- **Each archived entry gets a final outcome from its official record:**
  - became law;
  - passed both chambers;
  - passed one chamber;
  - agreed to (resolutions);
  - died at the end of the Congress.
- **An archive page** (`/archive/119`, the same multi-page pattern) lets you search and filter by outcome. It shows "In the 119th Congress: X bills and Y resolutions; Z became law", from the archive's own counts.
- **Active counts reset,** and the copy says which Congress they cover ("in the 120th Congress so far"). The main site's copy already says "this Congress", and its new wording from 1a carries over.

### 2b. Move the pipeline to the 120th
- `CURRENT_CONGRESS` and `SESSION_END` become values derived from the date, with one test, rather than constants someone has to remember to edit.
- **Discovery scans the 120th.** Decisions from the 119th never silence a 120th-Congress bill; discovery already keys decisions by Congress.
- **Reintroductions:** a 120th-Congress bill with the same title as an archived bill is listed for review as "possible reintroduction of H.R. N (119th)". It's linked to the old bill only after you confirm, as Codex advised on 11-08 ("a reintroduced H.R. 51 is a new bill").

### 2c. "What to watch in the 120th Congress"
- A short, dated list at the top of `/support` (✏️ 4). Each entry is marked "expected" until it has a bill number, then links to the bill.
- Once the bill exists, the entry changes from "expected" to the bill; it never shows a bill number we've guessed.

### 2d. Rehearsal
- On a branch, set the date to 2027-01-04 and run the switch on a copy of the data. Check every count, every page and the gates. Then repeat on real data on Jan 3–4.

## Risks and how they're handled

| Risk | Handling |
|---|---|
| The main site breaks when `stats.json` changes | New fields are additive, and the main site switches over after the tracker deploys |
| Unreviewed bills read as anti-DC | Neutral section, no position or priority, outside every count. The gate fails if a provisional bill appears in any count. |
| Reviews pile up unseen | Issue per bill, daily email box, "Review overdue" subject from day 7, watchdog check |
| Support data was stale when revived | Monitor coverage and an archive cross-check before `/support` goes live |
| The Jan 3 switch goes wrong under time pressure | Rehearsal on a branch in December, and counts derived from data, never hand-edited |

## Order and rough size

1. **1a, resolutions counted separately:** 1 session. It changes public numbers, so it goes first.
2. **1c, daily check covers support bills:** under 1 session. It has to come before 1d.
3. **1b, visible reviews:** 1 session.
4. **1d, `/support` page:** 1 session, once your copy (✏️ 3) is in.
5. **Phase 2:** 2 sessions in early December, plus the Jan 3–4 switch.

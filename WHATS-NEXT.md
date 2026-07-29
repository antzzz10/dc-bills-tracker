# What's Next — dc-bills-tracker

A walkable pipeline for work that's been scoped but isn't built yet. Companion to
`decisions/` (resolved decisions) and `METHODOLOGY.md` (standing rules) — this file
is for what's *next*, with enough detail that picking any item up doesn't require
re-deriving the context.

**Domain-wide decisions and rollout state now live in
`representdc-main/decisions/2026-07-27-domain-standards-and-rollout.md`** — analytics
policy, privacy rules, bundle discipline, the About page, the design-system rollout
across all three sites, and the cross-repo data contracts. Read that first; this file
is only what is specific to the bill tracker.

Longer-range domain ideas: `representdc-main/WHATS-NEXT.md`. Cross-project
scheduling: `~/Projects/QUEUE.md`.

Started 2026-07-27 from a `site-batch` triage. Each item carries its **lane** —
whether it can run in parallel or has to be serial — per
`.claude/site-batch-profile.md`.

---

## Waiting on you

### 1. Event tracking — ✅ LIVE
**Shipped 2026-07-27, key wired 2026-07-28.** Reasoning:
`decisions/2026-07-27-analytics.md`.

Four events through `src/lib/analytics.js`: `bill_source_opened`, `bill_expanded`,
`export_downloaded`, `category_filtered`. Cookieless, +0.57 kB gzip. Key is set both
locally (`.env`, gitignored) and as the `VITE_POSTHOG_KEY` repo **variable**, so the
three scheduled rebuild workflows keep it.

**One thing left for you: confirm a real visit registers.** Open
billtracker.representdc.org, expand any bill, and check PostHog → Activity.
Browser-side delivery could not be verified here because PostHog silently drops
events from automated browsers (`capture()` returns undefined with no log, in
headless regardless of user agent or `navigator.webdriver`). The key itself is
confirmed good — a direct `POST` to the ingestion endpoint returned
`{"status":"Ok"}`, and that test event appears as `setup_verification` from
distinct_id `setup-check`.

**Watch out:** several PostHog features default to `undefined`, meaning "defer to
remote config", and their server turns them on — dead clicks, web vitals, heatmaps,
surveys, web experiments. They are now explicitly `false` in `index.html`. Don't
remove those lines; without them the running page loads tracking we deliberately
rejected.

### 2. About page → **moved out of this repo**
Not tracker work. Decided domain-level: it's canonical at `representdc.org/about`.
Draft copy and spec remain at `docs/about-page-draft.md` purely as a handoff artifact
— nothing in this repo changes. Tracked in the domain note.

---

## Needs scoping before it can be built

### 3. Remaining UI/UX changes
**Lane B (serial).** Too broad to start. Known concrete items:
- `SupportBillsSection` floods `--support-green` as a large surface; the token's own
  comment reserves it for candidate/pledge use. Needs a ruling.
- `bills.json` categories carry an unused `color: "#DC143C"` field — dead data.
- Nav/footer will need reconciling once `representdc-main`'s IA rework lands.

### 4. Deeper bill-tracker improvements
**Mixed lanes — decomposes into several once specified.** Currently a placeholder.
Candidate threads, in rough value order:
- **Provenance tracking** (`_source` field) — the last open item from the Congress
  validation plan. Would record where each bill entry came from.
- **Data-integrity lint additions**, both cheap and both would have caught real bugs:
  assert `yeas > nays` for anything marked passed, and assert party rows sum to the
  displayed total. (A wrong, inverted House vote shipped live on H.R. 5103 and was
  caught only by manual review — see `decisions/2026-07-27-provisional-review.md`.)
- **Priority persistence audit** — entries have been found stale (`watching` despite
  `hasFloorVote: true`), suggesting `calculatePriority`'s result may never be written
  back to `bills.json`. Unknown blast radius until audited.

---

## Blocked on an external action

### 5. News scan + summary → automatic weekly update
**Lane D. Not a code problem — no amount of parallelism moves this.**

The pipeline exists and is committed. `weekly-digest.yml`'s cron is **commented out**
after five weeks of 401s: `KIT_API_KEY` is a Kit **v3** key and the workflow uses the
**v4** API. Kit rebranded from ConvertKit and issues different keys per version.

**Unblock:** generate a v4 key in Kit → Settings → Developer → API Keys, set it as
the `KIT_API_KEY` repo secret, run the workflow manually in test mode, then uncomment
the cron (instructions are inline in the workflow file).

Once unblocked, the documentation pass this needs: how `fetch-news.js` (6 AM/6 PM UTC)
→ `public/api/news.json` → both the weekly digest *and* `representdc-main`'s `/news`
page fit together. That cross-repo dependency is currently recorded only in a code
comment in `App.jsx`.

---

## Recently shipped

- **2026-07-27** — Provisional queue cleared to zero (94 bills live). Found and fixed
  a wrong, publicly displayed House vote on H.R. 5103. See `decisions/`.
- **2026-07-26** — RepresentDC design system adopted: fonts, Lucide icons replacing
  ~30 emoji, full token migration, real Nav/Footer. News section removed from the
  tracker (moved to `representdc.org/news`); the *pipeline* stays, since main fetches
  `news.json` from here.
- **2026-07-26** — Bill-count divergence fixed: the site said 93 while main published
  96, because `generate-stats.js` counted unreviewed provisionals. Now guarded by
  `lint-bills.js` check 7.

# What's Next — dc-bills-tracker

A walkable pipeline for work that's been scoped but isn't built yet. Companion to
`decisions/` (resolved decisions) and `METHODOLOGY.md` (standing rules) — this file
is for what's *next*, with enough detail that picking any item up doesn't require
re-deriving the context.

Domain-wide items live in `representdc-main/WHATS-NEXT.md`; this file is
tracker-specific. Cross-project scheduling lives in `~/Projects/QUEUE.md`.

Started 2026-07-27 from a `site-batch` triage. Each item carries its **lane** —
whether it can run in parallel or has to be serial — per
`.claude/site-batch-profile.md`.

---

## Ready to build

### 1. Event tracking — 4 events, vendor pending
**Lane B (serial — touches many components).** Blocked only on the vendor call.

Cloudflare Web Analytics (already live in `index.html`) is pageview/Core-Web-Vitals
only — it has no custom-event API. Zaraz was considered and rejected: it's a tag
manager, not an analytics backend, so it needs a destination anyway, *and* it
requires a Cloudflare-proxied domain, which this isn't (`billtracker.representdc.org`
resolves straight to GitHub Pages; no `cf-ray` header).

Events to instrument, all decided:
- outbound Congress.gov link clicks (which bills people actually read)
- PDF download button usage (does the export justify the jsPDF weight?)
- bill card expansions (what gets read vs. scrolled past)
- filter/category usage (which of the 12 categories earn their place)

**Explicitly not tracked:** search terms. On an advocacy site those can reveal what a
visitor is personally worried about.

Build notes:
- Put all calls behind `src/lib/analytics.js` so the vendor is swappable in one file.
- If PostHog: load via **async snippet, not the npm package** — `posthog-js` is 73 KB
  gzip, ~30% on the current bundle. Set `autocapture: false`,
  `disable_session_recording: true`, `persistence: 'memory'` (cookieless → no consent
  banner). Free tier is 1M events/mo, no card.
- Whatever the vendor: no cookies, no session replay, no consent banner.

### 2. About page → belongs in `representdc-main`
**Not this repo.** Decided 2026-07-27: it goes at `representdc.org/about`, the org's
front door, not on a tool subdomain. Draft copy and full spec:
`docs/about-page-draft.md`. Hand to whoever is working `representdc-main`.

Carries one bug worth fixing in passing: `representdc-main/src/hooks/useBillStats.js`
has a stale hardcoded fallback of **74** bills that renders whenever the stats fetch
fails.

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

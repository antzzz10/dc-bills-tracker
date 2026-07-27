# Event tracking: PostHog via async snippet, cookieless

**Date:** 2026-07-27
**Status:** Decided and implemented. Inert until a project key is set — see "What you still have to do."

## What we wanted

Four questions the existing analytics can't answer:

1. Which bills do people actually follow through to Congress.gov?
2. Does the PDF/CSV export earn the jsPDF bundle weight it costs?
3. Which bills get read versus scrolled past?
4. Which of the 12 categories do people actually use?

## Why the existing setup couldn't do it

Cloudflare Web Analytics has been running in `index.html` since before this
decision. It is **pageview and Core Web Vitals only** — there is no custom-event
API. It stays, because it does that job well and cookielessly. This decision is
purely about adding an event layer beside it.

## Options considered

**Cloudflare Zaraz — rejected, on two independent grounds.** It was the initial
preference (same vendor, already paying nothing) but investigation killed it:

- **Zaraz is a tag manager, not an analytics backend.** `zaraz.track()` fires an
  event and forwards it to "tools" you configure. It stores nothing and reports
  nothing. Choosing it would not have avoided choosing a destination — it would
  have added a layer *in front of* that choice.
- **It requires a Cloudflare-proxied domain, and ours isn't.**
  `billtracker.representdc.org` and `www.representdc.org` both resolve straight to
  GitHub Pages IPs (185.199.108–111.153) and return `server: GitHub.com` with no
  `cf-ray` header. The documented workaround is to stand up a *separate* proxied
  subdomain purely to host `/cdn-cgi/zaraz/i.js`. That is real DNS work for a
  layer we established we don't need.

The existing Cloudflare Web Analytics beacon works without proxying because it's a
plain script tag. Zaraz is not comparable in that respect.

**Google Analytics 4 — rejected.** Free and capable, but sets cookies, needs a
consent banner in most jurisdictions, and routes visitor behaviour to Google. For a
site whose users are researching government action against their own city, that is
a values mismatch, not just a compliance cost.

**Plausible / Fathom — viable, not chosen.** Cookieless by design, ~1 kB script,
first-class custom events. Would have been the pick at zero cost, but ~$9/mo is a
real line item for a volunteer project when a free tier achieves the same result.

**Workers Analytics Engine — rejected as disproportionate.** Cloudflare-native,
no third party, SQL-queryable. But it's written *from a Worker*, not a browser, so
it means owning an endpoint, a schema, and our own queries. A side project, not a
configuration task.

**PostHog — chosen**, with three deliberate constraints below.

## The decision

PostHog, **loaded by async snippet in `index.html`, not the npm package**, with
autocapture, session recording, and cookies all off.

Each constraint is doing specific work:

- **Snippet, not `posthog-js`.** The package is ~73 kB gzip — roughly +30% on this
  site's JS bundle. This repo removed a 173 kB gzip regression the day before
  (`decisions/2026-07-26-design-system-rollout.md`); adding 73 kB back for four
  events would be the same mistake in the other direction. Loaded async, PostHog
  costs nothing on first paint. Measured bundle impact of the whole change:
  **+0.57 kB gzip**, all of it our own wrapper.
- **`persistence: 'memory'` — cookieless.** No cross-visit identity, and therefore
  no consent banner. We lose returning-visitor analysis; we consider that a fair
  trade for this audience.
- **`autocapture: false`, `disable_session_recording: true`.** Both default to on.
  Session-recording visitors who are reading about legislation targeting their own
  city is not something this project should do, and autocapture would collect far
  more than the four events we actually reasoned about.
- **`capture_pageview: false`.** Cloudflare already does pageviews; no need to
  count them twice.

**Search terms are deliberately not tracked.** On an advocacy site, a search query
can reveal what a visitor is personally worried about. This is a standing rule, not
a v1 limitation.

## Implementation

All calls go through `src/lib/analytics.js`, which is the only file that knows the
vendor. Swapping PostHog or removing tracking entirely is a change to that one file.
`track()` no-ops silently when analytics is absent and never throws — a broken
tracker must not break the UI.

Events: `bill_source_opened`, `bill_expanded`, `export_downloaded`,
`category_filtered`. Names live in an exported `EVENTS` map so call sites can't
drift apart.

Verified in a real browser: all four fire with the expected names and properties on
genuine UI interaction, **zero cookies** are set, and with no key configured there
are **zero network requests to PostHog** — the site behaves exactly as it did before.

## What you still have to do

Tracking is **inert until a project key exists**. The snippet reads
`%VITE_POSTHOG_KEY%`, which Vite substitutes at build time; when unset, the
placeholder survives and a guard short-circuits before PostHog loads.

1. Create a PostHog project (free tier: 1M events/month, no card) and copy the
   project API key — it's publishable and safe in client code.
2. Set `VITE_POSTHOG_KEY` for local builds (a `.env` file, which is gitignored).
3. **Set it in CI, or production will silently have no tracking.** The site is
   rebuilt and redeployed by `monitor-bills.yml` and `fetch-news.yml`; the key must
   be available to those builds as a repo variable, or every automated deploy will
   ship the inert placeholder. This is the most likely way this decision quietly
   fails.

Reviewed `46b638a` read-only. **0 BLOCKER, 1 MATERIAL, 2 NOTE.** No files changed; worktree remains clean.

- **MATERIAL — Search terms can reach analytics.** `src/App.jsx:74` introduces searches in the URL, while `src/lib/analytics.js:38` sends custom events without URL sanitization. With PostHog configured, opening `?search=…` and expanding a bill can transmit that search through the default `$current_url` property, contrary to the policy at `src/lib/analytics.js:14`. Disabling pageviews does not remove custom-event URL properties. **Fix:** sanitize URL-bearing properties through PostHog’s `before_send` configuration in `index.html:35`, removing `search` before transmission. Verify the outgoing payload. [PostHog default properties](https://posthog.com/docs/data/events)

- **NOTE — Clearing filters leaves a stale address.** `src/App.jsx:224` clears React state only. After opening `?category=crime&search=budget`, clearing filters and reloading restores both filters; copying the address also shares the cleared selection. **Fix:** remove `category` and `search` with `history.replaceState` when clearing, preserving unrelated parameters and the hash.

- **NOTE — New test adds a lint error.** `scripts/test-url-filters.js:29` references `process`, but ESLint configures browser globals only. **Fix:** import `process` from `node:process`, or configure Node globals for scripts. Repository lint currently reports 68 errors, including unrelated existing failures; this commit adds this one.

The remaining static checks look sound:

- Menu order and URLs match the requested destinations and sibling change checkouts. Changed reader-facing wording follows sentence case, “D.C.” and “RepresentDC,” with no em-dashes.
- Opening focuses the first link; Escape restores button focus; outside clicks and tabbing out close the panel. Open-panel resize handling, `hidden`, `aria-expanded`, and `aria-controls` agree. The current-page span is available to screen-reader navigation and intentionally skipped by Tab as noninteractive text.
- Unknown categories are ignored; aliases and deduplication work. Search text reaches a controlled input and literal string matching, with no identified injection/XSS sink.

URL-filter tests and all 30 headline checks passed. An **in-memory Vite build passed**. Full build generation was not run because it writes files. Playwright was blocked by the read-only sandbox, so overflow/overlap at **320, 375, 768, 1024, 1160 and 1280px remains visually unverified**; integer CSS/JS breakpoints agree.

**Verdict: Request changes for analytics privacy before deployment; responsive visual verification remains outstanding.**
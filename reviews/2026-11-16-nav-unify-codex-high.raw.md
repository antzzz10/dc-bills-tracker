Reviewed `46b638a`. **0 BLOCKER, 1 MATERIAL, 4 NOTE.** No files modified.

- **MATERIAL — Search terms can reach analytics.** `src/App.jsx:74` introduces `?search=` while leaving it in the URL. With PostHog configured, subsequent custom events include `$current_url`, despite pageview capture being disabled. This conflicts with the explicit “search terms are not tracked” rule in `src/lib/analytics.js`. [PostHog’s source](https://github.com/PostHog/posthog-js/blob/main/packages/browser-common/src/utils/event-utils.ts) confirms URL collection. **Fix:** redact `search` from event and person URL properties before transmission, and verify outgoing payloads with a distinctive test term.

- **NOTE — Clearing filters leaves a misleading address.** `src/App.jsx:224` clears React state only. Reloading restores the cleared filters; copying the address shares the original selection. **Fix:** remove `category` and `search` with `history.replaceState` when clearing, preserving unrelated parameters and the hash.

- **NOTE — Resize focus recovery only runs while open.** `src/components/Nav.jsx:57` skips registering the breakpoint listener when closed. A keyboard user focused on the Menu button can widen past 1160px and lose focus when CSS hides it. **Fix:** register breakpoint handling independently of `open` and move focus to the brand when the focused button disappears.

- **NOTE — Fractional breakpoint gap.** `src/components/Nav.css:183` uses `max-width: 1159px`, while JS and the desktop panel rule use `min-width: 1160px`. Between those values, desktop links appear although JS still considers the viewport narrow; an already-open panel can remain visible alongside them. **Fix:** use complementary conditions, such as CSS `width < 1160px` and JS `min-width: 1160px`.

- **NOTE — New lint error.** `scripts/test-url-filters.js:29` references `process` without importing it under the browser-only ESLint configuration. **Fix:** import `process` from `node:process`. Repository lint already has unrelated failures; this adds another.

The nine labels, order and destinations match the corresponding sibling worktrees. All seven main-site category queries resolve correctly, including `search=budget`. Unknown categories are ignored; search uses literal string matching and a React-controlled input, with no identified injection or XSS path. Changed reader-facing copy meets the requested wording rules.

Static inspection supports the open/close, Escape, outside-click, `hidden`, and ARIA implementation. The current-page span is correctly noninteractive and skipped by Tab. No conflicting site CSS was found. **Rendered overflow at 320, 375, 768, 1024, 1160 and 1280px remains unverified.**

The production bundle built in memory. URL-filter, progress, statehood, Senate-vote, bill-data and regenerated published-claims checks passed. Deployment was not run.

**Verdict: Hold for analytics redaction; complete browser layout and focus verification before deployment.**
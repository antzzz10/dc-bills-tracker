# DC Bills Tracker

This repo is the bill tracker of **representdc.org**, a three-app DC statehood advocacy platform (all built with Claude Code, hosted on GitHub Pages with CNAME subdomains).

| App | Directory | URL | Purpose |
|-----|-----------|-----|---------|
| Landing Page | `../representdc-main/` | www.representdc.org | Main advocacy site, CTAs to the other tools |
| **Bill Tracker** | `dc-bills-tracker/` (this repo) | billtracker.representdc.org | Tracks 90+ anti-DC bills/riders plus pro-DC bills to support: search, filters, PDF export |
| Candidate Tracker | `../dc-statehood-pledge/` | candidates.representdc.org | 2026 candidate questionnaire responses |

**Stack:** React 19, Vite 7, ESLint 9, gh-pages.
**Automation:** `.github/workflows/monitor-bills.yml` runs daily at 2 PM UTC, fetching bill status from the Congress.gov API.
**Methodology:** `METHODOLOGY.md` defines inclusion (broad, per Free DC), the two-axis classification (`position` × `attackType` via the Statehood Scorecard's three-prong test), and momentum-based priority with the partial-attack cap. Run `node scripts/lint-bills.js` (offline lint + golden-label eval) before deploying data changes; decision history lives in `decisions/`.
**Cross-site links:** all three sites link to each other in navigation/footers — keep links intact when editing nav.

**Commands:**
```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run deploy   # Deploy to GitHub Pages
```

**Session memory:** `~/.claude/projects/-Users-andriathomas-Projects-dc-bills-tracker/memory/` — tracker state, GitHub Actions health, Congress.gov validation next steps; read MEMORY.md there first.

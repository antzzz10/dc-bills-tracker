# site-batch profile — dc-bills-tracker

Consumed by the global `site-batch` skill (`~/.claude/skills/site-batch/SKILL.md`).
That skill holds the method; this file holds what is true about *this* repo.

Keep it current — it is the difference between a batch that verifies and one that
quietly ships something wrong.

## Cross-cutting files (Lane B — never fan out, never split)

Any idea touching these is serial, one agent, however small it looks:

- `src/App.css` — global layout, section headers, shared icon/heading rules
- `src/index.css` — base type, the `--font-mono` data-face class list
- `src/styles/tokens.css` — **duplicated by design** from `representdc-main`; token
  *values* must stay byte-identical (verify with `diff <(sed -n '/^:root/,$p' ...)`)
- `src/App.jsx` — every section renders through it
- `src/data/bills.json` — the product; also written daily by the monitor
- `src/components/Icon.jsx` — the icon registry; adding an icon means editing it

Also serial: **anything changing shared visual language** (spacing scale, color
application, type ramp) even if it only edits one file today.

## Verification block

Run all of these. None is optional.

```bash
node scripts/lint-bills.js     # data + golden-label eval; MUST pass
npx eslint .                   # compare to baseline below, NOT to zero
npm run build                  # also regenerates public/api/stats.json
```

- **ESLint baseline is 59 errors, 0 warnings.** Pre-existing `process` /
  `__BUILD_DATE__` no-undef and unused vars. A non-zero exit is not a regression —
  a count above 59 is.
- **`lint-bills.js` check 7** asserts `stats.json` matches what the site renders.
  If it fires, run `node scripts/generate-stats.js` — do not edit stats.json by hand.
- UI verification: drive the built site with Playwright at **1440×900 and 390×844**.
  Playwright is not a repo dependency — install it in the session scratchpad, not
  into `package.json`.

## Deploy

```bash
npm run deploy        # gh-pages -d dist --dotfiles  → billtracker.representdc.org
```

- Production is the **`gh-pages` branch only**. There is exactly one Pages site per
  repo, so `npm run deploy:staging` pushes a branch **nobody serves** and prints a
  URL for a site that does not exist. Do not use it. For phone review, serve the
  built site over LAN: `npx vite preview --host` + the machine's `en0` address.
- Confirm the deploy by fetching the live bundle hash and comparing to `dist/`.
  CDN propagation takes ~10–60s; poll, don't assume.
- `public/CNAME` must survive the build or the custom domain breaks.

## Known traps

- **Daily bot commits.** GitHub Actions writes `bills.json`, `news.json`,
  `bill-status-history.json` on a schedule. Always `git fetch` and merge before
  pushing, and re-verify your data edits survived the merge.
- **Parallel human sessions.** This repo is sometimes worked from more than one
  Claude Code thread. Check `git status` for modifications you did not make and
  stage selectively — never `git add -A`.
- **Edit `bills.json` with Node, not Python.** `json.dumps` escapes em dashes to
  `—` and produces a huge spurious diff. Match the monitor:
  `JSON.stringify(data, null, 2)`.
- **Congress.gov 403s automated fetches.** Use govinfo bulk data instead:
  `https://www.govinfo.gov/bulkdata/BILLSTATUS/119/{hr|s}/BILLSTATUS-119{type}{num}.xml`
  and `https://www.govinfo.gov/content/pkg/BILLS-119{type}{num}{ver}/html/...htm`
  for text. Roll-call votes: `https://clerk.house.gov/evs/{year}/roll{NNN}.xml`.
- **`CONGRESS_API_KEY` exists only as a GitHub Actions secret** — no local copy.
  Scripts needing it must be run in CI or the key exported by hand.
- **Bill entry ids are load-bearing.** They key golden labels, are referenced in
  `scripts/update-bill-structure.js`, and serve as page anchors (`#hr9720`).
  Renaming one is a three-file change — prefer adding to `billNumbers`.
- **`priority` may not be persisted back to `bills.json` by the monitor.** Entries
  have been found stale (`watching` despite `hasFloorVote: true`). Don't trust a
  stored priority without checking the status flags. *(Open audit item.)*

## Design authority

`representdc-main/DESIGN-GUARDRAILS.md` is the single source of truth for all three
RepresentDC sites — navy is the workhorse, red is rationed, Lucide icons only, no
emoji, sentence case, "D.C." with periods in body copy, hero capped at 3 blocks.

**Read it at the start of any Lane B batch and again before finalizing** — it lives
in a repo that is often being edited by a parallel thread. Do not write to it from
here; hand any needed change to that thread.

## Content integrity (non-negotiable)

`METHODOLOGY.md` governs classification. Beyond it:

- Every factual claim needs a verified primary source. Never let a sub-agent
  introduce a bill status, vote count, or sponsor attribution it did not verify.
- Auto-discovered bills are `provisional: true` and excluded from every published
  count until a human reviews them. Never clear that flag inside a batch without an
  explicit decision.
- `supportBills` is for bills giving DC or its advocates **real leverage** — not
  symbolic recognition (decided 2026-07-27, see `decisions/`).
- Published counts have two consumers: this UI and `representdc-main`'s
  `useBillStats.js` fetch of `stats.json`. They must derive from one filter.

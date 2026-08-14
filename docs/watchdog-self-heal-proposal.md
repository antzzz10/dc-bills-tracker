# Watchdog self-heal — design v4 (final)

**Status:** Design record, implemented 2026-08-14. v1–v3 were reviewed by Codex
(read-only sandbox, web search enabled) on 2026-08-14; v4 incorporates all findings from
all three rounds plus three owner decisions. Written to be readable with no prior context
on the conversations that produced it.

**Review history:**
- v1 → 3 High (permissions would break checkout; dispatch cancels healthy runs under
  `cancel-in-progress: true`; failed dispatch suppresses the alert), 2 Medium.
- v2 → 3 High (GitHub docs do not define whether a runner-queued run holds the
  concurrency group, and document no hosted-runner queue timeout — so the v2 ship-gate
  was unsatisfiable as posed; v2's "never dispatch while a run is active" rule left a
  stuck-queued run unhealed forever; count-limited history queries break
  one-retry-per-episode), 2 Medium (match `displayTitle` not `.name`; email exclusivity
  needs explicit precedence).
- v3 → 1 High (no conditional "cancel only if still queued" API exists, so
  never-cancel-in-progress cannot be absolute — resolved by explicitly accepting a
  bounded race, §7.1), 3 Medium (reclassify after cancellation; the one-dispatch
  invariant is not transactional; email path was fail-open on crashed steps). Codex also
  confirmed `gh run list --created ">TIMESTAMP"` filters on run creation time.

---

## 1. The system, in brief

`billtracker.representdc.org` is a static React/Vite site on GitHub Pages tracking anti-DC
bills in Congress. Volunteer-run; the owner has explicitly said they do **not** have time for
periodic manual checks and wants automation plus audit.

Relevant workflows in `.github/workflows/`:

| workflow | schedule | what it does |
|---|---|---|
| `monitor-bills.yml` | `0 14 * * *` | fetches bill status from Congress.gov, runs gates, commits, rebuilds, deploys, emails a summary |
| `data-freshness-check.yml` | `0 8 * * *`, `0 20 * * *` | reads `src/data/bills.json` → `lastChecked`; if older than 36h, emails an alert and fails the run |
| `fetch-news.yml` | `0 6,18 * * *` | fetches news; commits, rebuilds, and redeploys **only when the news file changed** (`fetch-news.yml:37-39`) |
| `discover-bills.yml` | weekly | finds new DC-related bills |

`monitor-bills.js` stamps `bills.json.lastChecked` only when a run is healthy — strictly
`errorRate > 0.25` fails the check (`monitor-bills.js:1041`; exactly 75% success counts as
healthy) — **and** `changes.length > 0` (`monitor-bills.js:1060`). Note the naming trap:
`changes` holds every successful lookup, not just meaningful diffs, so the second condition
means "at least one lookup succeeded." That stamp is the single source of truth for
freshness and is what the watchdog reads. Because `fetch-news.yml` can redeploy the site on
days when bill data was never verified, the site can *look* current while bill data is
stale — which is why the watchdog exists.

## 2. The problem

Twice in two weeks a scheduled `monitor-bills` run never acquired a GitHub-hosted runner:

| date | outcome |
|---|---|
| 2026-07-25 | sat `queued` 4h39m without a runner, cancelled |
| 2026-08-06 | `"The job was not acquired by Runner of type hosted even after multiple attempts"`, failed at 15m51s |

Neither was caused by our code or data. In both cases the watchdog correctly fired,
emailed, and then **waited for a human** to notice and re-dispatch by hand. Each incident
cost roughly 44 hours of data freshness. Manual re-dispatch acquired a runner in 9–13
seconds, so a second attempt is very likely to succeed.

**The gap:** the only remaining manual link in the pipeline is a human reading an email
and clicking "run workflow".

## 3. Verified platform facts

Established across the two review rounds, from current GitHub documentation (not memory):

1. **The built-in `GITHUB_TOKEN` can dispatch `monitor-bills.yml` and the run will
   start.** `workflow_dispatch`/`repository_dispatch` are documented exceptions to
   `GITHUB_TOKEN` recursion suppression. The REST endpoint requires `Actions: write`.
   No PAT is needed.
2. **Declaring any `permissions` zeroes the rest.** The watchdog checks out the repo, so
   it needs `actions: write` **and** `contents: read`.
3. **There is no documented queue timeout for GitHub-hosted runners.** The 24h queue
   limit applies only to self-hosted runners; the 6h limit is execution time;
   `timeout-minutes` counts only after the job starts. A run stuck in `queued` has no
   platform-guaranteed end.
4. **Concurrency semantics for queued members are undocumented.** With
   `cancel-in-progress: false`, docs define in-progress and pending members, but not
   whether a runner-queued run occupies the group's in-progress slot. **v3 therefore
   depends on neither behavior**: it never dispatches while any monitor run is active,
   and it clears aged stuck-queued runs itself via the documented run-cancel API (which
   accepts queued and in-progress runs).
5. An accepted dispatch proves only that a run was created — not that a runner acquired
   it or that it completed. The state machine accounts for that.
6. **There is no conditional cancel.** `gh run cancel` hits the ordinary run-cancel
   endpoint, which accepts queued *and* in-progress runs, with no way to say "only if
   still queued." Any read-then-cancel sequence has an unavoidable race (§7.1).

## 4. Design v4

### 4a. Changes to `monitor-bills.yml`

1. **Concurrency** (owner decision, 2026-08-14):

   ```yaml
   concurrency:
     group: monitor-bills
     cancel-in-progress: false
   ```

   A dispatch can no longer cancel an in-progress run (v1's fatal flaw). The job `true`
   was originally protecting against — a stuck-queued run lingering indefinitely — is now
   handled explicitly by the watchdog (§4b.2), which is strictly better: `true` cleared
   stuck runs only as a side effect of the *next* trigger, relying on the same
   undocumented queued-member semantics.

2. **Recovery identification without persistent state.** New dispatch input, reflected in
   the run's display title:

   ```yaml
   on:
     workflow_dispatch:
       inputs:
         dry_run: ...            # existing, unchanged
         recovery_source:
           description: 'What triggered this dispatch (watchdog sets "watchdog")'
           type: string
           default: manual

   run-name: >-
     ${{ github.event_name == 'workflow_dispatch' && inputs.recovery_source == 'watchdog'
         && 'Monitor DC Bills (watchdog recovery)'
         || 'Monitor DC Bills' }}
   ```

   On `schedule` events `inputs` is empty, so the expression falls through to the plain
   name. **Matching rule (per v2 review):** a recovery is a run with
   `displayTitle == 'Monitor DC Bills (watchdog recovery)'` **and**
   `event == 'workflow_dispatch'` — never `.name`, which stays `Monitor DC Bills` for
   every run.

No other changes to `monitor-bills.yml`, and **no changes to `monitor-bills.js`**.

### 4b. Changes to `data-freshness-check.yml`

Add `permissions: { actions: write, contents: read }`. Keep the existing freshness
evaluation and keep failing the run whenever data is stale. On the stale branch:

1. **Classify step** (`id: monitor_state`, `continue-on-error: true`) — one script that
   queries and emits a single `state` output (the exclusivity guarantee: downstream steps
   key on this one value, so states are mutually exclusive by construction):

   ```bash
   gh run list --workflow=monitor-bills.yml --branch main \
     --created ">${LAST_CHECKED}" --limit 100 \
     --json databaseId,displayTitle,event,status,conclusion,createdAt
   ```

   - **Server-side `--created` filter, not a bare recent-count** (per v2 review): the
     episode is defined as runs created after `lastChecked`, so the query window equals
     the episode by construction. `--limit 100` is a safety bound, not the filter: an
     episode accrues ~2–4 runs/day (one schedule, occasional dispatches), so 100 covers
     several weeks of staleness; if the filtered list ever hits 100, treat as
     `indeterminate` rather than trusting it.
   - If `lastChecked` is absent entirely (never stamped): needs-human, no dispatch —
     same as today's behavior.
   - Derived facts: `in_progress_run` (status `in_progress`); `young_queued_run` (status
     `queued`/`waiting`/`pending`/`requested`, created < 2h ago); `stuck_queued_run`
     (same statuses, created ≥ 2h ago — healthy runs acquire runners in seconds, and
     both real incidents exceeded 2h or died trying); `recovery_attempted` (a completed
     run matching §4a.2's rule).
   - Any query/parse failure → `state=indeterminate`. **"Unable to determine" is never
     "safe to dispatch."**

   Precedence (first match wins):

   ```
   query failed or list truncated        → indeterminate  (S5)
   in_progress run exists                → active         (S1)
   young queued run exists               → active         (S1)
   stuck queued run exists               → stuck          (S1b — proceed to step 2)
   recovery_attempted this episode       → recovery_done  (S3)
   otherwise                             → dispatchable   (S2 — proceed to step 3)
   ```

2. **Clear-stuck step** (`id: clear_stuck`, only when `state == 'stuck'`,
   `continue-on-error: true`) — owner decision, 2026-08-14:
   - **Re-query the specific run by id immediately before acting**: if it has started
     running or completed in the interim, do not cancel.
   - Still queued ≥ 2h → `gh run cancel <id>`, then poll briefly until its status is
     `completed`. Cancel fails or never confirms → `cancel_failed`, loud email, **no
     dispatch** (dispatching behind an uncleared queued run has undocumented semantics —
     see §3.4).
   - The watchdog only ever targets runs of `monitor-bills.yml` on `main` with an active
     queued-type status and age ≥ 2h. It never *intends* to cancel an `in_progress` run;
     the residual race where one is hit anyway is accepted and bounded — see §7.1.
   - **After any cancellation (and after the do-not-cancel downgrade), the full episode
     classification from step 1 is re-run from scratch** (per v3 review): dispatch
     happens only if the *fresh* classification is `dispatchable`. This handles multiple
     stuck runs, runs that appeared or changed status during cancellation, and a
     re-queried run that turned out to be completed. A cancelled *recovery* still counts
     as a completed recovery in the fresh classification, preserving
     one-retry-per-episode.

3. **Dispatch step** (`id: dispatch`, `continue-on-error: true`) — only when the
   effective (freshest) state is `dispatchable`:

   ```yaml
   env:
     GH_TOKEN: ${{ github.token }}
   run: gh workflow run monitor-bills.yml --ref main -f recovery_source=watchdog
   ```

   Nonzero exit → `dispatch_failed`. On success, poll (short sleep + episode-filtered
   `gh run list` on the recovery displayTitle) until the created run is **visible in the
   episode query**, and put its URL in the email; fall back to the workflow's run-list
   URL if it never appears. Waiting for visibility is what closes (to ~zero, for
   scheduled operation) the window in which a subsequent watchdog check could classify
   before the recovery exists — see §7.2.

4. **Fail-closed final-state resolver** (`id: resolve`, `if: always()`) — per v3 review:
   `continue-on-error` does not create outputs when a script dies before writing them,
   and step outputs are immutable, so independent per-step email guards are fail-*open*
   (a crashed classify/cancel/dispatch step would produce **zero** emails). Instead, one
   resolver step reads every prior step's outputs and outcomes and computes a single
   `final_state`, defaulting anything missing or unknown to `indeterminate`. A crashed
   freshness evaluation resolves the same way (today it produces a red run with no
   email). Every email step keys on `resolve.outputs.final_state` alone — exclusivity
   and at-least-one-signal are both structural.

5. **Email steps** — one per final state, each `if: always() && resolve.outputs.final_state == '<state>'`.

### 4c. State machine — exactly one signal per state

| state | meaning | action | email |
|---|---|---|---|
| `fresh` | data fresh | none | none (unchanged) |
| `active` (S1) | stale; a monitor run is in progress, or queued < 2h, or a stuck run just started when re-queried | none | informational: "a run is active — expected to heal itself"; link |
| `dispatched` (S2) | stale; no active run; no recovery this episode (a stuck run may have been cleared first); dispatch succeeded | dispatch once | informational: "recovery dispatched"; link to created run |
| `recovery_done` (S3) | stale; a recovery this episode already completed (any conclusion — failed, cancelled, or green-but-never-stamped) | none | **loud: human needed** |
| `dispatch_failed` (S4) | stale; dispatch attempted just now and failed | — | **loud: human needed** — the self-heal itself is broken |
| `indeterminate` (S5) | stale; cannot read monitor state | none | **loud: human needed** — the watchdog is blind |
| `cancel_failed` (S6) | stale; stuck-queued run could not be cleared | none | **loud: human needed** — a wedged run is blocking recovery |

One-retry-per-episode (owner decision, 2026-08-14): at most one automatic dispatch per
stale episode; an episode ends when `lastChecked` advances, which re-arms S2. No cooldown
retry. A stuck *recovery* that gets cancelled at 2h counts as completed → next check is
S3, not a second dispatch.

**Scope of the invariant** (per v3 review): "at most one dispatch per episode" holds for
scheduled operation. It is not transactional — GitHub offers no atomic
"check-history-and-create-run." Two windows exist: (a) a manual watchdog dispatch landing
in the seconds between another watchdog's dispatch-accept and the created run becoming
visible (the visibility wait in §4b.3 shrinks this to ~zero); (b) API list-visibility
delay generally. Worst case in either window is a duplicate *idempotent* recovery run
queued serially behind the first (monitor concurrency is `false`) plus a duplicate
informational email — bounded and harmless, so no persistent state is warranted.

Loop analysis: the watchdog never triggers itself; the monitor never triggers the
watchdog; S2 fires at most once per episode (episode lookup is exhaustive by
construction). Worst case in a persistent outage: one doomed recovery run per episode,
plus at most one cancel per stuck run, plus two loud emails/day from the scheduled
checks — bounded, and the correct volume for "human needed."

Both motivating incidents now heal automatically: 08-06 (run failed) → next check is S2 →
dispatch; 07-25 (run stuck queued 4h39m) → next check is S1b → cancel → S2 → dispatch.

## 5. The alternative rejected in v1 (unchanged)

A second cron on `monitor-bills.yml` with a fresh-guard step remains rejected: it
duplicates the staleness derivation (this codebase has been bitten twice by duplicated
derivations drifting), and a daily do-nothing run invites the documented alert-fatigue
failure mode. An alert that fires when nothing is wrong is worse than none.

## 6. Questions resolved across reviews

1. `GITHUB_TOKEN` dispatch starts a run — **yes**, documented (v1 review).
2. Loop/thundering-herd — closed by one-retry-per-episode with an exhaustive
   `--created`-filtered episode query (v2 review closed the count-limit hole).
3. `cancel-in-progress: true` interaction — disqualifying; flipped to `false`, with the
   stuck-queued case `true` used to paper over now handled explicitly (v2 review + owner
   decision).
4. "Previous recovery failed" without state — yes: `recovery_source` input →
   `run-name`/`displayTitle`, matched with `event == 'workflow_dispatch'`, scoped by
   `created > lastChecked`.
5. Stuck-queued semantics under `false` — **undocumented, and deliberately not relied
   on**: v3 never dispatches while anything is active and clears aged queued runs via
   the documented cancel API.

## 7. Accepted residual risks (owner-visible, by design)

1. **The cancellation race (v3 High finding, accepted 2026-08-14).** No conditional
   cancel API exists, so between the by-id re-query and the cancel call (a window of
   seconds), a run starved for ≥ 2 hours could acquire a runner and be cancelled while
   `in_progress`. Why this is acceptable: the trigger probability is a runner acquisition
   landing in a specific few-second window after 2+ hours of starvation; and the blast
   radius is bounded because the monitor is idempotent and the watchdog immediately
   reclassifies and dispatches a recovery that redoes the same day's check — worst case
   is a few wasted runner-minutes and one extra email, never lost data. The alternative
   (no auto-cancellation) leaves 07-25-type incidents needing a human, which contradicts
   the project's automate-and-audit rule.
2. **One-dispatch-per-episode is near-absolute, not transactional** (§4c). Duplicate
   recoveries require a manual watchdog dispatch in a ~zero-width window; consequence is
   a serialized duplicate idempotent run.
3. **The 2h stuck threshold is policy, not proof.** GitHub documents no hosted-runner
   acquisition SLA. The threshold is grounded in this repo's observed behavior (healthy
   acquisition in 9–13s; both incidents ≥ 2h effective loss) and only affects runs
   created shortly before a check — at the 20:00 check, a stuck 14:00 run is already 6h
   old.
4. **Email delivery itself can fail** (SMTP outage). The run still goes red in the
   Actions UI in every stale state, which is the second, independent signal.

## 8. Files a reviewer should read

- `.github/workflows/data-freshness-check.yml` — the watchdog to be modified
- `.github/workflows/monitor-bills.yml` — the dispatch target; note `concurrency`,
  `timeout-minutes: 20`, and the existing `dry_run` input
- `scripts/monitor-bills.js` — search `lastChecked` (~line 1055) for the stamping rule
- `WHATS-NEXT.md` — records the *rejected* retry-cron design; will be revised at ship time

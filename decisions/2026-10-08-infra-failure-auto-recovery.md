# Decision: automatic recovery from GitHub infrastructure failures (monitor + discovery)

**Date:** 2026-10-08
**Status:** Implemented on branch `automation-self-heal`; pending live verification
**Trigger:** The 2026-10-05 weekly discovery scan was created 8h late, then GitHub never
gave it a runner ("The job was not acquired by Runner of type hosted even after multiple
attempts"). None of our code ran. The discovery watchdog, which only sends alerts by
design, emailed "human needed" every 12h until Andria asked; a manual dispatch passed in
5 minutes. This was the third runner-starvation incident (2026-07-25 and 2026-08-06 hit
the monitor, which already self-heals).

## Decisions (Andria, 2026-10-08: "A–E, with F separate")

**A. Discovery deploys only what it saved.** The deploy step keyed on the resolver's
`healthy` flag under `always()`, so a push that lost a race still published the run's
unsaved local snapshot (found by Codex). It now requires the commit step's success. A
failed save sends its own email ("safe to re-run"). Discovery runs are serialized
(`concurrency: discover-bills`, never cancelling a running scan), because each scan
dedupes against its own checkout.

**B. Discovery gets narrow self-heal.** This partly reverses
`2026-08-14-discovery-alerting.md` item 2. That decision declined auto-dispatch because
the failures seen so far were code/data bugs where a retry repeats the failure, and that
reasoning still holds for that class. So discovery recovers automatically (once per stale
episode) **only** when the scheduled scan never ran or GitHub never gave it a runner
(`scripts/discovery-recovery-gate.sh`). A scan that ran and failed escalates immediately,
naming the failed step. The monitor keeps its broader 08-14 policy (any stale episode →
one dispatch), since its transient Congress.gov failures can be helped by a retry.

**C. Immediate retry of runner-acquisition failures** (`retry-infra-failure.yml`,
`workflow_run`). This recovers in minutes instead of at the next twice-daily watchdog
check (about 1.5 days for discovery). Its guardrails come from Codex review:
- **Scheduled runs on `main` only.** A manual or dry run is never revived, because
  re-dispatching loses its inputs and would turn a test into a live commit + deploy.
- **Positive evidence required** (`scripts/infra-failure-check.sh`, attempt-specific jobs
  API). Every job must be completed and unsuccessful, have no runner, and have executed
  zero steps, **and** carry GitHub's "not acquired by Runner" annotation. Zero steps
  alone is not enough, because a run cancelled by hand or replaced in a concurrency queue
  looks identical. An empty job list, an API error or mixed evidence returns `unknown`,
  which is never retried. Validated against real history: both August/October
  starvations → `true`; the hand-cancelled 07-25 run → `unknown`; healthy runs and the
  three July lint failures → `false`.
- **One shared budget.** Both controllers dispatch under the same run-name
  (`… (watchdog recovery)`), write the same per-episode recovery fence before
  dispatching (see Process), classify through the same `scripts/watchdog-classify.sh`,
  and share concurrency group `automatic-recovery` (`cancel-in-progress: false`; the
  retrier's group is job-level, so its skipped no-op runs can't displace a pending
  watchdog). Result: one automatic recovery per stale episode, whichever controller acts
  first. This is not transactional; history lookup + dispatch is not atomic, and
  pending-run replacement in the group can drop a queued controller run. Both residual
  risks are bounded by the next watchdog check.
- **Audit-only.** The retrier never emails.

**D. Only actionable states email or turn the watchdog red.** "Recovery in flight" and
"recovery dispatched" used to email "no action needed". They now appear only as a
warning and in the run summary, and the run stays green. Escalation emails state the
cause class (GitHub vs. our code/data, from the failed recovery or scheduled run), what
was already tried, and the one action to take, with a direct link. We did **not** build
once-per-episode email dedup (a persisted notification ledger). Once B and C exist, a
repeating alert means a human is genuinely needed, and a 12-hourly reminder is then
acceptable. Codex's design for such a ledger, if it is ever needed: a JSON artifact,
written only after SMTP succeeds, where missing state means "send".

**E. Crons moved off :00**, because GitHub's scheduler is most congested there:
discovery Mon 12:23, monitor 13:41, news 06:07/18:07, watchdog 08:17/20:17 UTC. Observed
lateness before the change was 3–8h on every schedule. Ordering is best effort, so all
decisions rest on stamps and live run state. The discovery deadline is now
slot-based: stale = no healthy scan since the latest Monday 12:23 slot plus 18h of grace
(deadline Tue 06:23), instead of a flat 192h. A missed slot stays stale across later
Mondays.

**F (separate change, not in this branch):** pin `ubuntu-24.04` ahead of the Ubuntu 26
`ubuntu-latest` migration (2026-10-19 to 11-19) and upgrade action majors deliberately.

## Rejected alternatives
- Treat zero-runner + zero-steps as sufficient proof → rejected (false positives above).
- Retry any failed discovery run → rejected (08-14 reasoning; a doomed retry is noise).
- Separate retry budgets per controller → rejected (could double-dispatch an episode).
- Committed state file for email dedup → rejected (writer contention on main, broader
  permissions).
- Email on episode open + escalation + resolution → rejected as noise.

## Accepted limits
- Everything runs on GitHub-hosted runners, the same infrastructure that fails. An
  Actions-wide outage can't be self-detected or repaired; recovery happens when
  capacity returns.
- GitHub's own "workflow run failed" notifications for the original failed run are
  GitHub account settings, outside this repo.

## Process
Plan reviewed by Codex at medium and high reasoning (both "revise": 5 High, 0 Critical;
all adopted). Implementation-diff review, same two levels (both "fix first": 1–2 High,
3–4 Medium; all fixed):
- **API failure read as "missing run".** The discovery gate and the infra check piped
  `gh` into `jq` without `pipefail`, so a failed query could authorize a dispatch. API
  success is now checked separately from parsing, the jobs response must be complete
  (`total_count`), and `runner_id` must be present and exactly 0.
- **Unconfirmed dispatch reported as success.** The run URL returned by `gh workflow run`
  confirms the exact run, with polling as the fallback. If neither confirms it, the state
  is `dispatch_unconfirmed`, which emails and turns the run red.
- **Stale checkout stamps.** Every dispatch/escalation decision re-reads the stamp from
  `main` (`scripts/read-live-stamp.sh`). A healthy run landing mid-check resolves as
  `recovered`; an unreadable stamp resolves as `indeterminate`, never as an action.
- **A stuck discovery run cancelled by the watchdog** is passed to the gate as
  `cause=stuck` (recoverable) instead of escalating as unknown.
- **Missing email body.** A quiet-week save failure, or a resolver crash, could leave
  no HTML file, so the mail step failed and sent nothing. Both now always have a body.

Second implementation review (both levels: "fix first"). Fixed:
- **A discovery email fallback had landed in the monitor job** (separate runner, so it
  never helped). It has been moved.
- **"Clear step succeeded" was treated as "the watchdog cancelled this run".** A run that
  finished on its own, or that someone else cancelled, could then skip diagnosis. A
  `cancelled_run_id` receipt is now emitted only after this script cancels the run
  and confirms it completed.
- **"Stamp advanced on main" was treated as "fresh".** Staleness is now recomputed from
  main's stamp; advanced-but-still-stale resolves `indeterminate` (actionable).
- **The retrier now re-reads main immediately before dispatching** (`recovered` /
  `recheck_failed`).

**Disagreement, then resolved by evidence (Codex High, rounds 2–3).** Codex asked for
a persisted dispatch receipt so that a dispatched run that GitHub's run list doesn't
show yet can't be dispatched again. Claude first argued for a lighter fix: hold the
shared lock until the run is visible, and call the residual "at most one redundant
run". Round 3 reproduced that this bound did not exist: with the run list degraded,
every later controller (watchdog twice a day, plus the retrier on each failure) would
dispatch again, without limit. Adopted: a **recovery fence**. Before dispatching, a
controller uploads a small artifact named for the episode
(`recovery-fence-<monitor|discovery>-<episode start, epoch s>`), and the classifier
treats an unexpired fence as "budget spent". Order: live re-check → fence → dispatch.
If the fence can't be written, nothing is dispatched (an alert follows), and an
artifacts-API failure classifies as `indeterminate`. Because the name is keyed to the
episode, a fence can never spend a later episode's budget.

Round 4 (fence only; medium: ready for live test, high: one open point) confirmed that
writer and reader keys match and that v4 artifacts are listable immediately. Two
properties are accepted deliberately:
- **The bound is one automatic recovery per episode per 30 days, not a lifetime one.**
  Fences expire (retention 30 days), and GitHub no longer lists expired artifacts, so
  an episode still stale after a month gets one more attempt each month. By then the
  watchdog has been escalating twice a day for a month; a monthly retry is harmless
  and arguably useful. A lifetime cap would need storage outside Actions.
- **The fence is a reservation.** If it is written and the dispatch then fails or the
  controller dies, that episode gets no automatic recovery. The watchdog escalates
  (`dispatch_failed` / `recovery_done`), so this is fail-closed, never silent.

Verification (local, before commit):
- actionlint + shellcheck clean on all new code. The remaining shellcheck
  info/style notes are in pre-existing steps.
- `infra-failure-check.sh` against real run history: 10-05 and 08-06 starvations →
  `true`; 07-25 hand-cancelled → `unknown`; a healthy run and the July lint failures →
  `false`.
- A mocked `gh` for API failure, partial/incomplete/empty job lists, null runner_id,
  annotation failure, dispatch with/without a returned URL and lagging/never-visible
  runs, and stuck runs cancelled by us vs. finished on their own. Every unknown
  escalates, and only a confirmed cancellation yields a receipt.
- Both resolvers extracted from the YAML and run for every final state. The
  discovery deadline maths was run against 11 simulated clocks.

Not yet verified: a live end-to-end run (needs push), and a real `workflow_run`
delivery for a runner-starved run (can't be produced on demand; GitHub documents
that completion fires for any created run).

# Decision: watchdog self-heal for the bill monitor

**Date:** 2026-08-14
**Status:** Decided and implemented
**Full design record:** `docs/watchdog-self-heal-proposal.md` (v4 — kept as the living
spec; this note records the decisions and why)

## Problem

Twice in two weeks (2026-07-25 stuck-queued 4h39m; 2026-08-06 runner never acquired) a
scheduled `monitor-bills` run died to GitHub runner starvation. The freshness watchdog
emailed correctly both times, but recovery still required a human to read the email and
click "run workflow" — ~44h of data staleness each time, against the project's standing
rule that a design ending in "you check the email and click run" isn't finished.

## Process

Claude drafted the design; OpenAI Codex (read-only sandbox, web search on) reviewed it
three times, each round verified against the repo and current GitHub documentation.
Every High finding was either fixed or explicitly accepted with bounded blast radius.
The premise that gated everything — can the built-in `GITHUB_TOKEN` dispatch a workflow
run at all? — is now **verified yes** (documented exception to recursion suppression;
no PAT needed).

## Decisions (all Andria, 2026-08-14)

1. **Concurrency on `monitor-bills`: `cancel-in-progress: false`** — a recovery dispatch
   must never cancel an in-progress run. Chosen over keeping `true` + pre-dispatch check
   (race-prone) after Codex established the docs are silent on queued-member semantics.
2. **One automatic dispatch per stale episode** — stale → dispatch once + informational
   email; still stale after a completed recovery → loud human-needed email, no cooldown
   retries. Chosen over a 24–48h retry cooldown to protect signal integrity (alert-fatigue
   history in this repo).
3. **The watchdog cancels aged stuck-queued runs** (≥2h in queue; re-query by id first;
   never targets in-progress runs) — chosen over "keep true" and over "humans keep the
   stuck-queued case", because GitHub documents **no queue timeout for hosted runners**,
   so a wedged run has no platform-guaranteed end and would otherwise block recovery
   forever.

## Accepted residual risk (explicit)

No conditional "cancel only if still queued" API exists, so there is a seconds-wide race
in which a run starved ≥2h could start and be cancelled while running. Accepted because
the monitor is idempotent and the recovery dispatched immediately after redoes the same
check — worst case is wasted runner-minutes and one extra email, never lost data.

## What was rejected

A second cron on `monitor-bills.yml` with a fresh-guard step (duplicate staleness
derivation, quiet-day red runs — see design record §5). `WHATS-NEXT.md` previously
recorded that rejected shape as the plan; corrected in the same change.

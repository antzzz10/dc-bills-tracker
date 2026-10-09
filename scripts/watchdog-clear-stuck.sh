#!/usr/bin/env bash
# Cancel a run wedged in the queue, then RECLASSIFY from scratch.
#
# A run queued past STUCK_THRESHOLD_HOURS is presumed wedged (2026-07-25: 4h39m in
# `queued`). Re-query by id immediately before acting, cancel only if still queued,
# confirm, then hand back a fresh full classification — dispatch happens only if that
# says dispatchable. Residual race (the run starts in the seconds between re-query and
# cancel) is accepted and bounded: both watched workflows are idempotent and the
# recovery dispatched right after redoes the same work. Design record §7.1.
#
# Env in:  STUCK_RUN_ID plus everything watchdog-classify.sh reads.
# Stdout:  GITHUB_OUTPUT-style lines: `state=cancel_failed`, `state=indeterminate`, or
#          watchdog-classify.sh's output, preceded by `cancelled_run_id=` only when
#          this script itself cancelled the run and confirmed it completed.
# Exit:    always 0.

set -u
HERE="$(cd "$(dirname "$0")" && pwd)"

if ! STATUS=$(gh run view "$STUCK_RUN_ID" --json status -q .status); then
  echo "state=indeterminate"
  exit 0
fi
if [ "$STATUS" != "in_progress" ] && [ "$STATUS" != "completed" ]; then
  echo "Cancelling run $STUCK_RUN_ID (status: $STATUS)" >&2
  if ! gh run cancel "$STUCK_RUN_ID" >&2; then
    echo "state=cancel_failed"
    exit 0
  fi
  for _ in $(seq 1 12); do
    sleep 5
    STATUS=$(gh run view "$STUCK_RUN_ID" --json status -q .status || echo unknown)
    [ "$STATUS" = "completed" ] && break
  done
  if [ "$STATUS" != "completed" ]; then
    echo "state=cancel_failed"
    exit 0
  fi
  # Receipt: THIS script cancelled the run and saw it complete. Only this lets the
  # discovery gate treat the run as "GitHub never started it" — a run that finished, or
  # was cancelled by someone else, in the meantime gets no receipt and is diagnosed.
  echo "cancelled_run_id=$STUCK_RUN_ID"
fi
# In every non-error path — cancelled, already completed, or started running in the
# interim — the answer is a fresh full classification, never a guess.
bash "$HERE/watchdog-classify.sh"

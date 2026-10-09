#!/usr/bin/env bash
# Decide whether stale discovery is worth ONE automatic recovery, or needs a human now.
#
# Discovery's past failures were code/data bugs that a retry repeats identically
# (decisions/2026-08-14-discovery-alerting.md), so recovery is narrow: dispatch only when
# the scheduled scan never ran (schedule dropped) or GitHub never gave it a runner.
# If the latest scheduled scan ran and failed, escalate immediately with its diagnosis.
# Called only after watchdog-classify.sh said `dispatchable` (nothing active, no recovery
# yet this episode). Decision record: decisions/2026-10-08-infra-failure-auto-recovery.md.
#
# Env in:  LAST_CHECKED (discovery episode start), GITHUB_REPOSITORY, GH_TOKEN,
#          CLEARED_RUN_ID (optional: a run this watchdog just cancelled as stuck)
# Stdout:  `gate=dispatch|escalate`, `cause=missing|infra|code_failure|unknown`,
#          `reason=`, and for a run that exists: `failed_run_url=`, `failed_step=`.
#          cause=stuck when the latest scheduled run is the one the watchdog cleared.
# Exit:    always 0. Unknown evidence escalates; it never dispatches.

set -u
set -o pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"

escalate_unknown() { echo "gate=escalate"; echo "cause=unknown"; echo "reason=$1"; exit 0; }

CREATED_AFTER=$(printf '%s' "${LAST_CHECKED:-}" | sed -E 's/\.[0-9]+Z$/Z/')
[ -n "$CREATED_AFTER" ] || escalate_unknown "no discovery stamp to define the episode"

# Scheduled runs only: a manual dry run or test dispatch says nothing about the schedule.
# API success is checked separately from JSON processing: a failed history query must
# escalate, never read as "no run" (which would dispatch).
if ! RUNS=$(gh run list --workflow=discover-bills.yml --branch main --event schedule \
    --created ">${CREATED_AFTER}" --limit 100 \
    --json databaseId,status,conclusion,createdAt,url); then
  escalate_unknown "could not read discovery run history"
fi
if ! COUNT=$(jq -e 'length' <<<"$RUNS" 2>/dev/null); then
  escalate_unknown "unparseable discovery run history"
fi
[ "$COUNT" -lt 100 ] || escalate_unknown "discovery run history truncated at 100 runs"
if ! LATEST=$(jq -c '[.[] | select(.status == "completed")] | sort_by(.createdAt) | last // empty' <<<"$RUNS"); then
  escalate_unknown "unparseable discovery run history"
fi

if [ -z "$LATEST" ]; then
  echo "gate=dispatch"
  echo "cause=missing"
  echo "reason=no scheduled discovery run has completed since the last healthy scan (GitHub dropped or never created it)"
  exit 0
fi

RUN_ID=$(jq -r '.databaseId' <<<"$LATEST")
RUN_URL=$(jq -r '.url' <<<"$LATEST")
echo "failed_run_url=$RUN_URL"

# The watchdog itself just cancelled this run as wedged in the queue: that is GitHub
# failing to start it, so it is recoverable (it carries no runner annotation, since
# the cancellation, not GitHub, ended it).
if [ -n "${CLEARED_RUN_ID:-}" ] && [ "$RUN_ID" = "$CLEARED_RUN_ID" ]; then
  echo "gate=dispatch"
  echo "cause=stuck"
  echo "reason=the scheduled scan sat in GitHub's queue past ${STUCK_THRESHOLD_HOURS:-2}h without a runner; the watchdog cancelled it"
  exit 0
fi

# A green scheduled run that still didn't advance the stamp is contradictory evidence.
if [ "$(jq -r '.conclusion' <<<"$LATEST")" = "success" ]; then
  escalate_unknown "latest scheduled run succeeded but the discovery stamp did not advance"
fi

INFRA_OUT=$(bash "$HERE/infra-failure-check.sh" "$RUN_ID")
INFRA=$(sed -n 's/^infra=//p' <<<"$INFRA_OUT")
REASON=$(sed -n 's/^reason=//p' <<<"$INFRA_OUT")
FAILED_STEP=$(sed -n 's/^failed_step=//p' <<<"$INFRA_OUT")

case "$INFRA" in
  true)
    echo "gate=dispatch"; echo "cause=infra"; echo "reason=$REASON" ;;
  false)
    echo "gate=escalate"; echo "cause=code_failure"; echo "failed_step=$FAILED_STEP"; echo "reason=$REASON" ;;
  *)
    escalate_unknown "${REASON:-infra check gave no answer}" ;;
esac
exit 0

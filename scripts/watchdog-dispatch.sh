#!/usr/bin/env bash
# Dispatch one automatic recovery run of WORKFLOW_FILE on main.
#
# The run is identified later by its run-name (RECOVERY_TITLE), which is what bounds
# recovery to one automatic dispatch per episode. dry_run is passed explicitly: a
# recovery is always a live run, never an inherited test setting.
#
# The budget is only held once the recovery is VISIBLE in the episode query that both
# controllers classify from. So this script does not return `dispatched` until it is:
# both controllers share one concurrency group, and this controller keeps holding it
# while it waits — the next one cannot classify until the run is visible. When
# `gh workflow run` returns the created run's URL, that exact run id is what must
# appear. A run that never becomes visible within ~2 minutes is `dispatch_unconfirmed`:
# actionable (email + red), never reported as success. A later controller cannot
# dispatch again for the same episode even if visibility lags further: the caller
# writes the episode's recovery fence before calling this script, and the classifier
# treats that fence as "budget spent" (decisions/2026-10-08-infra-failure-auto-recovery.md).
#
# Env in:  WORKFLOW_FILE, RECOVERY_TITLE, RECOVERY_SOURCE (watchdog | infra-retry),
#          LAST_CHECKED (episode start), GITHUB_REPOSITORY, GH_TOKEN
# Stdout:  `state=dispatched` + `run_url=`, `state=dispatch_unconfirmed` (+ `run_url=`
#          when known), or `state=dispatch_failed`.
# Exit:    always 0.

set -u
set -o pipefail

if ! OUT=$(gh workflow run "$WORKFLOW_FILE" --ref main \
    -f recovery_source="$RECOVERY_SOURCE" -f dry_run=false 2>&1); then
  echo "$OUT" >&2
  echo "state=dispatch_failed"
  exit 0
fi
echo "$OUT" >&2

RETURNED_URL=$(grep -oE "https://github\.com/[^ ]+/actions/runs/[0-9]+" <<<"$OUT" | head -1 || true)
RETURNED_ID="${RETURNED_URL##*/}"

CREATED_AFTER=$(printf '%s' "$LAST_CHECKED" | sed -E 's/\.[0-9]+Z$/Z/')
for _ in $(seq 1 20); do
  sleep 6
  if ! RUNS=$(gh run list --workflow="$WORKFLOW_FILE" --branch main \
      --created ">${CREATED_AFTER}" --limit 100 \
      --json databaseId,displayTitle,event,url,createdAt); then
    continue
  fi
  VISIBLE=$(jq -r --arg t "$RECOVERY_TITLE" --arg id "$RETURNED_ID" '
      [.[] | select(.displayTitle == $t and .event == "workflow_dispatch")
           | select($id == "" or (.databaseId | tostring) == $id)]
      | sort_by(.createdAt) | last.url // empty' <<<"$RUNS" 2>/dev/null || true)
  if [ -n "$VISIBLE" ]; then
    echo "state=dispatched"
    echo "run_url=$VISIBLE"
    exit 0
  fi
done
echo "state=dispatch_unconfirmed"
[ -n "$RETURNED_URL" ] && echo "run_url=$RETURNED_URL"
exit 0

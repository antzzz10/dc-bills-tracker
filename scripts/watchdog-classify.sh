#!/usr/bin/env bash
# Classify a watched workflow's state for automatic recovery (monitor-bills.yml or
# discover-bills.yml).
#
# This is the single implementation of the "episode" derivation — the freshness watchdog
# and the infra-failure retrier both call it, before and after clearing a stuck run, so
# their classifications cannot drift. An episode is every run of WORKFLOW_FILE created
# after that workflow's health stamp (LAST_CHECKED: bills.json lastChecked for the
# monitor, .discover-last-run.json lastRun for discovery); each stamp only advances on a
# healthy run, so the episode window and the unhealthy period coincide by construction
# (design record: docs/watchdog-self-heal-proposal.md). Both recovery paths dispatch
# under the same RECOVERY_TITLE, so "one automatic recovery per episode" is one shared
# budget, not one per trigger (decisions/2026-10-08-infra-failure-auto-recovery.md).
#
# The budget has two records, either of which means "spent": a completed recovery run
# (matched by run-name), and a recovery FENCE — a small artifact that a
# controller uploads BEFORE it dispatches, named for THIS episode
# (<FENCE_PREFIX>-<episode start as epoch seconds>), so it can never spend a later
# episode's budget. The fence is what bounds retries when GitHub's run list lags or omits
# a dispatched run: without it, every later controller would see "dispatchable" again
# (Codex, 2026-10-08 review round 3).
#
# Env in:  LAST_CHECKED (ISO timestamp — the episode start), RECOVERY_TITLE,
#          STUCK_THRESHOLD_HOURS, WORKFLOW_FILE (default monitor-bills.yml),
#          FENCE_PREFIX (e.g. recovery-fence-monitor), GITHUB_REPOSITORY,
#          GH_TOKEN (used implicitly by gh)
# Stdout:  GITHUB_OUTPUT-style lines. Always exactly one `state=` line, one of:
#            active | stuck | recovery_done | dispatchable | indeterminate
#          plus `active_run_url=` (state=active, best effort),
#          `stuck_run_id=` / `stuck_run_age_hours=` (state=stuck), or
#          `recovery_run_id=` / `recovery_run_url=` (state=recovery_done, when a recovery
#          run is visible) or `fenced=true` (state=recovery_done from the fence alone).
# Exit:    always 0 — a failed query is a *classification* (indeterminate), never a
#          crash, because "unable to determine" must reach the email path, and it is
#          never "safe to dispatch".

set -u

if [ -z "${LAST_CHECKED:-}" ] || [ "${LAST_CHECKED}" = "never" ]; then
  echo "state=indeterminate"
  exit 0
fi

# GitHub's search-syntax date qualifier takes seconds precision; strip milliseconds.
CREATED_AFTER=$(printf '%s' "$LAST_CHECKED" | sed -E 's/\.[0-9]+Z$/Z/')

if ! RUNS_JSON=$(gh run list --workflow="${WORKFLOW_FILE:-monitor-bills.yml}" --branch main \
    --created ">${CREATED_AFTER}" --limit 100 \
    --json databaseId,displayTitle,event,status,conclusion,createdAt,url); then
  echo "state=indeterminate"
  exit 0
fi

COUNT=$(jq 'length' <<<"$RUNS_JSON" 2>/dev/null) || { echo "state=indeterminate"; exit 0; }
echo "episode_runs=$COUNT"

# --limit is a client-side safety bound, not the filter. Hitting it means the episode
# view may be truncated, and a truncated view could hide an earlier recovery.
if [ "$COUNT" -ge 100 ]; then
  echo "state=indeterminate"
  exit 0
fi

# Every jq below is guarded: a parse failure anywhere (unexpected createdAt format,
# malformed JSON) must classify as indeterminate, never fall through to dispatchable.
if ! IN_PROGRESS_URL=$(jq -r '[.[] | select(.status == "in_progress")][0].url // empty' <<<"$RUNS_JSON"); then
  echo "state=indeterminate"; exit 0
fi
if [ -n "$IN_PROGRESS_URL" ]; then
  echo "state=active"
  echo "active_run_url=$IN_PROGRESS_URL"
  exit 0
fi

# Queued-type runs, annotated with age. A young one is presumed to be acquiring a runner
# normally; one past the threshold is presumed wedged (healthy acquisition here is
# seconds; both real incidents lost 2h+).
if ! QUEUED_JSON=$(jq -c '[.[]
  | select(.status == "queued" or .status == "waiting" or .status == "pending" or .status == "requested")
  | . + {age_hours: ((now - (.createdAt | fromdate)) / 3600)}]
  | sort_by(.createdAt)' <<<"$RUNS_JSON"); then
  echo "state=indeterminate"; exit 0
fi

THRESHOLD="${STUCK_THRESHOLD_HOURS:-2}"

if ! YOUNG_URL=$(jq -r --argjson thr "$THRESHOLD" \
  '[.[] | select(.age_hours < $thr)][0].url // empty' <<<"$QUEUED_JSON"); then
  echo "state=indeterminate"; exit 0
fi
if [ -n "$YOUNG_URL" ]; then
  echo "state=active"
  echo "active_run_url=$YOUNG_URL"
  exit 0
fi

if ! STUCK_ID=$(jq -r --argjson thr "$THRESHOLD" \
  '[.[] | select(.age_hours >= $thr)][0].databaseId // empty' <<<"$QUEUED_JSON"); then
  echo "state=indeterminate"; exit 0
fi
if [ -n "$STUCK_ID" ]; then
  if ! STUCK_AGE=$(jq -r --argjson thr "$THRESHOLD" \
    '[.[] | select(.age_hours >= $thr)][0].age_hours | floor' <<<"$QUEUED_JSON"); then
    echo "state=indeterminate"; exit 0
  fi
  echo "state=stuck"
  echo "stuck_run_id=$STUCK_ID"
  echo "stuck_run_age_hours=$STUCK_AGE"
  exit 0
fi

# One automatic recovery per episode: if a watchdog-dispatched run has already completed
# (any conclusion — failed, cancelled, or green-but-never-stamped), a second automatic
# attempt is presumed doomed and a human is needed. Match displayTitle + event, never
# .name, which stays the same for every run.
if ! RECOVERY_COUNT=$(jq -r --arg t "${RECOVERY_TITLE:?RECOVERY_TITLE must be set}" \
  '[.[] | select(.displayTitle == $t and .event == "workflow_dispatch" and .status == "completed")] | length' \
  <<<"$RUNS_JSON"); then
  echo "state=indeterminate"; exit 0
fi
case "$RECOVERY_COUNT" in
  ''|*[!0-9]*) echo "state=indeterminate"; exit 0 ;;
esac
if [ "$RECOVERY_COUNT" -gt 0 ]; then
  echo "state=recovery_done"
  # Best effort, for the escalation email's diagnosis of why the recovery failed.
  jq -r --arg t "$RECOVERY_TITLE" \
    '[.[] | select(.displayTitle == $t and .event == "workflow_dispatch" and .status == "completed")]
     | sort_by(.createdAt) | last | "recovery_run_id=\(.databaseId)\nrecovery_run_url=\(.url)"' \
    <<<"$RUNS_JSON" 2>/dev/null || true
  exit 0
fi

# Fence check: a controller in this episode already committed to a recovery, even if the
# run it dispatched is not (yet) visible above. API failure is indeterminate, never "no
# fence".
if ! EPISODE_KEY=$(jq -Rre 'fromdate' <<<"$CREATED_AFTER" 2>/dev/null); then
  echo "state=indeterminate"; exit 0
fi
FENCE_NAME="${FENCE_PREFIX:?FENCE_PREFIX must be set}-${EPISODE_KEY}"
if ! FENCES=$(gh api "repos/${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set}/actions/artifacts?name=${FENCE_NAME}&per_page=100"); then
  echo "state=indeterminate"; exit 0
fi
if ! FENCE_COUNT=$(jq -e '[.artifacts[] | select(.expired | not)] | length' <<<"$FENCES" 2>/dev/null); then
  echo "state=indeterminate"; exit 0
fi
if [ "$FENCE_COUNT" -gt 0 ]; then
  echo "state=recovery_done"
  echo "fenced=true"
  exit 0
fi

echo "state=dispatchable"
exit 0

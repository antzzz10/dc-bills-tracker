#!/usr/bin/env bash
# Decide whether a workflow run failed because GitHub never gave it a runner — the one
# failure class where an automatic retry is worth it (2026-07-25, 2026-08-06, 2026-10-05).
#
# A run that executed any step and then failed is a code/data/API failure: retrying it
# usually fails identically (decisions/2026-08-14-discovery-alerting.md), so it is never
# classified as infra here. Zero steps alone is NOT proof either — a run cancelled by hand
# or replaced in a concurrency queue looks the same — so positive evidence is required:
# GitHub's own "not acquired by Runner" annotation on the job.
#
# Usage:   infra-failure-check.sh RUN_ID [RUN_ATTEMPT]
# Env in:  GH_TOKEN (used implicitly by gh), GITHUB_REPOSITORY (owner/repo)
# Stdout:  GITHUB_OUTPUT-style lines. Always exactly one `infra=` line, one of:
#            true    — every job matched the runner-acquisition signature
#            false   — at least one step executed; `failed_step=` names the first failure
#            unknown — anything else (API error, no jobs, incomplete or mixed evidence)
#          plus `reason=` (one line, human-readable).
# Exit:    always 0. "unknown" must never be read as "retry".

set -u
set -o pipefail

RUN_ID="${1:-}"
ATTEMPT="${2:-}"
REPO="${GITHUB_REPOSITORY:-}"

unknown() { echo "infra=unknown"; echo "reason=$1"; exit 0; }

[ -n "$RUN_ID" ] && [ -n "$REPO" ] || unknown "missing run id or repository"

if [ -z "$ATTEMPT" ]; then
  ATTEMPT=$(gh api "repos/$REPO/actions/runs/$RUN_ID" --jq '.run_attempt' 2>/dev/null) \
    || unknown "could not read run $RUN_ID"
fi
case "$ATTEMPT" in ''|*[!0-9]*) unknown "unreadable run attempt '$ATTEMPT'" ;; esac

# The attempt-specific endpoint, so a later re-run can't be inspected by mistake. One
# page of 100 (these workflows have one job each), checked against total_count so a
# truncated or partial response can never pass as complete. API success is checked
# separately from JSON processing: a failed call is "unknown", never "empty".
RAW=$(gh api "repos/$REPO/actions/runs/$RUN_ID/attempts/$ATTEMPT/jobs?per_page=100" 2>/dev/null) \
  || unknown "could not list jobs"
JOBS=$(jq -e '.jobs' <<<"$RAW" 2>/dev/null) || unknown "unparseable jobs response"
JOB_COUNT=$(jq -e 'length' <<<"$JOBS" 2>/dev/null) || unknown "unparseable jobs response"
TOTAL=$(jq -e '.total_count' <<<"$RAW" 2>/dev/null) || unknown "jobs response has no total_count"
# An empty list must not pass an "every job matches" test (jq's all/0 is true on []).
[ "$JOB_COUNT" -gt 0 ] 2>/dev/null || unknown "run has no jobs (workflow error or not yet created)"
[ "$JOB_COUNT" = "$TOTAL" ] || unknown "incomplete jobs response ($JOB_COUNT of $TOTAL)"

# Any executed step means the run got a runner: never infra.
EXECUTED=$(jq -e '[.[] | (.steps // []) | length] | add' <<<"$JOBS" 2>/dev/null) \
  || unknown "unparseable steps"
if [ "$EXECUTED" -gt 0 ] 2>/dev/null; then
  FAILED_STEP=$(jq -r '[.[] | (.steps // [])[] | select(.conclusion == "failure")][0].name // empty' <<<"$JOBS")
  echo "infra=false"
  echo "failed_step=${FAILED_STEP:-unknown}"
  echo "reason=the run executed ${EXECUTED} step(s); first failed step: ${FAILED_STEP:-none recorded}"
  exit 0
fi

# Every job: completed, unsuccessful, runner_id PRESENT and exactly numeric 0 (an absent
# or null field is unfamiliar evidence, not "no runner"), steps present-and-empty.
NOT_SIGNATURE=$(jq -e '[.[] | select(
    .status != "completed"
    or (.conclusion != "cancelled" and .conclusion != "failure")
    or ((.runner_id | type) != "number") or (.runner_id != 0)
    or ((.steps | type) != "array")
  )] | length' <<<"$JOBS" 2>/dev/null) || unknown "unparseable job fields"
[ "$NOT_SIGNATURE" = "0" ] || unknown "job state does not match a runner-acquisition failure"

# Positive evidence, per job: GitHub's annotation on the job's check run.
CHECK_URLS=$(jq -er '.[].check_run_url' <<<"$JOBS" 2>/dev/null) || unknown "job has no check run"
for CHECK_URL in $CHECK_URLS; do
  [ "$CHECK_URL" != "null" ] || unknown "job has no check run"
  MESSAGES=$(gh api "${CHECK_URL}/annotations" --jq '.[].message' 2>/dev/null) \
    || unknown "could not read annotations"
  grep -q "not acquired by Runner" <<<"$MESSAGES" \
    || unknown "no runner-acquisition annotation (cancelled by hand or by a concurrency queue?)"
done

echo "infra=true"
echo "reason=GitHub never assigned a runner (annotation: job was not acquired by Runner)"
exit 0

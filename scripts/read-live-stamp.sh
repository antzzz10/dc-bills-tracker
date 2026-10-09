#!/usr/bin/env bash
# Print a pipeline's health stamp as it is on main RIGHT NOW (not in this job's checkout).
#
# A controller's checkout can be minutes old by the time it decides. If a run committed a
# healthy stamp in between, deciding from the checkout would dispatch a needless recovery
# or email a false "still stale" — so every dispatch/escalation decision re-reads here.
#
# Usage:   read-live-stamp.sh monitor|discovery
# Env in:  GITHUB_REPOSITORY, GH_TOKEN
# Stdout:  the ISO stamp only. Exit non-zero (and print nothing) if it can't be read.

set -euo pipefail

case "${1:-}" in
  monitor)   FILE=src/data/bills.json;     FIELD=.lastChecked ;;
  discovery) FILE=.discover-last-run.json; FIELD=.lastRun ;;
  *) echo "usage: $0 monitor|discovery" >&2; exit 2 ;;
esac

RAW=$(gh api "repos/${GITHUB_REPOSITORY}/contents/${FILE}?ref=main" \
  -H "Accept: application/vnd.github.raw")
STAMP=$(jq -er "$FIELD" <<<"$RAW")
# Must parse as a date; anything else is "can't read", never a stamp.
node -e 'process.exit(Number.isFinite(Date.parse(process.argv[1])) ? 0 : 1)' "$STAMP"
echo "$STAMP"

# Decision: last-action fields come from Congress.gov; H.R. 5525 corrected

**Date:** 2026-11-08 · **Approved by:** Andria ("accuracy is paramount") · **Found by:** the new bill-history archive (`antzzz10/representdc-data`) comparing its official records with this tracker

## What was wrong

1. **H.R. 5525 (Stop DC CAMERA Act) was shown as passed by the House.** It was only marked up in committee (ordered reported 21-19 on 2026-03-18). The stage was hand-entered on 2026-01-24 (`08b27e1`). The monitor never moves a stage backwards, so it never corrected it. The site counted 15 bills as having cleared a chamber; the true count is 14. No other monitored bill's stage disagrees with the official actions.
2. **"Last action" dates were often the day the monitor noticed a change, not the day Congress acted.** On a stage change it wrote "Passed House" with the run date. It never refreshed these fields otherwise. Twenty bills disagreed with Congress.gov: eleven read 2025-11-28, a run date; the three H.R. 1968 riders read 2026-09-16, a year and a half after the law passed. Those dates drove Recent Activity and the summary's "Latest movement" line.

## What changed

- **Data:**
  - H.R. 5525 now has no passage stage, and its last action is the official markup.
  - H.J.Res. 142's date is now its signing date, 2026-02-18. That entry is under `manualOverride`, so the monitor won't touch it.
- **Monitor:**
  - Copies Congress.gov's own latest-action text and date, and the introduction date, on every run.
  - Fetches up to 250 actions, up from the default 20.
- **Banner:** "introduced" claims use the introduction date. Text matching treated any "Referred to…" as new.
- **Claims gate:** now actually checks the introduction banner. It had been looking for wording the banner never uses.
- **Recent Activity:** shows a passage on its own vote date, and otherwise the official latest action in Congress.gov's words.
- **Weekly digest:** backfilled actions and corrections aren't treated as this week's news.

## Rejected

- **Automatically clearing a passage stage when the detector finds no passage.** Codex flagged this as a BLOCKER: the detector misses voice votes and suspension passages, so it would erase real passages. Stage disagreements are caught by the archive's coverage report. That report will be compared with this tracker for a month before the tracker reads from the archive.

## Reviews

Codex medium and high, then a high recheck: `reviews/2026-11-08-tracker-accuracy-fix-codex-*.raw.md`. All findings are fixed.

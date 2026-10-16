# Decision: record review decisions so discovery stops re-emailing the same bills

**Date:** 2026-10-09
**Status:** Implemented; pending live verification
**Trigger:** Andria kept receiving "12 bill(s) need review" from the discovery scan. The
scan re-scores every candidate from scratch each week, and the DC subcommittee channel
returns the same bills every time, so the same 12 review-tier bills (score 20–39) were
emailed weekly with no way to say "seen it". The email also listed bills without
saying what to do with them.

## Decisions (Andria, 2026-10-09: "approved as recommended")

1. **Decisions are data.** `scripts/discovery-decisions.json` maps a bill id to
   `not_relevant`, `support_parked` (pro-DC; the tracker is oppose-only since
   `2026-08-03-park-support-bills.md`) or `track`. A decided review-tier bill is
   reported as a count and never listed again.
   - `not_relevant` / `support_parked` silence **only the review tier, and only on the
     evidence that was reviewed**. A bill that later scores 40+ is still auto-added. A
     decided bill returns to the review list at any score, with the reason shown, when
     it has an action newer than the one shown in the email when it was decided
     (`actionDateReviewed`, carried in the link as "as of YYYY-MM-DD"; `decidedAt` for
     the initial 12), or when any of its scoring requests failed this run. An amendment
     can lower the DC-relevance score while making a bill worse, so score is no excuse.
   - Re-deciding from a **new** issue is a fresh review even with the same answer: it
     resets the dates, so re-affirming a resurfaced bill stops it resurfacing. Only a
     re-run of the **same** issue is a no-op.
   - Decisions carry their `congress` and apply only to it: bill numbers restart each
     Congress.
   - `track` forces the bill in as provisional on the next scan, even if no channel
     surfaced it that week (incremental scans only see recently updated bills).
   - An unreadable or structurally invalid decisions file (wrong shape, unsupported id,
     unknown decision, missing congress, not a real calendar date) is fatal (loud "unhealthy" email), because
     silently ignoring it would resume the weekly re-emails or drop a `track`.
2. **Decide from the email in two clicks.** Each review-tier bill carries three links.
   Each opens a pre-filled GitHub issue ("Discovery decision: <decision> <billId>");
   clicking Create triggers `.github/workflows/discovery-decision.yml`, which records
   the decision, pushes it, and closes the issue with a confirmation. `track` also
   dispatches discovery so the bill is added within minutes. A failure leaves the issue
   open with a comment linking the run.
3. **The initial 12 were triaged by Claude, approved by Andria:** 8 pro-DC
   (`support_parked`) and 4 routine local measures (`not_relevant`). See the file.
4. **Every discovery email opens with a "What to do" box** stating the one next step
   for its state (unhealthy, added, review).

Also: discovery's save step now retries its push (up to 3 times), since decisions add
another writer to `main`. It rebases only over commits that leave `src/data/bills.json`
alone (decisions): this run's lint and claims gates validated its bills.json, and
an auto-merge with a concurrent monitor edit would publish a file nothing validated.
It also refuses when a bill this run added was decided as anything but `track` while
the scan ran, so the newer decision wins. Those cases, an inspection error, and any
conflict still fail into the existing "save failed, safe to re-run" email. The generated `public/api/stats.json` is discarded before rebasing (the
deploy's build regenerates it).

## Guardrails
- The repo is **public**. The workflow runs only for issues whose author is the repo
  OWNER and whose title starts with the exact prefix; anyone else's issue skips the
  job. The title reaches the shell only via env and must match the full pattern
  `^Discovery decision: (not_relevant|support_parked|track) ((hr|s|hjres|sjres|hconres|sconres|hres|sres)[1-9][0-9]{0,4})( as of ([0-9]{4}-[0-9]{2}-[0-9]{2}))?$`;
  `record-discovery-decision.js` validates it again. The issue body is ignored.
- No concurrency group: a shared group keeps only one pending run, so quick
  successive clicks would cancel decisions. Each run instead fetches, resets to the
  latest `main`, re-applies its one decision and pushes, retrying up to 6 times.
- Issue numbers order decisions: a delayed run for an older issue never overwrites a
  newer decision on the same bill (it closes its issue as "superseded").
- A re-run of the same issue writes an identical file and counts as success, so it can
  finish a failed follow-up step. The failure comment says whether the decision itself
  was saved.
- `track` dispatches discovery with `recovery_source=review-decision`, which keeps the
  plain run-name, so the freshness watchdog never counts it as an automatic recovery.

## Rejected alternatives
- Raising the review threshold: it would hide new borderline bills, not just decided ones.
- Moving decided bills into `bills.json` (`supportBills`/`routineBills`): this needs
  full classification fields and the lint gate for a bill nobody wants on the site.
- One-click email links that act directly (GET): links in email get prefetched by
  scanners and can't be authenticated; the pre-filled issue is the closest safe action.

## Accepted limits
- Pre-existing, not changed here: monitor and discovery each deploy
  independently, so a slow deploy of an older commit can briefly publish an older site
  until the next deploy (Codex, review round 1, Medium #7).
- Undecided bills whose scoring requests fail can still drop from review to skipped
  silently, as before this change; only decided bills got the stricter rule.
- Each click opens and closes a public issue that names the bill and the decision.
- GitHub may notify Andria when the workflow comments and closes her issue (her
  GitHub notification settings, outside the repo).

## Process
Codex implementation review (high effort): "fix first" with 1 High, 6 Medium, 2 Low and
no outsider-trigger path found (raw output in the session scratchpad,
`codex-decisions-review.md`). Fixed: High #1 (failed scoring requests could silence a
decided threat), #2 (rebase blocked by the generated stats file; Claude additionally
restricted the rebase to commits that leave bills.json alone), #3 (older issue
overwrote newer), #4 (decisions outlived amendments and Congresses), #5 (a re-run
couldn't finish; failure comment misreported), #6 (invalid structure passed silently),
#8 (links generated for bill types the workflow rejected), #9 (email said provisional
bills were live; they are hidden until classified). Not fixed: #7 (pre-existing, above).

Codex re-review (medium effort, `codex-decisions-review2.md`): confirmed fixes 1, 2, 3, 5,
8 and 9 closed, 4 and 6 partially; "fix first" with 4 Medium and 2 Low, all fixed: a
mid-scan dismissal lost to an in-flight `track` addition (save now refuses); a
re-affirmed decision didn't reset its date; a decided bill with a new action but a
score below 20 was skipped silently; same-day amendments stayed suppressed (now keyed to
the reviewed action date); impossible calendar dates passed; a failed `git diff` in
the save guard read as "nothing changed".

## Verification (local, before commit)
- `record-discovery-decision.js`: valid decisions, replacement of an earlier decision,
  and rejection of a bad decision, `hr0`, `hres5` and shell-metacharacter ids.
- `record-discovery-decision.js`: issue ordering (older issue → `superseded_by`, nothing
  written); an identical re-run writes a byte-identical file.
- `discover-bills.js` against a mocked Congress.gov: a decided bill → dismissed; the
  same bill with a failed subjects request, or a new action after the decision → back
  in review with the reason; a 118th-Congress decision doesn't apply; an undecided
  30-point bill → review; a `track` bill no channel surfaced (incl. `hres`) → added as
  provisional; re-run doesn't re-add; `{"decisions":[]}`, an `hr0` key or a missing
  congress → fatal, degraded.
- Save step against a local bare repo: a decision on another bill, or `track` on the
  added bill, pushed mid-run → rebased and saved (with a dirty stats.json); the added
  bill dismissed mid-run → refused; bills.json changed upstream → refused.
- Round 2: same-issue re-run byte-identical; a new issue with the same answer resets
  `decidedAt`/`actionDateReviewed`; `2026-02-30`/`2026-99-99` rejected; a decided bill
  with a new action resurfaces at score 0; a re-affirmed one stays silent; email links
  decode to `Discovery decision: <d> <id> as of <date>`.
- Resolver extracted from the YAML for review_only / added / unhealthy: each email
  opens with "What to do"; links URL-encode titles with quotes, `&` and `<>`.
- Title regex: exact matches pass; injection, wrong case and unsupported types fail.
- actionlint/shellcheck: the new workflow is clean; discover-bills.yml has only its
  pre-existing info-level notes.

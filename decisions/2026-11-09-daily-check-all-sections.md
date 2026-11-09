# Decision: the daily check covers every section, and keeps what it couldn't fetch

**Date:** 2026-11-09 · **Approved by:** Andria (guardrail answers of 2026-11-09: "the daily check will cover support bills too") · **Plan:** step 1b of `docs/2026-11-09-support-page-and-congress-switch-plan.md`

## What was wrong

- **The daily check read `bills` only.** The 36 support bills, the routine measure (S. 1077) and the 18 budget riders were never checked:
  - S. 1077 sat at no stage for eight months after passing the Senate;
  - support-bill cosponsor counts drifted (H.R. 51: 207 stored, 209 official).
- **Reloading mid-run dropped `supportBills` and `routineBills`.** The writer then saved its startup copy of those sections over any edit made during the run.
- **A partly failed lookup overwrote good data in a run reported as healthy.** On the 2026-11-09 14:57Z run, H.R. 5183's bill request succeeded but its actions request failed (`Could not fetch actions` in the run log). The markup flag defaulted to false and replaced "markup held" on the live site. The archive (`representdc-data`) records the markup: ordered reported 22–18 on 2025-09-10. Codex reproduced the same failure for cosponsors (H.R. 51: 207 → 0).
- **Four support bills had no `congress`.** They were checked against GovInfo BILLSTATUS (title, sponsor and introduction date match): all four are 119th-Congress bills.

## What changed

- **`scripts/monitor-bills.js`:**
  - **Bills, support bills and routine measures** get the full status update.
  - **Riders:** one lookup per spending bill. Rider entries get only the Congress.gov validation stamp, never the spending bill's stage, because a bill's progress doesn't show that a provision survived (H.R. 7148 became law; whether S.Amdt. 4253 is in it is a separate fact). Rider statuses are step 1a.
  - **Each entry is looked up in its own Congress.** A missing `congress` is an error, and other Congresses are skipped. A bill number names a different bill in every Congress.
  - **One lookup per record per run.** H.R. 1968's three entries are one lookup, which made 113 lookups in all.
  - **Health covers every section:**
    - the error rate is failed lookups out of distinct lookups;
    - an incomplete record (actions or cosponsors missing) counts as a failure;
    - fields that didn't arrive keep their stored value.
  - **Priority:** support bills and spending bills rank on momentum only. The partial-attack cap applies to oppose bills only.
  - **Email:**
    - support and routine items are labelled;
    - only an anti-DC passage suggests an urgent alert;
    - newly monitored records count as notable.
- **`bills.json`:** `congress: 119` on H.R. 2693, H.R. 9362, H.R. 6950 and S. 4837.
- **`lint-bills.js` check 12:** every entry in every section records an integer `congress`.
- **`validate-bills.js`** includes routine measures.
- **The workflow's unvalidated-entries step** covers all sections.

## Not changed (recorded for later steps)

- **Priority is still email-only.** `calculatePriority` never writes to `bills.json`; the parked `/support` component sorts on the stored value. Resolve this before step 1d.
- **First-run backfills:** a newly monitored bill with an old passage would appear under "Passed a chamber" as if new. None of the support bills has passed a chamber (checked against the archive), so this doesn't arise on the first run.
- **Budget-resolution amendments:** H.Con.Res. 14 and S.Con.Res. 7 are stored as resolutions with no stage, though the parent resolutions were agreed to. As with riders, the parent's outcome says nothing about the amendment. Step 1a.

## Verification

- An offline run against archive-backed responses:
  - 113 lookups;
  - a simulated 404 counted once;
  - partial failures preserved stored values and counted against health;
  - no rider stage written;
  - anti-DC counts unchanged.
- Both gates and the build pass.

## Reviews

- **Codex medium:** 0 BLOCKER, 0 MATERIAL, 3 NOTE.
- **Codex high:** 0 BLOCKER, 1 MATERIAL (the partial-failure overwrite above), 3 NOTE.
- **High recheck:** 0 BLOCKER, 0 MATERIAL, 1 NOTE: the spending bills riders sit on had no fallback. Fixed; they now fall back to the previous run's history, and a fail-then-recover test shows no false "priority escalated".
- **Raw output:** `reviews/2026-11-09-monitor-all-sections-codex-*.raw.md`.

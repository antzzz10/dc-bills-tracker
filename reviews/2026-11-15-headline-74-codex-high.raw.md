**8 MATERIAL findings; no BLOCKER findings.** The current data correctly produces **74 = 4 + 10 + 60**, but future-state wording, filtered headings, malformed responses, and the claims gate need fixes.

Paths below use `tracker/` and `main/` for the two worktrees.

1. **MATERIAL — A chamber stage does not prove which chamber a measure awaits.**  
   `tracker/src/lib/progressSplit.js:25–26,54–55`; `main/src/lib/billProgress.js:29–30`; `tracker/scripts/check-published-claims.js:233–245`.

   **Failing scenarios:** A simple House resolution at `agreed-house` produces **“1 passed the House and awaits the Senate.”** Simple resolutions require no action by the other chamber. Also, the monitor deliberately retains `passed-house` when both chambers passed different texts (`scripts/monitor-bills.js:481–486`); the new wording can therefore say it awaits the Senate when House concurrence is needed.

   Adding a completed simple resolution to the current data produced **“11 passed the House and await the Senate”**, and the gate passed.

   **Fix:** Determine the next required action using measure type and both chambers’ actions. Publish that verified distinction for the main site. Use neutral wording when it cannot be established. Simple resolutions’ single-chamber process is confirmed by the [Senate’s legislation guide](https://www.senate.gov/legislative/common/briefing/leg_laws_acts.htm).

2. **MATERIAL — Successful malformed responses can publish invalid counts.**  
   `main/src/hooks/useBillStats.js:57–73`; `main/src/Home.jsx:15`; `main/src/HowCongressControlsDC.jsx:11,167`.

   **Failing scenarios:** A successful `{}` response renders **“undefined anti-DC bills, resolutions and riders”** on HowCongressControlsDC. Home suppresses that value, creating inconsistent surfaces. `{totalBills:-1}` publishes **“-1 Threats…”** on Home because `Number.isInteger(-1)` passes.

   **Fix:** Validate the headline once in the hook as a nonnegative safe integer. Return a shared unavailable state for invalid responses, and make both pages consume it.

3. **MATERIAL — One measure can occupy multiple groups.**  
   `tracker/src/lib/progressSplit.js:36–46`.

   **Failing scenario:** Three entries sharing `H.R. 1`, respectively enacted, passed House, and unadvanced, produce headline **1** with split **1 + 1 + 1**. The code partitions entries before deduplicating each group separately.

   The claims gate catches this mismatch, and existing lint catches some conflicting stages. However, `package.json:8–12` allows build/deploy without either check.

   **Fix:** Form measure units first, then validate or reconcile their stages before assigning each unit to exactly one group. Reject conflicting data before publication, and enforce the checks in the build/deploy path.

4. **MATERIAL — The claims gate can pass false displayed wording and skips progress validation at zero.**  
   `tracker/scripts/check-published-claims.js:170–178,220–248,264–267,320–360`.

   **Failing scenarios demonstrated entirely in memory:**

   - Changed the rendered sentence from **“10 passed…”** to **“11 passed…”**, leaving the calculated split unchanged: **gate passed**.
   - Changed **“await the Senate”** to **“await the House”**: **gate passed**.
   - With zero tracked measures, supplied progress values **99 / 88 / 77** against headline zero: **gate passed**. Progress checks sit inside `if (facts)`, while zero makes `facts` null.

   The gate also does not render or inspect the list heading or either main-site page.

   **Fix:** Check independently expected rendered numbers and complete phrases, exercise all published surfaces, and move progress validation outside the nonempty-summary condition.

5. **MATERIAL — Searches and filters replace the approved headline with a different population.**  
   `tracker/src/App.jsx:180,304–317`.

   **Current-data examples:**

   - Search `H.R. 5166`: **“18 items found (2 law)”**, followed by **“Also found: 16 archived.”**
   - Select healthcare: **“11 items found (2 law, 5 not passed either chamber)”**, followed by four archived items.

   The three threat groups total **2** and **7**, respectively—not the heading’s **18** and **11**. “Also found” further suggests the archived matches are additional, although already included.

   **Fix:** Preserve **“74 threats to D.C. home rule”** and its full split. Put filtered match counts beneath it, explicitly identifying which populations they include.

6. **MATERIAL — Home’s new prose asserts a fixed distribution independently of the data.**  
   `main/src/Home.jsx:200–202`.

   > “These 74 bills, resolutions and riders aren't sitting untouched. Some are already law and others have cleared a chamber; most have not passed either chamber yet—all of them threats to D.C.'s home rule.”

   **Failing scenarios:** With zero enacted measures, “Some are already law” is false. Once the unpassed group is no longer a majority, “most” is false. Failed fetches and unavailable progress still display these assertions. At zero, it says **“These 0…”** followed by “Some”; at one, **“These 1 bills…”**.

   **Fix:** Derive these statements and singular/plural forms from validated progress, or replace them with wording that makes no distribution or current-movement claim.

7. **MATERIAL — HowCongressControlsDC falsely assigns all 74 measures to three specific mechanisms.**  
   `main/src/HowCongressControlsDC.jsx:167–169`.

   > “74 anti-DC bills, resolutions and riders in this Congress use these exact mechanisms—review, riders, and budget authority—and 4 are already law.”

   **Current-data counterexamples:** H.J.Res. 31 proposes a constitutional amendment; H.R. 9775 directly rewrites local criminal penalties. Those are not the three mechanisms the preceding section describes. See `tracker/src/data/bills.json:2502` and `:3139`.

   **Fix:** Use the tracker’s broader description—measures that override local laws or limit self-government—and explain direct congressional legislation separately.

8. **MATERIAL — Main-site surfaces still depart from the single-headline decision.**  
   `main/src/Home.jsx:204–214`; `main/src/App.css:687`; `main/src/HowCongressControlsDC.jsx:167–169`.

   **Current scenario:** Once progress arrives, Home’s trend block presents **4, 10, and 60** as separate 5rem headline-sized numbers, without leading that block with 74. HowCongressControlsDC uses **“74 anti-DC bills…”**, omits the approved headline label, and provides only the law count rather than the complete split.

   **Fix:** Lead each surface with **“74 threats to D.C. home rule”**, with all three groups subordinate to it.

**NOTES**

- `tracker/src/lib/progressSplit.js:56,63`; `main/src/lib/billProgress.js:31`: **“not yet law”** is misleading for an agreed concurrent resolution, which never becomes law. A constitutional amendment sent to the states also follows a different path. Prefer wording that does not imply eventual enactment, such as “cleared at least one chamber.”
- `main/src/hooks/useBillStats.js:54,87`: the fetch runs once per mount, with no age rejection or refresh. An open page can retain yesterday’s count after the tracker changes. This is pre-existing. Show freshness consistently and define when old data becomes unavailable.
- No remaining tracker group label says “pending” or “60 pending.” Main still contains **“has pending legislation requiring all officers to wear body cameras”** in `src/data/talkingPoints.js:115`, rendered through TalkingPoints. It concerns Georgia legislation, so it does not violate the prohibition on naming these groups.

Verification: all **21 added tests pass**. Senate-first, passed-both, empty-group, and singular helper cases behave as implemented; the resolution wording issues above remain. The checked-in stats file lacks progress, so the direct gate fails; regenerating stats **in memory** makes the baseline gate pass. Before progress publishes, main shows the headline without a numeric split. Failed fetches hide numeric counts, but retain the unsupported prose identified above. No files were modified.

**Verdict: ship after fixes.**
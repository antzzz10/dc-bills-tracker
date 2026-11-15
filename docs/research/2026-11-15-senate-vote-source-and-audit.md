# Senate votes: why the daily check failed, the source we use, and an audit of published numbers

**Date:** November 15, 2026

## What failed, and since when

| Period | What the daily check asked | Answer | Where |
|---|---|---|---|
| Nov 22, 2025 to Nov 14, 2026 | Congress.gov API, `/v3/senate-vote/119/{session}/{roll}` | HTTP 404, every time | GitHub Actions and locally |
| Nov 14, 2026, 19:49 UTC (one run) | senate.gov XML record | HTTP 403 on all 7 requests | GitHub Actions only |
| Nov 14, 2026, 20:19, 22:21 and 22:52 UTC | senate.gov XML record | All 5 votes read, 0 errors | GitHub Actions |

- The Congress.gov address never existed. The lookup was added on Nov 22, 2025 (`2b93f50`) and failed quietly for a year: the log printed a warning and the run carried on.
- On Nov 10, 2026 a failed vote lookup started counting as an error (`14164e8`), so the daily email showed 5 errors from Nov 11.
- On Nov 14 the lookup moved to senate.gov (`eaa1425`). The first run afterwards was refused; the next three were not. So senate.gov's block is occasional, not constant.

## Does Congress.gov cover Senate votes?

Partly.

- **No vote records.** The API has `house-vote` and nothing for the Senate. The Library of Congress said so on April 2, 2026: "Only House roll call votes are available on Congress.gov and the Congress.gov API" ([issue 436](https://github.com/LibraryOfCongress/api.congress.gov/issues/436)). The request to add them is open and marked blocked ([issue 249](https://github.com/LibraryOfCongress/api.congress.gov/issues/249)). Checked live on Nov 15, 2026: six Senate vote paths return 404, `house-vote/119/1/70` returns 200.
- **Yes for the totals.** Each bill's action list on Congress.gov records a Senate passage as text, for example "Passed Senate without amendment by Yea-Nay Vote. 54 - 46. Record Vote Number: 133.", with a link to the senate.gov record. It has no party breakdown.

## What the tracker needs from the Senate

For a bill that passed the Senate by roll call: the totals, the date and the party breakdown, shown on the bill's card. Today that is H.R. 1968 (three entries) and H.J.Res. 142. Whether a bill passed the Senate, and every count on the site, comes from Congress.gov's action list, not from the vote record.

## Sources compared

| Source | Senate votes? | Party breakdown? | Official? | Verdict |
|---|---|---|---|---|
| senate.gov XML | Yes | Yes, from the member list | Yes | **Primary.** Sometimes refuses cloud servers ([issue 441](https://github.com/LibraryOfCongress/api.congress.gov/issues/441)) |
| Congress.gov action text | Totals and date only | No | Yes | **Cross-check and fallback** |
| VoteView (UCLA) | Yes | Yes | No; no licence stated; 1–2 days behind | Not used |
| GovTrack API | Not reachable by script (Cloudflare challenge) | Unverified | No | Not used |
| GovInfo | No vote collection | – | Yes | Not usable |
| unitedstates/congress | Scrapers only; they fetch senate.gov | – | No | Not usable |

## What changed in the code

1. senate.gov is tried up to three times when it refuses, is overloaded or times out.
2. When both answer, the senate.gov totals and date must equal those in Congress.gov's action text, or the vote is not used and the run reports an error.
3. When senate.gov can't be reached, Congress.gov's totals are used without party rows. A stored record that already has party rows is kept as it is. Totals with a tie or a one-vote margin are never used this way, because Congress.gov's text can't show a Vice President's tie-break.
4. A vote shown without party rows appears in the daily email under "Known gap, not an error". A 404, an unreadable record, a record for another measure, or any disagreement between the two sources or with the stored record is still an error, and a disputed tally is left out of the email's and posts' announcements.
5. A hand-entered tally on a locked entry (H.J.Res. 142) is never changed, but the run now reports an error if it stops matching the official record.
6. Senate tallies are no longer requested for resolutions, whose tallies the site doesn't show. That was 2 of the 5 daily errors.

7. The tally shown is the latest Senate passage's. If the Senate later passes the bill again without a roll call, the run reports the stored tally as out of date for a person to correct.

Codex reviewed the change at medium and high effort on Nov 15, 2026, then rechecked the fixes four times; the last pass found nothing further (`reviews/2026-11-15-senate-vote-fallback-codex-*.raw.md`). Rules 2 (date), 3 (one-vote margins), 4 (announcements), 5 and 7 came from those reviews.

## Audit of published numbers (Nov 15, 2026)

Every number below was recomputed from the official source today.

| Published | Where | Published value | Source value | Source |
|---|---|---|---|---|
| H.R. 1968 Senate vote | Tracker, three cards | 54-46, Mar. 14, 2025; R 52-1, D 1-44, I 1-1 | Same | [senate.gov vote 133](https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00133.htm); Congress.gov action text 54-46 |
| H.J.Res. 142 Senate vote | Tracker card | 49-47, Feb. 12, 2026 (no party rows; entered by hand) | 49-47, Feb. 12, 2026; R 49-0, D 0-45, I 0-2 | [senate.gov vote 37](https://www.senate.gov/legislative/LIS/roll_call_votes/vote1192/vote_119_2_00037.htm); Congress.gov action text 49-47 |
| Stage of every tracked measure | Tracker | 118 entries | 116 match the stage read from Congress.gov; the other 2 are amendments whose own outcome was verified by hand | Congress.gov action lists, run of Nov. 14, 22:52 UTC |
| Counts: 92 introduced, 74 active, 18 archived, 60 pending, 14 cleared a chamber, 4 law | Tracker, main site, Bluesky post of Nov. 11 | As stated | Same in the live `stats.json`; built from the stages above | [stats.json](https://billtracker.representdc.org/api/stats.json) |
| H.R. 51 cosponsors | Statehood-bill page, Bluesky post of Nov. 14 | 209 | 209 | Congress.gov API, bill record |
| S. 51 cosponsors | Statehood-bill page | 43 | 43 | Congress.gov API, bill record |

- **Nothing published was wrong.** The year of failed lookups left H.R. 1968's Senate tally missing from its cards until Nov 14; it never showed a wrong one. A failed vote lookup doesn't stop the rest of a bill's record from updating.
- **Not rechecked here:** the "169 re-elected" figure in the Nov 14 post. It rests on election results, not Senate data, and was verified on Nov 14.
- **One gap remains by choice:** H.J.Res. 142's card has no party rows, because that entry is locked against automatic edits.

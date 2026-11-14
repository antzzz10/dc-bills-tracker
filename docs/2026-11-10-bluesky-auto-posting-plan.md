# Plan: automatic Bluesky posts from the bill tracker

**Version:** v0.2, 2026-11-13 · Answers recorded; shadow mode built · v0.1 (2026-11-10) is in `docs/outdated/` · Builds on the manual posting workflow in `representdc-main/.github/workflows/post-to-bluesky.yml` (live 2026-11-10)

## ✏️ YOUR INPUT GOES HERE

| #   | Question | Your answer (2026-11-13) |
| --- | --- | --- |
| 1 | What gets posted automatically | Changes to a measure's status, a new measure added, and changes to cosponsors. |
| 2 | Standing approval | Yes, once you've seen the templates (below, and in two weeks of daily emails). |
| 3 | Trial period | Two weeks in shadow mode. |
| 4 | The posting credential | Already added and tested with a prior post. **One gap:** the tested secret is in `representdc-main`. The tracker repo (`dc-bills-tracker`) doesn't have it yet, and the daily check runs there. Needed only at go-live, not for shadow mode. |
| 5 | Busy days | At most 3 posts per run, otherwise one summary post. |
| 6 | **New:** go live after the two weeks? | ___ (asked around Nov 27, with the shadow results) |

## What's built (shadow mode, from 2026-11-13)

Each healthy daily check works out the exact posts it would publish and shows them in a **🦋 Would post to Bluesky** box at the top of the daily email. Nothing is published. The posts are also saved with the run as `bluesky-would-post.json`.

**Posted (once live):**
- **Status changes** Congress.gov records: passed the House or Senate, agreed to (resolutions), passed both chambers, became law, sent to the states (constitutional amendments).
- **A new measure**, once it's reviewed and added to the tracker.
- **Cosponsor changes**, up or down, read from Congress.gov that run.

**Held back, and why:**
- **Committee hearings and markups.** The daily check flags these from any action whose text contains "hearing" or "markup". That's fine for your email, but too loose to publish as fact. A stricter detector, one that quotes Congress.gov's own action, would be a follow-up.
- **Riders, amendments and provisions.** That includes any entry that shares its bill number with another entry. Today that's H.R. 5242 and its two floor amendments, and H.R. 1968's three provisions: the number's status and cosponsors belong to the parent bill. **Side effect:** H.R. 5242 itself isn't posted either, until its amendments are stored under their own amendment numbers.
- **Entries a person maintains by hand**, under manual override or with a verified outcome. H.J.Res. 142 is one. The daily check doesn't write their status, so a Congress.gov reading may not match the site.
- **Routine measures**, unreviewed (provisional) entries, archived entries, and anything from another Congress.
- **Corrections to our own data.**
  - A stage post needs Congress.gov to have reported the change that run.
  - A cosponsor post needs that run's Congress.gov count to be the one the site now shows.
  - A renamed entry isn't announced again.
  - A new entry is announced only once its own lookup has worked.

That leaves 108 of the 115 active entries that can post: 71 anti-DC, 36 pro-DC and 1 barrier to statehood.

## Templates

These are the wording changes from v0.1, flagged per your copy rule (old → new):

- **Each single post names what kind of measure it is and which side it's on**: anti-DC, pro-DC, or "a barrier to statehood", the tracker's own heading. Without it, a pro-DC bill passing reads the same as an anti-DC one. A busy-day summary gives counts only.
- **"Signed into law" → "Became law".** That's Congress.gov's wording, and it's also true for a veto override or a bill that became law without a signature.
- **No next-step lines.** "Next: the Senate" and "It now goes to the President" are dropped. A simple resolution has no next chamber, and a check can catch up after a veto, so the line could be wrong.
- **A cosponsor template added.**

| Event | Post |
|---|---|
| Passed one chamber | `Passed the House: anti-DC bill H.R. 5103, Make the District of Columbia Safe and Beautiful Act of 2025 (218-206). billtracker.representdc.org` |
| Resolution agreed to | `Agreed to by the House: anti-DC resolution H.Res. N, <title>. billtracker.representdc.org` |
| Passed both, same text | `Passed both chambers: pro-DC bill H.R. 51, Washington, D.C. Admission Act. billtracker.representdc.org` |
| Became law | `Became law: anti-DC bill H.R. N, <title>. billtracker.representdc.org` |
| Constitutional amendment | `Passed both chambers: constitutional amendment H.J.Res. 141 (a barrier to statehood). It goes to the states for ratification. billtracker.representdc.org` |
| New measure | `New anti-DC bill: H.R. 6578, Charlie Kirk Freedom of Speech Plaza Act, introduced Dec 10, 2025. billtracker.representdc.org` |
| Cosponsors | `Anti-DC bill H.R. 6578, Charlie Kirk Freedom of Speech Plaza Act, now has 3 cosponsors, up from 2. billtracker.representdc.org` |
| Busy day (4+ events) | `Tracker update: 1 measure became law; 2 measures passed or were agreed to in a chamber; 3 measures gained or lost cosponsors. billtracker.representdc.org` |

**Rules:**
- **Vote tally:** only when there's an official roll call.
- **Long titles:** a title that would push a post past 300 characters is dropped, leaving the number alone.
- **Wording:** the tracker's own title and Congress.gov's action words, with no adjectives.

## How it works

- **When:** at the end of the daily tracker check, and only if that check was healthy. It isn't real-time: a post reflects what Congress.gov recorded since the last check.
- **Posted once:** `bluesky-ledger.json` is committed together with the day's data, and only from a healthy run. It records each measure's stage and cosponsor count as last posted. An event is posted once.
- **Failed runs:** if a run fails, or the posts can't be worked out, nothing from that run is saved and the next healthy run redoes it.
- **First run:** records a starting point and posts nothing. Cosponsor counts start from that run's own Congress.gov readings.
- **Code:**
  - The post builder: `scripts/lib/bluesky-posts.js`.
  - The tests: `node scripts/test-bluesky-posts.js`. They replay H.R. 5103's House passage, a law and a both-chambers passage, a new bill and cosponsor changes. Then they check every gate above, and every template against all 108 postable entries.

## At go-live (after the two weeks, on your yes)

1. The posting credential goes in the tracker repo: Settings → Secrets → Actions, name `BLUESKY_BILLS_REPRESENTDC_ACCOUNT`. You add it.
2. A posting step runs after the site deploy and both repo gates. It uses the same checks as the manual workflow (length, link, duplicate refusal).
3. **Stopping it:** a repository variable, `BLUESKY_AUTOPOST=off`, pauses posting without touching code.
4. I watch the first live post go out and check it on the profile and the `/follow` page.

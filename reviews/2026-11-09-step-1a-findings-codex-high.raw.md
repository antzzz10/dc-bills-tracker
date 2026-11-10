**Do not approve the correction as written. I found 0 BLOCKER and 2 MATERIAL findings.** The rider outcomes and proposed arithmetic check out, but the document overstates what the official record establishes.

**MATERIAL — The 15 omitted House riders do not have official terminal outcomes.** At [lines 9–18 and 48–52](/Users/andriathomas/Projects/dc-bills-tracker/docs/2026-11-09-step-1a-findings.md:48), the document treats archiving them as an official-record correction. H.R. 5166 remains on the Union Calendar; enactment of another appropriations bill did not formally reject or withdraw it. Archiving these provisions as superseded can be a tracker policy decision, but should be identified as such. [Official H.R. 5166 actions](https://www.congress.gov/bill/119th-congress/house-bill/5166/all-actions)

“**Dropped from the FY2026 funding law**” is defensible shorthand for omission from the final package, but **“Not included in P.L. 119-75; proposed in H.R. 5166”** is more precise. Do not publish “18 entries are no longer live” or describe all 18 as having official final outcomes without that qualification.

**MATERIAL — Concurrent resolutions require both chambers.** [Line 56](/Users/andriathomas/Projects/dc-bills-tracker/docs/2026-11-09-step-1a-findings.md:56) combines concurrent and simple resolutions into “agreed to, which is final.” A simple resolution needs its originating chamber; a concurrent resolution needs both chambers agreeing to identical text. S.Con.Res. 7 passed the Senate only. H.Con.Res. 14 was agreed to by both chambers. This does not change the finding that the two tracked amendments were not adopted. [Congressional procedure](https://www.congress.gov/help/learn-about-the-legislative-process/how-our-laws-are-made), [S.Con.Res. 7 actions](https://www.congress.gov/bill/119th-congress/senate-concurrent-resolution/7/all-actions)

**Verified rider results.** I read Division E, Title VIII and searched the entire supplied enrolled text using multiple names, descriptive phrases, D.C. law numbers, and code citations. For example, the camera searches included “automated traffic,” “Fiscal Year 1997 Budget Support,” and `50-2209.01`; marijuana required “schedule I” and “tetrahydrocannabinols.”

“Absent” below means the **specific tracked D.C. restriction** is absent from P.L. 119-75.

| Tracker ID | Enrolled-text result |
|---|---|
| `hr5166-police` | Absent |
| `hr5166-youth` | Absent |
| `hr5166-noncitizen` | Absent |
| `hr5166-emissions` | Absent |
| `hr5166-oilgas` | Absent |
| `hr5166-abortion` | **Present — Division E, §810** |
| `hr5166-reprohealth` | Absent |
| `hr5166-deathwithdignity` | Absent |
| `hr5166-covid` | Absent; see qualification below |
| `hr5166-insurance` | Absent |
| `hr5166-marijuana` | **Present — Division E, §809(a)–(b)** |
| `hr5166-rightturn` | Absent |
| `hr5166-cameras` | Absent |
| `hr5166-slapp` | Absent |
| `hr5166-guns` | Absent |
| `hr5166-sistercity` | Absent |
| `hr5166-shield` | Absent |
| `hr7148-sa4253-cameras` | Absent |

These results support **two enacted tracked provisions and 16 omitted rider/amendment entries**. The abortion restriction includes life-endangerment, rape, and incest exceptions. [GovInfo enrolled text](https://www.govinfo.gov/content/pkg/BILLS-119hr7148enr/html/BILLS-119hr7148enr.htm)

**Verified amendment histories.** Each named amendment’s nested BILLSTATUS actions contain only the introduction/referral entry and “Senate amendment submitted,” with no subsequent proposal, adoption, or vote action:

| Amendment | Identification | Submitted | Result |
|---|---|---|---|
| S.Amdt. 4253 | Cruz traffic-camera restriction, H.R. 7148 | January 29, 2026 | Submitted only; not adopted |
| **S.Amdt. 2195** | Cruz noncitizen-voting reserve fund, H.Con.Res. 14 | April 4, 2025 | Submitted only; not adopted |
| **S.Amdt. 919** | Lee D.C. legislative-authority reserve fund, S.Con.Res. 7 | February 20, 2025 | Submitted only; not adopted |

The published amendment texts confirm their identities. [4253](https://www.congress.gov/amendment/119th-congress/senate-amendment/4253/text), [2195](https://www.congress.gov/amendment/119th-congress/senate-amendment/2195/text), [919](https://www.congress.gov/amendment/119th-congress/senate-amendment/919/text)

I also confirmed the broader sponsor check: all seven Cruz amendments to H.Con.Res. 14 were submission-only; seven of eight Lee amendments to S.Con.Res. 7 were submission-only. The exception, S.Amdt. 922, concerned regulatory authority and passed 53–47. Neither tracked D.C. provision appears in the relevant resolution’s adopted text. [H.Con.Res. 14 enrolled text](https://www.govinfo.gov/content/pkg/BILLS-119hconres14enr/html/BILLS-119hconres14enr.htm), [S.Con.Res. 7 Senate-passed text](https://www.govinfo.gov/content/pkg/BILLS-119sconres7es/html/BILLS-119sconres7es.htm)

**Verified counts.** Running the actual `countUnits` implementation against `bills.json`, with the two provisions marked enacted in memory:

| Anti-DC counting units | Current | Archive proposed 18 | Retain 15 House riders pending¹ |
|---|---:|---:|---:|
| Total | 92 | **74** | 89 |
| Pending | 80 | **60** | 75 |
| Passed a chamber or enacted | 12 | **14** | 14 |
| Enacted | 2 | **4** | 4 |

¹ Archive only the three submitted amendments. Routine measures remain separately counted: **1**.

The proposed **74/60/14/4 is correct conditional arithmetic**, assuming the archive decision and status routing are implemented. Merely adding enacted stages to riders will not fix every current caller: `App.jsx` still places all riders in pending.

**NOTE — Publication qualifications:**

- The law contains a **different COVID mask restriction**, Division D §193, governing Department of Transportation funding. Say the tracked D.C. mandate rider was omitted; avoid saying the COVID subject appears nowhere. [Enrolled text](https://www.govinfo.gov/content/pkg/BILLS-119hr7148enr/html/BILLS-119hr7148enr.htm)
- “4” means **four enacted counting units**, including two provisions of one new law. Do not publish “four distinct laws.”
- “Riders and amendments have no status of their own” should become **“The tracker does not currently track their own outcomes.”** Numbered amendments demonstrably have official action histories.

No files were edited; the pre-existing Git changes remain unchanged.
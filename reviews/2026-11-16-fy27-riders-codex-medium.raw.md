**0 BLOCKER, 3 MATERIAL findings.** Reviewed commit `02d0864` read-only; no files changed.

I retrieved the [reported bill text](https://www.govinfo.gov/content/pkg/BILLS-119hr8495rh/html/BILLS-119hr8495rh.htm). The shell could not resolve GovInfo, and the web tool rejected the status XML’s content type. The [official House calendar](https://www.govinfo.gov/content/pkg/CCAL-119hcal-2026-04-28/pdf/CCAL-119hcal-2026-04-28.pdf) confirms the April 24 report and Union Calendar placement, but I could not independently certify the latest status from the requested XML.

**MATERIAL: `hr8495-marijuana` omits Sec. 809(a).** The description summarizes only subsection (b). Replace it with:

> Would prohibit Federal funds under this Act from enacting or carrying out laws, rules or regulations reducing penalties for possession, use or distribution of schedule I substances or THC derivatives; would prohibit all D.C. funds from enacting such measures for recreational purposes (Sec. 809).

“Any funds” and “recreational” are correct for subsection (b), not subsection (a).

**MATERIAL: `hr8495-slapp` omits restoration and retroactivity.** Corrected wording:

> Would retroactively repeal Section 5 of the Corrections Oversight Improvement Omnibus Amendment Act of 2022 and restore the prior anti-SLAPP exemptions (Sec. 825).

**MATERIAL: coverage is incomplete under `METHODOLOGY.md`.** These provisions have no entry. Proposed descriptions and inclusion judgments follow; the judgments apply the repository’s broad inclusion rule to the [reported text](https://www.govinfo.gov/content/pkg/BILLS-119hr8495rh/html/BILLS-119hr8495rh.htm).

| Proposed entry ID | Corrected wording | Treatment |
|---|---|---|
| `hr8495-vehicles` | Would restrict official-vehicle spending, with specified exceptions (Sec. 805). | Track: local spending restriction. |
| `hr8495-capitalfunds` | Would prohibit using capital-project borrowing proceeds for operating expenses (Sec. 813(c)). | Track: local spending restriction. |
| `hr8495-longbridge` | Would exempt Long Bridge railroads from specified D.C. law (Sec. 817). | Track the override; assess `support`, rather than automatically `oppose`. |
| `hr8495-shadowdelegation` | Would bar Federal funding under this Act for shadow-delegation offices (Sec. 804). | Track under broad inclusion. Federal funds only. |
| `hr8495-representation` | Would restrict Federal funding for representation petitions or litigation, preserving specified Attorney General activities (Sec. 806). | Track. Federal funds only. |
| `hr8495-needles` | Would restrict Federal needle-distribution funding at locally designated inappropriate locations (Sec. 807). | Include under the literal broad rule; not a local-funds ban. |
| `hr8495-abortionreport` | Would require a report on Partial Birth Abortion Ban Act enforcement within 60 days (Sec. 821). | Track targeted oversight, not as an abortion-funding prohibition. |
| `hr8495-executiveorders` | Would require Federal executive agencies to comply with ten specified executive orders (Sec. 760). | Track its D.C. effects, with `attackType: "partial"`. |

Sec. 760 incorporates D.C. policing interventions, including [EO 14333](https://www.whitehouse.gov/presidential-actions/2025/08/declaring-a-crime-emergency-in-the-district-of-columbia/) and [EO 14339](https://www.whitehouse.gov/presidential-actions/2025/08/additional-measures-to-address-the-crime-emergency-in-the-district-of-columbia/). Do not describe it as directly binding the Council or repealing Home Rule.

**NOTE: Sec. 808 expresses nonbinding conscience-clause intent.** I would not count it as an enforceable restriction. If listed informationally, say precisely that. Sections 811–812 also merit consideration under the methodology’s `routine` treatment of recurring congressional budget oversight, rather than automatic addition to the attack total.

The entry-by-entry check is below. **Every section number is correct.** “Accurate” means no substantive description correction identified.

| Entry ID | Section | Assessment |
|---|---:|---|
| `hr8495-marijuana` | 809 | MATERIAL above |
| `hr8495-abortion` | 810 | Accurate |
| `hr8495-reprohealth` | 819 | NOTE: explicitly include implementing regulations |
| `hr8495-deathwithdignity` | 820 | NOTE: “similar law” is imprecise; use “authorizing assisted suicide, euthanasia or mercy killing, subject to incorporated exceptions” |
| `hr8495-emissions` | 822 | Accurate |
| `hr8495-rightturn` | 823 | Accurate |
| `hr8495-cameras` | 824 | Accurate summary |
| `hr8495-slapp` | 825 | MATERIAL above |
| `hr8495-noncitizen` | 826 | Accurate |
| `hr8495-guns` | 827 | Accurate |
| `hr8495-police` | 828 | Accurate |
| `hr8495-youth` | 829 | NOTE: replace vague “provisions” with “Sections 102(a)(3) and 102(c)(1)(B), restoring prior law” |
| `hr8495-covid` | 830 | Accurate |
| `hr8495-insurance` | 831 | NOTE: explicitly include implementing regulations |
| `hr8495-oilgas` | 832 | Accurate |
| `hr8495-shield` | 833 | Accurate |

The remaining consistency checks pass:

- **Metadata:** All 16 categories match their H.R. 5166 counterparts. All use `type: "rider"`, `position: "oppose"`, integer `congress: 119`, and string `fiscalYear: "2027"`, consistent with the FY 2026 schema.
- **Status:** Omitting `status` complies with lint rule 13. That rule permits a provision’s stage only for a verified `became-law` outcome. Omitting `congressValidated` is also appropriate until validation succeeds. The monitor looks up each rider parent once, stamps successful validation on its riders, and does **not** copy the parent’s stage onto them.
- **Counts:** All 16 currently count as “have not passed either chamber.” That is correct for the stated reported-but-not-passed condition. Recomputed totals match `stats.json`: **90 total, 4 law, 10 cleared the House, 76 not passed either chamber; 18 active riders**.
- **Annual renewals:** Counting `hr8495-abortion` and `hr8495-marijuana` separately from their enacted FY 2026 predecessors follows `measureCounts.js`, which counts each rider entry independently. These are separate annual legislative proposals, not duplicate records of one enactment. `METHODOLOGY.md` permits their inclusion but does not explain this counting convention. Add an explicit annual-renewal explanation so “90 threats” cannot be mistaken for 90 distinct policy restrictions.
- **Wording:** All new entries use “D.C.” where applicable and contain no em-dashes.
- **Verification:** Offline lint passed with zero warnings; all 30 progress-split checks passed. The worktree remained clean.

**Verdict: Request changes for incomplete descriptions and coverage; metadata and current counting behavior pass, with latest-status verification still incomplete.**
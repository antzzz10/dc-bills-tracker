**0 BLOCKER; 3 MATERIAL findings.** Reviewed commit `02d0864` read-only; no files changed.

The [reported bill text](https://www.govinfo.gov/content/pkg/BILLS-119hr8495rh/html/BILLS-119hr8495rh.htm) was accessible. The requested status XML was not: the web tool rejected XML, and the shell fetch failed on DNS resolution. An [official House calendar](https://www.govinfo.gov/content/pkg/CCAL-119hcal-2026-11-17/pdf/CCAL-119hcal-2026-11-17.pdf) corroborates reporting on April 24 and Union Calendar No. 540, without recording passage.

**Entry-by-entry review**

All **16 section numbers are correct**.

| Entry id | Section | Assessment |
|---|---:|---|
| `hr8495-marijuana` | 809 | **MATERIAL:** omits subsection (a). Correction below. |
| `hr8495-abortion` | 810 | Accurate. “Any funds” is justified, including local funds. |
| `hr8495-reprohealth` | 819 | **NOTE:** explicitly add implementing rules and regulations. |
| `hr8495-deathwithdignity` | 820 | **NOTE:** “similar law” is imprecise, but the Council prohibition is real. |
| `hr8495-emissions` | 822 | Accurate. |
| `hr8495-rightturn` | 823 | Accurate. |
| `hr8495-cameras` | 824 | Accurate summary of the targeted automated-enforcement provisions. |
| `hr8495-slapp` | 825 | **NOTE:** identify restoration and retroactive effect. |
| `hr8495-noncitizen` | 826 | Accurate. |
| `hr8495-guns` | 827 | Accurate; the unusual breadth follows the text. |
| `hr8495-police` | 828 | Accurate. |
| `hr8495-youth` | 829 | **NOTE:** true but too vague about which provisions. |
| `hr8495-covid` | 830 | Accurate. |
| `hr8495-insurance` | 831 | **NOTE:** explicitly add implementing rules and regulations. |
| `hr8495-oilgas` | 832 | Accurate. |
| `hr8495-shield` | 833 | Accurate. |

These conclusions use the operative text, with the [committee’s section summaries](https://www.govinfo.gov/content/pkg/CRPT-119hrpt623/html/CRPT-119hrpt623.htm) as a cross-check.

**MATERIAL 1: `hr8495-marijuana` understates Sec. 809.**

The recreational qualification belongs to subsection (b). Subsection (a) separately restricts federal funding without that qualification. Suggested replacement:

> Would prohibit D.C. from using any funds to enact laws, rules, or regulations reducing penalties for recreational possession, use, or distribution of Schedule I substances or THC derivatives. Federal funds in this Act also could not support enactment or implementation of such measures, without the recreational-purpose limitation (Sec. 809).

Thus “recreational” is supported, but does not describe the whole section. [Reported text](https://www.govinfo.gov/content/pkg/BILLS-119hr8495rh/html/BILLS-119hr8495rh.htm)

**MATERIAL 2: missing entries for restrictions affecting local funds.**

Suggested IDs are proposals, not existing records.

| Suggested id | Section | Suggested description |
|---|---:|---|
| `hr8495-vehicles` | 805 | Would restrict funding for D.C. government vehicles to official duties, generally excluding commuting, with specified exceptions. |
| `hr8495-capitalfunds` | 813(c) | Would prohibit D.C. from transferring or reprogramming capital-project borrowing proceeds for operating expenses. |

Both warrant inclusion under the [methodology’s broad rule](METHODOLOGY.md:7). Their content should be classified separately using the `oppose`/`routine` distinction; inclusion does not automatically establish an advocacy stance. The [reported text](https://www.govinfo.gov/content/pkg/BILLS-119hr8495rh/html/BILLS-119hr8495rh.htm) contains both restrictions.

**MATERIAL 3: other qualifying provisions are missing.**

A federal-funds limitation is narrower than a local-funds prohibition, but the methodology does not make local funding a prerequisite for inclusion.

| Suggested id / section | Recommendation and corrected description |
|---|---|
| `hr8495-shadow`, **804** | **Track.** Would prohibit using federal funds provided by this Act for D.C.’s shadow congressional offices. |
| `hr8495-representation`, **806** | **Track.** Would restrict federal funding for petitions or litigation seeking congressional voting representation, preserving specified Attorney General activities. |
| `hr8495-syringes`, **807** | **Track under the broad inclusion rule.** Would restrict federally funded syringe distribution at locations local health or law-enforcement authorities deem inappropriate. It does not prohibit local funding generally. |
| `hr8495-abortionreport`, **821** | **Track.** Would require a D.C. report within 60 days on enforcement of the Partial Birth Abortion Ban Act. This is a reporting mandate. |
| `hr8495-executiveorders`, **760** | **Track as `partial`.** Would require federal executive agencies to comply with listed executive orders, including orders concerning federal intervention in D.C. policing. |

The [committee report](https://www.govinfo.gov/content/pkg/CRPT-119hrpt623/html/CRPT-119hrpt623.htm) identifies these provisions. The incorporated orders concern [MPD control](https://www.govinfo.gov/content/pkg/FR-2025-08-14/pdf/2025-15550.pdf) and [requests to change MPD policies](https://www.govinfo.gov/content/pkg/FR-2025-08-28/pdf/2025-16614.pdf). Applying `partial` to Sec. 760 is my methodology judgment; the section also addresses subjects beyond D.C.

Two qualifications matter:

- **Sec. 808:** I would exclude it from the binding-restriction count. It preserves local authority and expresses a congressional preference. If tracked as nonbinding pressure, say: “Would express Congress’s preference for religious and moral exceptions in D.C. contraceptive-coverage legislation.”
- **Sec. 817:** It also changes the application of D.C. law and has no entry. It warrants consideration as a **support** provision: “Would exempt Long Bridge Project railroads from D.C. Code § 9-1201.03.” It should not automatically increase the opposed total. [Reported text](https://www.govinfo.gov/content/pkg/BILLS-119hr8495rh/html/BILLS-119hr8495rh.htm)

For completeness, Secs. **801, 811–812 and 816** warrant consideration as recurring local-budget provisions under `routine`. Secs. **802–803, 814–815 and 818** primarily administer federal funding; their presence alone does not establish a separate local-law override. The [committee summaries](https://www.govinfo.gov/content/pkg/CRPT-119hrpt623/html/CRPT-119hrpt623.htm) distinguish these administrative provisions.

**NOTE: wording refinements**

- **`hr8495-reprohealth` and `hr8495-insurance`:** append “or implement rules or regulations issued under that Act.” Both sections expressly cover those instruments. [Committee report](https://www.govinfo.gov/content/pkg/CRPT-119hrpt623/html/CRPT-119hrpt623.htm)
- **`hr8495-deathwithdignity`:** replace “a similar law” with “measures permitting or reducing penalties for assisted-death activities covered by 42 U.S.C. § 14402(a), subject to its subsection (b) exclusions.” Those exclusions preserve distinctions involving treatment withdrawal and pain relief. The existing Council-prohibition claim is substantively supported. [Statutory cross-reference](https://uscode.house.gov/us/usc/119-124/t42/s14402/)
- **`hr8495-slapp`:** suggested replacement: “Would retroactively repeal the 2022 amendment to D.C.’s anti-SLAPP exemptions and restore the prior statutory text (Sec. 825).” The local amendment notably exempts District-government claims. [Local amendment](https://code.dccouncil.gov/us/dc/council/laws/24-344), [reported bill](https://www.govinfo.gov/content/pkg/BILLS-119hr8495rh/html/BILLS-119hr8495rh.htm)
- **`hr8495-youth`:** replace “provisions” with “sections 102(a)(3) and 102(c)(1)(B), restoring the law those sections amended.” This identifies the limited repeal without implying repeal of the entire Act. [Reported text](https://www.govinfo.gov/content/pkg/BILLS-119hr8495rh/html/BILLS-119hr8495rh.htm)

**Fields, status and counts**

- **Fields pass:** every new entry matches its FY 2026 counterpart’s `category`, `type`, `congress`, `position` and `attackType`. All correctly use fiscal year `"2027"` and Congress `119`.
- **Omitting `status` is correct under [lint rule 13](scripts/lint-bills.js:309).** Rider stages require a verified enacted outcome; the parent bill’s reporting status should not be copied onto them.
- **Omitting `congressValidated` is acceptable.** Rule 13 does not require it. The [monitor’s rider loop](scripts/monitor-bills.js:1223) checks the parent once, stamps validation after a successful lookup, and deliberately writes no rider stage. That stamp validates the bill number, not rider content.
- **The current arithmetic is correct:** the new entries contribute **16 not passed, zero advanced and zero law**. Published totals reconcile: **90 = 4 law + 10 cleared a chamber + 76 not passed either chamber**. The missing provisions above are an inclusion issue, not an arithmetic error.
- **Renewals are not double counting under the implemented unit.** [measureCounts.js](src/lib/measureCounts.js:10) expressly counts each rider entry separately. FY 2026 enactments and FY 2027 proposals are distinct legislative provisions. The methodology’s broad inclusion rule supports retaining substantive restrictions when renewed, although it should explicitly explain annual renewals. The headline is not a count of unique policy restrictions.
- **Wording rules pass:** all 16 new entries use “D.C.” where abbreviated, and contain no em-dashes.

`lint-bills.js` passed with zero warnings; `check-published-claims.js` passed all 28 checks. Those results establish internal consistency, not source completeness.

**Verdict: revise before publication to complete Sec. 809’s description and resolve the omitted qualifying provisions; the existing section numbers, fields and counting arithmetic pass.**
Reviewed `cad8ee2` (`git show HEAD`). **BLOCKER: 0. MATERIAL: 0.**

- **NOTE — `src/components/pageSummaryFacts.js:80`:** Pre-existing singular wording mismatch. Rendering one measure produces “1 threat …: bills aimed …”, “resolutions aimed …”, or “budget riders aimed …”. The headline and following verbs agree correctly; the category noun remains plural.
- **NOTE — `scripts/check-published-claims.js:425`:** The claims gate fails because committed `public/api/stats.json` lacks four `progress` fields. This predates HEAD; neither file changed in this commit. All 30 progress-split checks and the changed component’s ESLint check pass.

The requested checks otherwise pass:

- **`src/components/PageSummary.jsx:29`:** “overriding … or limiting …” is grammatically parallel. It describes purpose without implying enactment is still pending, and accommodates bills, resolutions and budget riders. Those mechanisms match [CRS’s explanation of congressional authority over D.C.](https://www.congress.gov/crs_external_products/R/PDF/R47927/R47927.1.pdf)
- **`src/components/pageSummaryFacts.js:50`:** Count 0 renders nothing. Server rendering verified count 1 across all three kinds and pending/passed/enacted states, mixed counts, and the current 74.
- **`src/components/PageSummary.jsx:19`:** Unavailable stats do not affect this component: it derives its text from bill data and never reads `stats.json`.
- **`scripts/check-published-claims.js:257`:** The gate substitutes `...` for the definition; no test or gate depends on the old words. Repo-wide searches found no remaining old phrase used for this definition.

No files modified.

**Verdict: PASS for the wording change, with two pre-existing NOTES.**
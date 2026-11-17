**BLOCKER: 0. MATERIAL: 0.**

- **NOTE — `src/components/pageSummaryFacts.js:80–84`:** Pre-existing singular mismatch. Rendering one measure produces “1 threat …: bills aimed at …”; the same happens with “resolutions” and “budget riders.” Those nouns should be singular when their count is one. The changed phrase itself is grammatical.
- **NOTE — `scripts/check-published-claims.js:424–426`:** The claims gate currently fails four checks because the checked-in `public/api/stats.json` lacks the expected `progress` fields. This is unrelated to the wording change. I did not regenerate files under the read-only instruction.

Checks completed:

- **Rendered states — `src/components/PageSummary.jsx:19–30`:** Zero measures renders no summary. One measure exposes the noun mismatch above. The current 74-measure state reads correctly, including “4 are law.”
- **Stats unavailable — `src/App.jsx:280–286`:** This summary uses bundled bill data directly; unavailable stats do not affect its wording or rendering.
- **Old phrase:** No remaining use of the old definition found across source, documentation, tests, workflows, or the existing build output. The newsletter’s “This resolution would override that decision” describes one specific measure.
- **Tests and gates — `scripts/check-published-claims.js:257`:** None depends on the replaced words. The claims gate substitutes `...` for this clause. All 30 progress checks and the bill lint/golden-label evaluation passed.
- **Accuracy — `src/components/PageSummary.jsx:29–30`:** “Aimed at overriding … or limiting …” describes purpose without implying pending status, successful enactment, or legal force. It accommodates bills, resolutions, and budget riders, enacted or otherwise. That reading is consistent with [House guidance on resolutions](https://www.house.gov/the-house-explained/the-legislative-process/bills-resolutions) and [CRS’s account of congressional control over D.C., including appropriations riders](https://www.congress.gov/crs-product/R47927).

No files modified; working tree remains clean.

**Verdict: The wording change is sound; only the pre-existing singular noun mismatch and unrelated stats-gate failure remain.**
**0 BLOCKER · 1 MATERIAL · 2 NOTE.** Fix the heading semantics before shipping. No files edited.

- **MATERIAL — Heading navigation can regress.** [HowWeTrack.jsx:37](/Users/andriathomas/Projects/dc-bills-tracker/src/components/HowWeTrack.jsx:37): `<h2>` inside `<summary>` is valid HTML, but some screen-reader combinations flatten its heading semantics. Users then lose this section from heading navigation. This is documented in [Chrome’s accessibility guidance](https://developer.chrome.com/docs/modern-web-guidance/guides/accessibility/accessibility), rather than reproduced locally. **Smallest fix:** move the `h2`, retaining its ID, immediately before `<details>` and use plain text inside `<summary>`. Visually hide the external heading if preserving the compact appearance.

- **NOTE — The timeout survives cleanup.** [HowWeTrack.jsx:22](/Users/andriathomas/Projects/dc-bills-tracker/src/components/HowWeTrack.jsx:22): both listeners are correctly removed, but queued callbacks are not cancelled. A callback after unmount is currently harmless because the refs become null. **Smallest fix:** retain the timer ID, clear any previous timer before scheduling, and clear it during cleanup.

- **NOTE — Modified clicks can affect the current tab.** [HowWeTrack.jsx:21](/Users/andriathomas/Projects/dc-bills-tracker/src/components/HowWeTrack.jsx:21): when the current hash already matches, Ctrl/Cmd-clicking the footer link also opens and scrolls the current page. **Smallest fix:** ignore modified, non-primary and default-prevented clicks before scheduling.

The remaining checks look sound:

- **Lifecycle and hashes:** the extracted effect passed in-memory checks for default collapse, initial targeting, `hashchange`, same-hash reopening and missing refs. StrictMode replay leaves one listener per event; its duplicate initial scroll is harmless. Missing `<details>` still permits scrolling to the section.
- **Keyboard and focus:** native summary activation remains intact; no custom keyboard handler is needed. The explicit outline at [HowWeTrack.css:51](/Users/andriathomas/Projects/dc-bills-tracker/src/components/HowWeTrack.css:51) provides visible keyboard focus.
- **Sticky-nav offset:** the 96px scroll margin at [HowWeTrack.css:10](/Users/andriathomas/Projects/dc-bills-tracker/src/components/HowWeTrack.css:10) exceeds the nav’s 66px height plus border.
- **Chevron and markers:** the empty, border-drawn chevron switches direction correctly. `display: flex`/`list-style: none` cover Firefox and Chrome; the separate WebKit marker rule covers Safari, consistent with [MDN guidance](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/summary#default_style).

Targeted ESLint and diff whitespace checks passed. Browser rendering and screen-reader interaction remain unverified.
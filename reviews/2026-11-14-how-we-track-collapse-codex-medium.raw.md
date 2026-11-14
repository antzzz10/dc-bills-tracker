**0 BLOCKER, 0 MATERIAL; 2 NOTEs.** No files edited.

- **NOTE — Heading semantics vary across screen readers.** [HowWeTrack.jsx:36–37](/Users/andriathomas/Projects/dc-bills-tracker/src/components/HowWeTrack.jsx:36): `<h2>` inside `<summary>` is valid HTML, but some browsers flatten its heading role. The disclosure remains operable; heading navigation may miss it. [MDN documents this limitation](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/summary#summaries_as_headings). **Smallest response:** verify VoiceOver/Safari and NVDA/Firefox or Chrome. If reliable heading navigation is required, use an external heading; retaining a single interactive heading requires the larger `h2 > button` accordion pattern.

- **NOTE — Deferred click callbacks survive cleanup.** [HowWeTrack.jsx:22](/Users/andriathomas/Projects/dc-bills-tracker/src/components/HowWeTrack.jsx:22) schedules a timeout, while cleanup at lines 27–30 removes only listeners. After unmount, null refs make the callback harmless; this is not a persistent listener leak. **Smallest fix:** retain the timeout ID, cancel any previous pending timeout before scheduling, and call `clearTimeout` during cleanup.

The other requested checks look correct:

- **Events/StrictMode:** listener identities match cleanup. Repeated setup opens idempotently rather than toggling. Initial hash, hash changes, and unchanged-hash link clicks are covered.
- **Missing elements:** null `detailsRef` skips opening safely; an existing section still scrolls. Null section refs safely skip scrolling.
- **Sticky nav:** [HowWeTrack.css:10](/Users/andriathomas/Projects/dc-bills-tracker/src/components/HowWeTrack.css:10) provides 96px clearance against the nav’s 66px height plus 1px border. Opening happens before scrolling.
- **Keyboard/focus:** native summary behavior supplies keyboard activation. The explicit [focus-visible outline](/Users/andriathomas/Projects/dc-bills-tracker/src/components/HowWeTrack.css:51) is clear, with no overriding outline removal found.
- **Chevron/markers:** [CSS lines 14–37](/Users/andriathomas/Projects/dc-bills-tracker/src/components/HowWeTrack.css:14) correctly combines flex/list-style removal for Firefox/Chrome with a separate WebKit marker rule for Safari. The empty pseudo-element adds no spoken text. [Browser styling reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/summary#default_style).

Validation: focused ESLint, diff whitespace check, and an isolated event/ref harness passed. Repository-wide lint fails outside these files (1,059 errors). Browser rendering and assistive-technology behavior were not exercised; build was not run because it writes files.
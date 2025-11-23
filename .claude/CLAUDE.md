# DC Bills Tracker - Project Memory

## Project Overview
A React web application that tracks anti-DC bills pending in the U.S. Congress. Helps users monitor legislation affecting Washington, DC through a searchable, filterable interface.

**Tech Stack:** React 19 + Vite + jsPDF (for PDF exports)

## Project Structure

```
dc-bills-tracker/
├── src/
│   ├── App.jsx              # Main application component
│   ├── main.jsx             # React entry point
│   ├── components/          # React components
│   │   ├── BillCard.jsx     # Individual bill display
│   │   ├── CategoryFilter.jsx
│   │   ├── SearchBar.jsx
│   │   ├── CategoryGroup.jsx
│   │   ├── DownloadButton.jsx
│   │   ├── UpdateBanner.jsx
│   │   ├── PassedBillsSection.jsx  # Display bills that passed
│   │   └── ContactSection.jsx      # Feedback form section
│   ├── data/                # Bill data storage
│   └── assets/              # Static assets
├── public/                  # Public assets
├── dist/                    # Build output (not in git)
├── scripts/                 # Deployment & utility scripts
├── deploy-staging.js        # Staging deployment script
└── FEEDBACK-SETUP.md        # Guide for setting up automated feedback
```

## Common Commands

### Development
```bash
npm run dev          # Start dev server with hot reload
npm run build        # Build for production
npm run preview      # Preview production build locally
npm run lint         # Run ESLint
```

### Deployment
```bash
npm run deploy              # Deploy to GitHub Pages (production)
npm run deploy:staging      # Deploy to staging environment
```

## Development Guidelines

### Code Style
- React 19 (latest version) with functional components
- Use JSX for components
- Component files use `.jsx` extension
- ESLint is configured - run `npm run lint` before committing

### Component Organization
- Small, focused components in `src/components/`
- Main app logic in `App.jsx`
- Data stored separately in `src/data/`

### Dependencies
**Core:**
- React 19.1.1 & React DOM 19.1.1
- Vite 7.1.7 (build tool)

**Features:**
- jsPDF + jspdf-autotable (PDF generation)

**Dev Tools:**
- ESLint with React plugins
- gh-pages (deployment)

## Deployment Process

### GitHub Pages (Production)
1. Update code and commit changes
2. Run `npm run deploy`
3. Site deploys to `gh-pages` branch
4. Live at: `https://[username].github.io/dc-bills-tracker/`

**Important:** The `base` path in `vite.config.js` must match the repository name.

### Staging Environment
- Uses `deploy-staging.js` script
- Run with `npm run deploy:staging`

## Key Configuration Files

- `vite.config.js` - Vite build configuration (sets base path for GH Pages)
- `eslint.config.js` - Linting rules
- `package.json` - Dependencies and scripts
- `DEPLOYMENT.md` - Detailed deployment instructions

## Data Management

### Data Structure (`src/data/bills.json`)

The bills data uses a three-section structure:

1. **`bills`** (54 items) - Primary bills to oppose
2. **`riders`** (17 items) - Budget riders in appropriations bills (H.R. 5166)
3. **`supportBills`** (0 items currently) - Pro-DC bills to support

Each bill/rider includes:
- `position`: "oppose" | "support"
- `type`: "bill" | "rider"
- `priority`: "high" | "medium" | "low" | "watching"
- `prioritySource`: "freedc" | "legislative" | "manual"
- `status`: Object with stage, actions, hearing/markup flags, cosponsors
  - `stage`: null | "passed-house" | "passed-senate" | "enacted"
- `passage`: (Optional) Detailed vote data when bill passes
  - `house`: { date, vote: { yeas, nays, byParty: { republican, democrat } } }
  - `senate`: (Same structure as house)
- `fullTitle`: (Optional) Full bill title for display

### Priority System

**High Priority** - Bills that meet any of:
- Listed on FreeDC's active opposition list
- Has had committee hearing
- Has had committee markup
- Has had floor vote
- 20+ cosponsors
- Manual override

**Medium Priority** - Bills with:
- 5-19 cosponsors
- In committee (no hearing yet)

**Watching/Low** - Recently introduced, no activity

### Passed Bills Tracking

The site now separates passed bills from pending bills:

**Display Logic:**
- Bills with `status.stage` starting with "passed-" or "enacted" appear in the **PassedBillsSection** at the top
- All other bills (pending) appear in the regular High Priority / Riders / Other Bills sections

**PassedBillsSection Features:**
- Collapsed by default (expandable)
- Red border and styling to indicate urgency
- Shows vote breakdown: Total (Yeas-Nays) and by party (R/D)
- Displays passage date
- Links to Congress.gov for details
- Alert icon with pulse animation

**UpdateBanner (Automatic Updates):**
The banner at the top of the page automatically updates based on bills.json data:
- Shows recently passed bills (within last 30 days) with vote counts
- Shows upcoming floor votes if no recent passages
- Auto-generates message: "H.R. XXXX passed the House (XXX-XXX). Now headed to Senate."
- Hides automatically if no important updates
- Updates every time bills.json changes (no manual editing needed!)

The banner prioritizes:
1. Recently passed bills (most urgent)
2. Upcoming floor votes (if no recent passages)
3. Hides if nothing important to show

**Recent Passed Bills (as of 2025-11-19):**
- H.R. 5214 - District of Columbia Cash Bail Reform Act of 2025 (237-179)
- H.R. 5107 - Common-Sense Law Enforcement and Accountability Now in D.C. Act (233-190)

Both passed the House and are now headed to the Senate.

### Automated Monitoring

Use `scripts/monitor-bills.js` to:
- Fetch latest bill status from Congress.gov API
- **Auto-detect when bills pass** House or Senate
- **Fetch detailed vote data** including party breakdown
- **Automatically update bills.json** with passage information
- Auto-detect priority based on legislative activity
- Generate reports grouped by priority
- Track changes over time

**New Features (Enhanced Passage Detection):**
- Detects passage in House/Senate from bill actions
- Extracts roll call vote numbers
- Fetches vote totals and party breakdowns (R/D)
- Updates bills.json with `passage` field and `status.stage`
- Displays passage summary at end of run

**Setup:**
1. Get API key: https://api.congress.gov/sign-up/
2. Set environment variable: `export CONGRESS_API_KEY=your_key`
3. Run: `node scripts/monitor-bills.js`
4. See detailed docs: `scripts/README-MONITORING.md`

**GitHub Actions:** Monitoring runs daily at 2 PM UTC via `.github/workflows/monitor-bills.yml`

When the script detects passage, it automatically:
- Updates `status.stage` to "passed-house" or "passed-senate"
- Adds `passage.house` or `passage.senate` with vote data
- Shows alert: 🚨 BILLS THAT HAVE PASSED 🚨
- Saves changes to bills.json

### Updating Data Structure

When the FreeDC list changes or new bills are introduced, use:
```bash
node scripts/update-bill-structure.js
```

This script reorganizes bills.json, separates riders, and applies FreeDC priority flags.

## Automated Feedback System

The site includes an automated feedback collection system that uses AI to analyze and categorize submissions.

**How it works:**
1. Users submit feedback via embedded Google Form (ContactSection component)
2. Submissions auto-save to Google Sheets
3. Apps Script triggers on submission
4. OpenAI API analyzes feedback and adds:
   - Category (Bug, Feature Request, Question, Feedback, etc.)
   - Sentiment (Positive, Neutral, Negative)
   - Priority (High, Medium, Low)
   - AI-generated summary
   - Response draft for quick replies
5. All feedback stored in one spreadsheet for easy review

**Setup Instructions:**
- See `FEEDBACK-SETUP.md` for complete setup guide
- Requires: Google Form, Google Sheets, Apps Script, OpenAI API key
- Cost: ~$0.01-0.05 per submission for AI analysis

**To activate the form on the site:**
1. Follow setup in `FEEDBACK-SETUP.md` to create Google Form and Apps Script
2. Copy your Google Form ID
3. Edit `src/components/ContactSection.jsx` - replace `REPLACE_WITH_YOUR_FORM_ID`
4. Edit `src/App.jsx` - uncomment the ContactSection import and usage (lines 10 and 229-230)
5. Rebuild and deploy: `npm run build && npm run deploy`

**Current status:** ContactSection component is built but commented out (hidden) in App.jsx until Google Form is configured

## Known Constraints

- Repository name must be exactly `dc-bills-tracker` for GitHub Pages to work correctly
- Vite base path is configured for GitHub Pages deployment
- Using React 19 (latest) - check compatibility when adding new libraries

## Troubleshooting

### Blank page after deployment
- Verify `base` in `vite.config.js` matches repo name
- Check GitHub Pages settings (Settings → Pages → gh-pages branch)

### Build errors
- Run `npm run lint` to catch issues
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`

## Future Enhancements to Consider

- TypeScript migration (see README note about TS template)
- React Compiler (currently disabled for performance reasons)
- Automated bill data updates
- Custom domain setup

## Related Documentation

- Full deployment guide: `DEPLOYMENT.md`
- React + Vite setup: `README.md`

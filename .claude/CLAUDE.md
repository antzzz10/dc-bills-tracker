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
│   │   └── UpdateBanner.jsx
│   ├── data/                # Bill data storage
│   └── assets/              # Static assets
├── public/                  # Public assets
├── dist/                    # Build output (not in git)
├── scripts/                 # Deployment & utility scripts
└── deploy-staging.js        # Staging deployment script
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

### Automated Monitoring

Use `scripts/monitor-bills.js` to:
- Fetch latest bill status from Congress.gov API
- Auto-detect priority based on legislative activity
- Generate reports grouped by priority
- Track changes over time

**Setup:**
1. Get API key: https://api.congress.gov/sign-up/
2. Set environment variable: `export CONGRESS_API_KEY=your_key`
3. Run: `node scripts/monitor-bills.js`
4. Test without API: `node scripts/test-monitor.js`

**GitHub Actions:** Monitoring runs daily at 2 PM UTC via `.github/workflows/monitor-bills.yml`

### Updating Data Structure

When the FreeDC list changes or new bills are introduced, use:
```bash
node scripts/update-bill-structure.js
```

This script reorganizes bills.json, separates riders, and applies FreeDC priority flags.

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

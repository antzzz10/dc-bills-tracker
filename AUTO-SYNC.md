# Auto-Sync Between Main Site and Bill Tracker

This document explains how the main site (www.representdc.org) stays automatically in sync with the bill tracker (billtracker.representdc.org).

## How It Works

### 1. **Bill Tracker Generates Stats API**

Every time the bill tracker builds, it automatically runs `scripts/generate-stats.js` which:
- Reads `src/data/bills.json`
- Counts total bills, pending bills, passed bills
- Generates `public/api/stats.json`
- This file is deployed with the site

**File generated:** `https://billtracker.representdc.org/api/stats.json`

**Example output:**
```json
{
  "lastUpdated": "2025-11-19",
  "totalBills": 71,
  "pendingBills": 69,
  "passedBills": 2,
  "breakdown": {
    "bills": 54,
    "riders": 17,
    "supportBills": 0
  },
  "passed": [
    {
      "id": "hr5107-s2687",
      "number": "H.R. 5107",
      "title": "CLEAN DC Act",
      "stage": "passed-house"
    }
  ]
}
```

### 2. **Main Site Fetches Stats**

The main site uses a React hook (`useBillStats.js`) that:
- Fetches from `https://billtracker.representdc.org/api/stats.json`
- Updates all bill counts dynamically
- Falls back to hardcoded values if fetch fails

**Hook location:** `representdc-main/src/hooks/useBillStats.js`

### 3. **Automatic Updates**

When bills.json changes:
1. Run `npm run build` in bill tracker (generates new stats.json)
2. Run `npm run deploy` in bill tracker (deploys stats.json)
3. Main site automatically fetches new stats on next page load
4. ✨ Everything stays in sync!

## Build Process

### Bill Tracker
```bash
cd ~/Projects/dc-bills-tracker
npm run build    # Runs: generate-stats.js && vite build
npm run deploy   # Deploys to billtracker.representdc.org
```

### Main Site
```bash
cd ~/Projects/representdc-main
npm run build    # Fetches stats at runtime
npm run deploy   # Deploys to www.representdc.org
```

## Manual Stats Generation

You can manually regenerate stats without building:
```bash
cd ~/Projects/dc-bills-tracker
npm run stats    # Just runs generate-stats.js
```

## What Gets Synced

The main site now dynamically shows:
- **Total bills** (71) - includes all bills and riders
- **Pending bills** (69) - excludes passed bills
- **Passed bills** (2) - bills that passed House/Senate
- **Last updated date** (2025-11-19)

### Where These Appear on Main Site

1. **Hero section:** "{totalBills} bills pending..."
2. **Hero CTA:** "See All {totalBills} Bills →"
3. **Hero note:** "{passedBills} bills just passed..."
4. **Facts section:** Large number showing {totalBills}
5. **Trend section:** Shows both {totalBills} and {pendingBills}
6. **Footer link:** "See all {totalBills} bills →"

## Fallback Behavior

If the API fetch fails (network issue, CORS, etc.):
- Main site uses hardcoded fallback values
- Shows last known counts (71 total, 69 pending, 2 passed)
- Console warning logged (not shown to user)
- Site continues to work normally

## CORS Configuration

The stats.json file is served as a static asset from GitHub Pages, so:
- ✅ No CORS issues (same-origin policy doesn't apply to static files)
- ✅ No backend needed
- ✅ Fast CDN delivery

## Monitoring Script Integration

When the monitoring script (`scripts/monitor-bills.js`) detects passage:
1. Updates `bills.json` with passage data
2. Run `npm run build` to regenerate stats.json
3. Run `npm run deploy` to deploy updated data
4. Main site automatically picks up changes

## Future Enhancements

Potential improvements:
- Cache stats in localStorage with TTL
- Show loading state while fetching
- Display "Updated X minutes ago" timestamp
- Add webhook to auto-deploy main site when bill tracker changes
- Create GitHub Action to auto-deploy both sites together

## Troubleshooting

### Main site showing old numbers
- Check if bill tracker deployed successfully
- Verify stats.json exists: https://billtracker.representdc.org/api/stats.json
- Clear browser cache
- Check browser console for fetch errors

### Stats.json not updating
- Ensure `generate-stats.js` ran during build (check build logs)
- Verify `public/api/` directory exists in bill tracker
- Check that gh-pages deployed the `api/` folder

### Counts still don't match
- Check both sites are using same source of truth
- Verify passed bills are correctly filtered in generate-stats.js
- Compare counts in bills.json manually

## Testing

To test the sync:
```bash
# 1. Update bills.json (e.g., mark another bill as passed)
cd ~/Projects/dc-bills-tracker
# Edit src/data/bills.json

# 2. Regenerate stats
npm run stats

# 3. Check the output
cat public/api/stats.json

# 4. Deploy bill tracker
npm run build && npm run deploy

# 5. Wait 1-2 minutes for GitHub Pages to update

# 6. Check the API
curl https://billtracker.representdc.org/api/stats.json

# 7. Reload main site - should show new numbers
open https://www.representdc.org
```

## Key Files

**Bill Tracker:**
- `scripts/generate-stats.js` - Generates the API
- `public/api/stats.json` - The API endpoint
- `src/data/bills.json` - Source of truth
- `package.json` - Build script includes stats generation

**Main Site:**
- `src/hooks/useBillStats.js` - Fetches and manages stats
- `src/App.jsx` - Uses the hook throughout
- All bill counts are dynamic (no hardcoded numbers in JSX)

## Summary

✅ **Automatic:** Stats update whenever bill tracker rebuilds
✅ **Real-time:** Main site fetches latest stats on every page load
✅ **Reliable:** Falls back to safe defaults if fetch fails
✅ **Simple:** No backend, no database, just static JSON
✅ **Fast:** CDN-delivered, cached by browsers

Both sites now stay in sync automatically! 🎉

# How to Verify the Monitoring Script is Working

This guide shows you how to confirm the automated Congress.gov monitoring is working and that updates appear on both sites.

## Quick Verification Checklist

### 1. Check When Monitoring Last Ran

```bash
# Check if monitoring has run before
ls -lah bill-status-history.json

# View the last run (if file exists)
tail -50 bill-status-history.json
```

**What to look for:**
- File exists → monitoring has run at least once
- Recent timestamp → monitoring ran recently
- Check the `timestamp` field in the JSON

### 2. Check for Recent Bill Updates

```bash
# Check bills.json last updated date
grep -A 1 '"lastUpdated"' src/data/bills.json

# Check which bills have passage data
grep -B 5 '"passage"' src/data/bills.json
```

**What to look for:**
- `lastUpdated` date should be recent (within last few days)
- Bills with `"stage": "passed-house"` or `"passed-senate"` are passed bills
- Bills with `"passage": { "house": ... }` have detailed vote data

### 3. Check What Will Show in the Banner

The banner shows bills that passed **today** or within the last few days. Check:

```bash
# See which bills have passed
cat src/data/bills.json | grep -A 20 '"stage": "passed-house"'
cat src/data/bills.json | grep -A 20 '"stage": "passed-senate"'
```

**Banner Rules (from UpdateBanner.jsx):**
- Only shows bills with `status.stage = "passed-house"` or `"passed-senate"`
- Shows passage date from `status.lastActionDate`
- Hides automatically after a few days

**Current passed bills that should appear in banner:**
- H.R. 5107 (CLEAN DC Act) - passed House
- H.R. 5214 (DC Cash Bail Reform Act) - passed House

### 4. Run Monitoring Manually (Testing)

To test the monitoring script right now:

```bash
# Make sure you have API key set
export CONGRESS_API_KEY=your_key_here

# Run the monitoring script
node scripts/monitor-bills.js
```

**What you'll see:**
```
🔍 Starting bill monitoring...
📊 Checking 54 bills

[1/54] Checking H.R. 5107...
  🔴 Priority: high (Floor vote occurred)
[2/54] Checking H.R. 5214...
  🗳️  Detected House passage with roll call 586
  ✓ House vote data: 237-179
  ✓ Updated stage to: passed-house
  ✓ Added House vote data: 237-179
  💾 Updated bills.json
  🔴 Priority: high (Floor vote occurred)

...

🚨 BILLS THAT HAVE PASSED 🚨
================================================================================

📜 H.R. 5214: District of Columbia Cash Bail Reform Act
   Stage: passed-house
   House: 237-179 on 2025-11-19
   Party breakdown: R 209-0, D 28-179

✅ Monitoring complete!

📋 BILL STATUS REPORT
...
💾 Results saved to: bill-status-history.json
```

**Key sections to watch:**
- **"🚨 BILLS THAT HAVE PASSED"** - Shows newly detected passages
- **"💾 Updated bills.json"** - Confirms data was saved
- **High priority bills** - Bills with significant activity

### 5. Verify Updates Appear on Sites

After monitoring runs and detects changes:

**A. Check bills.json was updated:**
```bash
git status
# Should show: modified: src/data/bills.json
```

**B. Rebuild and deploy:**
```bash
npm run build    # Regenerates stats.json
npm run deploy   # Deploys to billtracker.representdc.org
```

**C. Wait 1-2 minutes, then check both sites:**

**Bill Tracker (billtracker.representdc.org):**
- ✅ Banner at top shows: "2 bills just passed the House on November 19"
- ✅ "Bills That Have Passed" section shows H.R. 5107 and H.R. 5214
- ✅ Main count shows "69 bills" (71 total minus 2 passed)

**Main Site (www.representdc.org):**
- ✅ Hero: "71 bills pending in Congress"
- ✅ Hero note: "2 bills just passed the House"
- ✅ All counts automatically sync via API

### 6. Check the Stats API

```bash
# Verify stats API is current
curl https://billtracker.representdc.org/api/stats.json
```

Should show:
```json
{
  "lastUpdated": "2025-11-19",
  "totalBills": 71,
  "pendingBills": 69,
  "passedBills": 2,
  "passed": [
    {
      "id": "hr5107-s2687",
      "number": "H.R. 5107",
      "title": "CLEAN DC Act",
      "stage": "passed-house"
    },
    {
      "id": "hr5214",
      "number": "H.R. 5214",
      "title": "District of Columbia Cash Bail Reform Act",
      "stage": "passed-house"
    }
  ]
}
```

## What Makes Information "Banner Worthy"?

The banner shows when bills **pass** a chamber. The monitoring script detects:

### ✅ Banner-Worthy Events:
- ✅ **Bill passed House** → Shows "X bills just passed the House"
- ✅ **Bill passed Senate** → Shows "X bills just passed the Senate"
- ✅ **Bill became law** → Shows "X bills became law"

### ❌ Not Banner-Worthy:
- ❌ Bill introduced
- ❌ Referred to committee
- ❌ Committee hearing scheduled
- ❌ Cosponsors added

### Detection Logic (from monitor-bills.js):

The script looks for these action phrases:
- "On passage Passed by recorded vote"
- "On passage Passed by the Yeas and Nays"
- "Passed House"
- "Passed Senate"
- "Became Public Law"

When detected, it:
1. Sets `status.stage` to `"passed-house"` or `"passed-senate"`
2. Adds `passage.house` or `passage.senate` with vote details
3. Updates `status.lastActionDate` to passage date

## Automated Schedule

**Current Setup:** Manual runs only

**To Set Up Automation:**
You can create a GitHub Action to run this daily:

```yaml
# .github/workflows/monitor-bills.yml
name: Monitor Bills
on:
  schedule:
    - cron: '0 14 * * *'  # Daily at 2 PM UTC (9 AM EST)
  workflow_dispatch:  # Allow manual trigger

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: node scripts/monitor-bills.js
        env:
          CONGRESS_API_KEY: ${{ secrets.CONGRESS_API_KEY }}
      - name: Commit changes
        run: |
          git config user.name "Bill Monitor Bot"
          git config user.email "bot@representdc.org"
          git add src/data/bills.json
          git commit -m "Update bill statuses [automated]" || echo "No changes"
          git push
      - run: npm run deploy
```

## Troubleshooting

### "No history file found"
- ✅ Normal - means monitoring hasn't run yet
- Run `node scripts/monitor-bills.js` to create it

### "CONGRESS_API_KEY not set"
- Get API key: https://api.congress.gov/sign-up/
- Set it: `export CONGRESS_API_KEY=your_key_here`
- Add to `.bashrc` or `.zshrc` for persistence

### Monitoring runs but no updates
- ✅ Good news - means no bills passed recently!
- Script still saves status to `bill-status-history.json`
- Check high priority bills in the report for bills to watch

### Banner not showing on site
- Check `src/data/bills.json` has bills with `stage: "passed-house"` or `"passed-senate"`
- Check `status.lastActionDate` is recent (within last 3-5 days)
- UpdateBanner component filters by date automatically
- Rebuild and redeploy: `npm run build && npm run deploy`

### Sites showing different numbers
- ✅ This should be fixed now with auto-sync!
- Main site fetches from billtracker API
- If still mismatched: clear browser cache and reload

## Quick Reference Commands

```bash
# Test monitoring manually
export CONGRESS_API_KEY=your_key_here
node scripts/monitor-bills.js

# Check last monitoring run
cat bill-status-history.json | grep -A 5 '"timestamp"' | tail -10

# Check passed bills
grep -B 2 -A 15 '"stage": "passed' src/data/bills.json

# Rebuild stats and deploy
npm run build && npm run deploy

# Verify API is updated (wait 2 min after deploy)
curl https://billtracker.representdc.org/api/stats.json | grep -E '"(totalBills|passedBills|lastUpdated)"'

# Check if changes need committing
git status | grep bills.json
```

## Summary

**To verify monitoring worked:**
1. ✅ Check `bill-status-history.json` exists with recent timestamp
2. ✅ Check `bills.json` has `lastUpdated` date and passed bills with `"stage": "passed-house"`
3. ✅ Run `npm run build && npm run deploy` to update both sites
4. ✅ Check banner on billtracker.representdc.org shows passage notice
5. ✅ Check main site shows correct counts via auto-sync API

**For banner to show passage:**
- Bill must have `status.stage` = `"passed-house"` or `"passed-senate"`
- Passage date must be recent (within ~3-5 days)
- Banner auto-hides for older passages

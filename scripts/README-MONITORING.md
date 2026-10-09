# Enhanced Bill Monitoring Script

The `monitor-bills.js` script now automatically detects when bills pass the House or Senate and updates `bills.json` with detailed vote information.

## What's New

### Automatic Passage Detection
- ✅ Detects when bills pass House or Senate
- ✅ Extracts roll call vote numbers from action text
- ✅ Fetches detailed vote breakdowns from Congress.gov API
- ✅ Parses vote counts by party (Republican/Democrat)
- ✅ Automatically updates `bills.json` with passage data

### How It Works

1. **Scans bill actions** for passage indicators like:
   - "On passage Passed by recorded vote"
   - "On passage Passed by the Yeas and Nays"
   - "Passed House" / "Passed Senate"

2. **Extracts vote info** from action text:
   - Roll call number (e.g., "Roll no. 586")
   - Passage date

3. **Fetches roll call details** via Congress.gov API:
   - Total yeas and nays
   - Vote breakdown by party
   - Individual member votes

4. **Updates bills.json** automatically:
   - Sets `status.stage` to "passed-house" or "passed-senate"
   - Adds `passage` object with vote details
   - Updates `lastUpdated` timestamp

## Usage

### Setup
```bash
# Get your API key from: https://api.congress.gov/sign-up/
export CONGRESS_API_KEY=your_key_here

# Run the monitoring script
node scripts/monitor-bills.js
```

### Output Example

When a bill passes, you'll see:

```
[15/54] Checking H.R. 5214...
  🗳️  Detected House passage with roll call 586
  ✓ House vote data: 237-179
  ✓ Updated stage to: passed-house
  ✓ Added House vote data: 237-179
  💾 Updated bills.json
  🔴 Priority: high (Floor vote occurred)
```

### Passage Summary

At the end of the run, all newly-detected passed bills are summarized:

```
🚨 BILLS THAT HAVE PASSED 🚨
================================================================================

📜 H.R. 5214: District of Columbia Cash Bail Reform Act
   Stage: passed-house
   House: 237-179 on 2025-11-19
   Party breakdown: R 209-0, D 28-179
```

## Data Structure

When a bill passes, the script adds this to `bills.json`:

```json
{
  "status": {
    "stage": "passed-house",
    "lastAction": "Passed House",
    "lastActionDate": "2025-11-19",
    "hasFloorVote": true
  },
  "passage": {
    "house": {
      "date": "2025-11-19",
      "vote": {
        "yeas": 237,
        "nays": 179,
        "byParty": {
          "republican": { "yeas": 209, "nays": 0 },
          "democrat": { "yeas": 28, "nays": 179 }
        }
      }
    }
  }
}
```

## Automated Monitoring

The GitHub Actions workflow runs this script daily at 13:41 UTC (GitHub often fires scheduled runs hours late). When bills pass, the workflow:
1. Detects the passage automatically
2. Updates `bills.json` with vote data
3. Commits the changes to the repository
4. Can trigger notifications (if configured)

## Rate Limiting

The script includes built-in rate limiting (300ms between bills) to respect Congress.gov API limits.

## Troubleshooting

### "Could not fetch roll call vote"
- The API might not have vote data yet (usually available within hours)
- The roll call number extraction might have failed (check action text format)

### "Could not find bill in bills.json"
- Ensure the bill ID in bills.json matches the expected format

### Data not updating
- Check that bills.json has write permissions
- Verify the bill doesn't already have passage data (script won't overwrite)

## Future Enhancements

- Email/Slack notifications when bills pass
- Automatic deployment to website when bills.json changes
- Tracking of amendments and procedural votes
- Historical vote analysis

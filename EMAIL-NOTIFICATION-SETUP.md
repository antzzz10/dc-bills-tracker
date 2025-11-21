# Email Notification Setup for Bill Monitoring

The monitoring workflow now sends email notifications after each run. Here's how to set it up.

## What You'll Receive

After each monitoring run (daily at 9 AM EST), you'll get an email with:

- ✅ Timestamp of when monitoring ran
- ✅ Number of bills checked
- ✅ Attached monitoring report with full details
- ✅ Link to GitHub Actions run for complete logs

**Subject:** `DC Bills Monitoring Report - [timestamp]`

## Setup Instructions

### Option 1: Gmail (Recommended for personal use)

1. **Create an App Password for Gmail:**
   - Go to: https://myaccount.google.com/apppasswords
   - Sign in to your Google account
   - Create a new app password named "DC Bills Monitor"
   - Copy the 16-character password (looks like: `abcd efgh ijkl mnop`)

2. **Add GitHub Secrets:**

   Go to: https://github.com/antzzz10/dc-bills-tracker/settings/secrets/actions

   Add these three secrets:

   | Secret Name | Value |
   |------------|-------|
   | `EMAIL_USERNAME` | Your Gmail address (e.g., `yourname@gmail.com`) |
   | `EMAIL_PASSWORD` | The 16-character app password from step 1 |
   | `NOTIFICATION_EMAIL` | Email where you want to receive reports (can be same as EMAIL_USERNAME) |

3. **Done!** Next monitoring run will send you an email.

### Option 2: Other Email Providers

If you don't use Gmail, update the workflow settings in `.github/workflows/monitor-bills.yml`:

**For Outlook/Hotmail:**
```yaml
server_address: smtp-mail.outlook.com
server_port: 587
secure: true
```

**For Yahoo:**
```yaml
server_address: smtp.mail.yahoo.com
server_port: 465
secure: true
```

**For Custom SMTP:**
```yaml
server_address: smtp.yourdomain.com
server_port: 587  # or 465 for SSL
secure: true
```

Then add the same three GitHub secrets with your provider's credentials.

## Testing

### Test the Notification

1. Go to: https://github.com/antzzz10/dc-bills-tracker/actions/workflows/monitor-bills.yml
2. Click **"Run workflow"**
3. Select branch: `main`
4. Click **"Run workflow"**
5. Wait 2-3 minutes
6. Check your email inbox for the monitoring report

### Troubleshooting

**No email received:**
- ✅ Check spam folder
- ✅ Verify all three secrets are set correctly in GitHub
- ✅ For Gmail: ensure 2FA is enabled and you're using an app password (not your regular password)
- ✅ Check the GitHub Actions log for email send errors

**Email send fails with "Authentication failed":**
- Gmail: Use app password, not regular password
- Outlook: May need to enable "less secure apps" or create app password
- Check username/password are correct in secrets

**Email received but no attachment:**
- The workflow only attaches the report if monitoring found changes
- Check the GitHub Actions artifacts page for the report

## What's in the Email Report

The attached `monitoring-report.txt` contains:

```
🔍 Starting bill monitoring...
📊 Checking 71 bills

[1/71] Checking H.R. 5107...
  🔴 Priority: high (Floor vote occurred)
[2/71] Checking H.R. 5214...
  🗳️  Detected House passage with roll call 586
  ✓ Updated stage to: passed-house
  💾 Updated bills.json
...

🚨 BILLS THAT HAVE PASSED 🚨
================================================================================
📜 H.R. 5214: District of Columbia Cash Bail Reform Act
   Stage: passed-house
   House: 237-179 on 2025-11-19
   Party breakdown: R 209-0, D 28-179

✅ Monitoring complete!

📋 BILL STATUS REPORT
================================================================================
Total bills checked: 71
Successful checks: 71
Errors: 0

🔴 HIGH PRIORITY BILLS (15)
  H.R. 5107: CLEAN DC Act
  Status: PASSED_ONE_CHAMBER
  Priority reason: Floor vote occurred
  Latest: Received in the Senate...
  ...

🟡 MEDIUM PRIORITY BILLS (8)
  ...

⚪ WATCHING (48)
  ...
```

## Customizing the Email

### Change Email Subject

Edit `.github/workflows/monitor-bills.yml` line 87:

```yaml
subject: "Your Custom Subject - ${{ steps.check_changes.outputs.timestamp }}"
```

### Change Email Body

Edit lines 90-97 to customize the message:

```yaml
body: |
  Your custom message here.

  Bills checked: ${{ steps.check_changes.outputs.changes_count }}
  Time: ${{ steps.check_changes.outputs.timestamp }}
```

### Send Only When Bills Pass

To only receive emails when bills actually pass (not every day), change line 78:

```yaml
# Current: sends every time monitoring runs
if: steps.check_changes.outputs.has_changes == 'true'

# Change to: only send when bills.json changes (passage detected)
if: steps.check_changes.outputs.has_changes == 'true' && contains(github.event.head_commit.message, 'passage')
```

## Multiple Recipients

To send to multiple email addresses, use commas:

```yaml
to: email1@example.com,email2@example.com,email3@example.com
```

Or set `NOTIFICATION_EMAIL` secret to a comma-separated list.

## Disable Email Notifications

To turn off emails temporarily without removing the configuration:

1. Go to workflow file: `.github/workflows/monitor-bills.yml`
2. Comment out the email step (add `#` before lines 78-100)
3. Or change `if: steps.check_changes.outputs.has_changes == 'true'` to `if: false`

## Security Notes

- ✅ **Never commit email passwords to code** - always use GitHub secrets
- ✅ **Use app passwords** (Gmail, Outlook) instead of main account passwords
- ✅ **Enable 2FA** on your email account for better security
- ✅ **Rotate passwords** periodically (update GitHub secret)
- ✅ **Monitor access logs** in your email account for suspicious activity

## Alternative: GitHub Notifications

If you don't want to set up email, you can use GitHub's built-in notifications:

1. Go to: https://github.com/antzzz10/dc-bills-tracker/settings/notifications
2. Enable "Actions" notifications
3. You'll get GitHub notifications when workflows complete

This doesn't include the detailed report, but you can view it in:
- GitHub Actions artifacts
- The workflow run logs

## Summary

Once configured, you'll automatically receive:
- ✅ Daily monitoring reports via email
- ✅ Attached text file with full bill analysis
- ✅ High/medium/low priority breakdowns
- ✅ Alerts when bills pass chambers
- ✅ Link to full logs on GitHub

No manual checks needed - just read your email! 📧

# Automated Feedback System Setup Guide

This guide walks you through setting up an automated feedback system that saves submissions to Google Sheets and uses AI to categorize and analyze them.

## Overview

**What this does:**
- Users submit feedback via Google Form (embedded on your site)
- Submissions automatically save to Google Sheets
- AI analyzes each submission and adds:
  - Category (Bug, Feature Request, Question, Feedback, etc.)
  - Sentiment (Positive, Neutral, Negative)
  - Priority (High, Medium, Low)
  - Summary
  - Response draft
- Everything in one spreadsheet for easy review

**Cost:** Free (except ~$0.01-0.05 per submission for OpenAI API calls)

---

## Step 1: Create Google Form (5 minutes)

1. Go to https://forms.google.com
2. Click **+ Blank** to create a new form
3. Title: "DC Bills Tracker Feedback"
4. Add these questions:

   **Question 1:**
   - Type: Short answer
   - Question: "Email Address"
   - Required: Yes
   - Validation: Response validation → Text → Email

   **Question 2:**
   - Type: Short answer
   - Question: "Subject (Optional)"
   - Required: No

   **Question 3:**
   - Type: Paragraph
   - Question: "Your Feedback"
   - Required: Yes
   - Description: "Bug reports, feature requests, questions, or general feedback"

   **Question 4:**
   - Type: Multiple choice
   - Question: "Type of Feedback (Optional)"
   - Options:
     - Bug Report
     - Feature Request
     - Question
     - General Feedback
     - Other
   - Required: No

5. Click **Settings** (gear icon)
   - General tab:
     - ✓ Collect email addresses
     - ✓ Limit to 1 response (optional - prevents spam)
   - Presentation tab:
     - Confirmation message: "Thank you for your feedback! We'll review it shortly."

6. Click **Send** → **< >** (embed icon)
7. Copy the iframe code (you'll use this in Step 5)

---

## Step 2: Create Google Sheet (2 minutes)

1. In your Google Form, click **Responses** tab
2. Click the green Google Sheets icon (top right)
3. Choose "Create a new spreadsheet"
4. Name it: "DC Bills Tracker Feedback"
5. The sheet will open with columns: Timestamp, Email, Subject, Feedback, Type

Now add these **additional columns** (for AI analysis):
- Column F: `Category`
- Column G: `Sentiment`
- Column H: `Priority`
- Column I: `AI Summary`
- Column J: `Response Draft`
- Column K: `Status` (manually set: Open, In Progress, Closed)

---

## Step 3: Get OpenAI API Key (3 minutes)

1. Go to https://platform.openai.com/api-keys
2. Sign up or log in
3. Click **+ Create new secret key**
4. Name it: "DC Bills Feedback Analyzer"
5. Copy the key (starts with `sk-...`)
6. **Save it somewhere safe** - you'll need it in Step 4

**Cost:** ~$0.01-0.05 per feedback submission (very cheap)

---

## Step 4: Add Apps Script (10 minutes)

1. In your Google Sheet, click **Extensions → Apps Script**
2. Delete any existing code
3. Copy and paste the code below
4. Replace `YOUR_OPENAI_API_KEY` with your actual API key from Step 3
5. Click **Save** (disk icon)
6. Click **Run** (play icon) to test - you'll need to authorize it
7. Set up trigger:
   - Click **Triggers** (clock icon on left)
   - Click **+ Add Trigger**
   - Choose function: `onFormSubmit`
   - Event type: `On form submit`
   - Click **Save**

### Apps Script Code:

```javascript
// Configuration
const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY'; // Replace with your key
const MODEL = 'gpt-4o-mini'; // Cheap, fast model

/**
 * Triggers when form is submitted
 * Analyzes feedback with AI and updates spreadsheet
 */
function onFormSubmit(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const row = e.range.getRow();

    // Get submission data (adjust column indices if your form differs)
    const timestamp = e.values[0];
    const email = e.values[1];
    const subject = e.values[2] || '';
    const message = e.values[3];
    const userCategory = e.values[4] || '';

    Logger.log(`Processing feedback from ${email}`);

    // Analyze with AI
    const analysis = analyzeWithAI(message, subject, userCategory);

    // Update spreadsheet with AI analysis
    sheet.getRange(row, 6).setValue(analysis.category); // Column F
    sheet.getRange(row, 7).setValue(analysis.sentiment); // Column G
    sheet.getRange(row, 8).setValue(analysis.priority); // Column H
    sheet.getRange(row, 9).setValue(analysis.summary); // Column I
    sheet.getRange(row, 10).setValue(analysis.responseDraft); // Column J
    sheet.getRange(row, 11).setValue('Open'); // Column K (Status)

    Logger.log('Analysis complete');

  } catch (error) {
    Logger.log('Error: ' + error.toString());
  }
}

/**
 * Calls OpenAI API to analyze feedback
 */
function analyzeWithAI(message, subject, userCategory) {
  const prompt = `Analyze this feedback submission for a DC bills tracking website:

Subject: ${subject}
User-selected category: ${userCategory}
Message: ${message}

Provide analysis in this exact JSON format:
{
  "category": "Bug Report" | "Feature Request" | "Question" | "Feedback" | "Complaint" | "Praise",
  "sentiment": "Positive" | "Neutral" | "Negative",
  "priority": "High" | "Medium" | "Low",
  "summary": "Brief 1-sentence summary of the issue/request",
  "responseDraft": "Professional, friendly response draft (2-3 sentences)"
}

Rules:
- Priority is HIGH if: bug blocking usage, urgent request, angry tone
- Priority is MEDIUM if: feature request, question, mild complaint
- Priority is LOW if: general feedback, praise, minor suggestion
- Keep summary under 100 characters
- Response should be warm, helpful, and acknowledge their input`;

  const url = 'https://api.openai.com/v1/chat/completions';

  const payload = {
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant that analyzes user feedback for a civic tech project. Always respond with valid JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.3,
    response_format: { type: "json_object" }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + OPENAI_API_KEY
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());

    if (data.error) {
      Logger.log('OpenAI Error: ' + JSON.stringify(data.error));
      return getDefaultAnalysis();
    }

    const analysis = JSON.parse(data.choices[0].message.content);
    return analysis;

  } catch (error) {
    Logger.log('API Error: ' + error.toString());
    return getDefaultAnalysis();
  }
}

/**
 * Fallback if AI fails
 */
function getDefaultAnalysis() {
  return {
    category: 'Feedback',
    sentiment: 'Neutral',
    priority: 'Medium',
    summary: 'Feedback received (AI analysis unavailable)',
    responseDraft: 'Thank you for your feedback! We appreciate you taking the time to share your thoughts.'
  };
}

/**
 * Test function - run this to test AI analysis
 */
function testAnalysis() {
  const result = analyzeWithAI(
    "The bill tracker is great but I can't filter by date on my iPhone. Please fix!",
    "Bug on mobile",
    "Bug Report"
  );
  Logger.log(JSON.stringify(result, null, 2));
}
```

---

## Step 5: Embed Form on Website

Once you've completed Steps 1-4, activate the contact form on your site:

1. Get your Google Form embed code from Step 1
2. Copy the form ID from the iframe URL (looks like: `1FAIpQLSe...`)
3. Open `src/components/ContactSection.jsx`
4. Replace `REPLACE_WITH_YOUR_FORM_ID` with your actual form ID
5. Open `src/App.jsx`
6. Uncomment these two lines:
   ```javascript
   // Line 10: Uncomment this
   import ContactSection from './components/ContactSection'

   // Line 229-230: Uncomment this
   <ContactSection />
   ```
7. Build and deploy:
   ```bash
   npm run build
   npm run deploy
   ```

The form will appear at the bottom of your site, above the footer.

**Current Status:** The contact section is commented out (hidden) until you complete the setup above.

---

## Step 6: Test Everything

1. Submit a test through the form
2. Check Google Sheets - new row should appear
3. Wait ~5-10 seconds for Apps Script to run
4. Refresh sheet - AI analysis columns should be filled

Example result:
| Timestamp | Email | Subject | Message | Type | Category | Sentiment | Priority | AI Summary | Response Draft | Status |
|-----------|-------|---------|---------|------|----------|-----------|----------|------------|----------------|--------|
| 11/19 2pm | test@email.com | Mobile bug | Can't filter on iPhone | Bug Report | Bug Report | Negative | High | User reports mobile filter issue | Thank you for reporting this bug... | Open |

---

## Managing Feedback

### Reviewing in Google Sheets

**Filter by Priority:**
- Click column H header → Filter → Show only "High"

**Filter by Status:**
- Click column K header → Filter → Show only "Open"

**Sort by Date:**
- Click column A header → Sort sheet A → Z (newest first)

### Responding to Feedback

1. Read the AI-generated response draft (column J)
2. Edit if needed
3. Copy and send via email
4. Mark status as "Closed" (column K)

### Export Options

- **Download as CSV:** File → Download → CSV
- **Share with team:** Click "Share" → Add collaborators
- **Create charts:** Insert → Chart (track sentiment over time, etc.)

---

## Troubleshooting

### "AI analysis columns are empty"
- Check Apps Script logs: Extensions → Apps Script → Execution log
- Verify OpenAI API key is correct
- Check API key has credits: https://platform.openai.com/usage

### "Form not submitting"
- Check Google Form is set to "Accepting responses"
- Try submitting directly in Google Forms (not embedded) to test

### "Script authorization error"
- Run the script manually first: Apps Script → Run → onFormSubmit
- Click "Review permissions" and authorize

---

## Optional Enhancements

### Auto-reply to users
Add this to the end of `onFormSubmit()`:
```javascript
GmailApp.sendEmail(email,
  "Thank you for your feedback",
  analysis.responseDraft
);
```

### Slack notifications for high-priority
Add webhook integration for urgent issues

### Email yourself for new submissions
```javascript
GmailApp.sendEmail(
  "your-email@gmail.com",
  `New ${analysis.priority} priority feedback`,
  `From: ${email}\n\n${message}\n\nSummary: ${analysis.summary}`
);
```

---

## Next Steps

Once everything is working:
1. Monitor feedback in Google Sheets
2. Respond to users promptly
3. Track common issues/requests
4. Use insights to improve the site

The system will automatically categorize and analyze every submission - you just review and respond!

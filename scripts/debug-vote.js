#!/usr/bin/env node

/**
 * Debug script to investigate vote data issues
 */

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const API_BASE_URL = 'https://api.congress.gov/v3';

async function debugBill(billNum, congress = 119) {
  console.log(`\n🔍 Investigating HR ${billNum} (${congress}th Congress)...\n`);

  const actionsUrl = `${API_BASE_URL}/bill/${congress}/hr/${billNum}/actions?api_key=${CONGRESS_API_KEY}`;
  const response = await fetch(actionsUrl);
  const data = await response.json();

  if (data.error) {
    console.log(`❌ API Error: ${data.error.message}`);
    return;
  }

  if (!data.actions) {
    console.log('No actions found (but no error either)');
    console.log('Response:', JSON.stringify(data, null, 2).substring(0, 500));
    return;
  }

  // Find passage actions
  const passageActions = data.actions.filter(a =>
    a.text && (
      a.text.includes('On passage Passed') ||
      a.text.includes('Passed House') ||
      a.text.includes('Passed by recorded vote') ||
      a.text.includes('Passed by the Yeas and Nays')
    )
  );

  console.log('📋 Passage-related actions:');
  passageActions.forEach(action => {
    console.log(`\nDate: ${action.actionDate}`);
    console.log(`Text: ${action.text}`);

    // Extract roll call
    const rollMatch = action.text.match(/Roll no\.\s*(\d+)|recorded vote:\s*(\d+)|Yeas and Nays:\s*(\d+)/i);
    if (rollMatch) {
      const rollNumber = rollMatch[1] || rollMatch[2] || rollMatch[3];
      console.log(`→ Extracted roll call: ${rollNumber}`);
    }
  });

  // Show all actions mentioning "roll"
  console.log('\n\n📋 All actions mentioning roll call:');
  data.actions.filter(a => a.text && a.text.toLowerCase().includes('roll')).forEach(action => {
    console.log(`\nDate: ${action.actionDate}`);
    console.log(`Text: ${action.text}`);
  });
}

// Debug HR 2056 and HR 4922 in both 118th and 119th Congress
async function runDebug() {
  await debugBill('2056', 118);
  await debugBill('2056', 119);
  await debugBill('4922', 118);
  await debugBill('4922', 119);
  console.log('\n✅ Done');
}

runDebug().catch(err => {
  console.error('Error:', err.message);
});

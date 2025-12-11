#!/usr/bin/env node

/**
 * Debug script to check specific roll call votes
 */

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const API_BASE_URL = 'https://api.congress.gov/v3';

async function fetchRollCall(rollNum) {
  console.log(`\n🗳️  Fetching House Roll Call ${rollNum}...\n`);

  const session = 1; // 119th Congress, 1st session (2025)
  const voteUrl = `${API_BASE_URL}/house-vote/119/${session}/${rollNum}?api_key=${CONGRESS_API_KEY}`;

  try {
    const response = await fetch(voteUrl);
    const data = await response.json();

    if (data.error) {
      console.log(`❌ Error: ${data.error.message}`);
      return;
    }

    const vote = data.houseRollCallVote;
    console.log(`Date: ${vote.startDate || vote.actionDate}`);
    console.log(`Bill: ${vote.bill?.number || 'N/A'}`);
    console.log(`Question: ${vote.question || 'N/A'}`);

    const votePartyTotal = vote.votePartyTotal || [];
    let totalYeas = 0;
    let totalNays = 0;

    votePartyTotal.forEach(partyData => {
      const party = partyData.voteParty || partyData.party?.type;
      totalYeas += partyData.yeaTotal || 0;
      totalNays += partyData.nayTotal || 0;
      console.log(`${party}: ${partyData.yeaTotal} yeas, ${partyData.nayTotal} nays`);
    });

    console.log(`\nTOTAL: ${totalYeas}-${totalNays}`);

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function checkBillActions(billNum) {
  console.log(`\n\n📋 Checking actions for HR ${billNum}...\n`);

  const actionsUrl = `${API_BASE_URL}/bill/119/hr/${billNum}/actions?api_key=${CONGRESS_API_KEY}`;
  const response = await fetch(actionsUrl);
  const data = await response.json();

  if (data.error) {
    console.log(`❌ Error: ${data.error.message}`);
    return;
  }

  if (!data.actions) {
    console.log('No actions found');
    return;
  }

  // Find passage actions
  const passageActions = data.actions.filter(a =>
    a.text && (
      a.text.includes('On passage Passed') ||
      a.text.includes('Passed House') ||
      (a.text.includes('Passed') && !a.text.includes('Passed/agreed to in House'))
    )
  );

  console.log(`Found ${passageActions.length} passage-related actions:\n`);

  passageActions.forEach((action, i) => {
    console.log(`${i + 1}. Date: ${action.actionDate}`);
    console.log(`   Text: ${action.text}`);

    // Extract roll call
    const rollMatch = action.text.match(/Roll no\.\s*(\d+)|recorded vote:\s*(\d+)|Yeas and Nays:\s*(\d+)/i);
    if (rollMatch) {
      const rollNumber = rollMatch[1] || rollMatch[2] || rollMatch[3];
      console.log(`   → EXTRACTED ROLL CALL: ${rollNumber}\n`);
    } else {
      console.log(`   → No roll call number found\n`);
    }
  });
}

async function run() {
  console.log('='.repeat(60));
  console.log('CHECKING CORRECT ROLL CALLS');
  console.log('='.repeat(60));

  await fetchRollCall(171); // HR 2056 correct
  await fetchRollCall(270); // HR 4922 correct

  console.log('\n\n');
  console.log('='.repeat(60));
  console.log('CHECKING WHAT THE SCRIPT IS EXTRACTING');
  console.log('='.repeat(60));

  await checkBillActions(2056);
  await checkBillActions(4922);

  console.log('\n✅ Done\n');
}

run().catch(err => {
  console.error('Fatal error:', err);
});

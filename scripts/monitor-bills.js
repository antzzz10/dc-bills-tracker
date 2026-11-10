#!/usr/bin/env node

/**
 * Congress.gov Bill Monitoring Script
 * Checks all bills in the tracker for status updates
 * Sends notifications when changes are detected
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { CURRENT_CONGRESS } from './config.js';
import { isProvision } from '../src/lib/measureStatus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const CONGRESS_NUMBER = CURRENT_CONGRESS;
const API_BASE_URL = 'https://api.congress.gov/v3';

// How far along a bill is. Used only to stop the nightly sweep from moving a bill
// backwards: an enacted bill still has its House and Senate passage actions in the
// Congress.gov action list, so a detector that only looks for those will keep
// concluding "passed-both" for the rest of time. Ranks, not an ordering of the
// legislative process — passed-house and passed-senate are deliberately equal,
// since a bill in one chamber has not advanced past a bill in the other.
const STAGE_RANK = {
  'passed-house': 1,
  'passed-senate': 1,
  'agreed-house': 1,
  'agreed-senate': 1,
  'passed-both': 2,
  'agreed-both': 2,
  'enacted': 3,
  // A constitutional amendment's final congressional step (two-thirds of each chamber,
  // no President). Ranked above passed-both, which the bill path would have called it.
  'sent-to-states': 3
};

// Load bills data
const billsPath = join(__dirname, '../src/data/bills.json');
const billsData = JSON.parse(readFileSync(billsPath, 'utf-8'));

// Every section of bills.json the daily check covers. Until 2026-11 it read `bills` only:
// support bills drifted (H.R. 51's cosponsors went stale) and S. 1077, a routine measure,
// sat at no stage for eight months after passing the Senate. Riders are handled apart —
// see checkRiderParent — because a rider is a provision, not a bill.
const SECTIONS = ['bills', 'riders', 'supportBills', 'routineBills'];

// Parse bill number to API format
function parseBillNumber(billNumber) {
  // Anchored, longest prefix first. Unanchored, "S." matched inside "H.Res. 12" and looked
  // up S. 12, a different (Senate) bill. Amendment numbers (S.Amdt.) are not bills.
  const match = String(billNumber).trim().match(
    /^(H\.J\.Res\.|S\.J\.Res\.|H\.Con\.Res\.|S\.Con\.Res\.|H\.Res\.|S\.Res\.|H\.R\.|S\.)\s*(\d+)$/i
  );
  if (!match) return null;

  const [, type, number] = match;
  const TYPES = {
    'h.j.res.': ['hjres', 'house'],
    's.j.res.': ['sjres', 'senate'],
    'h.con.res.': ['hconres', 'house'],
    's.con.res.': ['sconres', 'senate'],
    'h.res.': ['hres', 'house'],
    's.res.': ['sres', 'senate'],
    'h.r.': ['hr', 'house'],
    's.': ['s', 'senate']
  };
  const [billType, chamber] = TYPES[type.toLowerCase()];
  return { billType, number, chamber };
}

// A Congress convenes in an odd year: the 119th began in 2025. Session 1 is that first
// year, session 2 the second.
const CONGRESS_START_YEAR = 1789 + (CONGRESS_NUMBER - 1) * 2;

// Build a resolvable link to the official roll call record — the Clerk of the House or
// the Senate's own vote page, not Congress.gov — so a reader can independently verify a
// vote tally instead of taking the site's word for it. Formats confirmed against live
// pages: clerk.house.gov/Votes/{year}{roll} (no zero-padding) and
// senate.gov/legislative/LIS/roll_call_votes/vote{congress}{session}/vote_{congress}_{session}_{roll, 5-digit}.htm
function buildVoteSourceUrl(chamber, year, session, rollCallNumber) {
  if (chamber === 'house') {
    return `https://clerk.house.gov/Votes/${year}${rollCallNumber}`;
  }
  const roll = String(rollCallNumber).padStart(5, '0');
  return `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${CONGRESS_NUMBER}${session}/vote_${CONGRESS_NUMBER}_${session}_${roll}.htm`;
}

// Fetch roll call vote details.
//
// `expected` ({ billType, number }) is required: roll call numbers restart every session,
// so the same number identifies a different vote in each year of a Congress. Querying the
// wrong session returns a real, well-formed vote for an unrelated bill — which is how
// H.R. 5103 came to display "211-215 on 2025-04-10", a vote taken five months before the
// bill was introduced, with the parties reversed. Deriving the session fixes the cause;
// checking the returned vote's own legislation ID catches anything else that would put a
// stranger's vote on a bill card.
async function fetchRollCallVote(chamber, year, rollCallNumber, expected) {
  try {
    // Sessions run 1..2 within a Congress; anything else means the action date is bogus.
    const session = year - CONGRESS_START_YEAR + 1;
    if (session !== 1 && session !== 2) {
      console.log(`  ⚠️  Vote year ${year} is outside the ${CONGRESS_NUMBER}th Congress — skipping roll call ${rollCallNumber}`);
      return null;
    }

    // Use new house-vote/senate-vote endpoints (2025 API format)
    const chamberEndpoint = chamber === 'house' ? 'house-vote' : 'senate-vote';
    const voteUrl = `${API_BASE_URL}/${chamberEndpoint}/${CONGRESS_NUMBER}/${session}/${rollCallNumber}?api_key=${CONGRESS_API_KEY}`;
    const response = await fetch(voteUrl);

    if (!response.ok) {
      console.log(`  ⚠️  Could not fetch roll call vote ${chamber} ${rollCallNumber} (session ${session}): HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    // New API format uses houseRollCallVote or senateRollCallVote
    const vote = data.houseRollCallVote || data.senateRollCallVote;

    // Refuse a vote that belongs to a different bill. Without this, any future drift in
    // roll call numbering silently publishes someone else's vote totals as fact.
    if (expected && vote?.legislationType && vote?.legislationNumber) {
      const gotType = String(vote.legislationType).toLowerCase();
      const gotNumber = String(vote.legislationNumber);
      if (gotType !== expected.billType || gotNumber !== String(expected.number)) {
        console.log(`  ❌ Roll call ${rollCallNumber} (session ${session}) is for ${gotType.toUpperCase()} ${gotNumber}, expected ${expected.billType.toUpperCase()} ${expected.number} — discarding`);
        return null;
      }
    }

    // Parse party breakdown from new API format (2025)
    // New format has votePartyTotal array instead of members
    const votePartyTotal = vote.votePartyTotal || [];

    let totalYeas = 0;
    let totalNays = 0;
    const partyVotes = {};

    votePartyTotal.forEach(partyData => {
      const party = partyData.voteParty || partyData.party?.type;
      totalYeas += partyData.yeaTotal || 0;
      totalNays += partyData.nayTotal || 0;

      if (party === 'R' || party === 'Republican') {
        partyVotes.republican = {
          yeas: partyData.yeaTotal || 0,
          nays: partyData.nayTotal || 0
        };
      } else if (party === 'D' || party === 'Democrat') {
        partyVotes.democrat = {
          yeas: partyData.yeaTotal || 0,
          nays: partyData.nayTotal || 0
        };
      } else if (party === 'I' || party === 'Independent') {
        // Dropped previously, which made the party rows silently fail to sum to the
        // displayed total. PassedBillsSection already renders an independent row.
        partyVotes.independent = {
          yeas: partyData.yeaTotal || 0,
          nays: partyData.nayTotal || 0
        };
      }
    });

    return {
      date: (vote.startDate || vote.actionDate).split('T')[0],
      yeas: totalYeas,
      nays: totalNays,
      byParty: {
        republican: partyVotes.republican || { yeas: 0, nays: 0 },
        democrat: partyVotes.democrat || { yeas: 0, nays: 0 },
        // Only when someone actually caucused independently — an all-zero row would
        // otherwise appear on every bill card.
        ...(partyVotes.independent && (partyVotes.independent.yeas || partyVotes.independent.nays)
          ? { independent: partyVotes.independent }
          : {})
      },
      source: buildVoteSourceUrl(chamber, year, session, rollCallNumber)
    };
  } catch (error) {
    console.log(`  ⚠️  Error fetching roll call vote: ${error.message}`);
    return null;
  }
}

// Detect bill passage and fetch vote data from actions
// Congress.gov's standardized marker for a chamber's passage or agreement, emitted for
// every measure type and every method, voice votes and unanimous consent included. The
// tally-specific matches below miss voice votes (S. 1077's Senate passage was one).
const PASSAGE_MARKER = { house: /^Passed\/agreed to in House/i, senate: /^Passed\/agreed to in Senate/i };

// One definition of "this action is a chamber passing the measure", shared by the tally
// detection in detectPassage and the finality helpers below, so they never disagree:
// Congress.gov's standardized marker, or the roll-call wording the tally parser reads.
function isHousePassage(text = '') {
  return PASSAGE_MARKER.house.test(text) ||
    text.includes('On passage Passed by recorded vote') ||
    text.includes('On passage Passed by the Yeas and Nays') ||
    (text.includes('Passed House') && !text.includes('Passed/agreed to in House'));
}
function isSenatePassage(text = '') {
  return PASSAGE_MARKER.senate.test(text) ||
    (text.includes('Passed Senate') && !text.includes('passed in Senate') && !text.includes('Received in the Senate'));
}

// Did both chambers agree to the same text? Passing both is not enough: each agreement
// can add an amendment the other chamber must then accept (the Senate amended H.Con.Res.
// 14 on 2025-04-05; the House accepted that amendment on 2025-04-10). So find the last
// agreement of any kind (a passage, or one chamber agreeing to the other's amendment) and
// require that it made no further amendment. Same-day actions have no reliable order, so
// any amendment on the last day counts as unresolved.
function differencesResolved(actions) {
  const isAgreement = a => {
    const t = a.text || '';
    if (isHousePassage(t) || isSenatePassage(t)) return true;
    return /(agree|concur)\w* (in|to) the (House|Senate) amendments?/i.test(t) &&
      /agreed to|without objection|concurred/i.test(t) && !/not agreed to|failed/i.test(t);
  };
  const agreements = actions.filter(isAgreement);
  if (agreements.length === 0) return false;
  const lastDate = agreements.map(a => String(a.actionDate)).sort().pop();
  return !agreements
    .filter(a => String(a.actionDate) === lastDate)
    .some(a => /with (an )?amendments?/i.test(a.text || ''));
}

// Both chambers agreed, to different text: report only the first chamber's agreement,
// which is true, rather than a final stage that isn't yet. If both acted on the same day
// (no reliable order), the measure's chamber of origin is taken as first.
function firstChamber(actions, originChamber) {
  const dated = side => actions
    .filter(a => (side === 'house' ? isHousePassage : isSenatePassage)(a.text || ''))
    .map(a => String(a.actionDate)).sort()[0];
  const h = dated('house'), sn = dated('senate');
  if (h && (!sn || h < sn)) return 'house';
  if (sn && (!h || sn < h)) return 'senate';
  return originChamber === 'senate' ? 'senate' : 'house';
}

async function detectPassage(actions, chamber, expected) {
  const passageInfo = {
    hasPassedHouse: false,
    hasPassedSenate: false,
    hasBecomeLaw: false,
    houseVote: null,
    senateVote: null,
    stage: null
  };

  // Sort actions by date (most recent first)
  const sortedActions = [...actions].sort((a, b) => {
    const dateA = new Date(a.actionDate || 0);
    const dateB = new Date(b.actionDate || 0);
    return dateB - dateA;
  });

  for (const action of sortedActions) {
    const actionText = action.text || '';
    const actionDate = action.actionDate;

    // Detect enactment. Congress.gov emits "Signed by President" and then
    // "Became Public Law No: 119-XX"; both mean the bill is law. "Presented to
    // President" deliberately does not match — presentment is not enactment.
    if (/Became Public Law No/i.test(actionText) ||
        /Signed by President/i.test(actionText)) {
      passageInfo.hasBecomeLaw = true;
    }

    // Detect House passage
    // The marker is excluded here only because it repeats a roll-call action already
    // matched; it still counts as passage evidence in isHousePassage.
    if (isHousePassage(actionText) && !PASSAGE_MARKER.house.test(actionText)) {

      passageInfo.hasPassedHouse = true;

      // Extract roll call number - prioritize "Roll no." as it's the authoritative source
      let rollNumber = null;
      let rollMatch = actionText.match(/Roll no\.\s*(\d+)/i);
      if (rollMatch) {
        rollNumber = rollMatch[1];
      } else {
        // Fallback to other formats if "Roll no." not found
        rollMatch = actionText.match(/recorded vote:\s*(\d+)/i);
        if (rollMatch) {
          rollNumber = rollMatch[1];
        }
      }

      if (rollNumber) {
        console.log(`  🗳️  Detected House passage with roll call ${rollNumber}`);

        // Fetch vote details
        const voteData = await fetchRollCallVote('house', new Date(actionDate).getFullYear(), rollNumber, expected);
        if (voteData) {
          passageInfo.houseVote = voteData;
          console.log(`  ✓ House vote data: ${voteData.yeas}-${voteData.nays}`);
        }
      }
    }

    // Detect Senate passage
    // Unchanged from before: the Senate marker line can carry the record vote number.
    if (isSenatePassage(actionText)) {

      passageInfo.hasPassedSenate = true;

      // Extract roll call number
      let rollNumber = null;
      let rollMatch = actionText.match(/Roll Call Vote No\.\s*(\d+)/i);
      if (rollMatch) {
        rollNumber = rollMatch[1];
      } else {
        rollMatch = actionText.match(/Vote Number:\s*(\d+)/i);
        if (rollMatch) {
          rollNumber = rollMatch[1];
        }
      }

      if (rollNumber) {
        console.log(`  🗳️  Detected Senate passage with roll call ${rollNumber}`);

        // Fetch vote details
        const voteData = await fetchRollCallVote('senate', new Date(actionDate).getFullYear(), rollNumber, expected);
        if (voteData) {
          passageInfo.senateVote = voteData;
          console.log(`  ✓ Senate vote data: ${voteData.yeas}-${voteData.nays}`);
        }
      }
    }
  }

  // Voice votes and unanimous consent carry no tally, so the matches above miss them.
  // The standardized marker catches every method; it never supplies a vote record.
  if (actions.some(a => PASSAGE_MARKER.house.test(a.text || ''))) passageInfo.hasPassedHouse = true;
  if (actions.some(a => PASSAGE_MARKER.senate.test(a.text || ''))) passageInfo.hasPassedSenate = true;

  // Resolutions don't follow the bill path (Andria's guardrails, 2026-11-09). Simple and
  // concurrent resolutions are "agreed to", never passed or enacted; Congress.gov marks
  // each chamber's agreement with a "Passed/agreed to in <chamber>" action.
  const { billType, title } = expected || {};
  if (['hres', 'sres', 'hconres', 'sconres'].includes(billType)) {
    const agreedHouse = actions.some(a => /^Passed\/agreed to in House/i.test(a.text || ''));
    const agreedSenate = actions.some(a => /^Passed\/agreed to in Senate/i.test(a.text || ''));
    passageInfo.houseVote = null;
    passageInfo.senateVote = null;
    passageInfo.hasBecomeLaw = false;
    // Concurrent resolutions need both chambers on identical text; a simple resolution
    // is only ever agreed to by its own chamber.
    passageInfo.stage = agreedHouse && agreedSenate && differencesResolved(actions) ? 'agreed-both'
      : agreedHouse && agreedSenate ? `agreed-${firstChamber(actions, chamber)}`
        : agreedHouse ? 'agreed-house'
          : agreedSenate ? 'agreed-senate'
            : null;
    return passageInfo;
  }

  // A joint resolution proposing a constitutional amendment goes to the states after
  // two-thirds of each chamber, with no President. It is never "law" and never "headed
  // to the President" (H.J.Res. 31).
  const isConstitutionalAmendment = ['hjres', 'sjres'].includes(billType) &&
    /^Proposing an amendment to the Constitution/i.test(title || '');
  if (isConstitutionalAmendment) {
    passageInfo.hasBecomeLaw = false;
    // Sent to the states only once both chambers have passed the same text. Until then
    // it falls through to the ordinary passed-* stages below, which are true.
    if (passageInfo.hasPassedHouse && passageInfo.hasPassedSenate && differencesResolved(actions)) {
      passageInfo.stage = 'sent-to-states';
      return passageInfo;
    }
  }

  // Determine stage. Enactment is checked first: a bill that became law still carries
  // its earlier chamber-passage actions, so the passed-* checks below would otherwise
  // describe a law as merely having passed both chambers.
  if (passageInfo.hasBecomeLaw) {
    passageInfo.stage = 'enacted';
  } else if (passageInfo.hasPassedHouse && passageInfo.hasPassedSenate) {
    // "Passed both chambers" tells readers a bill is headed to the President, which is
    // only true once both have passed the same text. Until then, report the first
    // chamber's passage, which is true.
    passageInfo.stage = differencesResolved(actions) ? 'passed-both'
      : `passed-${firstChamber(actions, chamber)}`;
  } else if (passageInfo.hasPassedHouse) {
    passageInfo.stage = 'passed-house';
  } else if (passageInfo.hasPassedSenate) {
    passageInfo.stage = 'passed-senate';
  }

  return passageInfo;
}

// Fetch bill details from Congress.gov API
// `congress` is the entry's own Congress, never assumed: a bill number names a different
// bill in every Congress, so looking an entry up in the wrong one silently overwrites it
// with another bill's status.
async function fetchBillStatus(billNumber, congress) {
  const parsed = parseBillNumber(billNumber);
  if (!parsed) {
    console.log(`⚠️  Could not parse bill number: ${billNumber}`);
    return null;
  }

  const { billType, number, chamber } = parsed;
  const billUrl = `${API_BASE_URL}/bill/${congress}/${billType}/${number}?api_key=${CONGRESS_API_KEY}`;
  // limit=250: the API defaults to 20 actions per page, and the busiest tracked measure
  // already has 53. A truncated list can hide a passage action.
  const actionsUrl = `${API_BASE_URL}/bill/${congress}/${billType}/${number}/actions?api_key=${CONGRESS_API_KEY}&limit=250`;
  const cosponsorsUrl = `${API_BASE_URL}/bill/${congress}/${billType}/${number}/cosponsors?api_key=${CONGRESS_API_KEY}`;

  try {
    // Fetch basic bill info
    const response = await fetch(billUrl);
    if (!response.ok) {
      // Every failure mode throws with its HTTP status attached. A 404 usually means a
      // bad bill number, but a *fleet* of 404s means the API is misbehaving — and the two
      // are only distinguishable after the fact if the status is recorded per bill.
      if (response.status === 404) {
        throw new Error(`HTTP 404 — not found in the ${congress}th Congress`);
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const bill = data.bill;

    // Fetch detailed actions
    let actions = [];
    let hasCommitteeHearing = false;
    let hasCommitteeMarkup = false;
    let hasFloorVote = false;
    let committees = [];
    let passageInfo = null;
    // Which parts of the record actually arrived. On 2026-11-09 the bill request for
    // H.R. 5183 succeeded but its actions request failed; the flags defaulted to false and
    // overwrote "markup held" on the live site, in a run reported as healthy. A part that
    // didn't arrive now leaves the stored values alone and counts against the run's health.
    const missingParts = [];

    try {
      const actionsResponse = await fetch(actionsUrl);
      if (!actionsResponse.ok) {
        missingParts.push(`actions (HTTP ${actionsResponse.status})`);
      } else {
        const actionsData = await actionsResponse.json();
        actions = actionsData.actions || [];

        // Detect passage and fetch vote data
        passageInfo = await detectPassage(actions, chamber, { billType, number, title: bill.title });

        // Analyze actions for significant events
        actions.forEach(action => {
          const actionText = action.text?.toLowerCase() || '';
          const actionType = action.type?.toLowerCase() || '';

          if (actionText.includes('hearing') || actionType.includes('hearing')) {
            hasCommitteeHearing = true;
          }
          if (actionText.includes('markup') || actionText.includes('ordered to be reported')) {
            hasCommitteeMarkup = true;
          }
          if (actionText.includes('floor') || actionText.includes('vote') ||
              actionText.includes('passed') || actionText.includes('failed')) {
            hasFloorVote = true;
          }
        });
      }
    } catch (e) {
      missingParts.push(`actions (${e.message})`);
    }
    const actionsOk = !missingParts.some(p => p.startsWith('actions'));

    // Fetch cosponsors count
    let cosponsorsCount = 0;
    try {
      const cosponsorsResponse = await fetch(cosponsorsUrl);
      if (!cosponsorsResponse.ok) {
        missingParts.push(`cosponsors (HTTP ${cosponsorsResponse.status})`);
      } else {
        const cosponsorsData = await cosponsorsResponse.json();
        cosponsorsCount = cosponsorsData.pagination?.count || 0;
      }
    } catch (e) {
      missingParts.push(`cosponsors (${e.message})`);
    }
    const cosponsorsOk = !missingParts.some(p => p.startsWith('cosponsors'));
    if (missingParts.length) {
      console.log(`  ⚠️  Incomplete record for ${billNumber}: could not fetch ${missingParts.join(', ')}`);
    }

    // Extract committee info
    if (bill.committees && Array.isArray(bill.committees)) {
      committees = bill.committees.map(c => c.name);
    }

    // Build return object
    const result = {
      billNumber,
      title: bill.title,
      latestAction: bill.latestAction?.text || 'No recent action',
      latestActionDate: bill.latestAction?.actionDate || null,
      status: getSimplifiedStatus(bill),
      sponsors: bill.sponsors?.map(s => s.fullName).join(', ') || 'Unknown',
      url: `https://www.congress.gov/bill/${congress}th-congress/${billType}/${number}`,
      // null = not known this run (that part of the record didn't arrive), never "no".
      cosponsorsCount: cosponsorsOk ? cosponsorsCount : null,
      hasCommitteeHearing: actionsOk ? hasCommitteeHearing : null,
      hasCommitteeMarkup: actionsOk ? hasCommitteeMarkup : null,
      hasFloorVote: actionsOk ? hasFloorVote : null,
      missingParts,
      committees,
      introducedDate: bill.introducedDate || null,
      // Passage information
      passageInfo
    };

    console.log(`  ✓ Successfully fetched ${billNumber}`);
    return result;
  } catch (error) {
    // Rethrow rather than returning null: the caller records the reason, and swallowing
    // it here is what made a 77/77 API outage look identical to 77 bad bill numbers.
    console.log(`  ❌ Error in fetchBillStatus for ${billNumber}:`, error.message);
    throw error;
  }
}

// Simplify status for comparison
function getSimplifiedStatus(bill) {
  // Determine simplified status based on latest action
  const action = bill.latestAction?.text?.toLowerCase() || '';

  if (action.includes('became public law') || action.includes('signed by president')) {
    return 'ENACTED';
  }
  if (action.includes('passed senate') && action.includes('passed house')) {
    return 'PASSED_BOTH';
  }
  if (action.includes('passed senate') || action.includes('passed house')) {
    return 'PASSED_ONE_CHAMBER';
  }
  if (action.includes('reported') || action.includes('committee')) {
    return 'IN_COMMITTEE';
  }
  if (action.includes('introduced')) {
    return 'INTRODUCED';
  }

  return 'UNKNOWN';
}

// Determine priority based on legislative activity
function calculatePriority(billStatus, billData) {
  const hasMomentum = billStatus.hasFloorVote || billStatus.hasCommitteeMarkup ||
    billStatus.hasCommitteeHearing || billStatus.cosponsorsCount >= 20;

  // Support bills (and the spending bills riders sit on) rank on momentum alone: the
  // manual and FreeDC flags below are judgments about attacks, and the partial-attack cap
  // is a rule about attacks. Neither means anything for a bill RepresentDC backs.
  const momentumOnly = billData.position === 'support' || billData.type === 'rider-parent';

  // Partial attacks (bills where DC is not the primary target) can only rank
  // high on real legislative momentum — never on a manual flag or FreeDC
  // listing alone. See METHODOLOGY.md. Oppose bills only.
  const cappedAtMedium = billData.position === 'oppose' && billData.attackType === 'partial' && !hasMomentum;

  // Check if bill is manually marked as high priority in bills.json
  if (!momentumOnly && billData.priority === 'high' && billData.prioritySource === 'manual') {
    if (cappedAtMedium) {
      return { priority: 'medium', source: 'manual', reason: 'Manually flagged (capped: partial attack without momentum)' };
    }
    return { priority: 'high', source: 'manual', reason: 'Manually flagged' };
  }

  // Check if listed on FreeDC (you can set this in bills.json)
  if (!momentumOnly && billData.prioritySource === 'freedc') {
    if (cappedAtMedium) {
      return { priority: 'medium', source: 'freedc', reason: 'Listed on FreeDC (capped: partial attack without momentum)' };
    }
    return { priority: 'high', source: 'freedc', reason: 'Listed on FreeDC' };
  }

  // Auto-detect HIGH priority based on legislative activity
  if (billStatus.hasFloorVote) {
    return { priority: 'high', source: 'legislative', reason: 'Floor vote occurred' };
  }

  if (billStatus.hasCommitteeMarkup) {
    return { priority: 'high', source: 'legislative', reason: 'Committee markup held' };
  }

  if (billStatus.hasCommitteeHearing) {
    return { priority: 'high', source: 'legislative', reason: 'Committee hearing held' };
  }

  if (billStatus.cosponsorsCount >= 20) {
    return { priority: 'high', source: 'legislative', reason: `${billStatus.cosponsorsCount} cosponsors` };
  }

  // MEDIUM priority
  if (billStatus.cosponsorsCount >= 5) {
    return { priority: 'medium', source: 'legislative', reason: `${billStatus.cosponsorsCount} cosponsors` };
  }

  if (billStatus.status === 'IN_COMMITTEE') {
    return { priority: 'medium', source: 'legislative', reason: 'In committee' };
  }

  // LOW/WATCHING priority - recently introduced, no activity
  if (billStatus.status === 'INTRODUCED') {
    return { priority: 'watching', source: 'legislative', reason: 'Recently introduced' };
  }

  return { priority: 'low', source: 'legislative', reason: 'No significant activity' };
}

// Re-read bills.json from disk to pick up any manual edits made since startup
function reloadBillsData() {
  const freshData = JSON.parse(readFileSync(billsPath, 'utf-8'));
  // Update in-memory data with fresh copy
  // Every section, not just bills and riders: the write below serializes the whole
  // object, so a section left stale here would overwrite any edit made to it mid-run.
  for (const section of SECTIONS) {
    billsData[section] = freshData[section];
  }
  billsData.categories = freshData.categories;
  billsData.lastUpdated = freshData.lastUpdated;
  // Also the freshness stamp, or a write mid-run restores the startup value over it.
  billsData.lastChecked = freshData.lastChecked;
}

// Update bills.json with the latest tracked status (stage, votes, cosponsors, hearing/markup/floor flags)
function updateBillsJson(section, billId, passageInfo, status) {
  passageInfo = passageInfo || {};

  try {
    // Re-read from disk before writing to avoid clobbering manual edits
    reloadBillsData();

    // Find and update the bill
    const billIndex = (billsData[section] || []).findIndex(b => b.id === billId);
    if (billIndex === -1) {
      console.log(`  ⚠️  Could not find ${billId} in bills.json ${section}`);
      return { updated: false, stageChanged: false };
    }

    const bill = billsData[section][billIndex];

    let updated = false;
    let stageChanged = false;

    // A successful fetch *is* the validation: validate-bills.js confirms a bill by doing
    // the same GET /bill/{congress}/{type}/{number} and checking res.ok, which the monitor
    // has just done. Recording it stops the flag from lying — it read "73 of 75 bills not
    // validated against Congress.gov" while this loop reached all 75 every night, and a
    // warning that is wrong 97% of the time teaches everyone to ignore warnings.
    //
    // Stamped once, not refreshed daily: bills.json is committed on every run, and
    // re-dating 75 bills a day would bury real changes in churn. Recency of the whole
    // sweep is already carried by the top-level `lastChecked`.
    //
    // Deliberately ABOVE the manualOverride return. This is provenance — "we reached this
    // bill on Congress.gov" — not a content edit, so it does not overwrite the human
    // judgement manualOverride exists to protect, and it writes at most once per bill.
    // Below the return it produced exactly the false warning it was meant to remove:
    // H.J.Res.142 carries manualOverride, so it was fetched cleanly every night and still
    // reported as "never confirmed on Congress.gov".
    if (status && !bill.congressValidated) {
      bill.congressValidated = true;
      bill.congressValidatedDate = new Date().toISOString().split('T')[0];
      updated = true;
      console.log(`  ✓ Recorded Congress.gov validation`);
    }

    // Everything below this point rewrites bill content, so manual edits win.
    // The validation stamp above is intentionally the only thing that runs first.
    // A provision (an amendment, a rider) or an entry with a verified outcome: the bill
    // number belongs to the measure it was proposed for, whose status is not the
    // provision's. H.Con.Res. 14 was agreed to; S.Amdt. 2195 to it never got a vote.
    const protectedEntry = bill.manualOverride || bill.outcome || isProvision(bill);
    if (protectedEntry) {
      console.log(`  🔒 Skipping ${billId}: ${bill.manualOverride ? 'manual override is set (preserving manual edits)' : 'provision or verified outcome; its own status is not this bill number\'s'}`);
      if (updated) {
        // Only ever the validation stamp, and only the first time — no lastUpdated bump,
        // since nothing about the bill's own content changed.
        writeFileSync(billsPath, JSON.stringify(billsData, null, 2));
        console.log(`  💾 Updated bills.json`);
      }
      return { updated, stageChanged: false };
    }

    // Update status stage, but never move a bill backwards. An enacted bill keeps its
    // chamber-passage actions in the Congress.gov action list forever, so without this
    // guard every nightly run rewrites "enacted" back to "passed-both" — and because
    // that also sets stageChanged, it announces a bill that is already law as though it
    // had just passed both chambers. Today the only enacted bill happens to carry
    // manualOverride and returns above; that is convention, not protection, and nothing
    // requires the next one to be hand-flagged the same way.
    if (!bill.status) bill.status = {};
    const currentRank = STAGE_RANK[bill.status.stage] || 0;
    const detectedRank = STAGE_RANK[passageInfo.stage] || 0;

    if (passageInfo.stage && detectedRank < currentRank) {
      console.log(`  ⏸️  Keeping stage "${bill.status.stage}"; detected "${passageInfo.stage}" is earlier`);
    } else if (passageInfo.stage && bill.status.stage !== passageInfo.stage) {
      bill.status.stage = passageInfo.stage;
      updated = true;
      stageChanged = true;
      console.log(`  ✓ Updated stage to: ${passageInfo.stage}`);
    }
    // Deliberately no automatic downgrade. H.R. 5525 sat at a hand-entered
    // "passed-house" for ten months (it was only marked up in committee) because this
    // guard never moves a stage backwards. Clearing a stage when the detector finds no
    // passage was tried and rejected (Codex review, 2026-11-08): the detector misses
    // voice votes and suspension passages, so it would erase real passages. Stage
    // disagreements are caught by representdc-data's coverage report instead.

    // Last action = Congress.gov's own latest action, text and date. The monitor used to
    // write "Passed House" with the date of the run that noticed the change, so the site
    // dated those events to whenever the cron happened to fire (twenty bills read
    // "2025-11-28"), and it never refreshed these fields otherwise.
    if (status.latestActionDate && status.latestAction &&
        (bill.status.lastActionDate !== status.latestActionDate ||
         bill.status.lastAction !== status.latestAction)) {
      bill.status.lastAction = status.latestAction;
      bill.status.lastActionDate = status.latestActionDate;
      updated = true;
    }

    // Introduction date, so "new bill" claims key off the actual introduction rather than
    // guessing from action text ("Referred to..." also describes later re-referrals).
    if (status.introducedDate && bill.status.introducedDate !== status.introducedDate) {
      bill.status.introducedDate = status.introducedDate;
      updated = true;
    }

    // Add or update passage data
    if (!bill.passage) {
      bill.passage = {};
    }

    if (passageInfo.houseVote) {
      const existingVote = bill.passage.house;
      // A missing `source` also counts as needing an update — this is how the phase-1
      // provenance backfill reaches records that already have a correct tally (see
      // decisions/2026-08-23-vote-provenance-phase1.md). Once `source` is set it never
      // triggers again on its own, so this does not add to bills.json's daily diff churn.
      const needsUpdate = !existingVote ||
                          existingVote.vote.yeas !== passageInfo.houseVote.yeas ||
                          existingVote.vote.nays !== passageInfo.houseVote.nays ||
                          existingVote.date !== passageInfo.houseVote.date ||
                          !existingVote.source;

      if (needsUpdate) {
        bill.passage.house = {
          date: passageInfo.houseVote.date,
          vote: {
            yeas: passageInfo.houseVote.yeas,
            nays: passageInfo.houseVote.nays,
            byParty: passageInfo.houseVote.byParty
          },
          source: passageInfo.houseVote.source,
          verifiedOn: new Date().toISOString().split('T')[0]
        };
        updated = true;
        const action = existingVote ? 'Updated' : 'Added';
        console.log(`  ✓ ${action} House vote data: ${passageInfo.houseVote.yeas}-${passageInfo.houseVote.nays}`);
      }
    }

    if (passageInfo.senateVote) {
      const existingVote = bill.passage.senate;
      const needsUpdate = !existingVote ||
                          existingVote.vote.yeas !== passageInfo.senateVote.yeas ||
                          existingVote.vote.nays !== passageInfo.senateVote.nays ||
                          existingVote.date !== passageInfo.senateVote.date ||
                          !existingVote.source;

      if (needsUpdate) {
        bill.passage.senate = {
          date: passageInfo.senateVote.date,
          vote: {
            yeas: passageInfo.senateVote.yeas,
            nays: passageInfo.senateVote.nays,
            byParty: passageInfo.senateVote.byParty
          },
          source: passageInfo.senateVote.source,
          verifiedOn: new Date().toISOString().split('T')[0]
        };
        updated = true;
        const action = existingVote ? 'Updated' : 'Added';
        console.log(`  ✓ ${action} Senate vote data: ${passageInfo.senateVote.yeas}-${passageInfo.senateVote.nays}`);
      }
    }

    // Update status flags — each is compared before assignment so a real change
    // (e.g. a cosponsor count bump, which signals traction) actually gets persisted,
    // instead of silently being dropped when no stage/vote change also occurred.
    // A null field didn't arrive this run (see missingParts in fetchBillStatus): keep
    // what is stored rather than write "no" over it.
    if (status.hasFloorVote !== null && bill.status.hasFloorVote !== status.hasFloorVote) {
      bill.status.hasFloorVote = status.hasFloorVote;
      updated = true;
    }
    if (status.hasCommitteeHearing !== null && bill.status.hasCommitteeHearing !== status.hasCommitteeHearing) {
      bill.status.hasCommitteeHearing = status.hasCommitteeHearing;
      updated = true;
    }
    if (status.hasCommitteeMarkup !== null && bill.status.hasCommitteeMarkup !== status.hasCommitteeMarkup) {
      bill.status.hasCommitteeMarkup = status.hasCommitteeMarkup;
      updated = true;
    }
    if (status.cosponsorsCount !== null && bill.status.cosponsors !== status.cosponsorsCount) {
      console.log(`  ✓ Cosponsors: ${bill.status.cosponsors ?? 0} → ${status.cosponsorsCount}`);
      bill.status.cosponsors = status.cosponsorsCount;
      updated = true;
    }

    if (updated) {
      // Save updated bills.json
      billsData.lastUpdated = new Date().toISOString().split('T')[0];
      writeFileSync(billsPath, JSON.stringify(billsData, null, 2));
      console.log(`  💾 Updated bills.json`);
    }

    return { updated, stageChanged };
  } catch (error) {
    console.log(`  ❌ Error updating bills.json:`, error.message);
    return { updated: false, stageChanged: false };
  }
}

// Record that Congress.gov answered for these entries' bill number. Used for riders, whose
// content the check deliberately does not touch (see the rider loop in monitorBills).
// Provenance only, so like the stamp in updateBillsJson it ignores manualOverride.
function stampValidation(section, ids) {
  try {
    reloadBillsData();
    const today = new Date().toISOString().split('T')[0];
    let stamped = 0;
    for (const entry of billsData[section] || []) {
      if (ids.includes(entry.id) && !entry.congressValidated) {
        entry.congressValidated = true;
        entry.congressValidatedDate = today;
        stamped++;
      }
    }
    if (stamped > 0) {
      writeFileSync(billsPath, JSON.stringify(billsData, null, 2));
      console.log(`  ✓ Recorded Congress.gov validation on ${stamped} ${section} entr${stamped === 1 ? 'y' : 'ies'}`);
    }
  } catch (error) {
    console.log(`  ❌ Error stamping validation:`, error.message);
  }
}

// One row of the run's history and email for a checked record.
function changeRecord(id, section, title, status, priorityInfo, stored = {}) {
  // Where part of the record didn't arrive, history keeps the last known value, so the
  // next run's diff doesn't announce a hearing or cosponsor jump that already happened.
  const known = (value, fallback) => (value === null ? (fallback ?? null) : value);
  return {
    id,
    section,
    bill: title,
    billNumber: status.billNumber,
    status: status.status,
    latestAction: status.latestAction,
    latestActionDate: status.latestActionDate,
    url: status.url,
    priority: priorityInfo.priority,
    prioritySource: priorityInfo.source,
    priorityReason: priorityInfo.reason,
    cosponsorsCount: known(status.cosponsorsCount, stored.cosponsors),
    hasCommitteeHearing: known(status.hasCommitteeHearing, stored.hasCommitteeHearing),
    hasCommitteeMarkup: known(status.hasCommitteeMarkup, stored.hasCommitteeMarkup),
    hasFloorVote: known(status.hasFloorVote, stored.hasFloorVote),
    committees: status.committees,
    introducedDate: status.introducedDate,
    passageInfo: status.passageInfo
  };
}

function logPriority(priorityInfo) {
  const priorityBadge = priorityInfo.priority === 'high' ? '🔴' :
                       priorityInfo.priority === 'medium' ? '🟡' : '⚪';
  console.log(`  ${priorityBadge} Priority: ${priorityInfo.priority} (${priorityInfo.reason})`);
}

// Main monitoring function
async function monitorBills() {
  console.log('🔍 Starting bill monitoring...\n');
  console.log(`📊 Checking ${SECTIONS.map(s => `${(billsData[s] || []).length} ${s}`).join(', ')}\n`);

  if (!CONGRESS_API_KEY) {
    console.error('❌ CONGRESS_API_KEY environment variable not set!');
    console.log('\n📝 To get an API key:');
    console.log('   1. Visit: https://api.congress.gov/sign-up/');
    console.log('   2. Sign up for a free API key');
    console.log('   3. Set environment variable: export CONGRESS_API_KEY=your_key_here\n');
    process.exit(1);
  }

  const changes = [];
  const errors = [];
  const passedBills = [];
  // Health is measured per record we tried to reach, across every section. Entries that
  // share a record (H.R. 1968's three provisions, H.R. 5166's 17 riders) are one lookup,
  // so a single bad number can't masquerade as a fleet-wide outage, or the reverse.
  const lookups = new Map();
  const checkedBySection = Object.fromEntries(SECTIONS.map(s => [s, 0]));
  let missingCongress = 0;

  async function lookup(billNumber, congress, section) {
    const key = `${congress}:${billNumber.replace(/\s+/g, '').toUpperCase()}`;
    if (lookups.has(key)) return lookups.get(key);
    let result;
    try {
      const status = await fetchBillStatus(billNumber, congress);
      result = status ? { status } : { error: 'No status returned' };
    } catch (error) {
      result = { error: error.message };
    }
    if (result.error) {
      console.log(`  ❌ Error processing ${billNumber}: ${result.error}`);
      errors.push({ billNumber, section, reason: result.error });
    } else if (result.status.missingParts.length) {
      // The record is still used (stored fields are kept), but it wasn't fully verified,
      // so it counts against the run's health like any other failed lookup.
      errors.push({ billNumber, section, reason: `Incomplete: could not fetch ${result.status.missingParts.join(', ')}` });
    }
    lookups.set(key, result);
    // Rate limiting: wait 300ms between requests (more requests now with vote data)
    await new Promise(resolve => setTimeout(resolve, 300));
    return result;
  }

  // An entry is looked up in its own Congress, which every entry must record. Guessing the
  // current one is how a stale or past-Congress number would pick up a stranger's status.
  function congressOf(entry, section, billNumber) {
    if (!Number.isInteger(entry.congress)) {
      missingCongress++;
      errors.push({ billNumber, section, reason: `No congress recorded on ${entry.id}` });
      console.log(`  ❌ ${entry.id} has no congress — not looked up`);
      return null;
    }
    if (entry.congress !== CONGRESS_NUMBER) {
      console.log(`  ⏭️  Skipping: ${entry.congress}th Congress (this check covers the ${CONGRESS_NUMBER}th)`);
      return null;
    }
    return entry.congress;
  }

  // Bills, support bills and routine measures: full status update per entry.
  const entrySections = ['bills', 'supportBills', 'routineBills'];
  const entryTotal = entrySections.reduce((n, s) => n + (billsData[s] || []).length, 0);
  let i = 0;
  for (const section of entrySections) {
    for (const bill of billsData[section] || []) {
      i++;
      const billNumber = bill.billNumbers[0]; // Primary bill number
      console.log(`[${i}/${entryTotal}] ${section}: checking ${billNumber}...`);

      // Skip bills with invalid/pending bill numbers
      if (!parseBillNumber(billNumber)) {
        console.log(`  ⏭️  Skipping: Bill number not yet assigned (${billNumber})`);
        continue;
      }
      const congress = congressOf(bill, section, billNumber);
      if (!congress) continue;

      const { status } = await lookup(billNumber, congress, section);
      if (!status) continue;

      // Rank on the last known value of anything that didn't arrive this run; a missing
      // cosponsor count read as 0 would drop the priority today and "escalate" it tomorrow.
      const stored = bill.status || {};
      const priorityInfo = calculatePriority({
        ...status,
        hasFloorVote: status.hasFloorVote ?? stored.hasFloorVote ?? false,
        hasCommitteeHearing: status.hasCommitteeHearing ?? stored.hasCommitteeHearing ?? false,
        hasCommitteeMarkup: status.hasCommitteeMarkup ?? stored.hasCommitteeMarkup ?? false,
        cosponsorsCount: status.cosponsorsCount ?? stored.cosponsors ?? 0
      }, bill);

      // Persist tracked status (stage, votes, cosponsors, hearing/markup/floor flags) for every bill,
      // not just ones that passed a chamber — cosponsor/committee movement matters on its own.
      const updateResult = updateBillsJson(section, bill.id, status.passageInfo, status);
      if (updateResult.stageChanged) {
        passedBills.push({
          section,
          billNumber: status.billNumber,
          title: bill.title,
          stage: status.passageInfo.stage,
          houseVote: status.passageInfo.houseVote,
          senateVote: status.passageInfo.senateVote
        });
      }

      changes.push(changeRecord(bill.id, section, bill.title, status, priorityInfo, bill.status));
      checkedBySection[section]++;
      logPriority(priorityInfo);
    }
  }

  // Riders: one lookup per spending bill they sit on. A rider is a provision inside that
  // bill, and the bill's progress says nothing about whether the provision survived —
  // H.R. 7148 became law, but whether S.Amdt. 4253 is in it is a separate fact. So this
  // confirms the number on Congress.gov and reports the spending bill's movement in the
  // email, and writes no stage to any rider. Rider statuses are step 1a of
  // docs/2026-11-09-support-page-and-congress-switch-plan.md.
  let previousParentRecords = new Map();
  try {
    const history = JSON.parse(readFileSync(join(__dirname, '../bill-status-history.json'), 'utf-8'));
    const last = history[history.length - 1];
    previousParentRecords = new Map((last?.changes || []).filter(c => c.section === 'riders').map(c => [c.id, c]));
  } catch {
    // No history yet: a first run has nothing to fall back on.
  }
  const parents = new Map();
  for (const rider of billsData.riders || []) {
    const billNumber = rider.billNumbers[0];
    const key = `${rider.congress}:${billNumber}`;
    if (!parents.has(key)) parents.set(key, { billNumber, first: rider, riders: [] });
    parents.get(key).riders.push(rider);
  }
  for (const { billNumber, first, riders } of parents.values()) {
    console.log(`riders: checking ${billNumber} (carries ${riders.length} rider${riders.length === 1 ? '' : 's'})...`);
    if (!parseBillNumber(billNumber)) {
      console.log(`  ⏭️  Skipping: Bill number not yet assigned (${billNumber})`);
      continue;
    }
    const congress = congressOf(first, 'riders', billNumber);
    if (!congress) continue;

    const { status } = await lookup(billNumber, congress, 'riders');
    if (!status) continue;

    stampValidation('riders', riders.map(r => r.id));
    // A spending bill has no stored status of its own, so its last known values come from
    // the previous run's history. Without this, a failed actions request ranks it low for
    // a day and the recovery reads as "priority escalated".
    const id = `riders:${congress}:${billNumber}`;
    const prev = previousParentRecords.get(id) || {};
    const stored = {
      hasFloorVote: prev.hasFloorVote,
      hasCommitteeHearing: prev.hasCommitteeHearing,
      hasCommitteeMarkup: prev.hasCommitteeMarkup,
      cosponsors: prev.cosponsorsCount
    };
    const priorityInfo = calculatePriority({
      ...status,
      hasFloorVote: status.hasFloorVote ?? stored.hasFloorVote ?? false,
      hasCommitteeHearing: status.hasCommitteeHearing ?? stored.hasCommitteeHearing ?? false,
      hasCommitteeMarkup: status.hasCommitteeMarkup ?? stored.hasCommitteeMarkup ?? false,
      cosponsorsCount: status.cosponsorsCount ?? stored.cosponsors ?? 0
    }, { type: 'rider-parent' });
    // "Tracked riders proposed for", not "carries": whether a provision survived into the
    // bill is exactly what this check does not know.
    const title = `${status.title} (${riders.length} tracked D.C. rider${riders.length === 1 ? '' : 's'} proposed for this bill)`;
    changes.push(changeRecord(id, 'riders', title, status, priorityInfo, stored));
    checkedBySection.riders += riders.length;
    logPriority(priorityInfo);
  }

  const attempted = lookups.size + missingCongress;

  console.log('\n✅ Monitoring complete!\n');

  // Show passage summary if any bills passed
  if (passedBills.length > 0) {
    console.log('\n🚨 BILLS THAT HAVE PASSED 🚨');
    console.log('='.repeat(80));
    passedBills.forEach(passed => {
      console.log(`\n📜 ${passed.billNumber}: ${passed.title}`);
      console.log(`   Stage: ${passed.stage}`);
      if (passed.houseVote) {
        console.log(`   House: ${passed.houseVote.yeas}-${passed.houseVote.nays} on ${passed.houseVote.date}`);
        console.log(`   Party breakdown: R ${passed.houseVote.byParty.republican.yeas}-${passed.houseVote.byParty.republican.nays}, D ${passed.houseVote.byParty.democrat.yeas}-${passed.houseVote.byParty.democrat.nays}`);
      }
      if (passed.senateVote) {
        console.log(`   Senate: ${passed.senateVote.yeas}-${passed.senateVote.nays} on ${passed.senateVote.date}`);
        console.log(`   Party breakdown: R ${passed.senateVote.byParty.republican.yeas}-${passed.senateVote.byParty.republican.nays}, D ${passed.senateVote.byParty.democrat.yeas}-${passed.senateVote.byParty.democrat.nays}`);
      }
    });
    console.log('\n' + '='.repeat(80) + '\n');
  }

  // Generate report
  generateReport(changes, errors, passedBills, { attempted, checkedBySection });
}

// Priority tiers for detecting escalation (watching and low are both "baseline")
const PRIORITY_RANK = { low: 0, watching: 0, medium: 1, high: 2 };

// Compare today's changes against the previous run to find what's actually new
function diffAgainstPrevious(changes, previousChanges) {
  const previousById = new Map((previousChanges || []).map(c => [c.id, c]));
  const currentIds = new Set(changes.map(c => c.id));

  const diff = {
    priorityEscalations: [],
    newHearings: [],
    newMarkups: [],
    newFloorVotes: [],
    cosponsorJumps: [],
    newBills: [],
    routineUpdateCount: 0
  };

  for (const current of changes) {
    const previous = previousById.get(current.id);

    if (!previous) {
      diff.newBills.push(current);
      continue;
    }

    let notable = false;

    if (PRIORITY_RANK[current.priority] > PRIORITY_RANK[previous.priority]) {
      diff.priorityEscalations.push({ current, previous });
      notable = true;
    }
    // A null on either side is "unknown that run", never a transition.
    if (previous.hasCommitteeHearing === false && current.hasCommitteeHearing === true) {
      diff.newHearings.push(current);
      notable = true;
    }
    if (previous.hasCommitteeMarkup === false && current.hasCommitteeMarkup === true) {
      diff.newMarkups.push(current);
      notable = true;
    }
    if (previous.hasFloorVote === false && current.hasFloorVote === true) {
      diff.newFloorVotes.push(current);
      notable = true;
    }
    const bothCounts = Number.isInteger(current.cosponsorsCount) && Number.isInteger(previous.cosponsorsCount);
    const cosponsorDelta = bothCounts ? current.cosponsorsCount - previous.cosponsorsCount : 0;
    if (cosponsorDelta >= 5) {
      diff.cosponsorJumps.push({ current, previous, delta: cosponsorDelta });
      notable = true;
    }

    if (!notable && current.latestActionDate !== previous.latestActionDate) {
      diff.routineUpdateCount++;
    }
  }

  diff.removedBillIds = [...previousById.keys()].filter(id => !currentIds.has(id));

  return diff;
}

function stageLabel(stage) {
  if (stage === 'passed-house' || stage === 'agreed-house') return 'the House';
  if (stage === 'passed-senate' || stage === 'agreed-senate') return 'the Senate';
  if (stage === 'passed-both' || stage === 'agreed-both') return 'both chambers';
  if (stage === 'sent-to-states') return 'both chambers and went to the states';
  if (stage === 'enacted') return 'into law';
  return stage;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Build the inline-styled HTML summary that gets emailed (full detail stays in monitoring-report.txt / history for archival)
// The email is about attacks unless it says otherwise. Support and routine measures are
// labelled so a support bill's hearing never reads as an attack advancing.
function sectionTag(item) {
  if (item.section === 'supportBills') return ' <em>(support bill)</em>';
  if (item.section === 'routineBills') return ' <em>(routine measure)</em>';
  return '';
}

function buildSummaryHtml({ diff, passedBills, errors, totalBills, checkedBySection = {}, timestamp, previousTimestamp, runUrl }) {
  const sections = [];

  if (passedBills.length > 0) {
    const rows = passedBills.map(p => {
      const vote = p.houseVote || p.senateVote;
      const voteText = vote
        ? ` — ${vote.yeas}-${vote.nays} (R ${vote.byParty.republican.yeas}-${vote.byParty.republican.nays}, D ${vote.byParty.democrat.yeas}-${vote.byParty.democrat.nays})`
        : '';
      const action = p.section === 'bills'
        ? `<br><em>Action to consider:</em> publish an urgent alert on the site and/or a newsletter update.`
        : '';
      return `<li><strong>${escapeHtml(p.billNumber)}</strong>${sectionTag(p)}: ${escapeHtml(p.title)} passed ${stageLabel(p.stage)}${voteText}.
        ${action}</li>`;
    }).join('');
    sections.push(`<h3 style="margin:20px 0 8px;color:#b91c1c;">🚨 Passed a chamber (${passedBills.length})</h3><ul style="margin:0;padding-left:20px;">${rows}</ul>`);
  }

  if (diff.priorityEscalations.length > 0) {
    const rows = diff.priorityEscalations.map(({ current, previous }) =>
      `<li><strong>${escapeHtml(current.billNumber)}</strong>${sectionTag(current)}: ${escapeHtml(current.bill)} — priority ${previous.priority} → <strong>${current.priority}</strong> (${escapeHtml(current.priorityReason)}).
        <br><em>Action to consider:</em> review its placement/details on the site.</li>`
    ).join('');
    sections.push(`<h3 style="margin:20px 0 8px;color:#b45309;">🔼 Priority escalated (${diff.priorityEscalations.length})</h3><ul style="margin:0;padding-left:20px;">${rows}</ul>`);
  }

  if (diff.newMarkups.length > 0) {
    const rows = diff.newMarkups.map(c =>
      `<li><strong>${escapeHtml(c.billNumber)}</strong>${sectionTag(c)}: ${escapeHtml(c.bill)} had a committee markup.
        <br><em>Action to consider:</em> markups often precede a floor vote — watch closely.</li>`
    ).join('');
    sections.push(`<h3 style="margin:20px 0 8px;">📝 New committee markups (${diff.newMarkups.length})</h3><ul style="margin:0;padding-left:20px;">${rows}</ul>`);
  }

  if (diff.newHearings.length > 0) {
    const rows = diff.newHearings.map(c =>
      `<li><strong>${escapeHtml(c.billNumber)}</strong>${sectionTag(c)}: ${escapeHtml(c.bill)} had a committee hearing.</li>`
    ).join('');
    sections.push(`<h3 style="margin:20px 0 8px;">🗣️ New committee hearings (${diff.newHearings.length})</h3><ul style="margin:0;padding-left:20px;">${rows}</ul>`);
  }

  if (diff.newFloorVotes.length > 0) {
    const rows = diff.newFloorVotes.map(c =>
      `<li><strong>${escapeHtml(c.billNumber)}</strong>${sectionTag(c)}: ${escapeHtml(c.bill)} — floor activity detected.
        <br><em>Action to consider:</em> check Congress.gov for the outcome.</li>`
    ).join('');
    sections.push(`<h3 style="margin:20px 0 8px;">🗳️ New floor activity (${diff.newFloorVotes.length})</h3><ul style="margin:0;padding-left:20px;">${rows}</ul>`);
  }

  if (diff.cosponsorJumps.length > 0) {
    const rows = diff.cosponsorJumps.map(({ current, previous, delta }) =>
      `<li><strong>${escapeHtml(current.billNumber)}</strong>${sectionTag(current)}: ${escapeHtml(current.bill)} — cosponsors ${previous.cosponsorsCount} → ${current.cosponsorsCount} (+${delta}).
        <br><em>Action to consider:</em> reassess priority tier if this crosses a threshold.</li>`
    ).join('');
    sections.push(`<h3 style="margin:20px 0 8px;">📈 Notable cosponsor jumps (${diff.cosponsorJumps.length})</h3><ul style="margin:0;padding-left:20px;">${rows}</ul>`);
  }

  if (diff.newBills.length > 0) {
    const rows = diff.newBills.map(c => `<li><strong>${escapeHtml(c.billNumber)}</strong>${sectionTag(c)}: ${escapeHtml(c.bill)}</li>`).join('');
    sections.push(`<h3 style="margin:20px 0 8px;">🆕 New to monitoring (${diff.newBills.length})</h3><ul style="margin:0;padding-left:20px;">${rows}</ul>`);
  }

  if (errors.length > 0) {
    const rows = errors
      .map(e => `<li>${escapeHtml(e.billNumber)} — <code>${escapeHtml(e.reason)}</code></li>`)
      .join('');
    const allFailed = errors.length === totalBills;
    const guidance = allFailed
      ? 'Every lookup failed — this is an API-wide problem (outage, key, or rate limit), not bad bill numbers. Bill data was NOT verified this run.'
      : 'Check bill number formatting or Congress.gov API status.';
    sections.push(`<h3 style="margin:20px 0 8px;color:#b91c1c;">⚠️ Fetch errors (${errors.length} of ${totalBills})</h3><ul style="margin:0;padding-left:20px;">${rows}</ul><p style="margin:4px 0 0;"><em>Action to consider:</em> ${escapeHtml(guidance)}</p>`);
  }

  const hasNotableChanges = sections.length > 0;
  const sectionNames = { bills: 'anti-D.C. bill entries', riders: 'riders', supportBills: 'support bills', routineBills: 'routine' };
  const checkedParts = Object.entries(checkedBySection).filter(([, n]) => n > 0).map(([s, n]) => `${n} ${sectionNames[s] || s}`);
  const checkedLine = checkedParts.length ? ` (${checkedParts.join(', ')})` : '';
  const intro = hasNotableChanges
    ? `Checked <strong>${totalBills}</strong> Congress.gov records${checkedLine}. Here's what changed since the last check${previousTimestamp ? ` (${new Date(previousTimestamp).toLocaleString('en-US', { dateStyle: 'medium' })})` : ''}:`
    : `Checked <strong>${totalBills}</strong> Congress.gov records${checkedLine}. No notable changes since the last check${previousTimestamp ? ` (${new Date(previousTimestamp).toLocaleString('en-US', { dateStyle: 'medium' })})` : ''} — nothing needs your attention today.`;

  const routineNote = diff.routineUpdateCount > 0
    ? `<p style="margin:16px 0 0;color:#6b7280;font-size:13px;">${diff.routineUpdateCount} other bill(s) had routine status/date updates with no notable category.</p>`
    : '';

  return `
    <style>
      @media (max-width: 600px) {
        .summary-container { padding: 12px !important; }
        .summary-container h2 { font-size: 20px !important; }
        .summary-container h3 { font-size: 16px !important; }
        .summary-container ul { padding-left: 16px !important; }
      }
    </style>
    <div class="summary-container" style="max-width:600px;margin:0 auto;padding:20px;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111827;">
      <h2 style="margin:0 0 12px;">DC Bills Tracker — Daily Summary</h2>
      <p style="margin:0 0 12px;">${intro}</p>
      ${sections.join('')}
      ${routineNote}
      <hr style="margin:24px 0 12px;border:none;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#6b7280;font-size:13px;font-style:italic;">
        Full per-bill detail for all ${totalBills} records is archived in <code>bill-status-history.json</code> (committed to the repo)
        and attached as a workflow artifact (90-day retention).${runUrl ? ` <a href="${runUrl}">View this run</a>.` : ''}
      </p>
    </div>
  `.trim();
}

// Generate summary report
function generateReport(changes, errors, passedBills, { attempted, checkedBySection }) {
  console.log('📋 BILL STATUS REPORT');
  console.log('='.repeat(80));
  console.log(`Congress.gov records looked up: ${attempted}`);
  console.log(`Entries checked by section: ${JSON.stringify(checkedBySection)}`);
  console.log(`Successful checks: ${changes.length}`);
  console.log(`Errors: ${errors.length}\n`);

  // Group by priority
  const byPriority = {
    high: [],
    medium: [],
    watching: [],
    low: []
  };

  changes.forEach(change => {
    const priority = change.priority || 'low';
    if (byPriority[priority]) {
      byPriority[priority].push(change);
    }
  });

  // Print HIGH priority bills first
  console.log('\n🔴 HIGH PRIORITY BILLS (' + byPriority.high.length + ')');
  console.log('='.repeat(80));
  byPriority.high.forEach(change => {
    console.log(`\n  ${change.billNumber}: ${change.bill}`);
    console.log(`  Status: ${change.status}`);
    console.log(`  Priority reason: ${change.priorityReason}`);
    console.log(`  Latest: ${change.latestAction}`);
    console.log(`  Date: ${change.latestActionDate || 'Unknown'}`);
    console.log(`  Cosponsors: ${change.cosponsorsCount}`);
    if (change.hasCommitteeHearing) console.log(`  ✓ Committee hearing held`);
    if (change.hasCommitteeMarkup) console.log(`  ✓ Committee markup held`);
    if (change.hasFloorVote) console.log(`  ✓ Floor vote occurred`);
    console.log(`  URL: ${change.url}`);
  });

  // Print MEDIUM priority bills
  console.log('\n\n🟡 MEDIUM PRIORITY BILLS (' + byPriority.medium.length + ')');
  console.log('='.repeat(80));
  byPriority.medium.forEach(change => {
    console.log(`\n  ${change.billNumber}: ${change.bill}`);
    console.log(`  Status: ${change.status} | Cosponsors: ${change.cosponsorsCount}`);
    console.log(`  Latest: ${change.latestAction} (${change.latestActionDate || 'Unknown'})`);
  });

  // Print WATCHING bills
  console.log('\n\n⚪ WATCHING (' + byPriority.watching.length + ')');
  console.log('='.repeat(80));
  byPriority.watching.forEach(change => {
    console.log(`  ${change.billNumber}: ${change.bill}`);
  });

  if (errors.length > 0) {
    console.log('\n\n❌ ERRORS');
    console.log('-'.repeat(80));
    errors.forEach(e => console.log(`  ${e.billNumber}: ${e.reason}`));
  }

  // Save results to file for future comparison
  const timestamp = new Date().toISOString();
  const resultsPath = join(__dirname, '../bill-status-history.json');

  let previousEntry = null;

  try {
    let history = [];
    try {
      history = JSON.parse(readFileSync(resultsPath, 'utf-8'));
    } catch (e) {
      // File doesn't exist yet, start fresh
    }

    previousEntry = history.length > 0 ? history[history.length - 1] : null;

    // A run that checked nothing has nothing to remember. Appending it would push a real
    // entry off the 30-entry cap — on 2026-07-26 one failed run cost 2,273 lines of
    // history — so a string of outages would quietly erase the change log it exists to keep.
    if (changes.length === 0 && errors.length > 0) {
      console.log('\n⚠️  Every lookup failed — not appending to history (would evict a real entry)');
    } else {
      history.push({
        timestamp,
        changes,
        errors
      });

      // Keep last 30 checks
      if (history.length > 30) {
        history = history.slice(-30);
      }

      writeFileSync(resultsPath, JSON.stringify(history, null, 2));
      console.log(`\n💾 Results saved to: ${resultsPath}`);
    }
  } catch (error) {
    console.error('Error saving results:', error);
  }

  console.log('\n' + '='.repeat(80));

  // Build the diff-based summary that gets emailed (this file, not the full report, is the email content)
  const diff = diffAgainstPrevious(changes, previousEntry ? previousEntry.changes : []);
  const hasMeaningfulChanges = passedBills.length > 0 ||
    diff.priorityEscalations.length > 0 ||
    diff.newHearings.length > 0 ||
    diff.newMarkups.length > 0 ||
    diff.newFloorVotes.length > 0 ||
    diff.cosponsorJumps.length > 0 ||
    diff.newBills.length > 0 ||
    errors.length > 0;

  const runUrl = (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID)
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null;

  const summaryHtml = buildSummaryHtml({
    diff,
    passedBills,
    errors,
    totalBills: attempted,
    checkedBySection,
    timestamp,
    previousTimestamp: previousEntry ? previousEntry.timestamp : null,
    runUrl
  });

  const summaryPath = join(__dirname, '../monitoring-summary.html');
  writeFileSync(summaryPath, summaryHtml);
  console.log(`💾 Summary saved to: ${summaryPath}`);

  // A run is only trustworthy if most lookups actually succeeded. Below that bar the
  // data is not verified, so downstream steps must not commit, deploy, or claim success.
  const MAX_ERROR_RATE = 0.25;
  // Across every section: a run that reached the 78 oppose bills but none of the support
  // bills is not a healthy check of the tracker.
  const errorRate = attempted > 0 ? errors.length / attempted : 1;
  const checkFailed = errorRate > MAX_ERROR_RATE;

  const metaPath = join(__dirname, '../monitoring-meta.json');
  writeFileSync(metaPath, JSON.stringify({
    timestamp,
    // Congress.gov records looked up, across all sections (the email subject's "N/M lookups").
    totalBills: attempted,
    checkedBySection,
    passedCount: passedBills.length,
    errorCount: errors.length,
    errorRate: Number(errorRate.toFixed(3)),
    checkFailed,
    hasMeaningfulChanges
  }, null, 2));
  console.log(`💾 Meta saved to: ${metaPath}`);

  // Stamp when the data was last verified against Congress.gov. This is distinct
  // from `lastUpdated`, which only moves when a bill's own fields change — a run
  // that finds nothing new is still a successful check, and the site needs to be
  // able to say so. Only stamp when the check was actually healthy: a run where most
  // lookups failed is not a check, and must not look like one.
  if (!checkFailed && changes.length > 0) {
    try {
      const fresh = JSON.parse(readFileSync(billsPath, 'utf-8'));
      fresh.lastChecked = timestamp;
      writeFileSync(billsPath, JSON.stringify(fresh, null, 2));
      console.log(`💾 Stamped lastChecked: ${timestamp}`);
    } catch (error) {
      console.error('Error stamping lastChecked:', error.message);
    }
  } else {
    console.log(`⚠️  Check unhealthy (${errors.length}/${attempted} lookups failed) — leaving lastChecked untouched`);
  }
}

// Run the monitoring
monitorBills().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

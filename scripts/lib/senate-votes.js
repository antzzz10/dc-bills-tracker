// Senate roll-call votes, read from the Senate's own XML record.
//
// Congress.gov's API publishes House votes (house-vote) but has no Senate vote endpoint:
// /senate-vote returns 404 for every path, so every Senate tally the monitor asked for
// failed and was reported as a fetch error in each daily email (checked 2026-11-14).
// senate.gov publishes each vote as XML beside the HTML page the site already links to.
//
// parseSenateVote is pure so it can be tested against saved records; fetchSenateVote is
// the network wrapper. Both refuse anything they can't fully account for, because a
// tally that's wrong is worse than one that's missing.
//
// senate.gov sometimes refuses requests from cloud servers (HTTP 403 to every request in
// one GitHub Actions run on 2026-11-14, then normal service in the next three; others
// report the same from AWS: github.com/LibraryOfCongress/api.congress.gov/issues/441).
// A Senate vote is a final record, and Congress.gov's own action line for the passage
// carries its totals ("Passed Senate ... by Yea-Nay Vote. 54 - 46. Record Vote Number:
// 133."). So resolveSenateVote checks the two official records against each other when
// both answer, and falls back to Congress.gov's totals (no party rows) when senate.gov
// can't be reached. mergeSenateVote then decides what is stored and what is reported.

const TYPE_ALIASES = {
  'h.r.': 'hr', 's.': 's',
  'h.j.res.': 'hjres', 's.j.res.': 'sjres',
  'h.con.res.': 'hconres', 's.con.res.': 'sconres',
  'h.res.': 'hres', 's.res.': 'sres'
};

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december'];

export function senateVoteXmlUrl(congress, session, rollCallNumber) {
  const roll = String(rollCallNumber).padStart(5, '0');
  return `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${congress}${session}/vote_${congress}_${session}_${roll}.xml`;
}

// First <tag>…</tag> inside `xml`, trimmed and entity-decoded; null when absent.
function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  if (!m) return null;
  return m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function toInt(value) {
  return /^\d+$/.test(value ?? '') ? Number(value) : null;
}

// "April 5, 2025,  02:26 AM" → "2025-04-05". The calendar date as the Senate wrote it,
// with no time-zone conversion. Null for an impossible date (Feb 31) or one outside the
// session: a session runs within its year, and can sit until noon Jan 3 of the next.
function parseVoteDate(text, congress, session) {
  const m = (text || '').match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  if (month < 0) return null;
  return sessionDate(Number(m[3]), month, Number(m[2]), congress, session);
}

// "YYYY-MM-DD" for a real calendar date inside the session, else null.
function sessionDate(year, month, day, congress, session) {
  const check = new Date(Date.UTC(year, month, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month || check.getUTCDate() !== day) return null;
  const sessionYear = 1789 + (Number(congress) - 1) * 2 + Number(session) - 1;
  const inSession = year === sessionYear || (year === sessionYear + 1 && month === 0 && day <= 3);
  if (!inSession) return null;
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Congress.gov's action date ("2025-03-14"), held to the same rule as the Senate's own.
function checkedActionDate(text, congress, session) {
  const m = String(text || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? sessionDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]), congress, session) : null;
}

export function normalizeDocumentType(text) {
  return TYPE_ALIASES[String(text || '').toLowerCase().replace(/\s+/g, '')] || null;
}

/**
 * Read one Senate roll-call record.
 * Returns { ok: true, vote } or { ok: false, reason, skip? }. `skip` marks a record that
 * is real but deliberately not published (another bill's vote, a tie the Vice President
 * broke); without it the caller should treat the vote as a failed fetch.
 */
export function parseSenateVote(xml, { congress, session, rollCallNumber, billType, number }) {
  if (typeof xml !== 'string' || !xml.includes('<roll_call_vote>')) {
    return { ok: false, reason: 'not a Senate roll-call record' };
  }

  // The record must be the one asked for: roll call numbers restart every session.
  const got = {
    congress: toInt(tag(xml, 'congress')),
    session: toInt(tag(xml, 'session')),
    roll: toInt(tag(xml, 'vote_number'))
  };
  if (got.congress !== Number(congress) || got.session !== Number(session) || got.roll !== Number(rollCallNumber)) {
    return { ok: false, reason: `record is ${got.congress}-${got.session} #${got.roll}, not ${congress}-${session} #${rollCallNumber}` };
  }

  // Skip only a record positively identified as something else (another measure, a
  // nomination). Missing or unrecognised identity is a failure, so a format change on
  // senate.gov shows up in the email instead of silently dropping tallies (Codex, 2026-11-14).
  const doc = tag(xml, 'document') || '';
  const rawType = tag(doc, 'document_type');
  const docNumber = tag(doc, 'document_number');
  const docCongress = tag(doc, 'document_congress');
  if (rawType === 'PN') return { ok: false, skip: true, reason: 'vote is on a nomination' };
  const docType = normalizeDocumentType(rawType);
  if (!docType || !/^\d+$/.test(docNumber || '')) {
    return { ok: false, reason: `record's measure is unreadable (type ${rawType ?? 'missing'}, number ${docNumber ?? 'missing'})` };
  }
  if (docCongress !== null && toInt(docCongress) !== Number(congress)) {
    return { ok: false, reason: `record's measure is from Congress ${docCongress}, not ${congress}` };
  }
  if (docType !== billType || String(docNumber) !== String(number)) {
    return { ok: false, skip: true, reason: `vote is on ${tag(doc, 'document_name') || `${docType} ${docNumber}`}, not ${String(billType).toUpperCase()} ${number}` };
  }

  const date = parseVoteDate(tag(xml, 'vote_date'), congress, session);
  if (!date) return { ok: false, reason: 'vote date unreadable, impossible or outside the session' };

  const count = tag(xml, 'count') || '';
  const yeas = toInt(tag(count, 'yeas'));
  const nays = toInt(tag(count, 'nays'));
  if (yeas === null || nays === null) return { ok: false, reason: 'missing yea/nay count' };

  // A tie the Vice President broke isn't in the senators' count; publishing 50-50 for a
  // measure that passed would mislead. Left for a person to record.
  const tieVote = tag(tag(xml, 'tie_breaker') || '', 'tie_breaker_vote');
  if (tieVote) return { ok: false, skip: true, reason: `Vice President broke a tie (${tieVote})` };

  // Party rows from the member list. They must add up to the official count, or none of
  // it is used.
  const byParty = {};
  let memberYeas = 0;
  let memberNays = 0;
  for (const member of xml.match(/<member>[\s\S]*?<\/member>/g) || []) {
    const cast = tag(member, 'vote_cast');
    if (cast !== 'Yea' && cast !== 'Nay') continue;
    const key = { R: 'republican', D: 'democrat', I: 'independent' }[tag(member, 'party')];
    if (!key) return { ok: false, reason: `unknown party for ${tag(member, 'member_full')}` };
    byParty[key] ??= { yeas: 0, nays: 0 };
    if (cast === 'Yea') { byParty[key].yeas++; memberYeas++; } else { byParty[key].nays++; memberNays++; }
  }
  if (memberYeas !== yeas || memberNays !== nays) {
    return { ok: false, reason: `member votes (${memberYeas}-${memberNays}) don't match the count (${yeas}-${nays})` };
  }

  return {
    ok: true,
    vote: {
      date,
      yeas,
      nays,
      byParty: {
        republican: byParty.republican || { yeas: 0, nays: 0 },
        democrat: byParty.democrat || { yeas: 0, nays: 0 },
        // Same rule as the House path: only when an independent actually voted.
        ...(byParty.independent ? { independent: byParty.independent } : {})
      }
    }
  };
}

// "... by Yea-Nay Vote. 54 - 46. Record Vote Number: 133." → { yeas, nays, rollCallNumber }.
// Null for anything else (voice votes, unanimous consent, House wording).
export function parseActionTally(text) {
  const m = String(text || '').match(/\bYea-Nay Vote\.\s*(\d{1,3})\s*-\s*(\d{1,3})\.\s*Record Vote Number:\s*(\d+)\b/i);
  return m ? { yeas: Number(m[1]), nays: Number(m[2]), rollCallNumber: Number(m[3]) } : null;
}

// Refusals and overloads worth another try. A 404 is not one: the record's address is
// built here, so a 404 means the address or the roll number is wrong, and that must
// stay an error.
const isTransientStatus = status => status === 403 || status === 429 || status >= 500;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch and read one record. `unreachable: true` marks the case where senate.gov never
 * gave a usable answer (refused, overloaded, timed out) after the retries; every other
 * failure means it answered with something we won't use.
 */
export async function fetchSenateVote(expected, { fetchImpl = fetch, timeoutMs = 15000, retryDelaysMs = [2000, 6000], sleep = pause } = {}) {
  const url = senateVoteXmlUrl(expected.congress, expected.session, expected.rollCallNumber);
  let reason = 'no attempt made';
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    if (attempt > 0) await sleep(retryDelaysMs[attempt - 1]);
    let response;
    try {
      response = await fetchImpl(url, {
        headers: { 'User-Agent': 'RepresentDC bill tracker (+https://billtracker.representdc.org)' },
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      reason = `no answer from senate.gov (${error?.name === 'TimeoutError' ? 'timed out' : error?.message || 'network error'})`;
      continue;
    }
    if (response.ok) {
      let body;
      try {
        body = await response.text();
      } catch (error) {
        reason = `no answer from senate.gov (${error?.message || 'response cut off'})`;
        continue;
      }
      return parseSenateVote(body, expected);
    }
    reason = `HTTP ${response.status} from senate.gov`;
    if (!isTransientStatus(response.status)) return { ok: false, reason };
  }
  return { ok: false, unreachable: true, reason };
}

/**
 * One Senate passage vote, from both official records.
 *   tally: parseActionTally() of Congress.gov's action line for this passage, or null.
 *   actionDate: that action's date (YYYY-MM-DD).
 * Returns what fetchSenateVote returns, plus:
 *   - a failure when senate.gov and Congress.gov give different totals or dates;
 *   - { ok: true, totalsOnly: true, unreachableReason, vote: { date, yeas, nays } } when
 *     senate.gov couldn't be reached and Congress.gov's action line has the totals.
 */
export async function resolveSenateVote(expected, evidence = {}, options = {}) {
  return reconcileSenateVote(await fetchSenateVote(expected, options), expected, evidence);
}

/**
 * The same decision for an answer already fetched, so one request to senate.gov can be
 * checked against each Congress.gov action line that cites the vote (Congress.gov lists a
 * passage twice). Every action's own totals and date are checked; none is taken on trust
 * because an earlier one passed.
 */
export function reconcileSenateVote(result, expected, { tally = null, actionDate = null } = {}) {
  const tallyIsForThisVote = Boolean(tally) && Number(tally.rollCallNumber) === Number(expected.rollCallNumber);
  if (result.ok) {
    if (tallyIsForThisVote && (tally.yeas !== result.vote.yeas || tally.nays !== result.vote.nays)) {
      return { ok: false, reason: `senate.gov records ${result.vote.yeas}-${result.vote.nays} but Congress.gov's action says ${tally.yeas}-${tally.nays}` };
    }
    if (tallyIsForThisVote && actionDate && actionDate !== result.vote.date) {
      return { ok: false, reason: `senate.gov dates the vote ${result.vote.date} but Congress.gov's action is dated ${actionDate}` };
    }
    return result;
  }
  if (!result.unreachable || !tallyIsForThisVote) return result;
  // From here senate.gov never answered. Each refusal below keeps `unreachable`, so the
  // caller still knows not to spend retries on the run's other votes.
  const refuse = why => ({ ok: false, unreachable: true, reason: `${result.reason}; ${why}` });
  // Without the Senate's record there is no way to see a Vice President's tie-break:
  // Congress.gov writes a 49-49 split the Vice President broke as "50 - 49". So a tie, a
  // one-vote margin or more votes than senators is never published from totals alone.
  if (tally.yeas - tally.nays <= 1 || tally.yeas + tally.nays > 100) {
    return refuse(`Congress.gov's ${tally.yeas}-${tally.nays} could include a tie-break, so it isn't used alone`);
  }
  const date = checkedActionDate(actionDate, expected.congress, expected.session);
  if (!date) return refuse(`Congress.gov's action date (${actionDate ?? 'missing'}) isn't a usable date in this session`);
  return {
    ok: true,
    totalsOnly: true,
    unreachableReason: result.reason,
    vote: { date, yeas: tally.yeas, nays: tally.nays }
  };
}

/**
 * Combine the answers for one roll call from each Congress.gov action line that cites it.
 *   votes: the accepted answers.
 *   failed: a line's lookup failed for a reason of substance (a disagreement between the
 *     two sources, an unreadable record, a refused tie-break guess, a 404).
 *   noEvidence: senate.gov was unreachable and a line carried no tally to fall back on.
 * Any failure of substance voids the vote, whatever the other lines say. Lines must also
 * agree with each other on totals and date. Only `noEvidence` is forgiven when another
 * line answered: the bare "Passed/agreed to" marker can lack what the full line has.
 * The fuller record (with party rows) wins.
 */
export function combineActionVotes({ votes = [], failed = false, noEvidence = false }) {
  if (failed) return { vote: null, failed: true, disagree: false };
  const first = votes[0];
  if (!first) return { vote: null, failed: noEvidence, disagree: false };
  if (votes.some(v => v.yeas !== first.yeas || v.nays !== first.nays || v.date !== first.date)) {
    return { vote: null, failed: true, disagree: true };
  }
  return { vote: votes.find(v => !v.totalsOnly) || first, failed: false, disagree: false };
}

const sameParty = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Decide what to store for a Senate vote and what to tell the person reading the email.
 *   existing: the stored passage.senate record, or undefined.
 *   fresh: this run's vote ({ date, yeas, nays, byParty?, source, totalsOnly?, unreachableReason? }).
 * Returns { record, note }: `record` is the new stored record, or null to keep what's
 * there; `note` is null, { kind: 'gap', text } (party rows missing on the site, senate.gov
 * unreachable: reported, not an error) or { kind: 'conflict', text } (an error).
 */
export function mergeSenateVote(existing, fresh, today) {
  const stored = existing?.vote;
  const hasStoredTotals = Number.isInteger(stored?.yeas) && Number.isInteger(stored?.nays);
  const sameTotals = hasStoredTotals && stored.yeas === fresh.yeas && stored.nays === fresh.nays;

  if (fresh.totalsOnly) {
    // Two records disagree and the fuller one can't be read: change nothing, say so.
    if (hasStoredTotals && !sameTotals) {
      return { record: null, note: { kind: 'conflict', text: `stored Senate tally ${stored.yeas}-${stored.nays} differs from Congress.gov's ${fresh.yeas}-${fresh.nays}, and senate.gov couldn't be read to settle it (${fresh.unreachableReason})` } };
    }
    if (sameTotals && existing.date && existing.date !== fresh.date) {
      return { record: null, note: { kind: 'conflict', text: `stored Senate vote is dated ${existing.date} but Congress.gov's action is dated ${fresh.date}, and senate.gov couldn't be read to settle it (${fresh.unreachableReason})` } };
    }
    const gap = { kind: 'gap', text: `Senate vote ${fresh.yeas}-${fresh.nays}: party breakdown not read (${fresh.unreachableReason}). Totals are from Congress.gov's action record.` };
    if (sameTotals) return { record: null, note: stored.byParty ? null : gap };
    return {
      record: { date: fresh.date, vote: { yeas: fresh.yeas, nays: fresh.nays }, source: fresh.source, verifiedOn: today },
      note: gap
    };
  }

  const needsUpdate = !existing || !sameTotals || existing.date !== fresh.date || !existing.source ||
    !sameParty(stored?.byParty, fresh.byParty);
  if (!needsUpdate) return { record: null, note: null };
  return {
    record: { date: fresh.date, vote: { yeas: fresh.yeas, nays: fresh.nays, byParty: fresh.byParty }, source: fresh.source, verifiedOn: today },
    note: null
  };
}

/**
 * For an entry the monitor never rewrites (manualOverride): does its hand-entered Senate
 * tally still agree with this run's? Returns a conflict note or null. No gap note: what a
 * locked entry shows is a person's choice.
 */
export function checkLockedSenateVote(existing, fresh) {
  const stored = existing?.vote;
  if (!Number.isInteger(stored?.yeas) || !Number.isInteger(stored?.nays)) return null;
  const where = fresh.totalsOnly ? "Congress.gov's" : "senate.gov's";
  if (stored.yeas !== fresh.yeas || stored.nays !== fresh.nays) {
    return { kind: 'conflict', text: `hand-entered Senate tally ${stored.yeas}-${stored.nays} differs from ${where} ${fresh.yeas}-${fresh.nays}; the entry is locked, so nothing was changed` };
  }
  if (existing.date && existing.date !== fresh.date) {
    return { kind: 'conflict', text: `hand-entered Senate vote date ${existing.date} differs from ${where} ${fresh.date}; the entry is locked, so nothing was changed` };
  }
  return null;
}

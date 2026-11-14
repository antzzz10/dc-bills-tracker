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
  const day = Number(m[2]);
  const year = Number(m[3]);
  if (month < 0) return null;
  const check = new Date(Date.UTC(year, month, day));
  if (check.getUTCMonth() !== month || check.getUTCDate() !== day) return null;
  const sessionYear = 1789 + (Number(congress) - 1) * 2 + Number(session) - 1;
  const inSession = year === sessionYear || (year === sessionYear + 1 && month === 0 && day <= 3);
  if (!inSession) return null;
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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

export async function fetchSenateVote(expected, { fetchImpl = fetch, timeoutMs = 30000 } = {}) {
  const url = senateVoteXmlUrl(expected.congress, expected.session, expected.rollCallNumber);
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': 'RepresentDC bill tracker (+https://billtracker.representdc.org)' },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) return { ok: false, reason: `HTTP ${response.status} from senate.gov` };
  return parseSenateVote(await response.text(), expected);
}

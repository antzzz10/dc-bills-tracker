/**
 * Congress.gov API helpers shared by the scripts that need a complete answer, not a
 * best-effort one: the flagship cosponsor lists (monitor-bills.js) and the current-member
 * roster (build-member-roster.js).
 *
 * The rest of the monitor deliberately keeps its single-attempt fetches: a failed lookup
 * there counts against the run's health, and that behaviour is unchanged.
 */

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Transient by definition: rate limiting (429) and server-side failures (5xx). A 4xx other
// than 429 is an answer, not an outage, and retrying it only spends the hourly quota.
export function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

/**
 * GET a JSON document, retrying 429/5xx and network errors with exponential backoff.
 * Honours Retry-After (seconds) when the API sends one, capped so a bad header can't stall
 * the job past its timeout.
 *
 * Returns { ok: true, data } or { ok: false, status, reason }. Never throws.
 */
export async function fetchJsonWithRetry(url, {
  retries = 4,
  baseDelayMs = 1000,
  maxDelayMs = 30000,
  fetchImpl = fetch,
  sleepImpl = sleep
} = {}) {
  let lastReason = 'not attempted';
  let lastStatus = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      await sleepImpl(backoff);
    }
    try {
      const response = await fetchImpl(url);
      if (response.ok) {
        try {
          return { ok: true, data: await response.json() };
        } catch (e) {
          // A truncated body is a transient fault too.
          lastStatus = response.status;
          lastReason = `invalid JSON (${redactKey(e.message)})`;
          continue;
        }
      }
      lastStatus = response.status;
      lastReason = `HTTP ${response.status}`;
      if (!isRetryableStatus(response.status)) break;
      const retryAfter = Number(response.headers?.get?.('retry-after'));
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        await sleepImpl(Math.min(maxDelayMs, retryAfter * 1000));
      }
    } catch (e) {
      lastStatus = null;
      lastReason = redactKey(e.message);
    }
  }
  // Redacted here, at the source: a reason travels into logs, the email summary,
  // bill-status-history.json and the statehood store (Codex attack review, 2026-11-10:
  // a URL-bearing fetch error put a dummy key into committed history).
  return { ok: false, status: lastStatus, reason: redactKey(lastReason) };
}

// The API key travels in the query string; it must never reach a log line or a stored file.
// Also strips URL credentials (user:pass@), which Node echoes back in its error text.
export function redactKey(text) {
  return String(text)
    .replace(/api_key=[^&\s"')]*/gi, 'api_key=REDACTED')
    .replace(/\/\/[^/\s@"']*@/g, '//REDACTED@');
}

const API_ORIGIN = 'https://api.congress.gov';

/**
 * Congress.gov's `pagination.next` omits the key. Add it back, but only to a URL that is
 * the same API endpoint we asked for: HTTPS on api.congress.gov, no embedded credentials,
 * no port, and the expected path. Anything else is refused (returns null) rather than
 * followed with the key attached.
 */
export function withKey(url, apiKey, expectedPath) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.origin !== API_ORIGIN || u.username || u.password || u.port) return null;
  if (expectedPath && u.pathname !== expectedPath) return null;
  u.searchParams.set('api_key', apiKey);
  if (!u.searchParams.has('format')) u.searchParams.set('format', 'json');
  return u.toString();
}

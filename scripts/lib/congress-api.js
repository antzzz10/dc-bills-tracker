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
          lastReason = `invalid JSON (${e.message})`;
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
      lastReason = e.message;
    }
  }
  return { ok: false, status: lastStatus, reason: lastReason };
}

// The API key travels in the query string; it must never reach a log line or a stored file.
export function redactKey(url) {
  return String(url).replace(/api_key=[^&]*/g, 'api_key=REDACTED');
}

// Congress.gov's `pagination.next` omits the key. Add it back (once) before following.
export function withKey(url, apiKey) {
  const u = new URL(url);
  u.searchParams.set('api_key', apiKey);
  if (!u.searchParams.has('format')) u.searchParams.set('format', 'json');
  return u.toString();
}

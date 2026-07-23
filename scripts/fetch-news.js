#!/usr/bin/env node

/**
 * Fetches DC-related news from RSS feeds, then uses Claude to filter
 * for articles specifically about DC statehood, home rule, or congressional
 * actions affecting DC governance.
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 * Run manually or via GitHub Actions.
 */

import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '../public/api/news.json');
const MAX_ARTICLES = 5;
const DEFAULT_MAX_AGE_DAYS = 30;

const FEEDS = [
  // News outlets — recent coverage only
  { url: 'https://51st.news/rss/', source: 'The 51st' },
  { url: 'https://washingtoninformer.com/feed/', source: 'Washington Informer' },
  // NOTUS is a general national-politics feed, not DC-specific — confirmed
  // valid RSS 2.0 at this URL (2026-07-12). Relies on the relevance filter
  // below to do more of the work than the DC-focused feeds above.
  { url: 'https://www.notus.org/index.rss', source: 'NOTUS' },
  // Advocacy org blogs — publish infrequently, so allow a wider window
  { url: 'https://acludc.org/feed/', source: 'ACLU DC', maxAgeDays: 60 },
  { url: 'https://www.dcvote.org/feed/', source: 'DC Vote', maxAgeDays: 60 },
  // Added 2026-07-12, URL NOT yet confirmed — direct fetch got 403'd by a
  // WAF/bot-blocker even with this script's own User-Agent, which could be
  // an IP-based block that behaves differently from GitHub Actions' infra.
  // fetchFeed() fails closed on a bad URL (logs a warning, returns [],
  // doesn't break the run) — check the next Action run's log for
  // "Failed: https://lwvdc.org/feed/" before trusting this is live.
  { url: 'https://lwvdc.org/feed/', source: 'League of Women Voters DC', maxAgeDays: 60 },
  // Rep. Eleanor Holmes Norton (norton.house.gov) — NOT added. Every RSS
  // path guessed either 403'd or 404'd, and the one guess that returned a
  // real feed (/rss.xml) turned out to be a stale artifact from an old site
  // redesign — items dated 2021–2022 ("117th Congress convenes"), not live
  // press releases. Needs a manually-confirmed current feed URL (or a
  // non-RSS ingestion method) before this source can be added correctly.
  // Senator Ankit Jain's site (senatorjaindc.com/news/) has no RSS/Atom
  // feed at all — a manually-maintained listing page, not a blog feed.
  // Skipped rather than force a non-RSS source into this pipeline; revisit
  // with custom scraping only if this source becomes important enough.
];

function extractCDATA(text) {
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function getTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? extractCDATA(match[1]).trim() : '';
}

function parseItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const raw = match[1];
    const title = getTag(raw, 'title');
    const linkMatch = raw.match(/<link>(https?:\/\/[^<\s]+)<\/link>/i);
    const link = linkMatch ? linkMatch[1] : getTag(raw, 'guid');
    const pubDate = getTag(raw, 'pubDate');
    const sourceMatch = raw.match(/<source[^>]*>([^<]+)<\/source>/i);
    const source = sourceMatch ? extractCDATA(sourceMatch[1]).trim() : '';
    if (title && link) items.push({ title, link, pubDate, source });
  }
  return items;
}

async function fetchFeed({ url, source }) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DC Bills Tracker News Aggregator (billtracker.representdc.org)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = parseItems(await res.text());
    return items.map(a => ({ ...a, source: a.source || source }));
  } catch (err) {
    console.warn(`  Failed: ${url} — ${err.message}`);
    return [];
  }
}

async function filterByRelevance(articles) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const client = new Anthropic({ apiKey, maxRetries: 5 });

  const titlesBlock = articles.map((a, i) => `${i}: ${a.title}`).join('\n');

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `You are a relevance filter for a DC statehood and home rule advocacy website called billtracker.representdc.org.

Below are article titles from DC-area news sources. Return ONLY the index numbers of articles that are specifically about one or more of:
- DC statehood
- DC home rule or congressional oversight of DC
- Congressional legislation, votes, or budget actions that directly affect DC governance or local laws
- Federal actions that override or threaten DC's self-governance

Do NOT include articles about:
- General DC local news (crime, weather, sports, events, local politics not related to autonomy)
- DC neighborhood or community stories
- Federal policy that affects DC only as a city/region (not as a self-governance issue)
- Human interest stories unrelated to DC autonomy or statehood

Return a JSON array of index numbers only, e.g. [0, 3, 7]. Return [] if none qualify.

Article titles:
${titlesBlock}`,
    }],
  });

  const text = message.content[0].text.trim();
  const match = text.match(/\[[\d,\s]*\]/);
  if (!match) {
    console.warn('  Claude returned unexpected format:', text);
    return [];
  }
  const indices = JSON.parse(match[0]);
  return indices.map(i => articles[i]).filter(Boolean);
}

async function main() {
  console.log('Fetching DC news feeds...\n');

  const seen = new Set();
  const all = [];

  for (const feed of FEEDS) {
    const maxAgeDays = feed.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const items = await fetchFeed(feed);
    const fresh = items.filter(a => {
      const ts = new Date(a.pubDate).getTime() || 0;
      return ts > cutoff;
    });
    console.log(`  ${fresh.length}/${items.length} articles from ${feed.source} (within ${maxAgeDays} days)`);
    for (const item of fresh) {
      const ts = new Date(item.pubDate).getTime();
      if (!seen.has(item.link)) {
        seen.add(item.link);
        all.push({ ...item, _ts: ts });
      }
    }
  }

  console.log(`\n${all.length} total articles fetched — scoring relevance with Claude...\n`);
  all.forEach(a => console.log(`  • [${a.source}] ${a.title}`));
  console.log();

  const relevant = await filterByRelevance(all);

  console.log(`${relevant.length} passed relevance filter:\n`);
  relevant.forEach(a => console.log(`  ✓ [${a.source}] ${a.title}`));

  const articles = relevant
    .sort((a, b) => b._ts - a._ts)
    .slice(0, MAX_ARTICLES)
    .map(({ _ts, ...a }) => a);

  const dir = join(__dirname, '../public/api');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  writeFileSync(OUTPUT_PATH, JSON.stringify({ lastUpdated: new Date().toISOString(), articles }, null, 2));
  console.log(`\nSaved ${articles.length} articles → public/api/news.json`);
}

main().catch(err => {
  if (err?.error?.type === 'overloaded_error' || err?.type === 'overloaded_error') {
    console.warn('Claude API overloaded — keeping existing news.json unchanged.');
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});

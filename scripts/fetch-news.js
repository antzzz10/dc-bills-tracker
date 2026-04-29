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
  // Advocacy org blogs — publish infrequently, so allow a wider window
  { url: 'https://acludc.org/feed/', source: 'ACLU DC', maxAgeDays: 60 },
  { url: 'https://www.dcvote.org/feed/', source: 'DC Vote', maxAgeDays: 60 },
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

  const client = new Anthropic({ apiKey });

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

main().catch(err => { console.error(err); process.exit(1); });

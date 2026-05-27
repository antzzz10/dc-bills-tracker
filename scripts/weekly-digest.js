#!/usr/bin/env node

/**
 * Generates and sends a weekly DC Bills Tracker digest via Kit (ConvertKit).
 *
 * Usage:
 *   node scripts/weekly-digest.js          # Schedule broadcast for next Tuesday
 *   node scripts/weekly-digest.js --draft  # Create as unscheduled draft (review in Kit before sending)
 *   node scripts/weekly-digest.js --test   # Send to test address only (andria.thomas@gmail.com)
 *
 * Required env vars: ANTHROPIC_API_KEY, KIT_API_KEY
 */

import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const KIT_API_BASE = 'https://api.kit.com/v4';
const FROM_EMAIL = 'statehood@dcdemocraticparty.org';
const FROM_NAME = 'RepresentDC Bill Tracker';
const TEST_EMAIL = 'andria.thomas@gmail.com';
const DAYS_BACK = 7;

const isDraft = process.argv.includes('--draft');
const isTest = process.argv.includes('--test');

// ── Data loading ──────────────────────────────────────────────────────────────

function loadBillsData() {
  return JSON.parse(readFileSync(join(ROOT, 'src/data/bills.json'), 'utf8'));
}

function loadNewsData() {
  const path = join(ROOT, 'public/api/news.json');
  if (!existsSync(path)) return { articles: [] };
  return JSON.parse(readFileSync(path, 'utf8'));
}

// ── Git diff ──────────────────────────────────────────────────────────────────

function getWeeklyChanges() {
  try {
    const diff = execSync(
      `git diff HEAD~${DAYS_BACK} -- src/data/bills.json`,
      { cwd: ROOT, encoding: 'utf8' }
    );
    if (!diff.trim()) return { newBills: [], statusChanges: [], newlyPassed: [] };

    // Get old and new JSON blobs from git
    let oldData, newData;
    try {
      const oldJson = execSync(`git show HEAD~${DAYS_BACK}:src/data/bills.json`, { cwd: ROOT, encoding: 'utf8' });
      oldData = JSON.parse(oldJson);
    } catch {
      return { newBills: [], statusChanges: [], newlyPassed: [] };
    }
    newData = loadBillsData();

    const oldBills = [...(oldData.bills || []), ...(oldData.riders || [])];
    const newBills = [...(newData.bills || []), ...(newData.riders || [])];
    const oldById = Object.fromEntries(oldBills.map(b => [b.id, b]));
    const newById = Object.fromEntries(newBills.map(b => [b.id, b]));

    const added = newBills.filter(b => !oldById[b.id]);
    const changed = newBills.filter(b => {
      const old = oldById[b.id];
      if (!old) return false;
      return old.status?.stage !== b.status?.stage ||
             old.status?.lastAction !== b.status?.lastAction ||
             old.priority !== b.priority;
    });
    const newlyPassed = changed.filter(b => {
      const old = oldById[b.id];
      return b.status?.stage && b.status.stage !== old?.status?.stage &&
             (b.status.stage.startsWith('passed') || b.status.stage === 'enacted');
    });

    return { newBills: added, statusChanges: changed, newlyPassed };
  } catch (err) {
    console.warn('Could not compute git diff:', err.message);
    return { newBills: [], statusChanges: [], newlyPassed: [] };
  }
}

// ── Stats summary ─────────────────────────────────────────────────────────────

function getStats(data) {
  const all = [...(data.bills || []), ...(data.riders || [])];
  const pending = all.filter(b => !b.status?.stage || b.status.stage === 'introduced');
  const passed = all.filter(b => b.status?.stage?.startsWith('passed'));
  const enacted = all.filter(b => b.status?.stage === 'enacted');
  const highPriority = pending.filter(b => b.priority === 'high');
  return { total: all.length, pending: pending.length, passed: passed.length, enacted: enacted.length, highPriority: highPriority.length };
}

// ── Pick featured bill ────────────────────────────────────────────────────────

function pickFeaturedBill(data, changes) {
  const all = [...(data.bills || []), ...(data.riders || [])];
  // Prefer newly passed, then newly added, then high priority with recent action
  if (changes.newlyPassed.length > 0) return changes.newlyPassed[0];
  if (changes.newBills.length > 0) return changes.newBills[0];
  const highPriority = all.filter(b => b.priority === 'high' && b.status?.lastActionDate);
  return highPriority.sort((a, b) =>
    (b.status.lastActionDate || '').localeCompare(a.status.lastActionDate || '')
  )[0] || all[0];
}

// ── Claude content generation ─────────────────────────────────────────────────

async function generateDigest({ stats, changes, featuredBill, news, weekOf }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const changesText = [
    changes.newlyPassed.length > 0
      ? `NEWLY PASSED/ENACTED:\n${changes.newlyPassed.map(b => `- ${b.billNumbers[0]}: ${b.title} (${b.status.stage})`).join('\n')}`
      : '',
    changes.newBills.length > 0
      ? `NEW BILLS ADDED:\n${changes.newBills.map(b => `- ${b.billNumbers[0]}: ${b.title}`).join('\n')}`
      : '',
    changes.statusChanges.length > 0
      ? `STATUS UPDATES:\n${changes.statusChanges.slice(0, 5).map(b => `- ${b.billNumbers[0]}: ${b.status.lastAction || b.status.stage}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n\n') || 'No significant changes this week.';

  const newsText = news.articles.length > 0
    ? news.articles.map(a => `- ${a.title} (${a.source}): ${a.link}`).join('\n')
    : 'No news this week.';

  const featuredText = featuredBill ? `
Bill: ${featuredBill.billNumbers.join(' / ')}
Title: ${featuredBill.fullTitle || featuredBill.title}
Sponsor(s): ${featuredBill.sponsors.join(', ')}
Status: ${featuredBill.status?.lastAction || featuredBill.status?.stage || 'Introduced'}
Description: ${featuredBill.description}
`.trim() : '';

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are writing the weekly email digest for RepresentDC's DC Bills Tracker (billtracker.representdc.org), an advocacy tool tracking anti-DC legislation in Congress.

Write a complete email in inline-styled HTML. Tone: clear, urgent, advocacy-focused but factual. Audience: DC residents and statehood supporters who subscribed to stay informed.

Use this structure:
1. Brief intro (2-3 sentences on why this week matters)
2. By the numbers (use the stats below — bold the key figures)
3. This week's changes (summarize the changes — lead with anything newly passed)
4. Bill spotlight (profile the featured bill and its sponsor — explain the stakes for DC residents in plain language)
5. In the news (list the news articles as linked headlines with source name)
6. Call to action (link to billtracker.representdc.org — one sentence)

HTML requirements:
- Full inline styles on all elements (this goes into Kit, not a browser)
- h1 font-size: 28px; h2 font-size: 20px
- Body font: Arial, sans-serif; color: #333; max-width: 600px
- Bold key stats and bill numbers
- Use <hr> between major sections
- News links as <a href="..."> tags
- Small gray italic paragraph for the tracker URL footer
- No markdown — pure HTML only

DATA:

Week of: ${weekOf}

STATS:
- Total bills/riders tracked: ${stats.total}
- Pending: ${stats.pending}
- Passed a chamber: ${stats.passed}
- Enacted into law: ${stats.enacted}
- High priority pending: ${stats.highPriority}

CHANGES THIS WEEK:
${changesText}

FEATURED BILL:
${featuredText}

IN THE NEWS:
${newsText}

Return only the HTML — no commentary before or after.`,
    }],
  });

  return message.content[0].text.trim();
}

// ── Kit API ───────────────────────────────────────────────────────────────────

async function kitRequest(path, method, body) {
  const apiKey = process.env.KIT_API_KEY;
  if (!apiKey) throw new Error('KIT_API_KEY not set');

  const res = await fetch(`${KIT_API_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Kit API ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

function nextTuesday() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 2=Tue
  const daysUntilTuesday = (2 - day + 7) % 7 || 7;
  const tuesday = new Date(now);
  tuesday.setUTCDate(now.getUTCDate() + daysUntilTuesday);
  tuesday.setUTCHours(14, 0, 0, 0); // 14:00 UTC = 9am ET (10am ET during EDT)
  return tuesday.toISOString();
}

async function createBroadcast(subject, htmlContent) {
  const payload = {
    subject,
    content: htmlContent,
    description: `Weekly digest auto-generated ${new Date().toISOString().slice(0, 10)}`,
    public: false,
    email_address: FROM_EMAIL,
    email_layout_template: 'none',
  };

  if (isTest) {
    // Send preview to test address
    console.log(`Sending test broadcast to ${TEST_EMAIL}...`);
    payload.subscriber_filter = [{ all: [{ type: 'email_address', value: TEST_EMAIL }] }];
    payload.send_at = new Date(Date.now() + 60000).toISOString(); // 1 min from now
  } else if (!isDraft) {
    payload.send_at = nextTuesday();
    console.log(`Scheduling broadcast for ${payload.send_at}`);
  } else {
    console.log('Creating draft (no send_at — review in Kit before sending)');
  }

  const result = await kitRequest('/broadcasts', 'POST', payload);
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('DC Bills Tracker — Weekly Digest Generator\n');

  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  if (!process.env.KIT_API_KEY) throw new Error('KIT_API_KEY not set');

  const data = loadBillsData();
  const news = loadNewsData();
  const stats = getStats(data);
  const changes = getWeeklyChanges();
  const featuredBill = pickFeaturedBill(data, changes);
  const weekOf = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  console.log(`Stats: ${stats.total} total | ${stats.pending} pending | ${stats.passed} passed | ${stats.enacted} enacted`);
  console.log(`Changes: ${changes.newBills.length} new | ${changes.statusChanges.length} updated | ${changes.newlyPassed.length} newly passed`);
  console.log(`Featured: ${featuredBill?.billNumbers[0]} — ${featuredBill?.title?.slice(0, 60)}...`);
  console.log(`News: ${news.articles.length} articles\n`);

  console.log('Generating digest with Claude...');
  const html = await generateDigest({ stats, changes, featuredBill, news, weekOf });
  console.log(`Generated ${html.length} chars of HTML\n`);

  const subject = changes.newlyPassed.length > 0
    ? `🚨 ${changes.newlyPassed[0].billNumbers[0]} advanced — DC Bills Update ${weekOf}`
    : `DC Bills Tracker: Weekly Update — ${weekOf}`;

  console.log(`Subject: ${subject}`);
  const result = await createBroadcast(subject, html);

  const broadcastId = result?.broadcast?.id || result?.id;
  console.log(`\nBroadcast created. ID: ${broadcastId}`);
  if (isDraft) console.log('→ Review and send at: https://app.kit.com/broadcasts');
}

main().catch(err => { console.error(err.message); process.exit(1); });

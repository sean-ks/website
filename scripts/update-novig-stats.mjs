#!/usr/bin/env node
// Snapshots the public Novig stats from https://www.lbtrading.com/stats/novig
// into assets/novig-stats.js (lbtrading.com sends no CORS header, so the site
// cannot read it live). Values are computed the same way lbtrading.com's own
// stats.js computes them.
//
// Usage: node scripts/update-novig-stats.mjs        (Node 18+, no dependencies)
// Exit 0: file written, or already up to date.
// Exit 1: fetch or validation failed; the existing file is left untouched.

import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SOURCE = 'https://www.lbtrading.com/stats/novig';
const JSON_URL = 'https://www.lbtrading.com/stats/novig_stats.json';
const CSV_URL = 'https://www.lbtrading.com/stats/novig_stats.csv';
const OUT = fileURLToPath(new URL('../assets/novig-stats.js', import.meta.url));
const OUT_NAME = 'assets/novig-stats.js';
const TIMEOUT_MS = 20000;
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

// Same as asNumber() in lbtrading.com/stats/stats.js.
function asNumber(raw) {
  if (raw === null || raw === undefined) return NaN;
  const s = String(raw).trim();
  if (!s || s === '-' || s === '—') return NaN;
  return Number(s);
}

async function get(url, accept) {
  let res, body;
  try {
    res = await fetch(`${url}?bust=${Date.now()}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: accept, 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    body = await res.text();
  } catch (err) {
    throw new Error(`${url}: ${err.cause?.message || err.message}`);
  }
  // Cloudflare can answer datacenter IPs with an HTML challenge page.
  const html = /html/i.test(res.headers.get('content-type') || '') || /^\s*</.test(body);
  if (!res.ok) {
    // only statuses Cloudflare uses for blocks and challenges get the hint; a plain 404 means the file moved
    const challenged = html && ([403, 429, 503].includes(res.status) || res.headers.has('cf-mitigated'));
    throw new Error(`${url}: HTTP ${res.status}${challenged ? ' with an HTML page (blocked or challenged?)' : ''}`);
  }
  if (html) throw new Error(`${url}: got an HTML page instead of data (blocked or challenged?)`);
  return { body, headers: res.headers };
}

function parseSummary({ body, headers }) {
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error(`${JSON_URL}: response is not valid JSON`);
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error(`${JSON_URL}: expected a JSON object`);
  }
  const num = (key) => {
    const n = asNumber(json[key]);
    if (!Number.isFinite(n)) throw new Error(`${JSON_URL}: "${key}" is missing or not a number`);
    return n;
  };
  const profit = num('profit');
  const trades = num('trades');
  const volume_usd = num('volume_usd');
  const sharpe = num('sharpe_ratio');
  if (!Number.isInteger(trades) || trades < 0) throw new Error(`${JSON_URL}: "trades" is not a count`);
  if (volume_usd < 0) throw new Error(`${JSON_URL}: "volume_usd" is negative`);

  const lastModified = headers.get('last-modified');
  const updated = new Date(lastModified ?? NaN);
  if (Number.isNaN(updated.getTime())) {
    throw new Error(`${JSON_URL}: missing or invalid Last-Modified header`);
  }
  return { profit, trades, volume_usd, sharpe, updated: updated.toISOString() };
}

// Mirrors loadHistory() in lbtrading.com/stats/stats.js.
function parseHistory({ body }) {
  const lines = body.trim().split(/\r?\n/);
  const header = lines.shift().split(',').map((s) => s.trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  if (!Object.hasOwn(idx, 'date') || !Object.hasOwn(idx, 'net_asset_value')) {
    throw new Error(`${CSV_URL}: header lacks a "date" or "net_asset_value" column`);
  }
  const rows = lines.filter((l) => l && l.trim()).map((l) => l.split(','));
  if (rows.length === 0) throw new Error(`${CSV_URL}: no data rows`);

  const days = rows.length;
  rows.sort((a, b) => (a[idx.date] ?? '').localeCompare(b[idx.date] ?? ''));

  let first = NaN;
  for (let i = 0; i < rows.length; i++) {
    const nav = asNumber(rows[i][idx.net_asset_value]);
    if (Number.isFinite(nav) && nav !== 0) {
      first = nav;
      break;
    }
  }
  let latest = NaN;
  for (let i = rows.length - 1; i >= 0; i--) {
    const nav = asNumber(rows[i][idx.net_asset_value]);
    if (Number.isFinite(nav)) {
      latest = nav;
      break;
    }
  }
  const return_pct = (latest / first - 1) * 100;
  if (!Number.isFinite(return_pct)) throw new Error(`${CSV_URL}: no usable net_asset_value rows`);
  return { days, return_pct };
}

async function main() {
  const [summaryRes, historyRes] = await Promise.all([
    get(JSON_URL, 'application/json'),
    get(CSV_URL, 'text/csv,text/plain;q=0.9,*/*;q=0.8'),
  ]);
  const s = parseSummary(summaryRes);
  const h = parseHistory(historyRes);

  const stats = {
    profit: Number(s.profit),
    trades: Number(s.trades),
    volume_usd: Number(s.volume_usd),
    return_pct: Number(h.return_pct),
    sharpe: Number(s.sharpe),
    days: Number(h.days),
    updated: s.updated,
    source: SOURCE,
  };
  const content =
    `/* Generated by scripts/update-novig-stats.mjs from ${SOURCE}. Do not edit by hand. */\n` +
    `window.NOVIG_STATS = ${JSON.stringify(stats)};\n`;

  const previous = await readFile(OUT, 'utf8').catch((err) => {
    if (err.code === 'ENOENT') return null;
    throw err;
  });
  const summary =
    `profit ${stats.profit.toFixed(2)}, trades ${stats.trades}, volume ${stats.volume_usd.toFixed(2)}, ` +
    `return ${stats.return_pct.toFixed(2)}%, sharpe ${stats.sharpe}, days ${stats.days}, updated ${stats.updated}`;
  if (previous === content) {
    console.log(`novig-stats: ${OUT_NAME} unchanged (${summary})`);
    return;
  }
  const tmp = `${OUT}.tmp`;
  await writeFile(tmp, content);
  await rename(tmp, OUT);
  console.log(`novig-stats: wrote ${OUT_NAME} (${summary})`);
}

main().catch((err) => {
  console.error(`novig-stats: ${err.message}`);
  process.exitCode = 1;
});

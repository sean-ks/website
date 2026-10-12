// The Novig stats snapshot from window.NOVIG_STATS, checked before use, and its text for novig-stats.txt.
export function stats() {
  const s = window.NOVIG_STATS;
  if (!s || typeof s !== 'object') return null;
  for (const k of ['profit', 'trades', 'volume_usd', 'return_pct', 'sharpe', 'days']) if (typeof s[k] !== 'number' || !isFinite(s[k])) return null;
  return typeof s.updated === 'string' && !isNaN(Date.parse(s.updated)) ? s : null;
}
export function novigText() {
  const s = stats();
  if (!s) return null;
  const f = (n, o) => n.toLocaleString('en-US', o);
  const usd = n => f(n, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const src = typeof s.source === 'string' && /^https:\/\/\S+$/.test(s.source) ? s.source : 'https://www.lbtrading.com/stats/novig';
  return ['Novig market making · LbtradingLLC',
    'source   ' + src,
    'updated  ' + new Date(s.updated).toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
    '',
    'profit   ' + usd(s.profit),
    'trades   ' + f(s.trades),
    'volume   ' + usd(s.volume_usd),
    'return   ' + f(s.return_pct, { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' }) + '%',
    'sharpe   ' + f(s.sharpe, { maximumFractionDigits: 2 }),
    'days     ' + f(s.days), ''].join('\n');
}

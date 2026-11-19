// Shared helpers for the NYC Open Data (Socrata) API routes.
// Files starting with "_" in /api are not deployed as functions on Vercel.

export const LAUNCH = "2026-11-19";        // GTA VI release, 12:00 AM ET
export const WINDOW_BEFORE_DAYS = 30;       // chart starts 30 days before launch
const BASE = "https://data.cityofnewyork.us";
const TZ = "America/New_York";

// --- date helpers (all dates are NYC-local calendar days, "YYYY-MM-DD") ---
export function nyToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date());
}
export function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function dayDiff(a, b) {
  return Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 864e5);
}
export function dateRange(start, end) {
  const out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

// --- Socrata fetch (fixed queries only; no user input reaches SoQL) ---
export async function soql(dataset, params, timeoutMs = 240000) {
  const url = `${BASE}/resource/${dataset}.json?` + new URLSearchParams(params);
  const headers = { Accept: "application/json" };
  if (process.env.SOCRATA_APP_TOKEN) headers["X-App-Token"] = process.env.SOCRATA_APP_TOKEN;
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`Socrata ${dataset} HTTP ${r.status}`);
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error(`Socrata ${dataset} returned non-array`);
  return j;
}
export async function sourceUpdatedAt(dataset) {
  try {
    const r = await fetch(`${BASE}/api/views/${dataset}.json`, { signal: AbortSignal.timeout(15000) });
    const m = await r.json();
    return m.rowsUpdatedAt ? new Date(m.rowsUpdatedAt * 1000).toISOString() : null;
  } catch { return null; }
}

// --- completeness ("still being reported") ---
// Records arrive late. A day is flagged provisional when it is younger than
// maxAgeDays AND its count is < 75% of the median of the same weekday over the
// previous 4 weeks. The first such day and every day after it are provisional.
// Today (a partial day) is always provisional. Days older than maxAgeDays are
// never flagged, so a real, lasting change cannot be hidden as "incomplete".
export function flagProvisional(days, today, maxAgeDays, threshold = 0.75) {
  let front = days.findIndex(d => d.date >= today);
  if (front === -1) front = days.length;
  for (let i = 0; i < days.length; i++) {
    if (dayDiff(days[i].date, today) > maxAgeDays) continue;
    const prior = [1, 2, 3, 4].map(k => days[i - 7 * k]).filter(Boolean).map(d => d.n);
    if (prior.length < 2) continue;
    const s = prior.slice().sort((a, b) => a - b);
    const med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    if (days[i].n < threshold * med) { front = Math.min(front, i); break; }
  }
  return days.map((d, i) => ({ ...d, provisional: i >= front }));
}

// --- sanity checks so bad upstream data is rejected, never cached ---
export function validate(days, launch) {
  const pre = days.filter(d => d.date < launch && !d.provisional);
  if (pre.length < 14) throw new Error("Too few complete pre-launch days; refusing to serve.");
  for (const d of days) {
    if (!Number.isFinite(d.n) || d.n < 0) throw new Error(`Bad count on ${d.date}`);
  }
}

export function send(res, status, body, sMaxAge) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (status === 200) {
    // CDN caches; browsers revalidate. Stale copy is served while refreshing.
    res.setHeader("Cache-Control", `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=86400`);
  } else {
    res.setHeader("Cache-Control", "no-store"); // never cache an error
  }
  res.status(status).send(JSON.stringify(body));
}

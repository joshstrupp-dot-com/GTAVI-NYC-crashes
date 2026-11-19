// GET /api/crashes — daily count of all police-reported motor vehicle crashes.
// Source: NYC Open Data "Motor Vehicle Collisions - Crashes" (h9gi-nx95), updated daily.
import { LAUNCH, WINDOW_BEFORE_DAYS, nyToday, addDays, dateRange, soql, sourceUpdatedAt,
         flagProvisional, validate, send } from "./_lib.js";

const DATASET = "h9gi-nx95";
const MAX_AGE = 10; // days; crashes are typically posted within a few days

export default async function handler(req, res) {
  try {
    const today = nyToday();
    const windowStart = addDays(LAUNCH, -WINDOW_BEFORE_DAYS);
    // extra history: 6 days for the 7-day average, 4 weeks for completeness check
    const fetchStart = [addDays(windowStart, -6), addDays(today, -MAX_AGE - 28)].sort()[0];

    const [rows, updated] = await Promise.all([
      soql(DATASET, {
        $select: "date_trunc_ymd(crash_date) AS d, count(*) AS n",
        $where: `crash_date >= '${fetchStart}T00:00:00' AND crash_date <= '${today}T23:59:59'`,
        $group: "d", $order: "d", $limit: "5000",
      }, 60000),
      sourceUpdatedAt(DATASET),
    ]);
    const counts = new Map(rows.map(r => [r.d.slice(0, 10), Number(r.n)]));
    const all = dateRange(fetchStart, today).map(date => ({ date, n: counts.get(date) ?? 0 }));
    const days = flagProvisional(all, today, MAX_AGE).filter(d => d.date >= addDays(windowStart, -6));
    validate(days, LAUNCH);

    send(res, 200, { series: "crashes", dataset: DATASET, launch: LAUNCH, windowStart, today,
                     fetchedAt: new Date().toISOString(), sourceUpdatedAt: updated, days }, 3600);
  } catch (e) {
    send(res, 502, { error: "Upstream data unavailable or failed checks.", detail: String(e.message || e) });
  }
}

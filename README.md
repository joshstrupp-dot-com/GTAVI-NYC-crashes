# GTAVI-NYC-crashes

Daily NYC motor vehicle crashes before and after the release of Grand Theft Auto VI (Nov 19, 2026, 12:00 AM ET), as a single line chart.

- **Data:** NYC Open Data, [Motor Vehicle Collisions – Crashes](https://data.cityofnewyork.us/d/h9gi-nx95) (`h9gi-nx95`), which updates daily.
- **Freshness:** `/api/crashes` queries the source and is cached at Vercel's CDN for 1 hour (`s-maxage=3600, stale-while-revalidate`). Errors are never cached.
- **Not-final days:** records are posted a few days late, so recent days whose counts look incomplete are hatched. The rule is in `api/_lib.js` and on the page under "Methodology".

## Run locally

```bash
node dev.mjs   # http://localhost:3000
```

## Deploy

Import the repo in Vercel; no build step is needed. Optional environment variable: `SOCRATA_APP_TOKEN` (a free NYC Open Data app token) for higher rate limits.

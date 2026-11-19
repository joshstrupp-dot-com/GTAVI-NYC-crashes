// Local preview server (not used on Vercel). Serves index.html and the /api
// handlers with a minimal Vercel-style res shim, plus an in-memory cache so
// the slow camera query only runs once per hour locally.
import http from "node:http";
import { readFile } from "node:fs/promises";

const PORT = Number(process.env.PORT || 3000);
const cache = new Map();

function shim(res, done) {
  let status = 200; const headers = {};
  return {
    setHeader: (k, v) => { headers[k] = v; },
    status(s) { status = s; return this; },
    json(o) { this.setHeader("Content-Type", "application/json"); this.send(JSON.stringify(o)); },
    send(body) { done(status, headers, body); },
  };
}

http.createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (path.startsWith("/api/")) {
    const name = path.slice(5).replace(/[^a-z]/g, "");
    const hit = cache.get(name);
    if (hit && Date.now() - hit.t < 3600e3) { res.writeHead(hit.status, hit.headers); return res.end(hit.body); }
    try {
      const mod = await import(`./api/${name}.js`);
      await mod.default(req, shim(res, (s, h, b) => {
        if (s === 200) cache.set(name, { t: Date.now(), status: s, headers: h, body: b });
        res.writeHead(s, h); res.end(b);
      }));
    } catch { res.writeHead(404); res.end("not found"); }
    return;
  }
  try {
    const html = await readFile(new URL("./index.html", import.meta.url));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(html);
  } catch { res.writeHead(500); res.end("index.html missing"); }
}).listen(PORT, () => console.log(`dev server on http://localhost:${PORT}`));

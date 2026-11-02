// IIM Stage Finder backend: static hosting + a small anonymous-response API on SQLite.
// Zero dependencies (Node 22.5+ for node:sqlite).   Start:  node server.js
//
//   POST /api/responses        store or update one student's answers (one row per IIM + device)
//   GET  /api/aggregate/:iim   combined view; details only appear once 5+ students have answered
//   GET  /api/stats            number of responses per IIM
//   GET  /api/health
//   GET  /api/export.csv?key=  full export, only when ADMIN_KEY is set
//
// Env: PORT, DB_PATH, ADMIN_KEY, ALLOW_ORIGIN (CORS for a separately hosted front end), TRUST_PROXY=1
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { METRICS, CAUSES, CAUSE_BY_ID, STAGE_QUESTIONS, STAGE_ORDER, PROGRAMMES, YEARS_OF_STUDY } from "./public/js/questions.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(ROOT, "public");
const PORT = +process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(ROOT, "data", "responses.db");
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "";
const MIN_N = 5;

const IIMS = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(PUB, "data", "iims.json"), "utf8")).iims));
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS responses_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  iim TEXT NOT NULL, anon_id TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  stage TEXT NOT NULL, ratings TEXT NOT NULL, causes TEXT NOT NULL, details TEXT NOT NULL,
  programme TEXT, year TEXT, comment TEXT,
  UNIQUE (iim, anon_id));
CREATE INDEX IF NOT EXISTS idx_iim_v2 ON responses_v2 (iim);`);
const upsert = db.prepare(`INSERT INTO responses_v2 (iim, anon_id, created_at, updated_at, stage, ratings, causes, details, programme, year, comment)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (iim, anon_id) DO UPDATE SET updated_at = excluded.updated_at, stage = excluded.stage, ratings = excluded.ratings,
    causes = excluded.causes, details = excluded.details, programme = excluded.programme, year = excluded.year, comment = excluded.comment`);
const byIim = db.prepare("SELECT * FROM responses_v2 WHERE iim = ?");
const counts = db.prepare("SELECT iim, COUNT(*) AS n FROM responses_v2 GROUP BY iim");
const all = db.prepare("SELECT * FROM responses_v2 ORDER BY id");

/* ---------- validation ---------- */
class Bad extends Error {}
const METRIC_IDS = METRICS.map((m) => m.id);
function clean(body) {
  if (!body || typeof body !== "object") throw new Bad("body");
  if (body.hp) throw new Bad("rejected");                       // honeypot
  if (!IIMS.has(body.iim)) throw new Bad("unknown iim");
  if (typeof body.anonId !== "string" || !/^[\w-]{8,64}$/.test(body.anonId)) throw new Bad("anonId");
  const stage = {}, ratings = {}, causes = {}, details = {};
  for (const q of STAGE_QUESTIONS) {
    const v = body.stage?.[q.id];
    if (v !== undefined && v !== null && !STAGE_ORDER.includes(v)) throw new Bad("stage " + q.id);
    if (v !== undefined) stage[q.id] = v;
  }
  for (const m of METRIC_IDS) {
    const r = body.ratings?.[m];
    if (r !== undefined && r !== null && !(Number.isInteger(r) && r >= 1 && r <= 5)) throw new Bad("rating " + m);
    if (r !== undefined) ratings[m] = r;
    const c = body.causes?.[m];
    if (c !== undefined) {
      if (!Array.isArray(c) || c.length > 2) throw new Bad("causes " + m);
      const ok = new Set(CAUSES[m].map((x) => x.id));
      if (!c.every((x) => ok.has(x))) throw new Bad("cause id");
      causes[m] = [...new Set(c)];
    }
  }
  for (const [cid, val] of Object.entries(body.details || {})) {
    const c = CAUSE_BY_ID[cid];
    if (!c?.detail || !c.detail.options.includes(val)) throw new Bad("detail " + cid);
    if (!(causes[c.metric] || []).includes(cid)) throw new Bad("detail without cause");
    details[cid] = val;
  }
  const programme = PROGRAMMES.includes(body.programme) ? body.programme : "";
  const year = YEARS_OF_STUDY.includes(body.year) ? body.year : "";
  const comment = typeof body.comment === "string" ? body.comment.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 300) : "";
  return { iim: body.iim, anonId: body.anonId, stage, ratings, causes, details, programme, year, comment };
}

/* ---------- aggregates ---------- */
function aggregate(iim) {
  const rows = byIim.all(iim);
  const n = rows.length;
  if (n < MIN_N) return { n, minN: MIN_N };
  const ratingMean = {}, causeCounts = {}, detailCounts = {};
  const stageCounts = Object.fromEntries(STAGE_ORDER.map((k) => [k, 0]));
  for (const x of rows) for (const v of Object.values(JSON.parse(x.stage))) if (v in stageCounts) stageCounts[v]++;
  for (const m of METRIC_IDS) {
    const r = rows.map((x) => JSON.parse(x.ratings)[m]).filter((v) => typeof v === "number");
    ratingMean[m] = r.length >= 3 ? +(r.reduce((a, b) => a + b, 0) / r.length).toFixed(2) : null;
    for (const x of rows) for (const c of JSON.parse(x.causes)[m] || []) ((causeCounts[m] ||= {})[c] = (causeCounts[m][c] || 0) + 1);
  }
  for (const x of rows) for (const [cid, val] of Object.entries(JSON.parse(x.details))) ((detailCounts[cid] ||= {})[val] = (detailCounts[cid][val] || 0) + 1);
  return { n, minN: MIN_N, ratingMean, stageCounts, causeCounts, detailCounts };
}

/* ---------- http helpers ---------- */
const hits = new Map();
function limited(ip, kind, max) {
  const now = Date.now(), k = kind + ip, h = hits.get(k);
  if (!h || now > h.reset) { hits.set(k, { n: 1, reset: now + 60_000 }); return false; }
  return ++h.n > max;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (now > v.reset) hits.delete(k); }, 60_000).unref();

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8" };
const SEC = {
  "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "x-frame-options": "DENY",
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
};
function send(res, code, body, headers = {}) {
  const h = { ...SEC, ...headers };
  if (ALLOW_ORIGIN) { h["access-control-allow-origin"] = ALLOW_ORIGIN; h["vary"] = "Origin"; }
  res.writeHead(code, h);
  res.end(body);
}
const json = (res, code, obj) => send(res, code, JSON.stringify(obj), { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
function readBody(req, max = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > max) { reject(new Bad("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "null")); } catch { reject(new Bad("json")); } });
    req.on("error", reject);
  });
}
const csvCell = (v) => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/* ---------- server ---------- */
const server = http.createServer(async (req, res) => {
  try {
    const ip = (process.env.TRUST_PROXY === "1" && String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()) || req.socket.remoteAddress || "?";
    const u = new URL(req.url, "http://x");
    const p = decodeURIComponent(u.pathname);

    if (p.startsWith("/api/")) {
      if (req.method === "OPTIONS") return send(res, 204, "", { "access-control-allow-methods": "GET, POST", "access-control-allow-headers": "content-type", "access-control-max-age": "86400" });
      if (limited(ip, req.method, req.method === "POST" ? 30 : 180)) return json(res, 429, { error: "slow down" });

      if (p === "/api/health" && req.method === "GET") return json(res, 200, { ok: true });
      if (p === "/api/stats" && req.method === "GET") return json(res, 200, Object.fromEntries(counts.all().map((r) => [r.iim, r.n])));
      if (p.startsWith("/api/aggregate/") && req.method === "GET") {
        const id = p.slice("/api/aggregate/".length);
        return IIMS.has(id) ? json(res, 200, aggregate(id)) : json(res, 404, { error: "unknown iim" });
      }
      if (p === "/api/responses" && req.method === "POST") {
        if (!String(req.headers["content-type"] || "").includes("application/json")) return json(res, 415, { error: "json only" });
        const r = clean(await readBody(req)), now = new Date().toISOString();
        upsert.run(r.iim, r.anonId, now, now, JSON.stringify(r.stage), JSON.stringify(r.ratings), JSON.stringify(r.causes), JSON.stringify(r.details), r.programme, r.year, r.comment);
        return json(res, 200, { ok: true });
      }
      if (p === "/api/export.csv" && req.method === "GET") {
        const k = Buffer.from(String(u.searchParams.get("key") || "")), a = Buffer.from(ADMIN_KEY);
        if (!ADMIN_KEY || k.length !== a.length || !crypto.timingSafeEqual(k, a)) return json(res, 404, { error: "not found" });
        const head = ["id", "iim", "created_at", "updated_at", ...STAGE_QUESTIONS.map((q) => "stage_" + q.id), ...METRIC_IDS.map((m) => "rating_" + m), ...METRIC_IDS.map((m) => "causes_" + m), "details", "programme", "year", "comment"];
        const lines = [head.join(",")];
        for (const x of all.all()) {
          const st = JSON.parse(x.stage), r = JSON.parse(x.ratings), c = JSON.parse(x.causes), d = JSON.parse(x.details);
          lines.push([x.id, x.iim, x.created_at, x.updated_at, ...STAGE_QUESTIONS.map((q) => st[q.id]), ...METRIC_IDS.map((m) => r[m]), ...METRIC_IDS.map((m) => (c[m] || []).join("|")), Object.entries(d).map(([k, v]) => k + "=" + v).join("|"), x.programme, x.year, x.comment].map(csvCell).join(","));
        }
        return send(res, 200, lines.join("\n"), { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="responses.csv"', "cache-control": "no-store" });
      }
      return json(res, 404, { error: "not found" });
    }

    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
    let file = path.normalize(path.join(PUB, p === "/" ? "index.html" : p));
    if (!file.startsWith(PUB + path.sep) && file !== PUB) return send(res, 403, "Forbidden");
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) return send(res, 404, "Not found", { "content-type": "text/plain" });
    const ext = path.extname(file);
    send(res, 200, req.method === "HEAD" ? "" : fs.readFileSync(file), { "content-type": MIME[ext] || "application/octet-stream", "cache-control": ext === ".png" || ext === ".ico" ? "public, max-age=86400" : "no-cache" });
  } catch (e) {
    if (e instanceof Bad) return json(res, 400, { error: e.message });
    console.error(e);
    json(res, 500, { error: "server error" });
  }
});
server.listen(PORT, () => console.log(`IIM Stage Finder on http://localhost:${PORT}  (db: ${DB_PATH})`));

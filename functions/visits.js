// Pages Function: password-protected viewer for the visits log.
// GET /visits  →  HTML table of recent visits (most-recent first)
// GET /visits?format=json  →  raw JSON
// GET /visits?limit=500    →  bump row cap (default 200, max 2000)
//
// Auth: HTTP Basic. Username is ignored, password must match VISITS_PASSWORD secret.
// Set it once with:  npx wrangler pages secret put VISITS_PASSWORD --project-name=lishainsurance

export async function onRequestGet({ request, env }) {
  const expected = env.VISITS_PASSWORD || "";
  if (!expected) {
    return new Response(
      "VISITS_PASSWORD secret is not set. Run: npx wrangler pages secret put VISITS_PASSWORD --project-name=lishainsurance",
      { status: 500 }
    );
  }

  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Basic ")) {
    return new Response("auth required", {
      status: 401,
      headers: { "www-authenticate": 'Basic realm="visits"' }
    });
  }
  let pwd = "";
  try {
    const decoded = atob(auth.slice(6));
    pwd = decoded.split(":")[1] || "";
  } catch { /* fall through */ }
  if (pwd !== expected) {
    return new Response("bad password", {
      status: 401,
      headers: { "www-authenticate": 'Basic realm="visits"' }
    });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "html";
  let limit = parseInt(url.searchParams.get("limit") || "200", 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 200;
  if (limit > 2000) limit = 2000;

  const { results } = await env.DB.prepare(
    `SELECT id, ts, ip, country, city, region, ua, lang, path, referrer, device
     FROM visits ORDER BY ts DESC LIMIT ?`
  ).bind(limit).all();

  // Summary counts (today / 7d / 30d / all + unique IPs)
  const now = Date.now();
  const dayAgo = now - 86400 * 1000;
  const weekAgo = now - 7 * 86400 * 1000;
  const monthAgo = now - 30 * 86400 * 1000;
  const s = await env.DB.prepare(
    `SELECT
       COUNT(*) AS total,
       COUNT(DISTINCT ip) AS uniq,
       SUM(CASE WHEN ts >= ? THEN 1 ELSE 0 END) AS d1,
       SUM(CASE WHEN ts >= ? THEN 1 ELSE 0 END) AS d7,
       SUM(CASE WHEN ts >= ? THEN 1 ELSE 0 END) AS d30
     FROM visits`
  ).bind(dayAgo, weekAgo, monthAgo).first();

  if (format === "json") {
    return new Response(JSON.stringify({ summary: s, rows: results }, null, 2), {
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }

  const rows = (results || []).map(r => {
    // Render in America/New_York (same zone as Ontario — auto EST/EDT).
    // sv-SE locale gives us "YYYY-MM-DD HH:MM:SS" format cleanly.
    const iso = new Date(r.ts).toLocaleString("sv-SE", {
      timeZone: "America/New_York",
      hour12: false
    });
    const esc = (x) => String(x || "").replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const flag = r.country ? countryFlag(r.country) : "";
    const geo = [r.city, r.region, flag + " " + (r.country || "")].filter(Boolean).join(", ");
    return `<tr>
      <td class="t">${iso}</td>
      <td class="ip">${esc(r.ip)}</td>
      <td>${esc(geo)}</td>
      <td>${esc(r.device || "")}</td>
      <td>${esc(r.lang || "")}</td>
      <td class="p">${esc(r.path || "")}</td>
      <td class="r" title="${esc(r.referrer)}">${esc((r.referrer || "").slice(0, 40))}</td>
      <td class="ua" title="${esc(r.ua)}">${esc((r.ua || "").slice(0, 60))}</td>
    </tr>`;
  }).join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Visits · Lisha Liang</title>
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { --ink:#1a1a1a; --cream:#faf8f4; --gold:#b8935b; --rule:rgba(26,26,26,0.08); }
  body { font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; background:var(--cream); color:var(--ink); margin:0; padding:24px; }
  h1 { font-family: "Playfair Display", Georgia, serif; font-weight: 600; font-size: 32px; margin: 0 0 6px; }
  .sub { color:#6b6b6b; font-size:13px; margin-bottom:28px; }
  .stats { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; max-width:900px; margin-bottom:28px; }
  .stat { border:1px solid var(--rule); border-radius:10px; padding:14px 16px; background:#fff; }
  .stat .n { font-family:"Playfair Display",Georgia,serif; font-size:26px; font-weight:600; line-height:1; }
  .stat .l { font-size:10.5px; letter-spacing:0.14em; text-transform:uppercase; color:#6b6b6b; margin-top:8px; }
  table { width:100%; border-collapse:collapse; font-size:12.5px; }
  thead th { text-align:left; font-weight:500; font-size:10.5px; letter-spacing:0.12em; text-transform:uppercase; color:#6b6b6b; padding:10px 8px; border-bottom:1px solid var(--ink); }
  tbody td { padding:9px 8px; border-bottom:1px solid var(--rule); vertical-align:top; }
  tbody tr:hover { background:#fff; }
  .t { white-space:nowrap; font-variant-numeric:tabular-nums; color:#555; }
  .ip { font-family: ui-monospace, Menlo, Consolas, monospace; font-size:12px; }
  .ua { color:#777; max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .p, .r { font-family: ui-monospace, Menlo, Consolas, monospace; font-size:11.5px; color:#555; }
  .controls { margin: 16px 0 18px; font-size:12px; color:#6b6b6b; }
  .controls a { color:var(--gold); text-decoration:none; margin-right:14px; }
  .controls a:hover { text-decoration:underline; }
  @media (max-width:768px) {
    .stats { grid-template-columns:repeat(2,1fr); }
    .ua, .r { display:none; }
  }
</style>
</head>
<body>
  <h1>Visits</h1>
  <div class="sub">lishainsurance.com · refresh to update</div>
  <div class="stats">
    <div class="stat"><div class="n">${s.d1 || 0}</div><div class="l">Last 24 h</div></div>
    <div class="stat"><div class="n">${s.d7 || 0}</div><div class="l">Last 7 d</div></div>
    <div class="stat"><div class="n">${s.d30 || 0}</div><div class="l">Last 30 d</div></div>
    <div class="stat"><div class="n">${s.total || 0}</div><div class="l">All time</div></div>
    <div class="stat"><div class="n">${s.uniq || 0}</div><div class="l">Unique IPs</div></div>
  </div>
  <div class="controls">
    Showing most recent ${results.length} visits ·
    <a href="?limit=500">500</a>
    <a href="?limit=2000">2000</a>
    <a href="?format=json">raw JSON</a>
  </div>
  <table>
    <thead><tr>
      <th>Time (NY · ET)</th><th>IP</th><th>Location</th><th>Device</th><th>Lang</th><th>Path</th><th>Referrer</th><th>User agent</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="8" style="padding:40px;text-align:center;color:#999">No visits yet.</td></tr>'}</tbody>
  </table>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

// Flag emoji from ISO country code (e.g. "CA" → 🇨🇦)
function countryFlag(code) {
  if (!code || code.length !== 2) return "";
  const A = 0x1F1E6;
  return String.fromCodePoint(A + code.charCodeAt(0) - 65) +
         String.fromCodePoint(A + code.charCodeAt(1) - 65);
}

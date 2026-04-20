// Pages Function: password-protected viewer for the visits log.
// GET /visits  →  HTML with LIVE NOW section (auto-polling) + recent visits
// GET /visits?format=json  →  raw JSON (includes live sessions)
// GET /visits?format=live  →  JSON of only the live-now slice (used by auto-poll)
// GET /visits?limit=500    →  bump row cap (default 200, max 2000)
//
// Auth: HTTP Basic. Username ignored, password must match VISITS_PASSWORD secret.

// A session is "live" if its last_ping is newer than this many ms ago.
const LIVE_WINDOW_MS = 45_000;

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
  try { pwd = (atob(auth.slice(6)).split(":")[1] || ""); } catch {}
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

  const now = Date.now();
  const liveCutoff = now - LIVE_WINDOW_MS;

  // Currently-live sessions
  const live = await env.DB.prepare(
    `SELECT id, ts, last_ping, ip, country, city, region, ua, lang, path, device
     FROM visits
     WHERE last_ping IS NOT NULL AND last_ping > ?
     ORDER BY last_ping DESC`
  ).bind(liveCutoff).all();

  // Lightweight live-only response for the auto-poller
  if (format === "live") {
    return new Response(JSON.stringify({
      now,
      live: live.results || []
    }), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }

  const { results } = await env.DB.prepare(
    `SELECT id, ts, last_ping, ip, country, city, region, ua, lang, path, referrer, device
     FROM visits ORDER BY ts DESC LIMIT ?`
  ).bind(limit).all();

  // Summary counts
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
    return new Response(JSON.stringify({ summary: s, live: live.results, rows: results }, null, 2), {
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }

  const esc = (x) => String(x || "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const fmtET = (ts) => new Date(ts).toLocaleString("sv-SE", {
    timeZone: "America/New_York", hour12: false
  });

  const liveRows = (live.results || []).map(r => {
    const agoSec = Math.max(0, Math.round((now - r.last_ping) / 1000));
    const flag = r.country ? countryFlag(r.country) : "";
    const geo = [r.city, r.region, flag + " " + (r.country || "")].filter(Boolean).join(", ");
    return `<tr data-id="${r.id}">
      <td class="live-dot"><span class="dot"></span></td>
      <td class="t ago" data-last-ping="${r.last_ping}">${agoSec}s ago</td>
      <td class="ip">${esc(r.ip)}</td>
      <td>${esc(geo)}</td>
      <td>${esc(r.device || "")}</td>
      <td>${esc(r.lang || "")}</td>
      <td class="p">${esc(r.path || "")}</td>
      <td class="ua" title="${esc(r.ua)}">${esc((r.ua || "").slice(0, 60))}</td>
    </tr>`;
  }).join("");

  const rows = (results || []).map(r => {
    const iso = fmtET(r.ts);
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

  const liveCount = (live.results || []).length;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Visits · Lisha Liang</title>
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { --ink:#1a1a1a; --cream:#faf8f4; --gold:#b8935b; --rule:rgba(26,26,26,0.08); --live:#2e8b57; }
  body { font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; background:var(--cream); color:var(--ink); margin:0; padding:24px; }
  h1 { font-family: "Playfair Display", Georgia, serif; font-weight: 600; font-size: 32px; margin: 0 0 6px; }
  h2 { font-family: "Playfair Display", Georgia, serif; font-weight: 600; font-size: 20px; margin: 36px 0 14px; display:flex; align-items:center; gap:10px; }
  h2 .pulse { width:9px; height:9px; border-radius:50%; background:var(--live); display:inline-block; animation:pulse 1.6s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.4; transform:scale(0.7); } }
  .sub { color:#6b6b6b; font-size:13px; margin-bottom:28px; }
  .stats { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; max-width:900px; margin-bottom:14px; }
  .stat { border:1px solid var(--rule); border-radius:10px; padding:14px 16px; background:#fff; }
  .stat .n { font-family:"Playfair Display",Georgia,serif; font-size:26px; font-weight:600; line-height:1; }
  .stat .l { font-size:10.5px; letter-spacing:0.14em; text-transform:uppercase; color:#6b6b6b; margin-top:8px; }
  .live-card { border:1px solid var(--rule); border-radius:10px; background:#fff; padding:18px 20px; max-width:1400px; margin-bottom:10px; }
  .live-count { font-family:"Playfair Display",Georgia,serif; font-size:42px; font-weight:600; line-height:1; }
  .live-count-label { font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:#6b6b6b; margin-top:6px; }
  table { width:100%; border-collapse:collapse; font-size:12.5px; }
  thead th { text-align:left; font-weight:500; font-size:10.5px; letter-spacing:0.12em; text-transform:uppercase; color:#6b6b6b; padding:10px 8px; border-bottom:1px solid var(--ink); }
  tbody td { padding:9px 8px; border-bottom:1px solid var(--rule); vertical-align:top; }
  tbody tr:hover { background:#faf7f0; }
  .t { white-space:nowrap; font-variant-numeric:tabular-nums; color:#555; }
  .ago { color:var(--live); font-weight:500; }
  .ip { font-family: ui-monospace, Menlo, Consolas, monospace; font-size:12px; }
  .ua { color:#777; max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .p, .r { font-family: ui-monospace, Menlo, Consolas, monospace; font-size:11.5px; color:#555; }
  .live-dot { width:14px; text-align:center; padding-left:0; }
  .live-dot .dot { display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--live); animation:pulse 1.6s ease-in-out infinite; }
  .controls { margin: 14px 0 18px; font-size:12px; color:#6b6b6b; }
  .controls a { color:var(--gold); text-decoration:none; margin-right:14px; }
  .controls a:hover { text-decoration:underline; }
  .empty { padding:28px; text-align:center; color:#999; font-size:13px; }
  .updating { font-size:10.5px; color:#999; letter-spacing:0.1em; text-transform:uppercase; margin-left:auto; }
  @media (max-width:768px) {
    .stats { grid-template-columns:repeat(2,1fr); }
    .ua, .r { display:none; }
  }
</style>
</head>
<body>
  <h1>Visits</h1>
  <div class="sub">lishainsurance.com · auto-refreshing live · times in NY/ET</div>

  <h2><span class="pulse"></span>Live now <span class="updating" id="updating">polling…</span></h2>
  <div class="live-card" id="liveCard">
    <div style="display:flex; align-items:baseline; gap:16px; margin-bottom:14px;">
      <div>
        <div class="live-count" id="liveCount">${liveCount}</div>
        <div class="live-count-label">active right now</div>
      </div>
    </div>
    <table id="liveTable">
      <thead><tr>
        <th></th><th>Last seen</th><th>IP</th><th>Location</th><th>Device</th><th>Lang</th><th>Path</th><th>User agent</th>
      </tr></thead>
      <tbody id="liveBody">${liveRows || '<tr><td colspan="8" class="empty">Nobody on the site right now.</td></tr>'}</tbody>
    </table>
  </div>

  <h2>Summary</h2>
  <div class="stats">
    <div class="stat"><div class="n">${s.d1 || 0}</div><div class="l">Last 24 h</div></div>
    <div class="stat"><div class="n">${s.d7 || 0}</div><div class="l">Last 7 d</div></div>
    <div class="stat"><div class="n">${s.d30 || 0}</div><div class="l">Last 30 d</div></div>
    <div class="stat"><div class="n">${s.total || 0}</div><div class="l">All time</div></div>
    <div class="stat"><div class="n">${s.uniq || 0}</div><div class="l">Unique IPs</div></div>
  </div>

  <h2>Recent visits</h2>
  <div class="controls">
    Showing most recent ${results.length} · <a href="?limit=500">500</a> <a href="?limit=2000">2000</a> <a href="?format=json">raw JSON</a>
  </div>
  <table>
    <thead><tr>
      <th>Time (NY · ET)</th><th>IP</th><th>Location</th><th>Device</th><th>Lang</th><th>Path</th><th>Referrer</th><th>User agent</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="8" class="empty">No visits yet.</td></tr>'}</tbody>
  </table>

<script>
(function(){
  const CF = ${JSON.stringify(countryFlagMapJS())};
  function flag(code){ if(!code||code.length!==2) return ''; return String.fromCodePoint(0x1F1E6+code.charCodeAt(0)-65)+String.fromCodePoint(0x1F1E6+code.charCodeAt(1)-65); }
  function esc(x){ return String(x==null?'':x).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  async function tick(){
    try {
      const r = await fetch('/visits?format=live', { credentials:'same-origin' });
      if (!r.ok) return;
      const { now, live } = await r.json();
      const body = document.getElementById('liveBody');
      document.getElementById('liveCount').textContent = live.length;
      if (!live.length) {
        body.innerHTML = '<tr><td colspan="8" class="empty">Nobody on the site right now.</td></tr>';
      } else {
        body.innerHTML = live.map(v => {
          const ago = Math.max(0, Math.round((now - v.last_ping)/1000));
          const geo = [v.city, v.region, flag(v.country) + ' ' + (v.country||'')].filter(Boolean).join(', ');
          const ua = (v.ua||'').slice(0,60);
          return '<tr data-id="'+v.id+'">'
               + '<td class="live-dot"><span class="dot"></span></td>'
               + '<td class="t ago">'+ago+'s ago</td>'
               + '<td class="ip">'+esc(v.ip)+'</td>'
               + '<td>'+esc(geo)+'</td>'
               + '<td>'+esc(v.device||'')+'</td>'
               + '<td>'+esc(v.lang||'')+'</td>'
               + '<td class="p">'+esc(v.path||'')+'</td>'
               + '<td class="ua" title="'+esc(v.ua||'')+'">'+esc(ua)+'</td>'
               + '</tr>';
        }).join('');
      }
      document.getElementById('updating').textContent = 'updated ' + new Date().toLocaleTimeString('en-US', { timeZone:'America/New_York', hour12:false });
    } catch(e){}
  }
  setInterval(tick, 4000);
})();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function countryFlag(code) {
  if (!code || code.length !== 2) return "";
  const A = 0x1F1E6;
  return String.fromCodePoint(A + code.charCodeAt(0) - 65) +
         String.fromCodePoint(A + code.charCodeAt(1) - 65);
}

// Used only so the JS block can call flag() in the browser; the server-side
// countryFlag is above. Kept as a noop placeholder — JS reconstructs flags locally.
function countryFlagMapJS() { return {}; }

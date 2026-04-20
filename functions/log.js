// Pages Function: capture a visit + heartbeat a live session.
// POST body (JSON): { sid, path, lang, referrer }
//
// If `sid` is provided and we have a recent row (< 60 min) for that sid,
// we UPDATE last_ping only (heartbeat — keeps the session "live").
// Otherwise we INSERT a new visit row (first page-load of a session).
//
// Rows without sid still insert (legacy compatibility / curl pings).

export async function onRequestPost({ request, env }) {
  try {
    const cf = request.cf || {};
    const body = await request.json().catch(() => ({}));

    const ip = request.headers.get("cf-connecting-ip") || "";
    const ua = request.headers.get("user-agent") || "";
    const sid = String(body.sid || "").slice(0, 64);
    const now = Date.now();

    const device = /mobile/i.test(ua) ? "mobile"
                 : /tablet|ipad/i.test(ua) ? "tablet"
                 : "desktop";

    // If this session is already logged within the last hour, just heartbeat.
    if (sid) {
      const existing = await env.DB.prepare(
        "SELECT id FROM visits WHERE sid = ? AND ts > ? ORDER BY ts DESC LIMIT 1"
      ).bind(sid, now - 3600_000).first();

      if (existing) {
        await env.DB.prepare(
          "UPDATE visits SET last_ping = ?, path = ? WHERE id = ?"
        ).bind(now, String(body.path || "/"), existing.id).run();
        return new Response(null, {
          status: 204,
          headers: { "access-control-allow-origin": "*" }
        });
      }
    }

    // First visit of this session (or no sid): insert a fresh row.
    await env.DB.prepare(
      `INSERT INTO visits (ts, ip, country, city, region, ua, lang, path, referrer, device, sid, last_ping)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      now,
      ip,
      cf.country || "",
      cf.city || "",
      cf.region || "",
      ua,
      String(body.lang || ""),
      String(body.path || "/"),
      String(body.referrer || ""),
      device,
      sid || null,
      now
    ).run();

    return new Response(null, {
      status: 204,
      headers: { "access-control-allow-origin": "*" }
    });
  } catch (e) {
    return new Response("err", { status: 500 });
  }
}

export async function onRequest({ request }) {
  if (request.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
}

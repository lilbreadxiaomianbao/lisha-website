// Pages Function: capture a visit (IP + country + user-agent + path + referrer).
// Called by index.html on DOMContentLoaded via a silent POST to /log.
// Writes to D1 table `visits`. Rejects anything that's not a POST.

export async function onRequestPost({ request, env }) {
  try {
    const cf = request.cf || {};
    const body = await request.json().catch(() => ({}));

    // Cloudflare gives us the real client IP in this header on Pages/Workers.
    const ip = request.headers.get("cf-connecting-ip") || "";
    const ua = request.headers.get("user-agent") || "";

    // Simple device class detection (mobile/tablet/desktop)
    const device = /mobile/i.test(ua) ? "mobile"
                 : /tablet|ipad/i.test(ua) ? "tablet"
                 : "desktop";

    await env.DB.prepare(
      `INSERT INTO visits (ts, ip, country, city, region, ua, lang, path, referrer, device)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      Date.now(),
      ip,
      cf.country || "",
      cf.city || "",
      cf.region || "",
      ua,
      String(body.lang || ""),
      String(body.path || "/"),
      String(body.referrer || ""),
      device
    ).run();

    return new Response(null, {
      status: 204,
      headers: { "access-control-allow-origin": "*" }
    });
  } catch (e) {
    return new Response("err", { status: 500 });
  }
}

// Reject anything that's not a POST (avoids accidental writes from crawlers).
export async function onRequest({ request }) {
  if (request.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
}

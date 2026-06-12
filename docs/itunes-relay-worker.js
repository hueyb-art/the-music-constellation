// The Jazz Constellation — private iTunes/Apple lookup relay (Cloudflare Worker)
//
// Why: iPhones often can't reach Apple's lookup API directly, and free public
// relays get rate-limited. This gives the site its own fast, reliable relay.
//
// Deploy: dash.cloudflare.com -> Workers & Pages -> Create -> Create Worker
//   -> name it (e.g. "jazz-itunes") -> Deploy -> Edit code -> paste this -> Deploy.
// Then copy the worker's address (https://jazz-itunes.YOUR-NAME.workers.dev)
// and send it to Claude to wire into the site.
//
// Usage: https://YOUR-WORKER.workers.dev/?url=<an https://itunes.apple.com/... URL>

export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Content-Type": "application/json",
      "Cache-Control": "max-age=86400"
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const target = new URL(request.url).searchParams.get("url");
    // Only allow Apple's own API through, so this can't be abused as an open proxy.
    if (!target || !target.startsWith("https://itunes.apple.com/")) {
      return new Response(JSON.stringify({ error: "bad url" }), { status: 400, headers: cors });
    }
    try {
      const r = await fetch(target, { headers: { "User-Agent": "jazz-constellation" } });
      const body = await r.text();
      return new Response(body, { headers: cors });
    } catch (e) {
      return new Response(JSON.stringify({ error: "fetch failed" }), { status: 502, headers: cors });
    }
  }
};

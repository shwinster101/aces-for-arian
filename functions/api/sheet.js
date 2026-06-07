// Edge-cached read proxy for the public Google Sheet. Clients hit this
// same-origin endpoint (/api/sheet?tab=...) instead of docs.google.com, so the
// crowd's polling is absorbed by Cloudflare's cache, not Google's gviz limits.
// Cloudflare Pages auto-deploys anything under functions/ — no extra config.
const SHEET_ID = "1u94hz6xL-WbLEQAOW9HLgSvKJ9B1LoqFX7lW1JMnjNM";
// "SeedBoardPublic" only — never the committee-side "Seeds"/notes data.
// See the "PUBLIC / COMMITTEE DATA SEPARATION" note in src/lib/sheet.js.
const ALLOWED = new Set(["", "Config", "SeedBoardPublic", "Photos", "Courts", "Matches"]);
const TTL = 30; // seconds the edge holds a tab's CSV before re-fetching gviz

export async function onRequestGet({ request }) {
  const tab = new URL(request.url).searchParams.get("tab") || "";
  if (!ALLOWED.has(tab)) return new Response("Unknown tab", { status: 400 });

  const gviz =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv` +
    (tab ? `&sheet=${encodeURIComponent(tab)}` : "");

  // cacheTtl also caches the upstream gviz subrequest at Cloudflare's edge.
  const upstream = await fetch(gviz, { cf: { cacheEverything: true, cacheTtl: TTL } });

  return new Response(await upstream.text(), {
    status: upstream.ok ? 200 : 502,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": `public, max-age=20, s-maxage=${TTL}`,
    },
  });
}

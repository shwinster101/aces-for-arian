// Edge-cached read proxy for the public Google Sheet. Clients hit this
// same-origin endpoint (/api/sheet?tab=...) instead of docs.google.com, so the
// crowd's polling is absorbed by Cloudflare's cache, not Google's gviz limits.
// Cloudflare Pages auto-deploys anything under functions/ — no extra config.
const SHEET_ID = "1u94hz6xL-WbLEQAOW9HLgSvKJ9B1LoqFX7lW1JMnjNM";
// "SeedBoardPublic" only — never the committee-side "Seeds"/notes data.
// See the "PUBLIC / COMMITTEE DATA SEPARATION" note in src/lib/sheet.js.
const ALLOWED = new Set(["", "Config", "SeedBoardPublic", "Photos", "Courts", "Matches"]);
const TTL = 30; // seconds the edge holds a tab's CSV before re-fetching gviz

// The roster tab is the raw Google Form responses sheet — it carries PII the
// public site never renders (email, phone, payment method, free-text comments).
// We expose ONLY the columns mapRoster() actually consumes. These keep-predicates
// mirror mapRoster's column detection in src/lib/sheet.js, so the boundary and
// the consumer can't drift apart. Keeping a harmless extra (e.g. "years of
// tennis xp", which matches "year") is fine; dropping a needed column is not —
// so this errs toward a superset of what mapRoster reads.
function isPublicRosterCol(header) {
  const h = header.trim().toLowerCase();
  return (
    h.includes("name") ||
    h.includes("class") || h.includes("grad") || h.includes("year") ||
    (h.includes("doubles") && (h.includes("tourney") || h.includes("saturday"))) ||
    (h.includes("singles") && (h.includes("sunday") || h.includes("tourney"))) ||
    /\bevents?\b/.test(h) ||
    h.includes("partner") ||
    h.includes("bio") || h.includes("yearbook") || h.includes("nickname") ||
    h.includes("about") || h.includes("quote") ||
    h.includes("status") || h.includes("verif") || h.includes("confirm") ||
    h.includes("hide") || h.includes("hidden")
  );
}

// gviz returns the FIRST sheet (the roster) when asked for a sheet name that
// does NOT exist — it doesn't 404. So a name allowlist alone isn't enough: a
// not-yet-created tab (Config / Photos / SeedBoardPublic pre-publish) would leak
// the roster. Detect that fallback by the roster's signature header columns and
// fail closed (return empty → callers fall back to their static defaults).
const ROSTER_MARKERS = ["email", "phone number", "timestamp", "payment method"];
function looksLikeRoster(csv) {
  const firstLine = (csv.split("\n", 1)[0] || "").toLowerCase();
  return ROSTER_MARKERS.some((m) => firstLine.includes(m));
}

// Minimal RFC-4180-ish CSV parse/serialize (mirrors src/lib/sheet.js parseCSV).
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function toCSV(rows) {
  return rows
    .map((r) => r.map((f) => {
      const s = String(f ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","))
    .join("\n");
}

// Drop every roster column except the public-safe set, preserving order.
function filterRoster(csv) {
  const rows = parseCSV(csv);
  if (rows.length < 1) return csv;
  const keep = rows[0].map((h) => isPublicRosterCol(h));
  return toCSV(rows.map((r) => r.filter((_, i) => keep[i])));
}

const gvizUrl = (tab) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv` +
  (tab ? `&sheet=${encodeURIComponent(tab)}` : "");

// Roster ('') → strip PII to the public columns; a named tab that came back
// looking like the roster (gviz missing-tab fallback) → fail closed.
const shape = (body, tab) =>
  tab === "" ? filterRoster(body) : looksLikeRoster(body) ? "" : body;

export async function onRequestGet({ request, env, waitUntil }) {
  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") || "";
  if (!ALLOWED.has(tab)) return new Response("Unknown tab", { status: 400 });

  const csv = (body, extra) => new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": `public, max-age=20, s-maxage=${TTL}`,
      ...(extra || {}),
    },
  });

  try {
    // Edge cache (per colo), keyed by the normalized public URL, so the crowd's
    // polling collapses to ~1 upstream fetch per tab per TTL. We cache OUR clean
    // response explicitly via the Cache API instead of fetch({cf:cacheEverything})
    // — the latter throws on Google's redirecting/cookie-setting Apps Script
    // response, and only ever worked for plain gviz.
    const cache = caches.default;
    const cacheKey = new Request(`${url.origin}${url.pathname}?tab=${encodeURIComponent(tab)}`);
    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    // Prefer the authenticated, owner-run Apps Script read proxy (doGet): it can
    // read the sheet even when set to "Restricted", closing the gviz backdoor.
    // The read token travels in this server-to-server URL only. Until
    // SHEET_READ_URL is set in Cloudflare, fall back to public gviz.
    const upstreamUrl = env.SHEET_READ_URL
      ? `${env.SHEET_READ_URL}?token=${encodeURIComponent(env.SHEET_READ_TOKEN || "")}` +
        `&tab=${encodeURIComponent(tab)}`
      : gvizUrl(tab);

    const upstream = await fetch(upstreamUrl);
    if (!upstream.ok) throw new Error("upstream " + upstream.status);

    const resp = csv(shape(await upstream.text(), tab));
    if (waitUntil) waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  } catch (err) {
    // Never hard-fail the public site. Log the error server-side (visible in
    // Cloudflare's real-time logs — NOT in a public header, since the error can
    // contain the upstream URL + read token) and fall back to direct gviz, which
    // works while the sheet is still public.
    console.error("sheet read failed:", err);
    const g = await fetch(gvizUrl(tab)).catch(() => null);
    if (!g || !g.ok) return new Response("", { status: 502 });
    const body = await g.text().catch(() => "");
    return csv(shape(body, tab), { "X-Fallback": "gviz" });
  }
}

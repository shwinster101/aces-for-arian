// Write adapter: the browser POSTs here (same-origin) instead of straight to
// the Apps Script exec URL. Why: Apps Script POST responses are unreadable
// from a browser (no CORS), so direct writes were fire-and-forget — "sent"
// could never mean "delivered". Server-to-server we CAN read the response
// (follow the 302 to script.googleusercontent.com and read the body), so this
// Function is the one place a real receipt can exist. It also validates the
// envelope, injects the write token server-side, logs failures to Cloudflare's
// real-time logs, and gives the client real status codes to retry on.
//
// Env (optional — falls back to the committed values so nothing breaks before
// they're set): SHEET_WRITE_URL = the Apps Script /exec URL,
// SHEET_WRITE_TOKEN = the write token. Like the committed tokens in the repo,
// the fallbacks are deterrents, not secrets; setting the env vars (and
// rotating the Apps Script token) is the post-event hardening step.
const EXEC_FALLBACK =
  "https://script.google.com/macros/s/AKfycby1CP-FQNwOoKYkDiiFEzoUbrEkg2427Iyt4x_GXwjeVsB9rlOPMYJOZQiygkI5fDbM7Q/exec";
const WRITE_TOKEN_FALLBACK = "a4a-ea5316b9f5d5b04e49115a20";

const MAX_BODY = 64 * 1024; // matches the browser keepalive cap
const UPSTREAM_TIMEOUT_MS = 10000;

// Every type doPost handles, with a MINIMAL payload check each — deliberately
// a permissive superset of the Apps Script's own validation so the two layers
// can't drift into rejecting legitimate writes. The goal here is catching
// malformed/garbage envelopes early with a readable 400, not re-implementing
// the handlers.
const str = (v) => typeof v === "string" && v.length > 0;
const TYPES = {
  // public, tokenless in doPost
  idea: (p) => str(p && p.text) && p.text.length <= 4000,
  subscribe: (p) => str(p && p.email) && /\S@\S/.test(p.email) && p.email.length <= 500,
  "ace-pledge": () => true,
  // ops (token-gated in doPost; token injected below)
  seeds: (p) => p && str(p.event) && Array.isArray(p.list),
  "court-board": (p) => p && typeof p === "object",
  match: (p) => str(p && p.id),
  "match-delete": (p) => str(p && p.id),
  "matches-replace": (p) => p && str(p.event) && str(p.prefix),
  aces: (p) => p && Number.isFinite(Number(p.count)),
  status: (p) => str(p && p.name),
  config: (p) => p && typeof p === "object",
  announce: (p) => str(p && p.id),
  "announce-delete": (p) => str(p && p.id),
  opsdesk: (p) => str(p && p.name),
  walkup: (p) => str(p && p.id),
  "walkup-delete": (p) => str(p && p.id),
  opsdraw: (p) => p && (p.event === "Singles" || p.event === "Doubles"),
};

const json = (status, obj) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

// The one place encoding the upstream-body contract, INCLUDING legacy compat:
// the currently-deployed Apps Script always answers 'ok'; the hardened one
// answers 'ok' | 'forbidden' | 'error:<reason>'. Anything else (e.g. a Google
// HTML error page served with HTTP 200) is a failure.
function upstreamResult(bodyText) {
  const t = (bodyText || "").trim();
  if (t === "ok" || t.startsWith("ok")) return { ok: true };
  if (t === "forbidden") return { ok: false, error: "forbidden" };
  if (t.startsWith("error:")) return { ok: false, error: t.slice(0, 220) };
  return { ok: false, error: "upstream-unexpected" };
}

export async function onRequestPost({ request, env }) {
  let text;
  try {
    text = await request.text();
  } catch {
    return json(400, { ok: false, error: "bad-json" });
  }
  if (text.length > MAX_BODY) return json(413, { ok: false, error: "too-large" });

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { ok: false, error: "bad-json" });
  }
  if (body.v !== 1) return json(400, { ok: false, error: "bad-version" });

  const type = body.type;
  const check = TYPES[type];
  if (!check) return json(400, { ok: false, error: "bad-type" });
  if (!check(body.payload)) return json(400, { ok: false, error: "bad-payload" });

  const execUrl = env.SHEET_WRITE_URL || EXEC_FALLBACK;
  const token = env.SHEET_WRITE_TOKEN || WRITE_TOKEN_FALLBACK;

  // Forward with the exact envelope doPost expects. Injecting the token on the
  // tokenless public types is harmless — doPost handles those before its token
  // check. NOTE: aborting this fetch does NOT un-deliver the request — Google
  // usually still processes a timed-out write, so a 504 means "unconfirmed",
  // not "not written" (the client only auto-retries idempotent types).
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(execUrl, {
      method: "POST",
      redirect: "follow", // Apps Script 302s to script.googleusercontent.com
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ type, payload: body.payload, ts: Date.now(), token }),
      signal: ctrl.signal,
    });
    if (!upstream.ok) {
      console.error(`write ${type}: upstream HTTP ${upstream.status}`);
      return json(502, { ok: false, error: `upstream-${upstream.status}` });
    }
    const result = upstreamResult(await upstream.text());
    if (!result.ok) {
      // Body excerpt only — never the token (it isn't in the response anyway).
      console.error(`write ${type}: ${result.error}`);
      return json(502, result);
    }
    return json(200, result);
  } catch (err) {
    const timedOut = err && err.name === "AbortError";
    console.error(`write ${type}: ${timedOut ? "timeout" : err}`);
    return json(timedOut ? 504 : 502, { ok: false, error: timedOut ? "timeout" : "upstream" });
  } finally {
    clearTimeout(timer);
  }
}

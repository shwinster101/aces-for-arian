// ==========================================
// SHARED WRITE PATH — the one client-side seam for every sheet write
// ==========================================
// PROD: POST /api/write (the Cloudflare Function in functions/api/write.js),
// which forwards to the Apps Script server-to-server and — unlike a browser —
// can READ the response. So for the first time "sent" can mean "delivered":
// postWrite resolves {ok, confirmed} and callers can show a real receipt.
//
// DEV (vite has no Pages Functions) and any prod build hitting a stale deploy
// without the Function (404/405): fall back to the legacy direct no-cors POST
// to the Apps Script — exactly the old behavior, {ok:true, confirmed:false}.
// Mirrors the READ_BASE prod/dev split for reads in ./sheet.js.
import { SHEET_WRITE_URL } from './sheet';

// Shared-secret gate for the DIRECT legacy path only (must match the token in
// apps-script/ops-write-back.js). In prod the /api/write adapter injects the
// token server-side, so it never needs to appear in a request the page makes.
// Ships in the public bundle → drive-by deterrent, not a secret. Rotate here
// AND in the Apps Script (+ New version redeploy), or set SHEET_WRITE_TOKEN in
// Cloudflare and rotate only there + the script.
export const WRITE_TOKEN = 'a4a-ea5316b9f5d5b04e49115a20';

const WRITE_API = '/api/write';

// The ONLY non-idempotent write types: 'idea' and 'merch-order' send an
// email, 'ace-pledge' increments a counter. A retry after an ambiguous
// timeout (where the first attempt actually landed — aborting the adapter's
// upstream fetch does NOT stop Google from processing it) would double-send /
// double-count. Every other type is a keyed upsert, absolute snapshot, or
// prefix-scoped replace ('subscribe' is deduped server-side), so retries are
// safe.
const NO_RETRY_TYPES = new Set(['idea', 'ace-pledge', 'merch-order']);

const RETRY_DELAYS_MS = [800, 2500]; // between attempts 1→2 and 2→3, ±30% jitter

// One 404/405 from /api/write means this deployment has no adapter — stop
// probing and use the legacy path for the rest of the session.
let adapterMissing = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (ms) => Math.round(ms * (0.7 + Math.random() * 0.6));

// The pre-adapter behavior, verbatim: fire-and-forget no-cors POST straight to
// the Apps Script. Response unreadable by design → resolves confirmed:false.
function legacyPost(type, payload, keepalive) {
  try {
    fetch(SHEET_WRITE_URL, {
      method: 'POST',
      mode: 'no-cors',
      // keepalive lets a push issued right before the tab closes (e.g. the
      // debounced seeds flush on pagehide) still be delivered. Payloads here
      // are far below the keepalive 64KB cap.
      keepalive: !!keepalive,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ type, payload, ts: Date.now(), token: WRITE_TOKEN }),
    }).catch(() => {});
  } catch { /* local state stays authoritative */ }
  return Promise.resolve({ ok: true, confirmed: false });
}

// Post one write. Resolves (never rejects) {ok, confirmed, error?}:
//   {ok:true,  confirmed:true}  — the adapter read the Apps Script's receipt
//   {ok:true,  confirmed:false} — dev/legacy path: sent, honesty caveat as ever
//   {ok:false, confirmed:false} — delivery failed after retries; caller may
//                                 surface it (local state is still saved)
// opts.keepalive: pass true from pagehide-flush call sites — applied on the
// FINAL attempt so a last-gasp push survives the tab closing.
export async function postWrite(type, payload, { keepalive = false } = {}) {
  if (!SHEET_WRITE_URL) return { ok: false, confirmed: false, error: 'no-endpoint' };
  if (!import.meta.env.PROD || adapterMissing) return legacyPost(type, payload, keepalive);

  const attempts = NO_RETRY_TYPES.has(type) ? 1 : 1 + RETRY_DELAYS_MS.length;
  let lastError = 'unknown';
  for (let i = 0; i < attempts; i++) {
    const finalAttempt = i === attempts - 1;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      let res;
      try {
        res = await fetch(WRITE_API, {
          method: 'POST',
          keepalive: keepalive && finalAttempt,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ v: 1, type, payload }),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (res.status === 404 || res.status === 405) {
        adapterMissing = true;
        return legacyPost(type, payload, keepalive);
      }
      if (res.ok) return { ok: true, confirmed: true };
      if (res.status === 400 || res.status === 413) {
        // A bad request stays bad — never retry it.
        let detail = '';
        try { detail = (await res.json()).error || ''; } catch { /* non-JSON */ }
        return { ok: false, confirmed: false, error: detail || `http-${res.status}` };
      }
      lastError = `http-${res.status}`; // 5xx/502/504 → retryable
    } catch (err) {
      lastError = err && err.name === 'AbortError' ? 'timeout' : 'network';
    }
    if (!finalAttempt) await sleep(jitter(RETRY_DELAYS_MS[i]));
  }
  return { ok: false, confirmed: false, error: lastError };
}

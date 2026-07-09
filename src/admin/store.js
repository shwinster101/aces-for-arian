import { useEffect, useRef, useState } from 'react';
import { SHEET_WRITE_URL } from '../lib/sheet';
import { buildDraw, setResult, clearResult, swapUnseeded, renameSlot, bracketMatchRows } from '../lib/draw';
import { SCHEDULE_DEFAULTS } from '../lib/schedule';

// Shared-secret gate for the write-back endpoint. Must match the token checked
// in apps-script/ops-write-back.js. It ships in the public admin bundle, so it
// only deters drive-by writes — not a determined actor. Rotate by changing it
// here AND in the Apps Script, then redeploying the script (New version).
const WRITE_TOKEN = 'a4a-ea5316b9f5d5b04e49115a20';

// Multi-device ops sync (check-in/payment/shirt/walk-ups) — must match
// OPSDESK_TOKEN in apps-script/ops-write-back.js. Same deterrent-only trust
// model as WRITE_TOKEN; rotate both together after the event.
const OPSDESK_TOKEN = 'a4a-desk-2f9b6a1e4c7d0358b1a9e6f2';
// Only these overlay fields leave the device — check-in/payment/shirt state,
// the day-of desk data shared across the ~5 ops devices (volunteer phones,
// HQ phone, the check-in laptop). `notes` (free-text committee commentary)
// and `regStatus`/`partner` stay local/on their own existing pipelines.
const SYNCED_OVERLAY_FIELDS = ['checkedIn', 'checkedInAt', 'paid', 'paymentMethod', 'shirt', 'shirtSize'];
// How often a device polls the shared desk state while the tab is visible.
const DESK_POLL_MS = 25000;
// A field this device edited in the last N seconds wins over an incoming
// poll result for that SAME field — protects a just-tapped toggle from
// flickering back if the poll response was already in flight when we wrote.
const LOCAL_EDIT_GUARD_MS = 45000;

// ==========================================
// OPS DATA STORE — localStorage-backed overlay
// ==========================================
// The public roster is read live from the Google Sheet (source of truth for
// "who signed up"). Day-of ops data — check-ins, payment/merch confirmation,
// seeds, draws, scores, court assignments — lives in this browser's
// localStorage as an "overlay" keyed by participant name / match id, so the
// panel works fully offline on a phone with zero setup.
//
// If SHEET_WRITE_URL is configured (see lib/sheet.js), every change is also
// fire-and-forwarded to that endpoint so it can land back in the spreadsheet —
// but local storage is always the immediate source of truth for this device.
const STORAGE_KEY = 'a4a-ops-v1';
const STORE_VERSION = 1;

const emptyOverlay = () => ({
  regStatus: '',        // 'confirmed' | 'pending' | ''  (blank = use sheet status)
  checkedIn: false,
  checkedInAt: null,    // ISO timestamp
  paid: false,
  paymentMethod: '',    // 'Venmo' | 'Zelle' | 'Cash' | 'Other' | ''
  shirt: false,
  shirtSize: '',        // 'YM' | 'YL' | 'AS' | 'AM' | 'AL' | 'AXL' | 'AXXL' | ''
  partner: '',          // ops-assigned/overridden doubles partner
  notes: '',
});

const emptyCourtBoard = () => ({
  updated: '',
  courts: Array.from({ length: 9 }, (_, i) => ({ court: i + 1, now: '', next: '' })),
});

const initialStore = () => ({
  v: STORE_VERSION,
  participants: {},                          // name -> overlay fields (see emptyOverlay)
  added: [],                                 // walk-ups: [{ id, name, classYear, events, partner }]
  seeds: { Singles: [], Doubles: [] },       // [{ id, rank, name, notes }]
  matches: [],                               // [{ id, event, round, num, a, b, court, status, score, winner }]
  courtBoard: emptyCourtBoard(),
  merch: {},                                 // inventory: key ('shirt:M' | 'sweatbands' | …) -> { order, stock }
  aces: 0,                                   // live "Ace Tracker" running total — see incrementAces/decrementAces
  announcements: [],                         // staff posts: [{ id, ts, event, category, message }] — see postAnnouncement
  brackets: { Singles: null, Doubles: null },// generated draws (src/lib/draw.js) — see generateBracket
  schedule: { ...SCHEDULE_DEFAULTS },        // courts + per-event match minutes for the "next match" estimate
  emails: [],                                // email-blast BCC list (Announce tab) — manual adds + sheet fetch
});

// Match Order rows managed by the bracket engine carry ids prefixed 'S-'
// (singles) / 'D-' (doubles); their numbers mirror the public bracket
// templates and must never be renumbered or renamed by hand.
export const isEngineRow = (m) => /^[SD]-/.test(String((m && m.id) || ''));

const publicMatchPayload = (m) => ({
  id: m.id,
  event: m.event,
  round: m.round,
  num: m.num,
  a: m.a,
  b: m.b,
  court: m.court,
  status: m.status,
  score: m.score,
  winner: m.winner,
});

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialStore();
    const parsed = JSON.parse(raw);
    return {
      ...initialStore(),
      ...parsed,
      participants: parsed.participants || {},
      added: Array.isArray(parsed.added) ? parsed.added : [],
      seeds: { Singles: parsed.seeds?.Singles || [], Doubles: parsed.seeds?.Doubles || [] },
      matches: Array.isArray(parsed.matches) ? parsed.matches : [],
      courtBoard: parsed.courtBoard?.courts ? parsed.courtBoard : emptyCourtBoard(),
      merch: parsed.merch && typeof parsed.merch === 'object' ? parsed.merch : {},
      aces: typeof parsed.aces === 'number' && parsed.aces >= 0 ? parsed.aces : 0,
      announcements: Array.isArray(parsed.announcements) ? parsed.announcements : [],
      brackets: parsed.brackets && typeof parsed.brackets === 'object'
        ? { Singles: parsed.brackets.Singles || null, Doubles: parsed.brackets.Doubles || null }
        : { Singles: null, Doubles: null },
      schedule: { ...SCHEDULE_DEFAULTS, ...(parsed.schedule && typeof parsed.schedule === 'object' ? parsed.schedule : {}) },
      emails: Array.isArray(parsed.emails) ? parsed.emails.filter(e => typeof e === 'string') : [],
    };
  } catch {
    return initialStore();
  }
}

// Lets the ops header show "last push sent H:MM" — pushToSheet notifies this
// on every dispatched POST. Module-level because pushToSheet is a module
// function; useOpsStore registers/clears the listener. "Sent" is the honest
// word: no-cors means the response is unreadable, so delivery can't be
// confirmed — only that the request left the device.
let notifyPush = null;

// Fire-and-forget POST to the optional write-back endpoint. Apps Script web
// apps don't return readable CORS responses from a browser, so this is purely
// "best effort, don't block on it" — local storage stays the real state.
export function pushToSheet(type, payload) {
  if (!SHEET_WRITE_URL) return;
  try {
    fetch(SHEET_WRITE_URL, {
      method: 'POST',
      mode: 'no-cors',
      // keepalive lets a push issued right before the tab closes (e.g. the
      // debounced seeds flush on pagehide) still be delivered. Payloads here
      // are far below the keepalive 64KB cap.
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ type, payload, ts: Date.now(), token: WRITE_TOKEN }),
    }).catch(() => {});
    if (notifyPush) notifyPush(Date.now());
  } catch { /* ignore — local store is still authoritative */ }
}

let uid = 0;
export const nextId = () => `${Date.now().toString(36)}-${(uid++).toString(36)}`;

export function useOpsStore() {
  const [store, setStore] = useState(load);
  const [lastPushAt, setLastPushAt] = useState(0);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { /* storage full/unavailable */ }
  }, [store]);

  // Surface "last push sent" to the ops header (see notifyPush above).
  useEffect(() => {
    notifyPush = setLastPushAt;
    return () => { if (notifyPush === setLastPushAt) notifyPush = null; };
  }, []);

  const getOverlay = (name) => ({ ...emptyOverlay(), ...store.participants[name] });

  // Per-name/id timestamps of this device's OWN edits, checked by the poll
  // merge below so a fresh tap can't be flickered back by an in-flight GET
  // that started before the tap landed server-side. Refs (not state) — purely
  // internal bookkeeping, shouldn't trigger a render.
  const localOverlayEditAt = useRef({});
  const localWalkupEditAt = useRef({});

  // Check-in/payment/shirt fields (SYNCED_OVERLAY_FIELDS) are pushed to the
  // private OpsDesk tab so every ops device sees the same day-of desk state
  // (see writeOpsDesk_ in apps-script/ops-write-back.js — per-field upsert,
  // so this device's edit can't stomp a different field another device just
  // set for the same person). `notes`/`regStatus`/`partner` stay local only.
  const setOverlay = (name, patch) => {
    setStore(s => {
      const merged = { ...emptyOverlay(), ...s.participants[name], ...patch };
      return { ...s, participants: { ...s.participants, [name]: merged } };
    });
    const synced = {};
    for (const k of SYNCED_OVERLAY_FIELDS) if (k in patch) synced[k] = patch[k];
    if (Object.keys(synced).length) {
      localOverlayEditAt.current[name] = Date.now();
      pushToSheet('opsdesk', { name, fields: synced });
    }
  };

  const addWalkUp = (entry) => {
    const row = { id: nextId(), name: '', classYear: '', events: 'Supporter', partner: '', ...entry };
    setStore(s => ({ ...s, added: [...s.added, row] }));
    localWalkupEditAt.current[row.id] = Date.now();
    pushToSheet('walkup', row);
    return row.id;
  };
  const removeWalkUp = (id) => {
    setStore(s => ({ ...s, added: s.added.filter(r => r.id !== id) }));
    localWalkupEditAt.current[id] = Date.now();
    pushToSheet('walkup-delete', { id });
  };

  // Accepts either a list or an updater `(prevList) => nextList` — mirrors
  // React's setState contract so callers never compute "next" from a closure
  // snapshot that might be stale by the time this runs (e.g. two rapid
  // "Add seed" clicks before a re-render, which would otherwise clobber
  // each other and silently drop a row).
  const setSeeds = (event, listOrUpdater) => {
    setStore(s => {
      const prev = s.seeds[event];
      const resolved = typeof listOrUpdater === 'function' ? listOrUpdater(prev) : listOrUpdater;
      return { ...s, seeds: { ...s.seeds, [event]: resolved } };
    });
  };
  // Push seed changes AFTER they commit (not inline in setSeeds): React only
  // runs the updater above when it renders, so reading its result back inside
  // setSeeds crashes whenever the eager-evaluation fast path is skipped (e.g.
  // another update is already queued in the same tap). The push is debounced
  // so typing in a seed row's name/notes field sends ONE POST after the
  // burst, not one per keystroke; a pagehide flush (+ keepalive in
  // pushToSheet) still delivers a pending push if the tab closes first.
  //
  // SANITIZE AT THE SOURCE: the full committee list (with `notes` — free-text
  // committee commentary) is the source of truth for THIS device only and
  // never leaves it. Only display-safe `name` crosses the wire — rank is
  // derived from list order server-side (see writeSeeds_ in
  // apps-script/ops-write-back.js, the actual write boundary into the
  // public, link-viewable sheet — it persists Name/Event/Rank and nothing
  // else regardless of what a payload contains). This is what keeps the
  // public "SeedBoardPublic" tab — and therefore the live site — free of
  // committee notes/votes/internal comments. See the "PUBLIC / COMMITTEE
  // DATA SEPARATION" note in lib/sheet.js for the full rationale.
  const pushedSeeds = useRef(store.seeds);
  useEffect(() => {
    const changed = Object.keys(store.seeds).filter(ev => store.seeds[ev] !== pushedSeeds.current[ev]);
    if (changed.length === 0) return undefined;
    let sent = false;
    const send = () => {
      if (sent) return;
      sent = true;
      changed.forEach(ev => pushToSheet('seeds', { event: ev, list: store.seeds[ev].map(({ name }) => ({ name })) }));
      pushedSeeds.current = { ...pushedSeeds.current, ...Object.fromEntries(changed.map(ev => [ev, store.seeds[ev]])) };
    };
    const t = setTimeout(send, 400);
    const flush = () => { clearTimeout(t); send(); };
    window.addEventListener('pagehide', flush);
    return () => { clearTimeout(t); window.removeEventListener('pagehide', flush); };
  }, [store.seeds]);

  const addMatch = (event) => {
    const id = nextId();
    // Courts are assigned dynamically day-of, so the match number IS the play
    // order — auto-assign one past the highest number in the event so new
    // matches land at the back of the queue and never collide with a
    // bracket-managed number. (See moveMatch to reorder.)
    setStore(s => {
      const n = s.matches.filter(m => m.event === event)
        .reduce((mx, m) => Math.max(mx, Number(m.num) || 0), 0) + 1;
      return { ...s, matches: [...s.matches, { id, event, round: '', num: String(n), a: '', b: '', court: '', status: 'scheduled', score: '', winner: '' }] };
    });
    return id;
  };
  const updateMatch = (id, patch) => {
    let nextForSheet = null;
    setStore(s => {
      const matches = s.matches.map(m => {
        if (m.id !== id) return m;
        const next = { ...m, ...patch };
        nextForSheet = publicMatchPayload(next);
        return next;
      });
      return { ...s, matches };
    });
    if (nextForSheet) pushToSheet('match', nextForSheet);
  };
  const removeMatch = (id) => {
    setStore(s => ({ ...s, matches: s.matches.filter(m => m.id !== id) }));
    // Mirror the delete so a match removed courtside doesn't linger as a ghost
    // on the public Live Scores board (the row is keyed by this same id).
    pushToSheet('match-delete', { id });
  };
  // Reorder the playing queue: swap play-order numbers with the neighboring
  // hand-added match. Bracket-managed rows (ids 'S-'/'D-') are excluded on
  // both ends — their numbers mirror the public bracket templates and must
  // never be renumbered here (the Draw board owns them). Pushes the rows
  // whose numbers changed so the public queue follows.
  const moveMatch = (id, dir) => {
    let pushes = [];
    setStore(s => {
      const m = s.matches.find(x => x.id === id);
      if (!m || isEngineRow(m)) return s;
      const sibs = s.matches.filter(x => x.event === m.event && !isEngineRow(x))
        .sort((x, y) => (Number(x.num) || 0) - (Number(y.num) || 0));
      const idx = sibs.findIndex(x => x.id === id);
      const j = idx + dir;
      if (j < 0 || j >= sibs.length) return s;
      const a = sibs[idx], b = sibs[j];
      const swap = new Map([[a.id, String(b.num)], [b.id, String(a.num)]]);
      pushes = [];
      const matches = s.matches.map(x => {
        if (!swap.has(x.id)) return x;
        const n = swap.get(x.id);
        const next = { ...x, num: n };
        if (String(x.num) !== n) pushes.push(publicMatchPayload(next));
        return next;
      });
      return { ...s, matches };
    });
    pushes.forEach(p => pushToSheet('match', p));
  };

  // Merch inventory (order/stock per item) — local to this device; the gear
  // locker is run from one laptop, so no sheet round-trip needed.
  const setMerch = (key, patch) => {
    setStore(s => ({ ...s, merch: { ...s.merch, [key]: { order: 0, stock: 0, ...s.merch[key], ...patch } } }));
  };

  // Live "Ace Tracker" — courtside +1/-1, pushed to the sheet as an absolute
  // total (not a delta) so a duplicate/late no-cors POST can't double-count.
  // The public Brackets tab polls ACES_CSV_URL for "$5/ace, capped at $500".
  const incrementAces = () => {
    let next;
    setStore(s => { next = (s.aces || 0) + 1; return { ...s, aces: next }; });
    pushToSheet('aces', { count: next });
  };
  const decrementAces = () => {
    let next;
    setStore(s => { next = Math.max(0, (s.aces || 0) - 1); return { ...s, aces: next }; });
    pushToSheet('aces', { count: next });
  };

  // Public announcements (weather delays, schedule changes, round calls…) —
  // discrete posts, so no debounce: each Post/Delete fires one push. The row
  // lands in the public Announcements tab via writeAnnounce_ (upsert by id),
  // which the site's banner + Home feed poll. Local list is this device's
  // posting history; the sheet is the public source of truth.
  const postAnnouncement = ({ event = 'Both', category = 'general', message = '' }) => {
    const msg = message.trim().slice(0, 400);
    if (!msg) return null;
    const row = { id: nextId(), ts: new Date().toISOString(), event, category, message: msg };
    setStore(s => ({ ...s, announcements: [row, ...s.announcements] }));
    pushToSheet('announce', row);
    return row.id;
  };
  const deleteAnnouncement = (id) => {
    setStore(s => ({ ...s, announcements: s.announcements.filter(a => a.id !== id) }));
    // Mirror the delete so a retracted post doesn't linger on the public feed.
    pushToSheet('announce-delete', { id });
  };

  // --- Generated brackets (src/lib/draw.js) --------------------------------
  // The bracket is ops-only state (seed placement + a results map); every
  // downstream slot is derived. On every change we RE-SYNC this event's flat
  // Match Order rows (ids prefixed 'S-'/'D-') from the bracket: contested R1
  // plus any next-round match whose both sides are known. Court/score entered
  // on the Scores tab survive the re-sync (merged by id). Matches that fall
  // away (e.g. a bracket cleared, or a swap that empties a slot) are deleted
  // from the sheet too, so the public board never keeps a ghost row.
  const applyBracket = (event, compute) => {
    const prefix = event === 'Doubles' ? 'D-' : 'S-';
    const pushes = [];
    setStore(s => {
      const nextBracket = compute(s);
      const prior = new Map(s.matches.map(m => [m.id, m]));
      const rows = bracketMatchRows(nextBracket).map(r => {
        const p = prior.get(r.id);
        // Court/score entered on the Scores tab survive the re-sync; a
        // Scores-set 'live' also survives unless the bracket says final.
        const status = r.status === 'final' ? 'final' : (p && p.status === 'live' ? 'live' : r.status);
        return {
          id: r.id, event, round: r.round, num: r.num, a: r.a, b: r.b,
          court: p ? p.court : '', score: p ? p.score : '', status, winner: r.winner,
        };
      });
      const newIds = new Set(rows.map(r => r.id));
      const kept = s.matches.filter(m => !String(m.id).startsWith(prefix));
      for (const r of rows) pushes.push({ type: 'match', payload: publicMatchPayload(r) });
      for (const m of s.matches) {
        if (String(m.id).startsWith(prefix) && !newIds.has(m.id)) pushes.push({ type: 'match-delete', payload: { id: m.id } });
      }
      return { ...s, brackets: { ...s.brackets, [event]: nextBracket }, matches: [...kept, ...rows] };
    });
    pushes.forEach(p => pushToSheet(p.type, p.payload));
  };
  // Auto-populate the draw from the current seed list (nearest power of 2,
  // byes to the top seeds) and sync R1 into Match Order. labelFor formats the
  // display name ("First L. 'YY"); prior name overrides are preserved so a
  // Regenerate keeps last-minute name fixes.
  const generateBracket = (event, labelFor) =>
    applyBracket(event, s => buildDraw(event, s.seeds[event], { labelFor, overrides: s.brackets[event] ? s.brackets[event].overrides : {} }));
  // Record a match result -> winner advances, loser routes to its backdraw
  // slot. Tapping the SAME side again un-marks it (correction); either way,
  // downstream results are invalidated by the engine so a changed outcome
  // can't leave stale advancement behind.
  const markBracketWinner = (event, matchId, side) =>
    applyBracket(event, s => {
      const b = s.brackets[event];
      if (!b) return null;
      return b.results[matchId] === side ? clearResult(b, matchId) : setResult(b, matchId, side);
    });
  // Drag-balance: swap two unseeded R1 entrants (no-op unless both draggable).
  const swapBracketSlots = (event, i, j) =>
    applyBracket(event, s => (s.brackets[event] ? swapUnseeded(s.brackets[event], i, j) : null));
  // Override an individual entrant's display name (profanity/typo/nickname).
  // Propagates through advancement + the Match Order sync (so the public
  // board never shows the bad name) and survives a Regenerate.
  const renameBracketSlot = (event, idx, value) =>
    applyBracket(event, s => (s.brackets[event] ? renameSlot(s.brackets[event], idx, value) : null));
  // Tear the generated draw down (and its synced Match Order rows).
  const clearBracket = (event) => applyBracket(event, () => null);

  // Push ONLY the display-safe registration flag (Verified/Pending) for a
  // sheet-sourced registrant, so tapping the "Confirmed" chip flips the public
  // board's badge. Intentionally separate from setOverlay (which stays local):
  // payment/check-in/shirt data must never cross the wire — see the comment on
  // setOverlay and [[pii-policy]]. Lands in the OpsStatus tab via writeStatus_.
  const pushPublicStatus = (name, status) => pushToSheet('status', { name, status });

  // Staff-set scholarship meter — writes raised/goal into the public Config tab
  // (see writeConfig_ in apps-script/ops-write-back.js) so the admin can bump the
  // public total from the console instead of hand-editing the sheet. Stateless:
  // the live Config tab is the source of truth, read back fresh in the section.
  const pushConfig = (patch) => pushToSheet('config', patch);

  // Schedule inputs for the "when's my next match" estimate. Kept locally for
  // instant ops display AND pushed to the public Config tab so the public
  // estimate uses the same numbers (mirrors the scholarship-meter pattern —
  // persists after the Apps Script redeploy; defaults apply until then).
  const setSchedule = (patch) => {
    const clean = {};
    for (const k of ['courts', 'doublesMin', 'singlesMin', 'warmupMin']) {
      if (patch[k] === '' || patch[k] === undefined) continue;
      const n = parseInt(patch[k], 10);
      if (!isNaN(n) && n >= 0) clean[k] = n;
    }
    setStore(s => ({ ...s, schedule: { ...s.schedule, ...clean } }));
    if (Object.keys(clean).length) pushConfig(clean);
  };

  // Email-blast BCC list (Announce tab). Local to this device — emails are
  // PII and never pushed to the sheet or the public endpoint from here; the
  // optional "fetch from sheet" path is a direct Apps Script read the section
  // performs itself (mode=emails), then merges through addEmails.
  const addEmails = (raw) => {
    const parts = String(raw || '').split(/[\s,;]+/).map(e => e.trim()).filter(Boolean);
    const valid = parts.filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    // Dedupe against the current snapshot so we can report how many landed
    // (case-insensitive; the stored casing of an existing address wins).
    const seen = new Set(store.emails.map(e => e.toLowerCase()));
    const fresh = [];
    for (const e of valid) {
      const k = e.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k); fresh.push(e);
    }
    if (fresh.length) setStore(s => ({ ...s, emails: [...s.emails, ...fresh] }));
    return { parsed: parts.length, valid: valid.length, added: fresh.length };
  };
  const removeEmail = (email) =>
    setStore(s => ({ ...s, emails: s.emails.filter(e => e.toLowerCase() !== String(email).toLowerCase()) }));
  const clearEmails = () => setStore(s => ({ ...s, emails: [] }));

  // --- Multi-device desk sync (GET mode=opsdesk, own token) ----------------
  // Pulls the shared check-in/payment/shirt/walk-up state written by
  // writeOpsDesk_/writeWalkup_ and merges it in. A name/id this device edited
  // within LOCAL_EDIT_GUARD_MS is left alone for this tick — protects a
  // just-tapped toggle from being flickered back by a GET that was already in
  // flight when the tap landed server-side; the next poll (after the guard
  // window) picks up whatever's on the sheet, including this device's own
  // edit once it's landed. A failed/blocked fetch is a silent no-op — every
  // device already works fully offline against localStorage.
  const [deskSync, setDeskSync] = useState({ at: 0, ok: false });
  const pullDesk = async () => {
    if (!SHEET_WRITE_URL) return;
    try {
      const res = await fetch(`${SHEET_WRITE_URL}?mode=opsdesk&token=${OPSDESK_TOKEN}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const { desk, walkups } = await res.json();
      const now = Date.now();
      setStore(s => {
        const participants = { ...s.participants };
        for (const row of desk || []) {
          const editedAt = localOverlayEditAt.current[row.name] || 0;
          if (now - editedAt < LOCAL_EDIT_GUARD_MS) continue; // this device's own recent edit wins
          const prior = participants[row.name] || emptyOverlay();
          participants[row.name] = {
            ...emptyOverlay(), ...prior,
            checkedIn: row.checkedIn, checkedInAt: row.checkedInAt || null,
            paid: row.paid, paymentMethod: row.paymentMethod || '',
            shirt: row.shirt, shirtSize: row.shirtSize || prior.shirtSize || '',
          };
        }
        const recentIds = new Set(
          Object.entries(localWalkupEditAt.current).filter(([, t]) => now - t < LOCAL_EDIT_GUARD_MS).map(([id]) => id)
        );
        const serverAdded = (walkups || [])
          .filter(w => !recentIds.has(w.id))
          .map(w => ({ id: w.id, name: w.name, classYear: w.classYear, events: w.events, partner: w.partner }));
        const localRecent = s.added.filter(w => recentIds.has(w.id));
        return { ...s, participants, added: [...serverAdded, ...localRecent] };
      });
      setDeskSync({ at: Date.now(), ok: true });
    } catch {
      setDeskSync(d => ({ ...d, ok: false }));
    }
  };

  // Poll while the tab is visible (a backgrounded phone shouldn't burn
  // battery/data polling a screen nobody's looking at); pull once immediately
  // and again on every return to the foreground.
  useEffect(() => {
    let timer = null;
    const tick = () => { pullDesk(); timer = setTimeout(tick, DESK_POLL_MS); };
    const onVisible = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); tick(); } };
    if (document.visibilityState === 'visible') tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  const exportJSON = () => JSON.stringify(store, null, 2);

  // Wipe everything this device has stored (check-ins, payments, walk-ups,
  // seeds, matches, merch) — for post-tournament cleanup. Irreversible.
  // DEVICE-LOCAL ONLY: mark the fresh (empty) seed lists as already-pushed
  // BEFORE committing, so the seeds effect above doesn't see the reset as an
  // edit and blank the public SeedBoardPublic tab — the confirm dialog
  // promises the sheet is unaffected.
  const clearOps = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    const fresh = initialStore();
    pushedSeeds.current = fresh.seeds;
    setStore(fresh);
  };

  return {
    store,
    lastPushAt,
    deskSync, pullDesk,
    getOverlay, setOverlay,
    addWalkUp, removeWalkUp,
    setSeeds,
    addMatch, updateMatch, removeMatch, moveMatch,
    setMerch,
    incrementAces, decrementAces,
    postAnnouncement, deleteAnnouncement,
    generateBracket, markBracketWinner, swapBracketSlots, renameBracketSlot, clearBracket,
    pushPublicStatus, pushConfig, setSchedule,
    addEmails, removeEmail, clearEmails,
    exportJSON, clearOps,
  };
}

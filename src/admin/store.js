import { useEffect, useRef, useState } from 'react';
import { SHEET_WRITE_URL } from '../lib/sheet';

// Shared-secret gate for the write-back endpoint. Must match the token checked
// in apps-script/ops-write-back.js. It ships in the public admin bundle, so it
// only deters drive-by writes — not a determined actor. Rotate by changing it
// here AND in the Apps Script, then redeploying the script (New version).
const WRITE_TOKEN = 'a4a-ea5316b9f5d5b04e49115a20';

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
});

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

  // Check-in / payment / shirt / walk-up overlay stays LOCAL to this device.
  // We deliberately do NOT push it: the Apps Script ignores those types anyway
  // (writing them into the raw Form-responses tab by name-match is fragile —
  // see that file's bottom note), and not sending them keeps payment/check-in
  // data off the wire. A shared multi-device ops state would need its own
  // private "Ops" tab/backend with explicit columns, not this overlay.
  const setOverlay = (name, patch) => {
    setStore(s => {
      const merged = { ...emptyOverlay(), ...s.participants[name], ...patch };
      return { ...s, participants: { ...s.participants, [name]: merged } };
    });
  };

  const addWalkUp = (entry) => {
    const row = { id: nextId(), name: '', classYear: '', events: 'Supporter', partner: '', ...entry };
    setStore(s => ({ ...s, added: [...s.added, row] }));
    return row.id;
  };
  const removeWalkUp = (id) => setStore(s => ({ ...s, added: s.added.filter(r => r.id !== id) }));

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
    // order — auto-assign the next slot so new matches land at the back of the
    // queue. (See moveMatch to reorder.)
    setStore(s => {
      const n = s.matches.filter(m => m.event === event).length + 1;
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
  // Reorder the playing queue: move a match up/down within its event and
  // renumber the event 1..N to the new order. The match number = play order, so
  // bumping someone up lets a player who must leave early go sooner. Pushes
  // every row whose number actually changed so the public queue follows.
  const moveMatch = (id, dir) => {
    let pushes = [];
    setStore(s => {
      const m = s.matches.find(x => x.id === id);
      if (!m) return s;
      const sibs = s.matches.filter(x => x.event === m.event)
        .sort((x, y) => (Number(x.num) || 0) - (Number(y.num) || 0));
      const idx = sibs.findIndex(x => x.id === id);
      const j = idx + dir;
      if (j < 0 || j >= sibs.length) return s;
      [sibs[idx], sibs[j]] = [sibs[j], sibs[idx]];
      const newNum = new Map(sibs.map((x, i) => [x.id, String(i + 1)]));
      pushes = [];
      const matches = s.matches.map(x => {
        if (!newNum.has(x.id)) return x;
        const n = newNum.get(x.id);
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
    getOverlay, setOverlay,
    addWalkUp, removeWalkUp,
    setSeeds,
    addMatch, updateMatch, removeMatch, moveMatch,
    setMerch,
    incrementAces, decrementAces,
    postAnnouncement, deleteAnnouncement,
    pushPublicStatus, pushConfig,
    exportJSON, clearOps,
  };
}

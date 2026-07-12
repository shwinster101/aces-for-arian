import { useEffect, useRef, useState } from 'react';
import { SHEET_WRITE_URL, MATCHES_CSV_URL, parseCSV, mapMatches } from '../lib/sheet';
import { buildDraw, setResult, clearResult, swapUnseeded, renameSlot, bracketMatchRows, toggleWithdrawn } from '../lib/draw';
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
// Match rows get a LONGER guard: the score sync reads the public Matches CSV
// through the edge cache (~30s edge + 20s browser), so a 45s guard could let
// a device re-adopt its OWN pre-edit row from a stale cache. 90s clears the
// worst-case staleness with room to spare.
const MATCH_SYNC_GUARD_MS = 90000;

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

// One physical cash box → one device. float/closing stay raw strings (they
// back number inputs); cashMath derives all the numbers.
const emptyCash = () => ({ float: '', volunteer: '', closing: '', log: [] });
// Pure drawer math — shared by CashDrawer (full view) and the Command Center
// ("$ collected"). Expected = starting float + net cash in; variance compares
// the counted close-out; lowBills warns when change given nears the float.
export function cashMath(cash = {}) {
  const float = parseFloat(cash.float) || 0;
  const log = cash.log || [];
  const cashIn = log.reduce((t, r) => t + (Number(r.amount) || 0), 0);
  const changeGiven = log.reduce((t, r) => t + (Number(r.change) || 0), 0);
  const expected = float + cashIn;
  const closing = cash.closing === '' || cash.closing == null ? NaN : parseFloat(cash.closing);
  const variance = isNaN(closing) ? null : closing - expected;
  const lowBills = float > 0 && changeGiven >= 0.8 * float;
  return { float, cashIn, changeGiven, expected, variance, lowBills };
}
// Check-in script read to every player (warm-up spot, where to report
// scores, where next matches show) — HQ fills these at the desk each morning.
const emptyDeskScript = () => ({ warmup: '', scores: '', next: 'Website + court board' });

// Day-of logistics — the buy list (consumables) + merch/trophy order
// confirmations. LOCAL-only committee prep data (like cash/deskScript). Seeded
// with the standard checklist so it's ready every year; edit quantities/vendors
// on the tab. Stable ids on the seed rows so a re-seed can't duplicate them.
// The durable next-year reference is docs/day-of-logistics.md (this mirrors it).
const defaultLogistics = () => ({
  buyList: [
    { id: 'buy-water', item: 'Water (cases)', target: '5', got: false, note: '' },
    { id: 'buy-gatorade', item: 'Gatorade (cases)', target: '3', got: false, note: '' },
    { id: 'buy-fruit', item: 'Fruit — bananas / oranges', target: '4 dozen', got: false, note: '' },
    { id: 'buy-savory', item: 'Savory snack — chips / pretzels', target: '8 bags', got: false, note: '' },
    { id: 'buy-fruitsnacks', item: 'Fruit snacks', target: '2 boxes', got: false, note: '' },
    { id: 'buy-paper', item: 'Paper towels', target: '3 rolls', got: false, note: '' },
    { id: 'buy-napkins', item: 'Napkins', target: '1 pack', got: false, note: '' },
    { id: 'buy-ice', item: 'Ice + coolers', target: '3 bags', got: false, note: '' },
    { id: 'buy-sundries', item: 'Cups / trash bags', target: '', got: false, note: '' },
  ],
  orders: [
    { id: 'ord-tees', item: 'Player tees', vendor: '', ordered: false, confirmed: false, cost: '', note: 'Size counts live on the Merch tab' },
    { id: 'ord-trophies-d', item: 'Trophies — doubles top 3', vendor: '', ordered: false, confirmed: false, cost: '', note: '' },
    { id: 'ord-trophies-s', item: 'Trophies — singles top 3', vendor: '', ordered: false, confirmed: false, cost: '', note: '' },
    { id: 'ord-hats', item: 'Extra gear — hats', vendor: '', ordered: false, confirmed: false, cost: '', note: '' },
    { id: 'ord-bands', item: 'Extra gear — sweatbands', vendor: '', ordered: false, confirmed: false, cost: '', note: '' },
    { id: 'ord-towels', item: 'Extra gear — court towels', vendor: '', ordered: false, confirmed: false, cost: '', note: '' },
  ],
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
  cash: emptyCash(),                         // day-of cash drawer ledger — LOCAL to the drawer device (see setCash)
  deskScript: emptyDeskScript(),             // pinned check-in script lines volunteers read out
  logistics: defaultLogistics(),             // buy list + merch/trophy order confirmations — LOCAL (see setLogItem)
  regPay: {},                                // normName -> intended payment method from the registration form (pullDesk)
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

// A persisted bracket generated by an OLDER build (or otherwise corrupt) can
// have a shape the current render can't map over — which would crash the whole
// ops draw. Validate it by actually running the row builder (the same resolve()
// the render uses); if it throws, drop the bracket to null so it regenerates
// cleanly instead of black-screening. A healthy bracket passes through untouched.
function safeBracket(b) {
  if (!b || typeof b !== 'object' || !Array.isArray(b.r1slots) || !b.r1slots.length) return null;
  try { bracketMatchRows(b); return b; } catch { return null; }
}

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
      seeds: { Singles: Array.isArray(parsed.seeds?.Singles) ? parsed.seeds.Singles : [], Doubles: Array.isArray(parsed.seeds?.Doubles) ? parsed.seeds.Doubles : [] },
      matches: Array.isArray(parsed.matches) ? parsed.matches : [],
      courtBoard: parsed.courtBoard?.courts ? parsed.courtBoard : emptyCourtBoard(),
      merch: parsed.merch && typeof parsed.merch === 'object' ? parsed.merch : {},
      aces: typeof parsed.aces === 'number' && parsed.aces >= 0 ? parsed.aces : 0,
      announcements: Array.isArray(parsed.announcements) ? parsed.announcements : [],
      brackets: parsed.brackets && typeof parsed.brackets === 'object'
        ? { Singles: safeBracket(parsed.brackets.Singles), Doubles: safeBracket(parsed.brackets.Doubles) }
        : { Singles: null, Doubles: null },
      schedule: { ...SCHEDULE_DEFAULTS, ...(parsed.schedule && typeof parsed.schedule === 'object' ? parsed.schedule : {}) },
      emails: Array.isArray(parsed.emails) ? parsed.emails.filter(e => typeof e === 'string') : [],
      cash: parsed.cash && typeof parsed.cash === 'object'
        ? { ...emptyCash(), ...parsed.cash, log: Array.isArray(parsed.cash.log) ? parsed.cash.log : [] }
        : emptyCash(),
      deskScript: { ...emptyDeskScript(), ...(parsed.deskScript && typeof parsed.deskScript === 'object' ? parsed.deskScript : {}) },
      // Missing slice (pre-logistics store) → seed the standard checklist; an
      // edited array (even emptied on purpose) is preserved as-is.
      logistics: parsed.logistics && typeof parsed.logistics === 'object'
        ? {
            buyList: Array.isArray(parsed.logistics.buyList) ? parsed.logistics.buyList : defaultLogistics().buyList,
            orders: Array.isArray(parsed.logistics.orders) ? parsed.logistics.orders : defaultLogistics().orders,
          }
        : defaultLogistics(),
      regPay: parsed.regPay && typeof parsed.regPay === 'object' ? parsed.regPay : {},
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
  // Per-match "saved" receipts: id -> ts of the last match POST that actually
  // left this device (debounced flush, explicit Save flush, or the bracket
  // re-sync). Fire-and-forget no-cors, so this is "sent", same honesty caveat
  // as lastPushAt — but per-row, so the Scores tab can show "Saved ✓ H:MM" on
  // the exact match a volunteer just edited instead of only the global header.
  const [matchSavedAt, setMatchSavedAt] = useState({});
  const stampSaved = (ids) => {
    const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
    if (!list.length) return;
    const now = Date.now();
    setMatchSavedAt(m => { const next = { ...m }; for (const id of list) next[id] = now; return next; });
  };

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
  // Per-event timestamp of this device's own draw edits (generate/mark/seed…),
  // so an in-flight poll can't flicker a just-made change back. Same guard the
  // desk overlay uses.
  const localDrawEditAt = useRef({});
  // Per-match-id timestamp of this device's own score/court/status edits —
  // guards the cross-device score merge in pullDesk (MATCH_SYNC_GUARD_MS).
  const localMatchEditAt = useRef({});

  // The generated draw (seed order + bracket) is shared across ops devices via
  // the private OpsDraw tab so a phone/laptop opening /admin sees HQ's draw
  // instead of an empty board. Committee `notes` are stripped here — only the
  // display-safe seed order (already public on SeedBoardPublic) crosses the
  // wire, alongside the bracket engine state (names/results/overrides, all
  // display-safe). A device only ever pushes on a real user action, so a
  // fresh (pull-only) device can never clobber HQ's draw with empty state.
  const seedsForSync = (list) => (list || []).map(r => ({ id: r.id, rank: r.rank, name: r.name }));
  const pushDraw = (event, seeds, bracket) => {
    localDrawEditAt.current[event] = Date.now();
    pushToSheet('opsdraw', { event, seeds: seedsForSync(seeds), bracket: bracket || null });
  };

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
      changed.forEach(ev => {
        pushToSheet('seeds', { event: ev, list: store.seeds[ev].map(({ name }) => ({ name })) });
        // Mirror the seed order to the private ops-draw sync too, so a second
        // device's Seed Order card fills in (the public 'seeds' push above is
        // Name/Event/Rank only and feeds the PUBLIC board, not the ops console).
        pushDraw(ev, store.seeds[ev], store.brackets[ev]);
      });
      pushedSeeds.current = { ...pushedSeeds.current, ...Object.fromEntries(changed.map(ev => [ev, store.seeds[ev]])) };
    };
    const t = setTimeout(send, 400);
    const flush = () => { clearTimeout(t); send(); };
    window.addEventListener('pagehide', flush);
    return () => { clearTimeout(t); window.removeEventListener('pagehide', flush); };
    // Intentionally debounced on seed changes ONLY; it reads the current
    // brackets/pushDraw at run time, which is the state as of this seed edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // Debounced per-match sheet pushes: typing a score/court/name fires one
  // POST per pause (trailing ~400ms), not one per keystroke — each POST is a
  // full read-modify-write server-side, so bursts are what race. Local state
  // updates immediately; the latest payload per id wins; pagehide flushes
  // anything pending (pushToSheet is keepalive).
  const pendingMatchPush = useRef({}); // id -> { timer, payload }
  const flushMatchPush = (id) => {
    const p = pendingMatchPush.current[id];
    if (!p) return;
    clearTimeout(p.timer);
    delete pendingMatchPush.current[id];
    pushToSheet('match', p.payload);
    stampSaved(id);
  };
  // Immediate flush for the Scores-tab "Save result" button — sends whatever's
  // pending for this row right now (no 400ms wait) and stamps the saved time.
  // A no-op stamp if nothing was pending keeps the button reassuring even when
  // the debounce already fired.
  const flushMatch = (id) => {
    if (pendingMatchPush.current[id]) flushMatchPush(id);
    else stampSaved(id);
  };
  useEffect(() => {
    const flushAll = () => Object.keys(pendingMatchPush.current).forEach(flushMatchPush);
    window.addEventListener('pagehide', flushAll);
    return () => window.removeEventListener('pagehide', flushAll);
    // Mount-only pagehide safety net; flushMatchPush reads live refs at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const updateMatch = (id, patch) => {
    localMatchEditAt.current[id] = Date.now();
    setStore(s => ({ ...s, matches: s.matches.map(m => (m.id === id ? { ...m, ...patch } : m)) }));
    // Build the sheet payload OUTSIDE the updater: React only invokes updater
    // functions synchronously on its eager first-update path, so a side-effect
    // capture inside setStore silently drops rapid successive edits (verified:
    // typing "6-4" pushed just "6"). The closure `store` is the last committed
    // snapshot; layering any pending payload + this patch over it covers
    // same-tick edit runs (payload keys mirror match row keys).
    const cur = store.matches.find(m => m.id === id);
    if (!cur) return;
    const prior = pendingMatchPush.current[id];
    if (prior) clearTimeout(prior.timer);
    pendingMatchPush.current[id] = {
      payload: publicMatchPayload({ ...cur, ...(prior ? prior.payload : null), ...patch }),
      timer: setTimeout(() => flushMatchPush(id), 400),
    };
  };
  const removeMatch = (id) => {
    // Cancel any debounced edit push for this id — if it fired after the
    // delete below, it would resurrect the row on the sheet.
    const p = pendingMatchPush.current[id];
    if (p) { clearTimeout(p.timer); delete pendingMatchPush.current[id]; }
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
    // Everything is computed from the closure snapshot OUTSIDE setStore —
    // capturing values out of an updater is unreliable (React defers updaters
    // off its eager first-update path; see updateMatch), and a missed capture
    // here would push an EMPTY list and wipe the event's rows off the sheet.
    // Each call is one user action (generate/winner/swap/rename/clear), so
    // the last committed snapshot is the current one.
    const nextBracket = compute(store);
    const prior = new Map(store.matches.map(m => [m.id, m]));
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
    setStore(s => {
      const kept = s.matches.filter(m => !String(m.id).startsWith(prefix));
      return { ...s, brackets: { ...s.brackets, [event]: nextBracket }, matches: [...kept, ...rows] };
    });
    // The bulk replace below already carries every engine row's current local
    // state, so any pending debounced edit for these ids is superseded —
    // cancel it (a late fire would re-push pre-replace fields over the row).
    Object.keys(pendingMatchPush.current).forEach(pid => {
      if (pid.startsWith(prefix)) {
        clearTimeout(pendingMatchPush.current[pid].timer);
        delete pendingMatchPush.current[pid];
      }
    });
    // ONE atomic bulk write replaces this event's engine rows on the sheet
    // (replaceEngineMatches_ drops old prefix rows and appends these — the
    // old per-row match + match-delete burst could interleave server-side and
    // clobber itself; hand-added rows are untouched by replace semantics).
    pushToSheet('matches-replace', { event, prefix, list: rows.map(publicMatchPayload) });
    // Stamp each engine row saved so a winner marked here (or on the unified
    // Scores tab) shows "Saved ✓" on the row, same as a debounced score push.
    stampSaved(rows.map(r => r.id));
    // Share the full draw (seed order + bracket state, incl. winner marks) so
    // every ops device converges on it. A null bracket (clear) syncs too.
    pushDraw(event, store.seeds[event], nextBracket);
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
  // No-show / dropout: toggle an entrant's withdrawal. Every match they'd
  // reach walks over to the opponent (including their comeback-draw drop
  // slot); already-played results stand; toggling again fully restores them.
  const toggleBracketWithdrawal = (event, key) =>
    applyBracket(event, s => toggleWithdrawn(s.brackets[event], key));
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
  // Re-derive every slot's display label from the CURRENT roster (labelFor)
  // without touching seeds, results, or manual name overrides — the fix when
  // a class year or name was missing at generate time (roster hadn't loaded,
  // nickname-only seed entry). Unlike Regenerate, every posted result stays.
  // Hard no-op without a local bracket: falling through to applyBracket(null)
  // would CLEAR the event's rows on the sheet from a device that simply
  // hasn't pulled the draw yet.
  const relabelBracket = (event, labelFor) => {
    if (!store.brackets[event]) return;
    applyBracket(event, s => {
      const b = s.brackets[event];
      if (!b) return null;
      return {
        ...b,
        r1slots: b.r1slots.map(sl => {
          if (!sl || !sl.raw) return sl;
          const def = labelFor(sl.raw);
          return { ...sl, def, name: (b.overrides || {})[sl.key] || def };
        }),
      };
    });
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

  // Schedule inputs for the "when's my next match" estimate. Kept locally for
  // instant ops display AND pushed to the public Config tab so the public
  // estimate uses the same numbers (mirrors the scholarship-meter pattern —
  // persists after the Apps Script redeploy; defaults apply until then).
  const setSchedule = (patch) => {
    const clean = {};
    for (const k of ['courts', 'doublesMin', 'singlesMin', 'r1Min', 'qfMin', 'warmupMin', 'finalsMin']) {
      if (patch[k] === '' || patch[k] === undefined) continue;
      const n = parseInt(patch[k], 10);
      if (!isNaN(n) && n >= 0) clean[k] = n;
    }
    setStore(s => ({ ...s, schedule: { ...s.schedule, ...clean } }));
    if (Object.keys(clean).length) pushConfig(clean);
  };

  // --- Cash drawer (LOCAL ONLY — deliberate) -------------------------------
  // There is ONE physical cash box, so its ledger lives on the device sitting
  // next to it. Syncing it would let two phones "run" the same drawer and
  // drift the count — the exact failure cash controls exist to prevent. Cash
  // entry fees land here automatically from the Check-ins collect flow; merch
  // cash and refunds go through the drawer's quick-adjust row.
  const setCash = (patch) => setStore(s => ({ ...s, cash: { ...s.cash, ...patch } }));
  const recordCash = (entry) => {
    const row = { id: nextId(), ts: new Date().toISOString(), name: '', kind: 'entry', amount: 0, tendered: 0, change: 0, ...entry };
    setStore(s => ({ ...s, cash: { ...s.cash, log: [...s.cash.log, row] } }));
    return row.id;
  };
  const removeCashEntry = (id) =>
    setStore(s => ({ ...s, cash: { ...s.cash, log: s.cash.log.filter(r => r.id !== id) } }));

  // Pinned check-in script (warm-up spot, score reporting, next matches) —
  // HQ types it once at setup; volunteers read it on every check-in. Local
  // like the drawer: it's desk signage, not shared state.
  const setDeskScript = (patch) => setStore(s => ({ ...s, deskScript: { ...s.deskScript, ...patch } }));

  // Day-of logistics — buy list + merch/trophy order confirmations. LOCAL-only
  // committee prep (like the drawer/script). `kind` is 'buyList' | 'orders'.
  const setLogItem = (kind, id, patch) =>
    setStore(s => ({ ...s, logistics: { ...s.logistics, [kind]: s.logistics[kind].map(r => (r.id === id ? { ...r, ...patch } : r)) } }));
  const addLogItem = (kind) => {
    const row = kind === 'orders'
      ? { id: nextId(), item: '', vendor: '', ordered: false, confirmed: false, cost: '', note: '' }
      : { id: nextId(), item: '', target: '', got: false, note: '' };
    setStore(s => ({ ...s, logistics: { ...s.logistics, [kind]: [...s.logistics[kind], row] } }));
    return row.id;
  };
  const removeLogItem = (kind, id) =>
    setStore(s => ({ ...s, logistics: { ...s.logistics, [kind]: s.logistics[kind].filter(r => r.id !== id) } }));
  // Restore the seeded checklist (for the "reset to standard list" button).
  const resetLogistics = () => setStore(s => ({ ...s, logistics: defaultLogistics() }));

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

  // Cross-device SCORE sync — reads the public Matches tab (the same rows
  // every device already pushes) back into local rows, so a score typed on
  // one volunteer phone shows on every ops device within a poll + cache
  // window (~25-60s). Merge rules are deliberately MONOTONE so a stale edge
  // cache can only lag, never regress state:
  //   • score/court: adopt a non-empty sheet value that differs — a cleared
  //     field never blanks out another device (corrections propagate by
  //     overwriting, which is how the desk actually fixes scores).
  //   • status: bracket-managed rows only upgrade scheduled→live here —
  //     final/winner stays the bracket sync's call (opsdraw is authoritative,
  //     and un-marking a winner must not fight a stale CSV). Hand-added rows
  //     upgrade scheduled→live→final and adopt a non-empty winner.
  //   • rows this device edited within MATCH_SYNC_GUARD_MS are left alone.
  // Pure local adoption — never pushes — so devices can't ping-pong.
  const pullScores = async (now) => {
    try {
      const res = await fetch(MATCHES_CSV_URL);
      if (!res.ok) return;
      const sheetRows = mapMatches(parseCSV(await res.text()));
      if (!sheetRows.length) return;
      const byId = new Map(sheetRows.filter(r => r.id).map(r => [r.id, r]));
      const RANK = { scheduled: 0, live: 1, final: 2 };
      setStore(s => {
        let changed = false;
        const matches = s.matches.map(m => {
          const r = byId.get(m.id);
          if (!r) return m;
          if (now - (localMatchEditAt.current[m.id] || 0) < MATCH_SYNC_GUARD_MS) return m;
          const next = { ...m };
          if (r.score && r.score !== m.score) next.score = r.score;
          if (r.court && String(r.court) !== String(m.court)) next.court = String(r.court);
          if (isEngineRow(m)) {
            if (r.status === 'live' && m.status === 'scheduled') next.status = 'live';
          } else {
            if ((RANK[r.status] || 0) > (RANK[m.status] || 0)) next.status = r.status;
            if ((r.winner === 'a' || r.winner === 'b') && r.winner !== m.winner) next.winner = r.winner;
          }
          if (next.score === m.score && next.court === m.court && next.status === m.status && next.winner === m.winner) return m;
          changed = true;
          return next;
        });
        return changed ? { ...s, matches } : s;
      });
    } catch { /* cache/network hiccup — the next poll converges */ }
  };

  const pullDesk = async () => {
    if (!SHEET_WRITE_URL) return;
    pullScores(Date.now()); // independent read — runs even if the opsdesk GET fails
    try {
      const res = await fetch(`${SHEET_WRITE_URL}?mode=opsdesk&token=${OPSDESK_TOKEN}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const { desk, walkups, draw, reg } = await res.json();
      const now = Date.now();
      // Intended payment method straight off the registration form (raw-sheet
      // column, served ONLY through this token-gated ops read — the public
      // path strips payment columns). Read-only reference data: the server
      // list always wins wholesale, no local-edit guard needed. Absent until
      // the Apps Script carrying rosterPayIntent_ is deployed — harmless.
      if (Array.isArray(reg) && reg.length) {
        const regPay = {};
        for (const r of reg) {
          const k = String((r && r.name) || '').trim().toLowerCase().replace(/\s+/g, ' ');
          if (k) regPay[k] = String(r.pay || '').trim();
        }
        setStore(s => ({ ...s, regPay }));
      }
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
      // Hydrate the shared draw (seed order + bracket) for any event this
      // device hasn't edited within the guard window — this is what makes a
      // fresh device show HQ's draw. Suppress the seeds effect from re-pushing
      // the hydrated list (update pushedSeeds.current), and re-derive the flat
      // Match Order rows locally WITHOUT pushing (no churn).
      if (Array.isArray(draw) && draw.length) {
        setStore(s => {
          let seeds = s.seeds, brackets = s.brackets, matches = s.matches;
          for (const d of draw) {
            const ev = d.event;
            if (ev !== 'Singles' && ev !== 'Doubles') continue;
            if (now - (localDrawEditAt.current[ev] || 0) < LOCAL_EDIT_GUARD_MS) continue;
            const serverSeeds = (Array.isArray(d.seeds) ? d.seeds : [])
              .map(r => ({ id: r.id || nextId(), rank: r.rank, name: r.name, notes: '' }));
            const serverBracket = d.bracket || null;
            pushedSeeds.current = { ...pushedSeeds.current, [ev]: serverSeeds }; // don't re-push a hydrated list
            seeds = { ...seeds, [ev]: serverSeeds };
            brackets = { ...brackets, [ev]: serverBracket };
            const prefix = ev === 'Doubles' ? 'D-' : 'S-';
            const prior = new Map(matches.map(m => [m.id, m]));
            const rows = serverBracket ? bracketMatchRows(serverBracket).map(r => {
              const p = prior.get(r.id);
              const status = r.status === 'final' ? 'final' : (p && p.status === 'live' ? 'live' : r.status);
              return { id: r.id, event: ev, round: r.round, num: r.num, a: r.a, b: r.b,
                court: p ? p.court : '', score: p ? p.score : '', status, winner: r.winner };
            }) : [];
            matches = [...matches.filter(m => !String(m.id).startsWith(prefix)), ...rows];
          }
          return { ...s, seeds, brackets, matches };
        });
      }
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
    // Mount-only poll loop; pullDesk reads live refs/state at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    matchSavedAt, flushMatch,
    deskSync, pullDesk,
    getOverlay, setOverlay,
    addWalkUp, removeWalkUp,
    setSeeds,
    addMatch, updateMatch, removeMatch, moveMatch,
    setMerch,
    incrementAces, decrementAces,
    postAnnouncement, deleteAnnouncement,
    generateBracket, markBracketWinner, toggleBracketWithdrawal, swapBracketSlots, renameBracketSlot, clearBracket, relabelBracket,
    pushPublicStatus, pushConfig, setSchedule,
    addEmails, removeEmail, clearEmails,
    setCash, recordCash, removeCashEntry, setDeskScript,
    setLogItem, addLogItem, removeLogItem, resetLogistics,
    exportJSON, clearOps,
  };
}

import { useEffect, useState } from 'react';
import { SHEET_WRITE_URL } from '../lib/sheet';

// Shared-secret gate for the write-back endpoint. Must match the token checked
// in apps-script/ops-write-back.js. It ships in the public admin bundle, so it
// only deters drive-by writes — not a determined actor. Rotate by changing it
// here AND in the Apps Script, then redeploying the script (New version).
const WRITE_TOKEN = 'a4a-49010c3b149e53e25be43297';

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
  regStatus: '',        // 'confirmed' | 'pending' | 'waitlist' | ''  (blank = use sheet status)
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
    };
  } catch {
    return initialStore();
  }
}

// Fire-and-forget POST to the optional write-back endpoint. Apps Script web
// apps don't return readable CORS responses from a browser, so this is purely
// "best effort, don't block on it" — local storage stays the real state.
export function pushToSheet(type, payload) {
  if (!SHEET_WRITE_URL) return;
  try {
    fetch(SHEET_WRITE_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ type, payload, ts: Date.now(), token: WRITE_TOKEN }),
    }).catch(() => {});
  } catch { /* ignore — local store is still authoritative */ }
}

let uid = 0;
export const nextId = () => `${Date.now().toString(36)}-${(uid++).toString(36)}`;

export function useOpsStore() {
  const [store, setStore] = useState(load);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { /* storage full/unavailable */ }
  }, [store]);

  const getOverlay = (name) => ({ ...emptyOverlay(), ...store.participants[name] });

  const setOverlay = (name, patch) => {
    setStore(s => {
      const merged = { ...emptyOverlay(), ...s.participants[name], ...patch };
      return { ...s, participants: { ...s.participants, [name]: merged } };
    });
    pushToSheet('participant', { name, ...patch });
  };

  const addWalkUp = (entry) => {
    const row = { id: nextId(), name: '', classYear: '', events: 'Supporter', partner: '', ...entry };
    setStore(s => ({ ...s, added: [...s.added, row] }));
    pushToSheet('walk-up', row);
    return row.id;
  };
  const removeWalkUp = (id) => setStore(s => ({ ...s, added: s.added.filter(r => r.id !== id) }));

  // Accepts either a list or an updater `(prevList) => nextList` — mirrors
  // React's setState contract so callers never compute "next" from a closure
  // snapshot that might be stale by the time this runs (e.g. two rapid
  // "Add seed" clicks before a re-render, which would otherwise clobber
  // each other and silently drop a row).
  const setSeeds = (event, listOrUpdater) => {
    let resolved;
    setStore(s => {
      const prev = s.seeds[event];
      resolved = typeof listOrUpdater === 'function' ? listOrUpdater(prev) : listOrUpdater;
      return { ...s, seeds: { ...s.seeds, [event]: resolved } };
    });
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
    pushToSheet('seeds', { event, list: resolved.map(({ name }) => ({ name })) });
  };

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
    setStore(s => ({ ...s, matches: s.matches.map(m => (m.id === id ? { ...m, ...patch } : m)) }));
    pushToSheet('match', { id, ...patch });
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
        if (String(x.num) !== n) pushes.push({ id: x.id, num: n });
        return { ...x, num: n };
      });
      return { ...s, matches };
    });
    pushes.forEach(p => pushToSheet('match', p));
  };

  const exportJSON = () => JSON.stringify(store, null, 2);

  return {
    store,
    getOverlay, setOverlay,
    addWalkUp, removeWalkUp,
    setSeeds,
    addMatch, updateMatch, removeMatch, moveMatch,
    exportJSON,
  };
}

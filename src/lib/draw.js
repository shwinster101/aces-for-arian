// ==========================================
// BRACKET ENGINE — ops-only draw generation + advancement
// ==========================================
// Turns the ops seed list into a real bracket: standard seed placement, byes
// to the top seeds, and working feeders (winners advance, round-1 losers drop
// into consolation). Pure functions, no store/DOM/sheet access — the admin
// DrawBoard renders resolve() and mutates via setResult/swapUnseeded.
//
// State is deliberately minimal: the R1 slot assignment (`r1slots`) plus a
// results map (matchId -> winning side). EVERY downstream slot (Winners R2,
// Consolation R1) is DERIVED by resolve() from those two, so re-marking a
// result can never leave a stale name propagated downstream — the classic
// bracket bug. Deeper rounds (WB R3+, Comeback R2+, North/South) are the
// Friday build; the model already carries the feeder links they need.

import { rowKeys, SEED_CUT } from './entrants';

// Smallest power of two >= n (min 2). 12 -> 16, 16 -> 16, 17 -> 32.
export const nextPow2 = (n) => { let p = 2; while (p < n) p *= 2; return p; };

// Standard single-elim seed placement — MIRRORS seedOrder() in src/App.jsx
// (kept in sync by hand; both must agree so ops and public place seeds
// identically). slot i (0-based) holds seed number order[i]: 1 v N, then
// 2 v N-1 nested so top seeds only meet in the final rounds.
export function seedOrder(n) {
  let seeds = [1, 2];
  while (seeds.length < n) {
    const total = seeds.length * 2 + 1;
    const next = [];
    for (const s of seeds) next.push(s, total - s);
    seeds = next;
  }
  return seeds;
}

// Winners round-1 match m (0-based) -> its consolation round-1 slot. Cross-half
// pairing: the top half of WB R1 losers fills the A slots, the bottom half the
// B slots, so a consol match pairs a top-region loser with a bottom-region one
// (delays rematches). consolCount = size/4.
export function loserRoute(size, m) {
  const consolCount = size / 4;
  return { match: m % consolCount, side: m < consolCount ? 'a' : 'b' };
}

// The ops seed list -> ordered, de-duped names (seed 1 first). Blank rows and
// repeat entrants (same person/team, any partner order) are dropped via the
// canonical key from entrants.js.
function fieldFromSeeds(seedList) {
  const seen = new Set();
  const out = [];
  for (const row of seedList || []) {
    const name = (row.name || '').trim();
    if (!name) continue;
    const k = rowKeys(name).key;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(name);
  }
  return out;
}

export const CONSOL_LABEL = { Singles: 'Comeback', Doubles: 'West' };

// A slot is draggable when it holds a real, non-seeded entrant (seeds 1..8 and
// byes are fixed) — that's the "balance the unseeded" affordance.
export const isDraggableSlot = (s) => !!(s && s.name && !s.bye && s.seed > SEED_CUT);

// Build the bracket from the ops seed list. Returns null if <2 entrants.
// opts.labelFor(fullName) -> display name (e.g. "First L. 'YY"); defaults to
// the raw name. opts.overrides is a { canonicalKey -> customName } map that
// wins over the formatted default (preserved across Regenerate so a name
// fix — profanity/typo — sticks). Each slot carries raw (the seed-list name,
// for key/lookup), def (the formatted default), and name (override ?? def).
export function buildDraw(event, seedList, opts = {}) {
  const labelFor = opts.labelFor || ((s) => s);
  const overrides = opts.overrides || {};
  const field = fieldFromSeeds(seedList);
  const n = field.length;
  if (n < 2) return null;
  const size = nextPow2(n);
  const order = seedOrder(size); // slot -> seed number 1..size
  const r1slots = order.map((seedNum) => {
    if (seedNum > n) return { name: null, def: null, key: null, raw: null, seed: seedNum, bye: true };
    const raw = field[seedNum - 1];
    const key = rowKeys(raw).key;
    const def = labelFor(raw);
    return { name: overrides[key] || def, def, key, raw, seed: seedNum, bye: false };
  });
  return {
    event,
    size,
    fieldCount: n,
    byeCount: size - n,
    format: event === 'Doubles' ? 'compass' : 'double-elim',
    consolLabel: CONSOL_LABEL[event] || 'Comeback',
    r1slots,
    overrides: { ...overrides },
    results: {}, // matchId -> 'a' | 'b'
  };
}

const evPrefix = (event) => (event === 'Doubles' ? 'D' : 'S');
export const wr1Id = (event, m) => `${evPrefix(event)}-W1-${m}`;
export const wr2Id = (event, m) => `${evPrefix(event)}-W2-${m}`;
export const cr1Id = (event, m) => `${evPrefix(event)}-C1-${m}`;

// Derive the render-ready columns (Winners R1, Winners R2, Consolation R1)
// with every known slot filled. This build surfaces R1 + the next round.
export function resolve(bracket) {
  if (!bracket) return null;
  const { event, size, r1slots, results } = bracket;
  const wr1Count = size / 2;
  const wr2Count = Math.floor(size / 4);
  const cr1Count = Math.floor(size / 4);

  // Winners R1 straight from the slots; a lone named side is a walkover.
  const wr1 = [];
  for (let m = 0; m < wr1Count; m++) {
    const slotA = r1slots[2 * m];
    const slotB = r1slots[2 * m + 1];
    const id = wr1Id(event, m);
    const bye = slotA.name && !slotB.name ? 'a' : slotB.name && !slotA.name ? 'b' : null;
    const winner = results[id] || bye || null; // byes auto-decide
    const contested = !!slotA.name && !!slotB.name;
    wr1.push({ id, bracket: 'W', round: 1, m, slotA, slotB, winner, bye, contested });
  }

  // Shells for the next round + consolation, with "Winner/Loser of M#"
  // placeholders until a result fills them. Match numbers continue after R1
  // (R1 = 1..size/2) so the flat Match Order stays in playing order.
  const w2 = Array.from({ length: wr2Count }, (_, k) => ({
    id: wr2Id(event, k), bracket: 'W', round: 2, m: k, num: wr1Count + k + 1,
    winner: results[wr2Id(event, k)] || null,
    slotA: { name: null, from: `W of M${2 * k + 1}` },
    slotB: { name: null, from: `W of M${2 * k + 2}` },
  }));
  const c1 = Array.from({ length: cr1Count }, (_, k) => ({
    id: cr1Id(event, k), bracket: 'C', round: 1, m: k, num: wr1Count + wr2Count + k + 1,
    winner: results[cr1Id(event, k)] || null,
    slotA: { name: null, from: `L of M${k + 1}` },
    slotB: { name: null, from: `L of M${k + cr1Count + 1}` },
  }));

  const put = (arr, idx, side, slot) => { if (arr[idx]) arr[idx][side === 'a' ? 'slotA' : 'slotB'] = slot; };

  for (const w of wr1) {
    if (!w.winner) continue;
    const wSlot = w.winner === 'a' ? w.slotA : w.slotB;
    const lSlot = w.winner === 'a' ? w.slotB : w.slotA;
    // Winner advances to Winners R2.
    put(w2, Math.floor(w.m / 2), w.m % 2 === 0 ? 'a' : 'b',
      { name: wSlot.name, seed: wSlot.seed, from: `W of M${w.m + 1}` });
    // Loser drops to Consolation R1 (byes have no loser).
    if (w.contested && lSlot.name) {
      const r = loserRoute(size, w.m);
      put(c1, r.match, r.side, { name: lSlot.name, from: `L of M${w.m + 1}` });
    }
  }

  return { size, format: bracket.format, consolLabel: bracket.consolLabel, wr1, w2, c1 };
}

// Record / clear a match result (immutable).
export function setResult(bracket, matchId, side) {
  return { ...bracket, results: { ...bracket.results, [matchId]: side } };
}
export function clearResult(bracket, matchId) {
  const results = { ...bracket.results };
  delete results[matchId];
  return { ...bracket, results };
}

// Swap two unseeded R1 entrants to balance the draw. No-op unless BOTH slots
// are draggable (real, non-seed, non-bye). The entrant IDENTITY moves
// (name/def/key/raw); the slot's seed number stays with its bracket position.
export function swapUnseeded(bracket, i, j) {
  if (i === j) return bracket;
  const a = bracket.r1slots[i];
  const b = bracket.r1slots[j];
  if (!isDraggableSlot(a) || !isDraggableSlot(b)) return bracket;
  const move = (from, to) => ({ ...to, name: from.name, def: from.def, key: from.key, raw: from.raw });
  const r1slots = bracket.r1slots.slice();
  r1slots[i] = move(b, a);
  r1slots[j] = move(a, b);
  return { ...bracket, r1slots };
}

// Override (or clear, with an empty value) a slot's display name — the fix
// for a profane/typo/nickname registration. Keyed by the entrant's canonical
// key so it survives a Regenerate. No-op on byes/empty slots.
export function renameSlot(bracket, idx, value) {
  const slot = bracket.r1slots[idx];
  if (!slot || !slot.key) return bracket;
  const v = (value || '').trim();
  const overrides = { ...bracket.overrides };
  if (v) overrides[slot.key] = v; else delete overrides[slot.key];
  const r1slots = bracket.r1slots.map((s, i) => (i === idx ? { ...s, name: v || s.def } : s));
  return { ...bracket, overrides, r1slots };
}

// All bracket matches ready to post to the flat Match Order (store.matches) —
// contested R1 plus any next-round match whose both slots are known. The
// bracket-node id == flat match id so scoring one links to the other. Byes
// aren't posted (nothing to play). Shaped so the store only adds event/court/
// score. Used for the full re-sync on every generate / result / swap / clear.
export function bracketMatchRows(bracket) {
  const view = resolve(bracket);
  if (!view) return [];
  const rows = [];
  const results = bracket.results || {};
  for (const w of view.wr1) {
    if (!w.contested) continue; // byes have no match to play
    rows.push({
      id: w.id, round: 'R1', num: String(w.m + 1), a: w.slotA.name, b: w.slotB.name,
      winner: results[w.id] || '', status: results[w.id] ? 'final' : 'scheduled',
    });
  }
  const post = (m, round) => {
    if (!m.slotA.name || !m.slotB.name) return; // not yet determined
    rows.push({
      id: m.id, round, num: String(m.num), a: m.slotA.name, b: m.slotB.name,
      winner: results[m.id] || '', status: results[m.id] ? 'final' : 'scheduled',
    });
  };
  view.w2.forEach(m => post(m, 'R2'));
  view.c1.forEach(m => post(m, `${view.consolLabel} R1`));
  return rows;
}

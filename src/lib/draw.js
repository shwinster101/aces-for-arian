// ==========================================
// BRACKET ENGINE — full draw generation + advancement (ops-only)
// ==========================================
// Turns the ops seed list into a complete tournament: standard seed
// placement, byes to the top seeds, and working feeders for EVERY round —
// the full compass draw for doubles (East → West/North/South drop routing)
// and full double elimination for singles (winners rounds, the complete
// Comeback backdraw, Grand Final + bracket reset).
//
// State is deliberately minimal: the R1 slot assignment (`r1slots`) plus a
// results map (matchId -> winning side). EVERY downstream slot is DERIVED by
// resolve() from a static feeder graph, so re-marking a result can never
// leave a stale name propagated downstream. Byes cascade as walkovers: a
// side whose source can never produce a player is "dead", and a match with
// one live side auto-advances it.
//
// NUMBERING CONTRACT: match numbers mirror the PUBLIC bracket templates in
// src/App.jsx exactly (doubles: East 1-15, West 16-22, North 23-25, South
// 26-28 via numberSeq; singles: winners start [1,25,41,53,59], comeback
// [17,33,45,49,55,57,60,61], Grand Final 62, reset 63). That is what lets
// the public draw overlay ops-posted rows onto ANY round's lines by
// num+event. Change one side and you must change the other.

import { rowKeys, SEED_CUT, DRAW_CAP } from './entrants';

// Smallest power of two >= n (min 2). Kept for tooling; buildDraw itself now
// always uses the full event size (see below).
export const nextPow2 = (n) => { let p = 2; while (p < n) p *= 2; return p; };

// Standard single-elim seed placement — MIRRORS seedOrder() in src/App.jsx.
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

// Winners/East round-1 match m (0-based) -> consolation round-1 feed.
// Cross-half pairing (top-half losers take the A slots) to delay rematches.
export function loserRoute(size, m) {
  const consolCount = size / 4;
  return { match: m % consolCount, side: m < consolCount ? 'a' : 'b' };
}

// Doubles can overflow its 16-line draw via PLAY-INS: field 17..16+PLAYIN_MAX
// adds (n-16) "Play-in — Round of 32" matches (seed 16 v 17, 15 v 18, …)
// whose winners take the corresponding East R1 lines, so every registered
// team is in the championship draw instead of sitting out as an alternate.
// Play-ins are numbered AFTER South (29+) so the public numbering contract
// (East 1-15 … South 26-28) stays byte-identical.
export const PLAYIN_MAX = { Singles: 0, Doubles: 8 };

// The ops seed list -> ordered, de-duped names (seed 1 first), capped to the
// event's draw size (entries beyond the cap are alternates).
function fieldFromSeeds(seedList, cap) {
  const seen = new Set();
  const out = [];
  for (const row of seedList || []) {
    const name = (row.name || '').trim();
    if (!name) continue;
    const k = rowKeys(name).key;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(name);
    if (out.length >= cap) break;
  }
  return out;
}

export const CONSOL_LABEL = { Singles: 'Comeback', Doubles: 'West' };

// A slot is draggable when it holds a real, non-seeded entrant (seeds 1..8
// and byes are fixed) — the "balance the unseeded" affordance.
export const isDraggableSlot = (s) => !!(s && s.name && !s.bye && s.seed > SEED_CUT);

// Build the bracket from the ops seed list. Returns null if <2 entrants.
// The draw is ALWAYS the full event size (DRAW_CAP: 32 singles / 16 doubles)
// so ops numbering lines up with the fixed public templates; short fields
// simply carry more byes, which cascade as walkovers.
export function buildDraw(event, seedList, opts = {}) {
  const labelFor = opts.labelFor || ((s) => s);
  const overrides = opts.overrides || {};
  const size = DRAW_CAP[event] || nextPow2((seedList || []).length || 2);
  const field = fieldFromSeeds(seedList, size + (PLAYIN_MAX[event] || 0));
  const n = field.length;
  if (n < 2) return null;
  const pIns = Math.max(0, n - size); // doubles overflow -> play-in count
  const order = seedOrder(size);
  const teamSlot = (seedNum) => {
    const raw = field[seedNum - 1];
    const key = rowKeys(raw).key;
    const def = labelFor(raw);
    return { name: overrides[key] || def, def, key, raw, seed: seedNum, bye: false };
  };
  const r1slots = order.map((seedNum) => {
    // Host line of play-in k (k = size - seedNum): fed by that play-in's
    // winner, derived at resolve time — no team sits here directly.
    if (pIns > 0 && seedNum > size - pIns) {
      return { name: null, def: null, key: null, raw: null, seed: seedNum, bye: false, fromPlayIn: size - seedNum };
    }
    if (seedNum > n) return { name: null, def: null, key: null, raw: null, seed: seedNum, bye: true };
    return teamSlot(seedNum);
  });
  // Play-in participant slots, appended contiguously (match k -> slots
  // size+2k / size+2k+1) so the DrawBoard's idx = slot math keeps working.
  for (let k = 0; k < pIns; k++) {
    r1slots.push(teamSlot(size - k));      // higher seed hosts the play-in
    r1slots.push(teamSlot(size + 1 + k));  // overflow entrant
  }
  return {
    event,
    size,
    pIns,
    fieldCount: n,
    byeCount: Math.max(0, size - n),
    format: event === 'Doubles' ? 'compass' : 'double-elim',
    consolLabel: CONSOL_LABEL[event] || 'Comeback',
    r1slots,
    overrides: { ...overrides },
    results: {}, // matchId -> 'a' | 'b'
  };
}

// ---------------------------------------------------------------------------
// STATIC FEEDER GRAPH — one match descriptor per playable match, in
// evaluation (and play) order. aFrom/bFrom are either { slot } (an R1 slot
// index) or { kind: 'winner'|'loser', ref: <matchId> }.
// Exported for read-only public consumers (src/lib/compass.js derives the
// "follow my team" win/lose routing from it) — single source of truth.
// ---------------------------------------------------------------------------
export function graphFor(event, pIns = 0) {
  const matches = [];
  const sections = [];
  let section = null;
  const open = (key, title) => { section = { key, title, ids: [] }; sections.push(section); };
  const add = (id, roundTag, num, aFrom, bFrom, extra = {}) => {
    matches.push({ id, roundTag, num, aFrom, bFrom, section: section.key, ...extra });
    section.ids.push(id);
  };
  const Wof = (ref) => ({ kind: 'winner', ref });
  const Lof = (ref) => ({ kind: 'loser', ref });

  if (event === 'Doubles') {
    // Compass, 16 teams. East all rounds; E R1 losers -> West; E QF losers ->
    // North; West R1 losers -> South. Numbers = public numberSeq chain.
    const E = (r, k) => `D-E${r}-${k}`, W = (r, k) => `D-W${r}-${k}`;
    const N = (r, k) => `D-N${r}-${k}`, S = (r, k) => `D-S${r}-${k}`;
    // Overflow field (17+ teams): play-ins run FIRST (both play + display
    // order) — their winners feed the East host lines via each slot's
    // fromPlayIn marker (see evalGraph). Numbered 29+ so East 1-15 … South
    // 26-28 stay contract-exact with the public templates.
    if (pIns > 0) {
      open('P1', 'Play-in — Round of 32');
      for (let k = 0; k < pIns; k++) add(`D-P1-${k}`, 'Play-in', 29 + k, { slot: 16 + 2 * k }, { slot: 16 + 2 * k + 1 });
      // Consolation so play-in losers still get a second match ("every team
      // plays at least twice"). Losers pair up; an odd loser (3+ play-ins)
      // meets the winner of the first consolation. Numbered after the
      // play-ins (M29+pIns…). A single play-in (17 teams) has one loser and
      // no structural opponent — the desk pairs them by hand that day.
      if (pIns >= 2) {
        open('PC', 'Play-in Consolation');
        const pairs = Math.floor(pIns / 2);
        for (let k = 0; k < pairs; k++) {
          add(`D-PC-${k}`, 'Play-in Consol', 29 + pIns + k, Lof(`D-P1-${2 * k}`), Lof(`D-P1-${2 * k + 1}`));
        }
        if (pIns % 2 === 1) {
          add(`D-PC-${pairs}`, 'Play-in Consol', 29 + pIns + pairs, Wof('D-PC-0'), Lof(`D-P1-${pIns - 1}`));
        }
      }
    }
    open('E1', 'East — Round of 16');
    for (let k = 0; k < 8; k++) add(E(1, k), 'R1', k + 1, { slot: 2 * k }, { slot: 2 * k + 1 });
    open('E2', 'East — Quarterfinals');
    for (let k = 0; k < 4; k++) add(E(2, k), 'QF', 9 + k, Wof(E(1, 2 * k)), Wof(E(1, 2 * k + 1)));
    open('E3', 'East — Semifinals');
    for (let k = 0; k < 2; k++) add(E(3, k), 'SF', 13 + k, Wof(E(2, 2 * k)), Wof(E(2, 2 * k + 1)));
    open('E4', 'East — Final');
    add(E(4, 0), 'F', 15, Wof(E(3, 0)), Wof(E(3, 1)));
    open('W1', 'West — Round 1');
    for (let k = 0; k < 4; k++) add(W(1, k), 'West R1', 16 + k, Lof(E(1, k)), Lof(E(1, k + 4))); // loserRoute(16,·) cross-half
    open('W2', 'West — Semifinals');
    for (let k = 0; k < 2; k++) add(W(2, k), 'West SF', 20 + k, Wof(W(1, 2 * k)), Wof(W(1, 2 * k + 1)));
    open('W3', 'West — Final');
    add(W(3, 0), 'West F', 22, Wof(W(2, 0)), Wof(W(2, 1)));
    open('N1', 'North — Semifinals');
    for (let k = 0; k < 2; k++) add(N(1, k), 'North SF', 23 + k, Lof(E(2, 2 * k)), Lof(E(2, 2 * k + 1)));
    open('N2', 'North — Final');
    add(N(2, 0), 'North F', 25, Wof(N(1, 0)), Wof(N(1, 1)));
    open('S1', 'South — Semifinals');
    for (let k = 0; k < 2; k++) add(S(1, k), 'South SF', 26 + k, Lof(W(1, 2 * k)), Lof(W(1, 2 * k + 1)));
    open('S2', 'South — Final');
    add(S(2, 0), 'South F', 28, Wof(S(1, 0)), Wof(S(1, 1)));
    return { matches, sections };
  }

  // Singles: full 32 double elimination. Winners W1..W5; Comeback L1..L8
  // (pair-up rounds alternate with drop-in rounds; drop-ins reversed to delay
  // rematches); Grand Final + reset. Numbers mirror the public 1-62(+63).
  const W = (r, k) => `S-W${r}-${k}`, L = (r, k) => `S-L${r}-${k}`;
  open('W1', 'Winners — Round 1');
  for (let k = 0; k < 16; k++) add(W(1, k), 'R1', 1 + k, { slot: 2 * k }, { slot: 2 * k + 1 });
  open('W2', 'Winners — Round 2');
  for (let k = 0; k < 8; k++) add(W(2, k), 'R2', 25 + k, Wof(W(1, 2 * k)), Wof(W(1, 2 * k + 1)));
  open('W3', 'Winners — Round 3');
  for (let k = 0; k < 4; k++) add(W(3, k), 'R3', 41 + k, Wof(W(2, 2 * k)), Wof(W(2, 2 * k + 1)));
  open('W4', 'Winners — Semifinals');
  for (let k = 0; k < 2; k++) add(W(4, k), 'SF', 53 + k, Wof(W(3, 2 * k)), Wof(W(3, 2 * k + 1)));
  open('W5', 'Winners — Final');
  add(W(5, 0), 'F', 59, Wof(W(4, 0)), Wof(W(4, 1)));
  open('L1', 'Comeback — Round 1');
  for (let k = 0; k < 8; k++) add(L(1, k), 'Comeback R1', 17 + k, Lof(W(1, k)), Lof(W(1, k + 8))); // loserRoute(32,·)
  open('L2', 'Comeback — Round 2');
  for (let k = 0; k < 8; k++) add(L(2, k), 'Comeback R2', 33 + k, Wof(L(1, k)), Lof(W(2, 7 - k))); // reversed drop
  open('L3', 'Comeback — Round 3');
  for (let k = 0; k < 4; k++) add(L(3, k), 'Comeback R3', 45 + k, Wof(L(2, 2 * k)), Wof(L(2, 2 * k + 1)));
  open('L4', 'Comeback — Round 4');
  for (let k = 0; k < 4; k++) add(L(4, k), 'Comeback R4', 49 + k, Wof(L(3, k)), Lof(W(3, 3 - k))); // reversed drop
  open('L5', 'Comeback — Round 5');
  for (let k = 0; k < 2; k++) add(L(5, k), 'Comeback R5', 55 + k, Wof(L(4, 2 * k)), Wof(L(4, 2 * k + 1)));
  open('L6', 'Comeback — Round 6');
  for (let k = 0; k < 2; k++) add(L(6, k), 'Comeback R6', 57 + k, Wof(L(5, k)), Lof(W(4, 1 - k))); // reversed drop
  open('L7', 'Comeback — Round 7');
  add(L(7, 0), 'Comeback R7', 60, Wof(L(6, 0)), Wof(L(6, 1)));
  open('L8', 'Comeback — Final');
  add(L(8, 0), 'Comeback F', 61, Wof(L(7, 0)), Lof(W(5, 0)));
  open('GF', 'Grand Final');
  add('S-GF-0', 'Grand Final', 62, Wof(W(5, 0)), Wof(L(8, 0)));
  // Bracket reset — only played if the Comeback champion wins the GF.
  add('S-GF2-0', 'GF Reset', 63, Wof(W(5, 0)), Wof(L(8, 0)), { resetOf: 'S-GF-0' });
  return { matches, sections };
}

// Evaluate the graph: fill every slot that is knowable from R1 + results,
// auto-advancing walkovers (a live side vs a DEAD side — one whose source
// can never produce a player, i.e. a bye or a chain of byes).
function evalGraph(graph, r1slots, results) {
  const state = new Map();
  const numOf = new Map(graph.matches.map(m => [m.id, m.num]));
  for (const m of graph.matches) {
    const side = (from) => {
      if (from.slot != null) {
        // Defensive: a persisted bracket whose field was edited after generating
        // can leave a hole here. Treat a missing slot as an empty (TBD) line
        // rather than crashing resolve() — which would black-screen the ops draw.
        const s = r1slots[from.slot] || {};
        // Play-in host line: derived from the play-in's outcome (play-ins sit
        // first in the graph, so their state is already evaluated). Never
        // dead-before-play — both play-in sides are real teams.
        if (s.fromPlayIn != null) {
          const src = state.get(`D-P1-${s.fromPlayIn}`);
          const label = `W of M${29 + s.fromPlayIn}`;
          if (!src || !src.decided) return { name: null, seed: s.seed, dead: false, from: label };
          return { name: src.winnerName, seed: s.seed, dead: src.winnerName == null, from: label };
        }
        return { name: s.name, seed: s.seed, dead: !!s.bye, from: null };
      }
      const label = `${from.kind === 'winner' ? 'W' : 'L'} of M${numOf.get(from.ref)}`;
      const src = state.get(from.ref);
      if (!src || !src.decided) return { name: null, dead: false, from: label };
      if (from.kind === 'winner') return { name: src.winnerName, dead: src.winnerName == null, from: label };
      return { name: src.loserName, dead: src.loserName == null, from: label };
    };
    const a = side(m.aFrom), b = side(m.bFrom);
    const manual = results[m.id] || null;
    let auto = null;
    if (!manual) {
      if (a.name && b.dead) auto = 'a';
      else if (b.name && a.dead) auto = 'b';
    }
    const winner = manual || auto;
    const bothDead = a.dead && b.dead;
    const decided = !!winner || bothDead;
    const winnerName = winner === 'a' ? a.name : winner === 'b' ? b.name : null;
    const loserName = winner === 'a' ? b.name : winner === 'b' ? a.name : null;
    state.set(m.id, {
      a, b, manual, winner, decided,
      winnerName, loserName,
      contested: !!(a.name && b.name),
      bothDead,
    });
  }
  return state;
}

// Render-ready sections for the ops DrawBoard — every round of every
// direction/bracket, slots filled as far as results allow. The reset match
// is included but flagged inactive until the Comeback champ takes the GF.
export function resolve(bracket) {
  if (!bracket) return null;
  const { event, size, r1slots, results } = bracket;
  const graph = graphFor(event, bracket.pIns || 0);
  const state = evalGraph(graph, r1slots, results);
  const byId = new Map(graph.matches.map(m => [m.id, m]));
  const sections = graph.sections.map(sec => ({
    key: sec.key,
    title: sec.title,
    matches: sec.ids.map(id => {
      const g = byId.get(id);
      const st = state.get(id);
      const active = g.resetOf ? state.get(g.resetOf)?.manual === 'b' : true;
      // R1-type sections expose the raw slots so drag/rename keep working —
      // except play-in host lines, whose value is DERIVED from the play-in
      // (st.a/st.b carry the resolved name or a "W of M29" pointer).
      const isR1 = g.aFrom.slot != null;
      // `|| {}`: a hole in a persisted bracket's r1slots resolves to an empty
      // (TBD) slot instead of crashing the whole ops draw render.
      const rawA = isR1 ? (r1slots[g.aFrom.slot] || {}) : null;
      const rawB = isR1 ? (r1slots[g.bFrom.slot] || {}) : null;
      const slotA = isR1 ? (rawA.fromPlayIn != null ? { ...st.a, key: null, bye: false } : rawA) : st.a;
      const slotB = isR1 ? (rawB.fromPlayIn != null ? { ...st.b, key: null, bye: false } : rawB) : st.b;
      return {
        id, num: g.num, roundTag: g.roundTag, k: isR1 ? g.aFrom.slot / 2 : null,
        slotA, slotB,
        winner: st.winner, manual: st.manual, contested: st.contested,
        bye: isR1 ? !!(slotA.bye || slotB.bye) : st.bothDead ? true : (!st.contested && (st.a.dead || st.b.dead)),
        active,
      };
    }),
  }));
  return {
    size,
    format: bracket.format,
    consolLabel: bracket.consolLabel,
    fieldCount: bracket.fieldCount,
    byeCount: bracket.byeCount,
    pIns: bracket.pIns || 0,
    sections,
  };
}

// All matches consuming this one's outcome (transitively) — their recorded
// results become meaningless if this result changes, so they get cleared.
// Play-in host lines feed East through the slot's fromPlayIn marker (not a
// graph ref), so those edges are added explicitly from r1slots.
function downstreamIds(bracket, startId) {
  const graph = graphFor(bracket.event, bracket.pIns || 0);
  const consumers = new Map();
  const link = (ref, id) => {
    if (!consumers.has(ref)) consumers.set(ref, []);
    consumers.get(ref).push(id);
  };
  for (const m of graph.matches) {
    for (const f of [m.aFrom, m.bFrom]) {
      if (f.ref) link(f.ref, m.id);
      else if (f.slot != null) {
        const s = bracket.r1slots[f.slot];
        if (s && s.fromPlayIn != null) link(`D-P1-${s.fromPlayIn}`, m.id);
      }
    }
  }
  const out = new Set();
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift();
    for (const next of consumers.get(id) || []) {
      if (!out.has(next)) { out.add(next); queue.push(next); }
    }
  }
  return out;
}

// Record / clear a result (immutable). Changing a result invalidates every
// downstream result — the participants those results referred to may no
// longer be in that match. Ops re-marks the affected matches.
export function setResult(bracket, matchId, side) {
  const results = { ...bracket.results, [matchId]: side };
  for (const id of downstreamIds(bracket, matchId)) delete results[id];
  return { ...bracket, results };
}
export function clearResult(bracket, matchId) {
  const results = { ...bracket.results };
  delete results[matchId];
  for (const id of downstreamIds(bracket, matchId)) delete results[id];
  return { ...bracket, results };
}

// Swap two unseeded R1 entrants to balance the draw (identity moves; the
// slot's seed number stays with its bracket position).
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

// Override (or clear) a slot's display name — keyed by the entrant's
// canonical key so it survives a Regenerate and flows to every round.
export function renameSlot(bracket, idx, value) {
  const slot = bracket.r1slots[idx];
  if (!slot || !slot.key) return bracket;
  const v = (value || '').trim();
  const overrides = { ...bracket.overrides };
  if (v) overrides[slot.key] = v; else delete overrides[slot.key];
  const r1slots = bracket.r1slots.map((s, i) => (i === idx ? { ...s, name: v || s.def } : s));
  return { ...bracket, overrides, r1slots };
}

// Every PLAYABLE match (both sides known), shaped for the flat Match Order —
// bracket-node id == flat match id, nums mirror the public bracket. Byes and
// walkovers aren't posted (nothing to play); the reset match posts only once
// the Comeback champ forces it.
export function bracketMatchRows(bracket) {
  if (!bracket) return [];
  const { event, r1slots, results } = bracket;
  const graph = graphFor(event, bracket.pIns || 0);
  const state = evalGraph(graph, r1slots, results);
  const rows = [];
  for (const m of graph.matches) {
    const st = state.get(m.id);
    if (!st.contested) continue;
    if (st.winner && !st.manual) continue; // walkover — never actually played
    if (m.resetOf && state.get(m.resetOf)?.manual !== 'b') continue;
    rows.push({
      id: m.id, round: m.roundTag, num: String(m.num),
      a: st.a.name, b: st.b.name,
      winner: st.manual || '', status: st.manual ? 'final' : 'scheduled',
    });
  }
  return rows;
}

// ==========================================
// PUBLIC COMPASS MODEL — 2025 sheet-style spatial draw + team projections
// ==========================================
// Pure derivation, no React: the fixed doubles templates (NUMBERING CONTRACT
// in ./draw.js — East 1-15, West 16-22, North 23-25, South 26-28, play-ins
// 29+) plus the posted Matches rows (keyed by num, see engineRowsFor in
// App.jsx) become render-ready lines/connectors/metas for the CompassDraw
// canvas. Also derives the "follow my team" win/lose projection by scanning
// the ops engine's own feeder graph (graphFor) — read-only, single source of
// truth for routing, so the public projection can never drift from the ops
// bracket.

import { graphFor, seedOrder, buildDraw, resolve } from './draw';
import { playPos, stakesFor, waitsOnLabel, matchMinFor, dayStartMs, SCHEDULE_DEFAULTS } from './schedule';

const T = 16; // doubles East draw size (DRAW_CAP.Doubles)

// Grid geometry shared with CompassDraw.jsx. One row unit = one CSS grid row;
// a line's underline sits at the bottom of its cell, so a match whose feeder
// lines are at rows rA < rB elbows through a border-only item spanning
// rows rA+1..rB, and its output line lands exactly on the midpoint row —
// integer by construction for every round below.
export const COL_W = 200;
export const ROW_H = 22;

// Paper/dark canvas token sets — shared by CompassDraw and SinglesDraw.
export const THEMES = {
  paper: {
    '--cd-canvas': '#faf7f0', '--cd-ink': '#171310', '--cd-faint': 'rgba(23,19,16,0.52)',
    '--cd-from': 'rgba(23,19,16,0.72)',
    '--cd-rule': '#57534e', '--cd-gold': '#996c00', '--cd-gold-bg': '#fbbf24',
    '--cd-hit': 'rgba(251,191,36,0.45)', '--cd-live': '#047857', '--cd-live-bg': 'rgba(4,120,87,0.09)',
    '--cd-panel': '#f3ede1', '--cd-border': '#d8d2c4',
  },
  dark: {
    '--cd-canvas': '#101010', '--cd-ink': '#e4e4e7', '--cd-faint': 'rgba(228,228,231,0.45)',
    '--cd-from': 'rgba(228,228,231,0.7)',
    '--cd-rule': '#71717a', '--cd-gold': '#fbbf24', '--cd-gold-bg': '#fbbf24',
    '--cd-hit': 'rgba(251,191,36,0.25)', '--cd-live': '#34d399', '--cd-live-bg': 'rgba(52,211,153,0.09)',
    '--cd-panel': '#171717', '--cd-border': '#27272a',
  },
};

const rowOf = (rows, n) => rows.get(Number(n)) || null;
const isFinal = (r) => !!r && r.status === 'final' && (r.winner === 'a' || r.winner === 'b');
const winnerName = (r) => (r.winner === 'a' ? r.a : r.b);
const loserName = (r) => (r.winner === 'a' ? r.b : r.a);

// Resolve one draw line against the posted rows. A line is one side of one
// match (its `nextNum`/`nextSide`), fed by an upstream match (`feederNum` +
// `feederTake`) and/or a template entrant (`tName`). Precedence:
// posted overlay -> derived feeder result -> template -> walkover -> BYE ->
// "W/L of Mx" placeholder -> TBD. The score of a FINAL feeder rides along
// under the advancing name — the 2025 sheet look.
function resolveLine(spec, rows) {
  const out = {
    key: spec.key, col: spec.col, row: spec.row,
    seed: spec.seed || null, name: null, kind: 'tbd',
    score: '', live: false, court: '', wo: false, from: spec.from || null,
    drop: !!spec.dropIn,
  };
  const nr = spec.nextNum ? rowOf(rows, spec.nextNum) : null;
  if (nr && nr[spec.nextSide]) { out.name = nr[spec.nextSide]; out.kind = 'name'; }
  const fr = spec.feederNum ? rowOf(rows, spec.feederNum) : null;
  if (fr && isFinal(fr)) {
    const nm = spec.feederTake === 'loser' ? loserName(fr) : winnerName(fr);
    if (nm && !out.name) { out.name = nm; out.kind = 'name'; }
    if (nm && spec.feederTake !== 'loser') out.score = fr.score || '';
  }
  if (!out.name && spec.tName) { out.name = spec.tName; out.kind = 'name'; }
  if (!out.name && spec.woName) { out.name = spec.woName; out.kind = 'name'; out.wo = true; }
  if (!out.name && spec.bye) out.kind = 'bye';
  if (!out.name && out.kind === 'tbd' && spec.from) out.kind = 'from';
  if (nr && nr.status === 'live') { out.live = true; out.court = nr.court || ''; }
  return out;
}

// Match meta chip (num + status) rendered on the spare row under the lower
// feeder line. The estimate text itself is time-dependent, so the component
// asks App's estFor(num) at render time; the model only says which state.
// `fmt` (doubles only) carries the scoring format for that path — 'ad' on the
// East championship path + East-entry play-ins, 'noad' on West/North/South and
// the placement/consolation matches. Left undefined for singles (no chip).
function meta(col, row, num, rows, fmt) {
  const r = rowOf(rows, num);
  return {
    key: `m${num}`, col, row, num,
    live: !!r && r.status === 'live',
    court: (r && r.court) || '',
    final: isFinal(r),
    posted: !!r,
    fmt: fmt || null,
  };
}

// Scoring format by round (uniform Fast-4 best-of-3, 10-pt match tiebreak for
// the 3rd): NO-AD through the Round of 16 and on the whole backdraw/placement
// side; AD from the main-draw QUARTERFINAL onward (the matches that decide the
// title). Derived from the fixed numbering contract — same rule both events.
//   Doubles: East QF M9-12, SF M13-14, F M15.
//   Singles: Winners QF M41-44, SF M53-54, F M59, Grand Final M62 (+ reset 63).
const AD_NUMS = {
  Doubles: new Set([9, 10, 11, 12, 13, 14, 15]),
  Singles: new Set([41, 42, 43, 44, 53, 54, 59, 62, 63]),
};
export function scoreFmt(event, num) {
  const set = AD_NUMS[/doub/i.test(event || '') ? 'Doubles' : 'Singles'];
  return set.has(Number(num)) ? 'ad' : 'noad';
}

const conn = (col, rowStart, rowEnd, num, rows) => ({
  key: `c${num}`, col, rowStart, rowEnd,
  live: (rowOf(rows, num) || {}).status === 'live',
});

// Full render model for the doubles compass canvas.
// eastNames: 16 display names by seed position (null = open/host line, as the
// public template builds them); teams: ALL labeled team names in seed order
// (16 + overflow, for the play-in panel); rows: Map(num -> posted match row).
export function buildCompassModel({ eastNames = [], teams = [], pIns = 0, rows = new Map(), showByes = false }) {
  const order = seedOrder(T);

  // --- East leaves (template round of 16) --------------------------------
  const leafSpecs = order.map((seed, i) => {
    const host = pIns > 0 && seed > T - pIns;
    const playInNum = host ? 29 + (T - seed) : null;
    return {
      key: `e1-${i}`, col: 1, row: 2 * i + 1, seed,
      tName: host ? null : (eastNames[seed - 1] || null),
      host, feederNum: playInNum, feederTake: 'winner',
      from: host ? `W of M${playInNum}` : null,
      nextNum: Math.floor(i / 2) + 1, nextSide: i % 2 === 0 ? 'a' : 'b',
    };
  });
  if (showByes) {
    for (let i = 0; i < T; i++) {
      const me = leafSpecs[i], sib = leafSpecs[i ^ 1];
      if (!me.tName && !me.host && sib.tName) me.bye = true;
    }
  }

  const east = { cols: 5, rows: 32, lines: [], connectors: [], metas: [], headers: ['Round of 16', 'Quarterfinals', 'Semifinals', 'Final', 'Champion'] };
  for (const s of leafSpecs) east.lines.push(resolveLine(s, rows));
  // QF entrants (winners of M1-8) — template walkover shows the bye-side name
  // advancing dimmed until the real QF row posts (overlay always wins).
  for (let j = 0; j < 8; j++) {
    const a = leafSpecs[2 * j], b = leafSpecs[2 * j + 1];
    const woName = a.bye ? b.tName : b.bye ? a.tName : null;
    east.lines.push(resolveLine({
      key: `e2-${j}`, col: 2, row: 4 * j + 2,
      feederNum: j + 1, feederTake: 'winner', woName, from: `W of M${j + 1}`,
      nextNum: 9 + Math.floor(j / 2), nextSide: j % 2 === 0 ? 'a' : 'b',
    }, rows));
  }
  for (let j = 0; j < 4; j++) east.lines.push(resolveLine({
    key: `e3-${j}`, col: 3, row: 8 * j + 4,
    feederNum: 9 + j, feederTake: 'winner', from: `W of M${9 + j}`,
    nextNum: 13 + Math.floor(j / 2), nextSide: j % 2 === 0 ? 'a' : 'b',
  }, rows));
  for (let j = 0; j < 2; j++) east.lines.push(resolveLine({
    key: `e4-${j}`, col: 4, row: 16 * j + 8,
    feederNum: 13 + j, feederTake: 'winner', from: `W of M${13 + j}`,
    nextNum: 15, nextSide: j === 0 ? 'a' : 'b',
  }, rows));
  for (let k = 0; k < 8; k++) { east.connectors.push(conn(1, 4 * k + 1, 4 * k + 3, k + 1, rows)); east.metas.push(meta(1, 4 * k + 4, k + 1, rows, scoreFmt('Doubles', k + 1))); }
  for (let k = 0; k < 4; k++) { east.connectors.push(conn(2, 8 * k + 2, 8 * k + 6, 9 + k, rows)); east.metas.push(meta(2, 8 * k + 7, 9 + k, rows, scoreFmt('Doubles', 9 + k))); }
  for (let k = 0; k < 2; k++) { east.connectors.push(conn(3, 16 * k + 4, 16 * k + 12, 13 + k, rows)); east.metas.push(meta(3, 16 * k + 13, 13 + k, rows, scoreFmt('Doubles', 13 + k))); }
  east.connectors.push(conn(4, 8, 24, 15, rows)); east.metas.push(meta(4, 25, 15, rows, scoreFmt('Doubles', 15)));
  const r15 = rowOf(rows, 15);
  east.champion = { row: 16, name: isFinal(r15) ? winnerName(r15) : null, score: isFinal(r15) ? (r15.score || '') : '' };

  // --- West (East R16 losers; mirrored — flows right-to-left) -------------
  // Grid cols left→right: 1 champion line, 2 final entrants, 3 SF entrants,
  // 4 opening-round entrant lines (the column adjacent to East).
  const west = { cols: 4, rows: 32, mirrored: true, lines: [], connectors: [], metas: [], headers: ['West Champion', 'Final', 'Semifinals', 'Round 1'] };
  for (let j = 0; j < 8; j++) {
    const k = Math.floor(j / 2);
    const feederNum = j % 2 === 0 ? k + 1 : k + 5; // W1 k = L of M(k+1) vs L of M(k+5) — cross-half
    west.lines.push(resolveLine({
      key: `w1-${j}`, col: 4, row: 4 * j + 2,
      feederNum, feederTake: 'loser', from: `L of M${feederNum}`,
      nextNum: 16 + k, nextSide: j % 2 === 0 ? 'a' : 'b',
    }, rows));
  }
  for (let j = 0; j < 4; j++) west.lines.push(resolveLine({
    key: `w2-${j}`, col: 3, row: 8 * j + 4,
    feederNum: 16 + j, feederTake: 'winner', from: `W of M${16 + j}`,
    nextNum: 20 + Math.floor(j / 2), nextSide: j % 2 === 0 ? 'a' : 'b',
  }, rows));
  for (let j = 0; j < 2; j++) west.lines.push(resolveLine({
    key: `w3-${j}`, col: 2, row: 16 * j + 8,
    feederNum: 20 + j, feederTake: 'winner', from: `W of M${20 + j}`,
    nextNum: 22, nextSide: j === 0 ? 'a' : 'b',
  }, rows));
  west.lines.push(resolveLine({ key: 'w-win', col: 1, row: 16, feederNum: 22, feederTake: 'winner', from: 'W of M22' }, rows));
  west.winner = { col: 1, row: 17, caption: 'West champions' };
  for (let k = 0; k < 4; k++) { west.connectors.push(conn(4, 8 * k + 2, 8 * k + 6, 16 + k, rows)); west.metas.push(meta(4, 8 * k + 7, 16 + k, rows, scoreFmt('Doubles', 16 + k))); }
  for (let k = 0; k < 2; k++) { west.connectors.push(conn(3, 16 * k + 4, 16 * k + 12, 20 + k, rows)); west.metas.push(meta(3, 16 * k + 13, 20 + k, rows, scoreFmt('Doubles', 20 + k))); }
  west.connectors.push(conn(2, 8, 24, 22, rows)); west.metas.push(meta(2, 25, 22, rows, scoreFmt('Doubles', 22)));

  // --- North (East QF losers) / South (West R1 losers) ---------------------
  const smallDraw = (keyP, firstNum, finalNum, feederBase, feederTake, caption, headers) => {
    const g = { cols: 3, rows: 8, lines: [], connectors: [], metas: [], headers };
    for (let j = 0; j < 4; j++) g.lines.push(resolveLine({
      key: `${keyP}1-${j}`, col: 1, row: 2 * j + 1,
      feederNum: feederBase + j, feederTake, from: `${feederTake === 'loser' ? 'L' : 'W'} of M${feederBase + j}`,
      nextNum: firstNum + Math.floor(j / 2), nextSide: j % 2 === 0 ? 'a' : 'b',
    }, rows));
    for (let j = 0; j < 2; j++) g.lines.push(resolveLine({
      key: `${keyP}2-${j}`, col: 2, row: 4 * j + 2,
      feederNum: firstNum + j, feederTake: 'winner', from: `W of M${firstNum + j}`,
      nextNum: finalNum, nextSide: j === 0 ? 'a' : 'b',
    }, rows));
    g.lines.push(resolveLine({ key: `${keyP}-win`, col: 3, row: 4, feederNum: finalNum, feederTake: 'winner', from: `W of M${finalNum}` }, rows));
    g.winner = { col: 3, row: 5, caption };
    for (let k = 0; k < 2; k++) { g.connectors.push(conn(1, 4 * k + 1, 4 * k + 3, firstNum + k, rows)); g.metas.push(meta(1, 4 * k + 4, firstNum + k, rows, scoreFmt('Doubles', firstNum + k))); }
    g.connectors.push(conn(2, 2, 6, finalNum, rows)); g.metas.push(meta(2, 7, finalNum, rows, scoreFmt('Doubles', finalNum)));
    return g;
  };
  const north = smallDraw('n', 23, 25, 9, 'loser', 'North champions', ['Semifinals', 'Final', 'Champion']);
  const south = smallDraw('s', 26, 28, 16, 'loser', 'South champions', ['Semifinals', 'Final', 'Champion']);

  // --- Play-in panel (17+ team overflow, first on court Saturday) ----------
  const playIns = [];
  for (let k = 0; k < pIns; k++) {
    const num = 29 + k;
    const hostSeed = T - k;
    const slotIdx = order.indexOf(hostSeed);
    const eastMatch = Math.floor(slotIdx / 2) + 1;
    const oppSeed = order[slotIdx % 2 === 0 ? slotIdx + 1 : slotIdx - 1];
    const opp = eastNames[oppSeed - 1] || null;
    playIns.push({
      num,
      a: resolveLine({ key: `p${k}a`, col: 1, row: 1, seed: hostSeed, tName: teams[hostSeed - 1] || null, nextNum: num, nextSide: 'a' }, rows),
      b: resolveLine({ key: `p${k}b`, col: 1, row: 2, seed: T + 1 + k, tName: teams[T + k] || null, nextNum: num, nextSide: 'b' }, rows),
      note: `Winner → East M${eastMatch}`, // opponent already shows on that East line
      opp,
      meta: meta(1, 1, num, rows, scoreFmt('Doubles', num)), // play-in (pre-R16) → no-ad
    });
  }
  const consolation = [];
  if (pIns >= 2) {
    const pairs = Math.floor(pIns / 2);
    for (let k = 0; k < pairs; k++) {
      const num = 29 + pIns + k;
      consolation.push({
        num,
        a: resolveLine({ key: `pc${k}a`, col: 1, row: 1, feederNum: 29 + 2 * k, feederTake: 'loser', from: `L of M${29 + 2 * k}`, nextNum: num, nextSide: 'a' }, rows),
        b: resolveLine({ key: `pc${k}b`, col: 1, row: 2, feederNum: 29 + 2 * k + 1, feederTake: 'loser', from: `L of M${29 + 2 * k + 1}`, nextNum: num, nextSide: 'b' }, rows),
        meta: meta(1, 1, num, rows, scoreFmt('Doubles', num)), // play-in consolation → no-ad placement
      });
    }
    if (pIns % 2 === 1) {
      const num = 29 + pIns + pairs;
      consolation.push({
        num,
        a: resolveLine({ key: `pc${pairs}a`, col: 1, row: 1, feederNum: 29 + pIns, feederTake: 'winner', from: `W of M${29 + pIns}`, nextNum: num, nextSide: 'a' }, rows),
        b: resolveLine({ key: `pc${pairs}b`, col: 1, row: 2, feederNum: 29 + pIns - 1, feederTake: 'loser', from: `L of M${29 + pIns - 1}`, nextNum: num, nextSide: 'b' }, rows),
        meta: meta(1, 1, num, rows, scoreFmt('Doubles', num)), // play-in consolation → no-ad placement
      });
    }
  }

  return { east, west, north, south, playIns, consolation };
}

// ---------------------------------------------------------------------------
// SINGLES DOUBLE-ELIM MODEL — same sheet grammar as the compass (lines on
// rules, elbow connectors, one token per match), same NUMBERING CONTRACT
// (winners rounds start [1,25,41,53,59]; comeback [17,33,45,49,55,57,60,61];
// Grand Final 62, reset 63). Winners is a plain single-elim grid
// (row = 2^r·(2j+1)); the comeback alternates PAIR-UP rounds (halve) with
// DROP-IN rounds (same match count: the survivor line meets a fresh loser
// dropping from the winners side — reversed order, per the engine). All
// feeder/next wiring below mirrors graphFor('Singles') and is asserted
// against it in the verification suite.
// ---------------------------------------------------------------------------
export function buildDoubleElimModel({ names = [], rows = new Map(), showByes = false }) {
  const S = 32;
  const order = seedOrder(S);

  // --- Winners grid (6 cols: R32 … Winners Final → GF line) ---------------
  const leafSpecs = order.map((seed, i) => ({
    key: `w1-${i}`, col: 1, row: 2 * i + 1, seed,
    tName: names[seed - 1] || null,
    nextNum: Math.floor(i / 2) + 1, nextSide: i % 2 === 0 ? 'a' : 'b',
  }));
  if (showByes) {
    for (let i = 0; i < S; i++) {
      const me = leafSpecs[i], sib = leafSpecs[i ^ 1];
      if (!me.tName && sib.tName) me.bye = true;
    }
  }
  const winners = {
    cols: 6, rows: 64, lines: [], connectors: [], metas: [],
    headers: ['Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals', 'Winners Final', 'To Grand Final'],
  };
  for (const s of leafSpecs) winners.lines.push(resolveLine(s, rows));
  const W_BASE = [1, 25, 41, 53, 59], W_COUNT = [16, 8, 4, 2, 1];
  for (let c = 2; c <= 6; c++) {
    const rIdx = c - 2;                 // feeder round index into W_BASE
    const winnersOf = W_COUNT[rIdx];    // lines in this column
    for (let j = 0; j < winnersOf; j++) {
      const feederNum = W_BASE[rIdx] + j;
      const a = c === 2 ? leafSpecs[2 * j] : null, b = c === 2 ? leafSpecs[2 * j + 1] : null;
      const woName = a && a.bye ? (b && b.tName) : b && b.bye ? (a && a.tName) : null;
      winners.lines.push(resolveLine({
        key: `w${c}-${j}`, col: c, row: Math.pow(2, c - 1) * (2 * j + 1),
        feederNum, feederTake: 'winner', woName, from: `W of M${feederNum}`,
        nextNum: c === 6 ? 62 : W_BASE[rIdx + 1] + Math.floor(j / 2),
        nextSide: c === 6 ? 'a' : (j % 2 === 0 ? 'a' : 'b'),
      }, rows));
    }
    for (let k = 0; k < winnersOf / (c === 6 ? 1 : 2); k++) {
      if (c === 6) break; // no matches inside the GF-line column
      const num = W_BASE[rIdx + 1] + k;
      const rA = Math.pow(2, c - 1) * (4 * k + 1), rB = Math.pow(2, c - 1) * (4 * k + 3);
      winners.connectors.push(conn(c, rA, rB, num, rows));
      winners.metas.push(meta(c, rB + 1, num, rows));
    }
  }
  // W1 matches connect from column 1
  for (let k = 0; k < 16; k++) { winners.connectors.push(conn(1, 4 * k + 1, 4 * k + 3, k + 1, rows)); winners.metas.push(meta(1, 4 * k + 4, k + 1, rows)); }
  winners.winner = { col: 6, row: 33, caption: '→ Grand Final (M62)' };

  // --- Comeback grid (9 cols, pair-up / drop-in alternation) ---------------
  const comeback = {
    cols: 9, rows: 33, lines: [], connectors: [], metas: [],
    headers: ['Round 1', 'Round 2', 'Round 3', 'Round 4', 'Round 5', 'Round 6', 'Round 7', 'Comeback Final', 'To Grand Final'],
  };
  const CL = comeback.lines, CC = comeback.connectors, CM = comeback.metas;
  // L1 (M17-24): losers of W1 cross-half — L of M(k+1) vs L of M(k+9)
  for (let j = 0; j < 16; j++) {
    const k = Math.floor(j / 2);
    const feederNum = j % 2 === 0 ? k + 1 : k + 9;
    CL.push(resolveLine({
      key: `l1-${j}`, col: 1, row: 2 * j + 1,
      feederNum, feederTake: 'loser', from: `L of M${feederNum}`,
      nextNum: 17 + k, nextSide: j % 2 === 0 ? 'a' : 'b',
    }, rows));
  }
  for (let k = 0; k < 8; k++) { CC.push(conn(1, 4 * k + 1, 4 * k + 3, 17 + k, rows)); CM.push(meta(1, 4 * k + 4, 17 + k, rows)); }
  // L2 (M33-40): W of L1 vs L of W2 (reversed drop — L of M(32-k))
  for (let k = 0; k < 8; k++) {
    CL.push(resolveLine({ key: `l2w-${k}`, col: 2, row: 4 * k + 2, feederNum: 17 + k, feederTake: 'winner', from: `W of M${17 + k}`, nextNum: 33 + k, nextSide: 'a' }, rows));
    CL.push(resolveLine({ key: `l2d-${k}`, col: 2, row: 4 * k + 4, feederNum: 32 - k, feederTake: 'loser', from: `L of M${32 - k}`, nextNum: 33 + k, nextSide: 'b', dropIn: true }, rows));
    CC.push(conn(2, 4 * k + 2, 4 * k + 3, 33 + k, rows)); CM.push(meta(2, 4 * k + 5, 33 + k, rows));
  }
  // L3 (M45-48): pair-up of L2 winners
  for (let j = 0; j < 8; j++) CL.push(resolveLine({ key: `l3-${j}`, col: 3, row: 4 * j + 3, feederNum: 33 + j, feederTake: 'winner', from: `W of M${33 + j}`, nextNum: 45 + Math.floor(j / 2), nextSide: j % 2 === 0 ? 'a' : 'b' }, rows));
  for (let k = 0; k < 4; k++) { CC.push(conn(3, 8 * k + 3, 8 * k + 7, 45 + k, rows)); CM.push(meta(3, 8 * k + 8, 45 + k, rows)); }
  // L4 (M49-52): W of L3 vs L of W3 (reversed — L of M(44-k))
  for (let k = 0; k < 4; k++) {
    CL.push(resolveLine({ key: `l4w-${k}`, col: 4, row: 8 * k + 5, feederNum: 45 + k, feederTake: 'winner', from: `W of M${45 + k}`, nextNum: 49 + k, nextSide: 'a' }, rows));
    CL.push(resolveLine({ key: `l4d-${k}`, col: 4, row: 8 * k + 7, feederNum: 44 - k, feederTake: 'loser', from: `L of M${44 - k}`, nextNum: 49 + k, nextSide: 'b', dropIn: true }, rows));
    CC.push(conn(4, 8 * k + 5, 8 * k + 6, 49 + k, rows)); CM.push(meta(4, 8 * k + 8, 49 + k, rows));
  }
  // L5 (M55-56): pair-up
  for (let j = 0; j < 4; j++) CL.push(resolveLine({ key: `l5-${j}`, col: 5, row: 8 * j + 6, feederNum: 49 + j, feederTake: 'winner', from: `W of M${49 + j}`, nextNum: 55 + Math.floor(j / 2), nextSide: j % 2 === 0 ? 'a' : 'b' }, rows));
  for (let k = 0; k < 2; k++) { CC.push(conn(5, 16 * k + 6, 16 * k + 14, 55 + k, rows)); CM.push(meta(5, 16 * k + 15, 55 + k, rows)); }
  // L6 (M57-58): W of L5 vs L of W4 (reversed — L of M(54-k))
  for (let k = 0; k < 2; k++) {
    CL.push(resolveLine({ key: `l6w-${k}`, col: 6, row: 16 * k + 10, feederNum: 55 + k, feederTake: 'winner', from: `W of M${55 + k}`, nextNum: 57 + k, nextSide: 'a' }, rows));
    CL.push(resolveLine({ key: `l6d-${k}`, col: 6, row: 16 * k + 12, feederNum: 54 - k, feederTake: 'loser', from: `L of M${54 - k}`, nextNum: 57 + k, nextSide: 'b', dropIn: true }, rows));
    CC.push(conn(6, 16 * k + 10, 16 * k + 11, 57 + k, rows)); CM.push(meta(6, 16 * k + 13, 57 + k, rows));
  }
  // L7 (M60): pair-up of the two survivors
  for (let j = 0; j < 2; j++) CL.push(resolveLine({ key: `l7-${j}`, col: 7, row: 16 * j + 11, feederNum: 57 + j, feederTake: 'winner', from: `W of M${57 + j}`, nextNum: 60, nextSide: j === 0 ? 'a' : 'b' }, rows));
  CC.push(conn(7, 11, 27, 60, rows)); CM.push(meta(7, 28, 60, rows));
  // L8 (M61, Comeback Final): W of L7 vs L of Winners Final
  CL.push(resolveLine({ key: 'l8w', col: 8, row: 19, feederNum: 60, feederTake: 'winner', from: 'W of M60', nextNum: 61, nextSide: 'a' }, rows));
  CL.push(resolveLine({ key: 'l8d', col: 8, row: 21, feederNum: 59, feederTake: 'loser', from: 'L of M59', nextNum: 61, nextSide: 'b', dropIn: true }, rows));
  CC.push(conn(8, 19, 20, 61, rows)); CM.push(meta(8, 22, 61, rows));
  CL.push(resolveLine({ key: 'l9', col: 9, row: 20, feederNum: 61, feederTake: 'winner', from: 'W of M61', nextNum: 62, nextSide: 'b' }, rows));
  comeback.winner = { col: 9, row: 21, caption: '→ Grand Final (M62)' };

  // --- Grand Final panel ----------------------------------------------------
  const gf = {
    num: 62,
    a: resolveLine({ key: 'gfa', col: 1, row: 1, feederNum: 59, feederTake: 'winner', from: 'W of M59', nextNum: 62, nextSide: 'a' }, rows),
    b: resolveLine({ key: 'gfb', col: 1, row: 2, feederNum: 61, feederTake: 'winner', from: 'W of M61', nextNum: 62, nextSide: 'b' }, rows),
    meta: meta(1, 1, 62, rows),
    reset: !!rowOf(rows, 63), // posted reset row → M63 is ON
  };
  // Champion is only truly decided once the bracket-reset question is settled:
  //  - if the reset M63 was played, ITS winner takes the title (with M63's score);
  //  - a Winners-bracket win in M62 (side 'a') ends it outright — no reset;
  //  - a Comeback win in M62 (side 'b') only FORCES the reset, so the title stays
  //    undecided until M63 is final. Crowning M62's winner unconditionally would
  //    crown the comeback player early and wrongly if they then lose the reset.
  const r62 = rowOf(rows, 62);
  const r63 = rowOf(rows, 63);
  let champion = { name: null, score: '' };
  if (isFinal(r63)) champion = { name: winnerName(r63), score: r63.score || '' };
  else if (isFinal(r62) && r62.winner === 'a') champion = { name: winnerName(r62), score: r62.score || '' };

  // Scoring-format chip, round-based (same rule as doubles): no-ad through the
  // Winners R16 + all of the Comeback side; ad from the Winners QF (M41-44) on,
  // the finals, and the Grand Final. Tag every meta so the chip renders.
  for (const m of [...winners.metas, ...comeback.metas]) m.fmt = scoreFmt('Singles', m.num);
  gf.meta.fmt = scoreFmt('Singles', 62);

  return { winners, comeback, gf, champion };
}

// ---------------------------------------------------------------------------
// PROJECTED SCHEDULE / CALL ORDER — a start time for EVERY match in the
// draw, posted or not. Match NUMBERS stay pure bracket identity (the
// num+event overlay contract is untouchable); the CALL ORDER is derived
// here, list-scheduling style, honoring all three courtside constraints:
//  1. the feeder chain — M1 can't start before its play-in finishes;
//  2. the REST WINDOW — a team gets sched.restMin (10) after its previous
//     match before it can be called again (skipped for feeders already
//     final long ago);
//  3. the court pool (sched.courts, 9) — when courts are contended, SHORTER
//     backdraw matches go on first (front-load the West/North/South splits),
//     with an aging guard so a longer championship QF/SF/F that's been
//     ready for a while can't be starved and push the final late.
// Anchored at first serve (9:00 Sat / 8:00 Sun) until anything goes
// live/final, then re-projects from `now`. All consumers label with "~".
// ---------------------------------------------------------------------------
// Matches that will NEVER be played — R1 byes and the walkover cascade they
// trigger (including comeback drop-ins fed by dead losers). Derived by
// running the REAL engine over the public seed list (buildDraw + resolve are
// pure and exported), so the skip set matches the ops board exactly. Bye
// placement depends only on field size and seed ranks — ops drag-swaps move
// real entrants between non-bye slots — so public seeds are sufficient.
export function structuralSkips(event, seedList) {
  const skips = new Set();
  const bracket = buildDraw(event, seedList || [], {});
  if (!bracket) return skips;
  const view = resolve(bracket);
  for (const sec of view.sections) {
    for (const m of sec.matches) {
      if (!m.active || m.bye) skips.add(Number(m.num));
    }
  }
  return skips;
}

export function projectSchedule(event, pIns, rows, sched, nowMs = Date.now(), skips = null) {
  const s = { ...SCHEDULE_DEFAULTS, ...(sched || {}) };
  const courts = Math.max(1, Number(s.courts) || 1);
  const restMs = Math.max(0, Number(s.restMin) || 0) * 60000;
  const g = graphFor(event, pIns);

  let anyStarted = false;
  for (const r of rows.values()) if (r.status === 'live' || r.status === 'final') { anyStarted = true; break; }
  const ds = dayStartMs(event);
  const anchor = anyStarted ? nowMs : Math.max(nowMs, Number.isFinite(ds) ? ds : nowMs);

  // Play-in winner -> East host line isn't a graph ref (it's an r1slots
  // marker in the engine) — same seedOrder patch nextMatchMap uses.
  const hostDep = new Map(); // East R1 match id -> play-in id
  if (event === 'Doubles' && pIns > 0) {
    const order = seedOrder(T);
    for (let k = 0; k < pIns; k++) hostDep.set(`D-E1-${Math.floor(order.indexOf(T - k) / 2)}`, `D-P1-${k}`);
  }
  const depsOf = (m) => {
    const d = [];
    for (const f of [m.aFrom, m.bFrom]) if (f.ref) d.push(f.ref);
    const h = hostDep.get(m.id);
    if (h) d.push(h);
    return d;
  };

  const pool = Array.from({ length: courts }, () => anchor); // court free-at times
  const finish = new Map(); // match id -> projected finish ms (rest applies AFTER this)
  const out = new Map();    // num -> Date projected start (not-yet-final only)

  // Seed the sim with reality: finals freed their courts long ago (and the
  // teams have had their rest — back the finish off by restMs so dependents
  // aren't double-charged); live matches hold a court for ~half a match.
  const pending = [];
  for (const m of g.matches) {
    if (m.resetOf) continue; // GF reset is conditional — never booked
    // Structural byes/walkovers never occupy a court; their "winner" has
    // been through no match, so dependents owe no rest either.
    if (skips && skips.has(Number(m.num))) { finish.set(m.id, anchor - restMs); continue; }
    const row = rows.get(Number(m.num));
    if (row && row.status === 'final') { finish.set(m.id, anchor - restMs); continue; }
    if (row && row.status === 'live') {
      const f = nowMs + (matchMinFor(event, s, m.roundTag) * 60000) / 2;
      let i = 0; for (let j = 1; j < pool.length; j++) if (pool[j] < pool[i]) i = j;
      pool[i] = Math.max(pool[i], f);
      finish.set(m.id, f);
      continue;
    }
    pending.push(m);
  }

  // Path "side" for the owner's East↔West alternation: the East championship
  // path + the East-entry play-ins are the FRONT; West/North/South + play-in
  // consolation are the BACK. Alternating front/back across successive calls
  // keeps every court busy while the half that just played gets its break
  // (the break IS the other side's court time — no extra recovery window).
  const sideOf = (m) => (/west|north|south|consol/i.test(m.roundTag || '') ? 'back' : 'front');

  // List scheduling: repeatedly place the match that can start EARLIEST.
  // Among ties (same court-contended start time):
  //   1. a match that's been kept waiting ≥ AGING_MS beats one that hasn't
  //      (a long championship QF can't be starved by an endless run of
  //      short backdraw calls — the "don't push the final late" guard);
  //   2. both aged → whoever's been ready longest, then bracket play order
  //      (championship path first);
  //   3. neither aged → alternate away from the last-placed side (East↔West),
  //      then SHORTER match first (front-load the placement splits), then
  //      bracket play order.
  const AGING_MS = 30 * 60000;
  let lastSide = null; // side of the most recently placed match
  while (pending.length) {
    let ci = 0; for (let j = 1; j < pool.length; j++) if (pool[j] < pool[ci]) ci = j;
    const courtAt = pool[ci];
    let best = null;
    for (let i = 0; i < pending.length; i++) {
      const m = pending[i];
      const deps = depsOf(m);
      if (deps.some((d) => !finish.has(d))) continue; // upstream still pending
      let ready = anchor;
      for (const d of deps) ready = Math.max(ready, finish.get(d) + restMs);
      const durMs = matchMinFor(event, s, m.roundTag) * 60000;
      const cand = {
        i, m, durMs,
        start: Math.max(ready, courtAt),
        ready,
        pos: playPos({ num: m.num, event }),
        side: sideOf(m),
      };
      if (!best) { best = cand; continue; }
      if (cand.start !== best.start) { if (cand.start < best.start) best = cand; continue; }
      const aC = cand.start - cand.ready >= AGING_MS, aB = best.start - best.ready >= AGING_MS;
      if (aC !== aB) { if (aC) best = cand; continue; }
      if (aC) { // both aged: longest-waiting first, then play order
        if (cand.ready !== best.ready ? cand.ready < best.ready : cand.pos < best.pos) best = cand;
        continue;
      }
      // neither aged: alternate away from the last-placed side first (keep the
      // other half resting), then shorter match, then bracket play order.
      const cAlt = lastSide && cand.side !== lastSide, bAlt = lastSide && best.side !== lastSide;
      if (cAlt !== bAlt) { if (cAlt) best = cand; continue; }
      if (cand.durMs !== best.durMs ? cand.durMs < best.durMs : cand.pos < best.pos) best = cand;
    }
    if (!best) break; // safety: cyclic/unsatisfiable (can't happen in a DAG)
    pending.splice(best.i, 1);
    pool[ci] = best.start + best.durMs;
    finish.set(best.m.id, best.start + best.durMs);
    out.set(best.m.num, new Date(best.start));
    lastSide = best.side;
  }
  return out;
}

// A team's FIRST match from its seed rank alone — for the tracker's
// "your first match" line before ops has posted anything. Mirrors buildDraw
// placement: overflow seeds (17+) and their host seeds open in the play-ins;
// everyone else starts on their East/Winners R1 line. Opponent is either a
// seed rank or a "winner of M29"-style pointer.
export function firstMatchFor(event, pIns, rank, fieldCount = Infinity) {
  if (!rank || rank < 1) return null;
  if (event === 'Doubles') {
    if (rank > T) return rank - 17 < pIns ? { num: 29 + (rank - 17), round: 'Play-in', oppRank: 33 - rank } : null;
    if (pIns > 0 && rank > T - pIns) return { num: 29 + (T - rank), round: 'Play-in', oppRank: 33 - rank };
    const order = seedOrder(T);
    const idx = order.indexOf(rank);
    const k = Math.floor(idx / 2);
    const oppSeed = order[idx ^ 1];
    if (oppSeed > fieldCount) {
      // first-round bye — the real first match is next round, vs the winner
      // of the sibling opening match
      return { num: 9 + Math.floor(k / 2), round: 'QF', oppRank: null, oppFrom: `winner of M${(k ^ 1) + 1}` };
    }
    const oppHost = pIns > 0 && oppSeed > T - pIns;
    return {
      num: k + 1, round: 'R1',
      oppRank: oppHost ? null : oppSeed,
      oppFrom: oppHost ? `winner of M${29 + (T - oppSeed)}` : null,
    };
  }
  const order = seedOrder(32);
  const idx = order.indexOf(rank);
  if (idx < 0) return null;
  const k = Math.floor(idx / 2);
  const oppSeed = order[idx ^ 1];
  if (oppSeed > fieldCount) {
    return { num: 25 + Math.floor(k / 2), round: 'R2', oppRank: null, oppFrom: `winner of M${(k ^ 1) + 1}` };
  }
  return { num: k + 1, round: 'R1', oppRank: oppSeed };
}

// ---------------------------------------------------------------------------
// "FOLLOW MY TEAM" — next-match projection from the engine's feeder graph.
// ---------------------------------------------------------------------------

// Map(num -> { round, win: edge|null, lose: edge|null }) where an edge is
// { num, round, feeders } (feeders = the match nums that block the target).
// A null edge means the path ends there (title match / end of the line).
// Built by scanning graphFor's winner/loser references — the same graph the
// ops engine advances teams with. The only routing not in the graph is the
// play-in-winner -> East host line (an r1slots marker in the engine), patched
// here from the same seedOrder math buildDraw uses. The singles GF reset
// (M63) is condition-dependent (only if the Comeback champ takes M62), so
// M62's branches stay terminal — the tracker shows the generic title copy.
const nextMapCache = new Map();
export function nextMatchMap(event, pIns = 0) {
  const ck = `${event}:${pIns}`;
  if (nextMapCache.has(ck)) return nextMapCache.get(ck);
  const g = graphFor(event, pIns);
  const numOf = new Map(g.matches.map((m) => [m.id, m.num]));
  const map = new Map();
  for (const m of g.matches) if (!map.has(m.num)) map.set(m.num, { round: m.roundTag, win: null, lose: null });
  for (const m of g.matches) {
    if (m.resetOf) continue;
    const feeders = [m.aFrom, m.bFrom].map((f) => (f.ref ? numOf.get(f.ref) : null)).filter((n) => n != null);
    for (const f of [m.aFrom, m.bFrom]) {
      if (!f.ref) continue;
      const src = map.get(numOf.get(f.ref));
      const edge = { num: m.num, round: m.roundTag, feeders };
      if (f.kind === 'winner') src.win = edge; else src.lose = edge;
    }
  }
  if (event === 'Doubles' && pIns > 0) {
    const order = seedOrder(T);
    for (let k = 0; k < pIns; k++) {
      const eastMatch = Math.floor(order.indexOf(T - k) / 2) + 1;
      map.get(29 + k).win = { num: eastMatch, round: 'R1', feeders: [29 + k] };
    }
  }
  nextMapCache.set(ck, map);
  return map;
}

const norm = (s) => (s || '').trim().toLowerCase();

// Dropdown options per event: seed-board names (labeled) merged with any
// names already on posted rows, case-insensitively deduped.
export function teamOptions(seeds, matches, events, labelFor) {
  return events
    .map((event) => {
      const seen = new Map();
      for (const s of seeds || []) {
        if (s.type !== event) continue;
        const label = labelFor(s.name);
        const k = norm(label);
        if (k && !seen.has(k)) seen.set(k, label);
      }
      for (const m of matches || []) {
        if ((m.event || '') !== event) continue;
        for (const n of [m.a, m.b]) {
          const k = norm(n);
          if (k && !seen.has(k)) seen.set(k, String(n).trim());
        }
      }
      return { event, options: [...seen.values()].sort((a, b) => a.localeCompare(b)) };
    })
    .filter((g) => g.options.length > 0);
}

// A team's day: posted matches split played/live/upcoming, plus the projected
// next match(es) that ops hasn't posted yet — "Win → M12 · Championship QF ·
// Waits on M9 · ~10:40". Anchor = live match, else next posted, else last
// final; a pending anchor projects BOTH branches, a decided one projects the
// actual branch until the real row appears.
export function teamTimeline(label, event, matches, sched, nowMs, pIns = 0) {
  const key = norm(label);
  if (!key) return null;
  const hasMe = (n) => { const v = norm(n); return v === key || (!!v && v.includes(key)); };
  const mine = (matches || [])
    .filter((m) => (m.event || '') === event && (hasMe(m.a) || hasMe(m.b)))
    .sort((x, y) => playPos(x) - playPos(y));
  const sideOf = (m) => (hasMe(m.a) ? 'a' : 'b');
  const played = mine.filter((m) => m.status === 'final').map((m) => ({ m, side: sideOf(m), won: m.winner === sideOf(m) }));
  const live = mine.find((m) => m.status === 'live') || null;
  const upcoming = mine.filter((m) => m.status !== 'final' && m.status !== 'live');

  const anchor = live || upcoming[0] || (played.length ? played[played.length - 1].m : null);
  const next = [];
  if (anchor) {
    const info = nextMatchMap(event, pIns).get(Number(anchor.num));
    const postedNums = new Set(mine.map((m) => Number(m.num)));
    const branch = (kind, edge) => {
      if (!edge) return { kind, terminal: true };
      if (postedNums.has(edge.num)) return null; // already visible as a posted row
      const blockers = (edge.feeders || []).filter((f) => f !== Number(anchor.num));
      return {
        kind, num: edge.num,
        stakes: stakesFor(event, edge.round),
        waits: blockers.length ? waitsOnLabel(blockers, matches, event, sched, nowMs) : null,
      };
    };
    if (info) {
      if (anchor.status === 'final') {
        const last = played[played.length - 1];
        const b = branch(last.won ? 'win' : 'lose', last.won ? info.win : info.lose);
        if (b) next.push({ ...b, decided: true });
      } else {
        for (const [kind, edge] of [['win', info.win], ['lose', info.lose]]) {
          const b = branch(kind, edge);
          if (b) next.push(b);
        }
      }
    }
  }
  return { mine, played, live, upcoming, next, anchorNum: anchor ? Number(anchor.num) : null };
}

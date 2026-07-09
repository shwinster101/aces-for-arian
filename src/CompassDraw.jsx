// ==========================================
// COMPASS DRAW CANVAS — the 2025 printed-sheet look, live
// ==========================================
// One spatial canvas mirroring the 2025 Google-Sheet compass players know:
// East flows left→right from the center into a gold champion cell, West
// mirrors it right→left, North rides the top band beside the play-ins,
// South tucks under West. First principles of the printed sheet: names sit
// on strong underline rules, matches read as PAIRS (elbow connectors group
// them), the only ink besides names is a single compact token per match
// ("M2 · ~9:00" / "M1 · Ct 3 LIVE") hugging the connector, and scores ride
// the advancing line. Connectors are border-only grid items on integer row
// math (lib/compass.js) — no SVG, no measurement — so the whole canvas zooms
// with one CSS transform. Paper-light for sunlight; dark tokens one prop away.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { buildCompassModel, COL_W, ROW_H } from './lib/compass';
import { SEED_CUT } from './lib/entrants';

const HDR = 1; // header row offset — model rows are 1-based below the column headers
const GAP = 32;
const PAD = 20;
const WEST_W = 4 * COL_W;
const EAST_W = 5 * COL_W;
const CANVAS_W = PAD * 2 + WEST_W + GAP + EAST_W; // 1640

const THEMES = {
  paper: {
    '--cd-canvas': '#faf7f0', '--cd-ink': '#171310', '--cd-faint': 'rgba(23,19,16,0.52)',
    '--cd-rule': '#57534e', '--cd-gold': '#996c00', '--cd-gold-bg': '#fbbf24',
    '--cd-hit': 'rgba(251,191,36,0.45)', '--cd-live': '#047857', '--cd-live-bg': 'rgba(4,120,87,0.09)',
    '--cd-panel': '#f3ede1', '--cd-border': '#d8d2c4',
  },
  dark: {
    '--cd-canvas': '#101010', '--cd-ink': '#e4e4e7', '--cd-faint': 'rgba(228,228,231,0.45)',
    '--cd-rule': '#71717a', '--cd-gold': '#fbbf24', '--cd-gold-bg': '#fbbf24',
    '--cd-hit': 'rgba(251,191,36,0.25)', '--cd-live': '#34d399', '--cd-live-bg': 'rgba(52,211,153,0.09)',
    '--cd-panel': '#171717', '--cd-border': '#27272a',
  },
};

// One draw line: a name sitting on an underline rule, sheet-style. Names all
// start flush-left; the seed badge rides the RIGHT edge so alignment never
// staggers. The feeder's score is pinned to the empty top half of the cell.
function LineCell({ l, highlight, mirrored, hdr = HDR }) {
  const hit = !!(highlight && l.kind === 'name' && !l.wo && l.name && l.name.toLowerCase().includes(highlight));
  const text = l.kind === 'name' ? l.name : l.kind === 'bye' ? 'BYE' : l.kind === 'from' ? l.from : '';
  const faded = l.kind !== 'name' || l.wo;
  return (
    <div
      data-hit={hit || undefined}
      style={{
        gridColumn: l.col, gridRow: l.row + hdr,
        background: hit ? 'var(--cd-hit)' : l.live ? 'var(--cd-live-bg)' : undefined,
        borderBottom: `1.5px solid ${l.live ? 'var(--cd-live)' : 'var(--cd-rule)'}`,
      }}
      className="relative flex items-end gap-1 px-1.5 min-w-0"
    >
      <span
        className={`text-[10px] leading-tight pb-px truncate ${faded ? 'italic font-normal' : hit ? 'font-black' : 'font-semibold'}`}
        style={{ color: l.live ? 'var(--cd-live)' : faded ? 'var(--cd-faint)' : 'var(--cd-ink)' }}
        title={l.kind === 'name' ? l.name : undefined}
      >
        {text}{l.wo ? ' (bye)' : ''}
      </span>
      <span className="ml-auto shrink-0 flex items-end gap-1">
        {l.live && l.court && (
          <span className="text-[8px] font-black pb-px" style={{ color: 'var(--cd-live)' }}>Ct {l.court}</span>
        )}
        {l.seed != null && l.seed <= SEED_CUT && l.kind === 'name' && !l.wo && (
          <span className="text-[8px] font-mono font-bold pb-px" style={{ color: 'var(--cd-gold)' }}>{l.seed}</span>
        )}
      </span>
      {l.score && (
        <span className="absolute top-0 text-[8px] font-mono font-bold whitespace-nowrap" style={{ color: 'var(--cd-gold)', [mirrored ? 'left' : 'right']: '6px' }}>{l.score}</span>
      )}
    </div>
  );
}

// ONE compact token per match — "M2 · ~9:00 AM" scheduled, "M1 · Ct 3 LIVE"
// live, bare "M2" otherwise — hugging the connector edge so it reads as the
// pair's metadata, never as a third line of text.
function MetaCell({ m, clockFor, mirrored, hdr = HDR }) {
  let extra = null, color = 'var(--cd-faint)';
  if (m.live) { extra = m.court ? `Ct ${m.court} LIVE` : 'LIVE'; color = 'var(--cd-live)'; }
  else if (m.posted && !m.final && clockFor) { const c = clockFor(m.num); if (c) { extra = c; color = 'var(--cd-gold)'; } }
  return (
    <div
      style={{ gridColumn: m.col, gridRow: m.row + hdr, justifyContent: mirrored ? 'flex-start' : 'flex-end' }}
      className="flex items-start gap-1 px-2 pt-px min-w-0"
    >
      <span className="text-[8px] font-mono font-bold whitespace-nowrap" style={{ color: 'var(--cd-faint)' }}>M{m.num}</span>
      {extra && <span className="text-[8px] font-mono font-bold whitespace-nowrap" style={{ color }}>· {extra}</span>}
    </div>
  );
}

function DirectionGrid({ g, clockFor, highlight }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${g.cols}, ${COL_W}px)`, gridAutoRows: `${ROW_H}px` }}>
      {g.headers.map((h, i) => (
        <div key={`h${i}`} style={{ gridColumn: i + 1, gridRow: 1, textAlign: g.mirrored ? 'right' : 'left' }} className="px-1.5 text-[8px] font-bold uppercase tracking-[0.14em] self-center truncate">
          <span style={{ color: 'var(--cd-faint)' }}>{h}</span>
        </div>
      ))}
      {g.lines.map((l) => <LineCell key={l.key} l={l} highlight={highlight} mirrored={g.mirrored} />)}
      {g.connectors.map((c) => (
        <div
          key={c.key}
          style={{
            gridColumn: c.col, gridRow: `${c.rowStart + 1 + HDR} / ${c.rowEnd + 1 + HDR}`,
            [g.mirrored ? 'borderLeft' : 'borderRight']: `1.5px solid ${c.live ? 'var(--cd-live)' : 'var(--cd-rule)'}`,
          }}
        />
      ))}
      {g.metas.map((m) => <MetaCell key={m.key} m={m} clockFor={clockFor} mirrored={g.mirrored} />)}
      {g.winner && (
        <div style={{ gridColumn: g.winner.col, gridRow: g.winner.row + HDR, textAlign: g.mirrored ? 'right' : 'left' }} className="px-1.5 pt-0.5 text-[8px] font-black uppercase tracking-widest">
          <span style={{ color: 'var(--cd-gold)' }}>{g.winner.caption}</span>
        </div>
      )}
      {g.champion && (
        <div style={{ gridColumn: 5, gridRow: `${15 + HDR} / ${20 + HDR}` }} className="flex items-center pl-2">
          <div className="w-full rounded-lg border-2 px-3 py-2" style={{ borderColor: 'var(--cd-gold)', background: 'rgba(251,191,36,0.18)' }}>
            <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--cd-gold)' }}>🏆 2026 Champions</div>
            <div className="text-[11px] font-black truncate" style={{ color: 'var(--cd-ink)' }} title={g.champion.name || undefined}>{g.champion.name || 'Winner of M15'}</div>
            {g.champion.score && <div className="text-[8px] font-mono font-bold mt-0.5" style={{ color: 'var(--cd-gold)' }}>{g.champion.score}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// Play-in / consolation panels — the sheet's top-left slot (first on court).
// Two rules per match, one compact meta line, no prose.
function PairPanel({ dataDir, title, items, clockFor, highlight }) {
  if (!items || !items.length) return null;
  return (
    <div data-dir={dataDir} className="rounded-lg border px-3 pt-1.5 pb-2.5 shrink-0" style={{ background: 'var(--cd-panel)', borderColor: 'var(--cd-border)' }}>
      <div className="text-[9px] font-black uppercase tracking-[0.14em] mb-1.5" style={{ color: 'var(--cd-faint)' }}>{title}</div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {items.map((p) => {
          let extra = null, color = 'var(--cd-gold)';
          if (p.meta.live) { extra = p.meta.court ? `Ct ${p.meta.court} LIVE` : 'LIVE'; color = 'var(--cd-live)'; }
          else if (p.meta.posted && !p.meta.final && clockFor) extra = clockFor(p.num);
          return (
            <div key={p.num} style={{ width: COL_W }}>
              <div className="grid" style={{ gridTemplateColumns: `${COL_W}px`, gridAutoRows: `${ROW_H}px` }}>
                <LineCell l={p.a} highlight={highlight} hdr={0} />
                <LineCell l={p.b} highlight={highlight} hdr={0} />
              </div>
              <div className="flex items-baseline gap-1 pt-0.5 min-w-0">
                <span className="shrink-0 text-[8px] font-mono font-bold" style={{ color: 'var(--cd-faint)' }}>M{p.num}</span>
                {extra && <span className="shrink-0 text-[8px] font-mono font-bold" style={{ color }}>· {extra}</span>}
                {p.note && <span className="text-[8px] truncate" style={{ color: 'var(--cd-faint)' }} title={p.note}>· {p.note}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DirLabel({ children, caption }) {
  return (
    <div className="flex items-baseline gap-2.5 mb-0.5">
      <span className="text-xl font-black uppercase tracking-wide leading-none" style={{ color: 'var(--cd-ink)' }}>{children}</span>
      {caption && <span className="text-[8px] font-semibold" style={{ color: 'var(--cd-faint)' }}>{caption}</span>}
    </div>
  );
}

const JUMPS = [
  ['playin', 'Play-ins'], ['west', 'West'], ['east', 'East'], ['north', 'North'], ['south', 'South'],
];

export default function CompassDraw({
  eastNames, teams, pIns = 0, rowsByNum, clockFor, highlight = '', showByes = false,
  theme = 'paper', title = 'Aces for Arian 2026 Doubles',
}) {
  // Cheap to rebuild every render (a few hundred tiny objects); rowsByNum is
  // a fresh Map each App render, so memoizing on it would never hit anyway.
  const model = buildCompassModel({ eastNames, teams, pIns, rows: rowsByNum, showByes });
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [fit, setFit] = useState(true);
  const [scale, setScale] = useState(1);
  const [natH, setNatH] = useState(1300);

  useLayoutEffect(() => {
    const measure = () => {
      const wrapW = wrapRef.current ? wrapRef.current.clientWidth : CANVAS_W;
      setScale(fit ? Math.max(0.15, Math.min(1, wrapW / CANVAS_W)) : 1);
      // transform doesn't affect offsetHeight, so this reads the natural size
      if (canvasRef.current) setNatH(canvasRef.current.offsetHeight);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [fit, pIns]);

  // Offset of an element relative to the canvas root (the only positioned
  // ancestor inside it), in unscaled canvas pixels.
  const offsetIn = (el) => {
    let x = 0, y = 0, n = el;
    while (n && n !== canvasRef.current) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y };
  };
  const jumpTo = (dir) => {
    const el = canvasRef.current && canvasRef.current.querySelector(`[data-dir="${dir}"]`);
    if (!el || !wrapRef.current) return;
    const { x, y } = offsetIn(el);
    wrapRef.current.scrollTo({ left: Math.max(0, x * scale - 16), top: Math.max(0, y * scale - 16), behavior: 'smooth' });
  };

  // "Find yourself" — bring the first highlighted line into view.
  useEffect(() => {
    if (!highlight || !canvasRef.current || !wrapRef.current) return;
    const el = canvasRef.current.querySelector('[data-hit]');
    if (!el) return;
    const wrap = wrapRef.current;
    const { x, y } = offsetIn(el);
    wrap.scrollTo({ left: Math.max(0, x * scale - wrap.clientWidth / 2), top: Math.max(0, y * scale - wrap.clientHeight / 3), behavior: 'smooth' });
  }, [highlight, scale]);

  const chip = (active) => `whitespace-nowrap px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg border transition ${active ? 'bg-[#fbbf24] text-black border-[#fbbf24]' : 'bg-[#111] text-zinc-400 border-zinc-800 hover:bg-zinc-900'}`;

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <div className="flex gap-1">
          <button onClick={() => setFit(true)} className={chip(fit)}>Fit</button>
          <button onClick={() => setFit(false)} className={chip(!fit)}>100%</button>
        </div>
        <span className="w-px h-4 bg-zinc-800 mx-1 hidden sm:block" />
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {JUMPS.filter(([d]) => d !== 'playin' || model.playIns.length > 0).map(([d, label]) => (
            <button key={d} onClick={() => { setFit(false); setTimeout(() => jumpTo(d), 60); }} className={chip(false)}>{label}</button>
          ))}
        </div>
        <span className="text-[10px] text-zinc-600 ml-auto hidden md:block">Fit shows the whole sheet — 100% to read, drag to pan.</span>
      </div>
      <div ref={wrapRef} className="overflow-auto rounded-2xl border border-zinc-800 max-h-[82vh] overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div style={{ width: CANVAS_W * scale, height: natH * scale }}>
          <div
            ref={canvasRef}
            className="relative"
            style={{ width: CANVAS_W, padding: PAD, transform: `scale(${scale})`, transformOrigin: 'top left', background: 'var(--cd-canvas)', ...(THEMES[theme] || THEMES.paper) }}
          >
            {/* Top band: gold banner over [play-ins | consolation | North].
                North lives up here (right side) like the sheet's top row —
                no dead band between the panels and the main draws. */}
            <div className="flex justify-center mb-3">
              <div className="px-6 py-1.5 rounded font-black uppercase tracking-widest text-sm text-center" style={{ background: 'var(--cd-gold-bg)', color: '#3b2405' }}>
                {title} · Compass Draw
              </div>
            </div>
            <div className="flex items-end gap-5 mb-4">
              {model.playIns.length > 0 && (
                <div className="flex flex-col gap-2 shrink-0" style={{ maxWidth: 4 * COL_W + 120 }}>
                  <PairPanel dataDir="playin" title="Play-ins · first on court Saturday" items={model.playIns} clockFor={clockFor} highlight={highlight} />
                  <PairPanel title="Play-in consolation · everyone plays twice" items={model.consolation} clockFor={clockFor} highlight={highlight} />
                </div>
              )}
              <div data-dir="north" className="ml-auto shrink-0" style={{ width: 3 * COL_W, marginRight: COL_W }}>
                <DirLabel caption="East quarterfinal exits — placement path">North</DirLabel>
                <DirectionGrid g={model.north} clockFor={clockFor} highlight={highlight} />
              </div>
            </div>

            {/* Main band: West mirrored ← | → East to the champion cell */}
            <div className="flex items-start" style={{ gap: GAP }}>
              <div data-dir="west">
                <DirLabel caption="East Round-of-16 exits — second path">West</DirLabel>
                <DirectionGrid g={model.west} clockFor={clockFor} highlight={highlight} />
              </div>
              <div data-dir="east">
                <DirLabel caption="Championship path — every team starts here">East</DirLabel>
                <DirectionGrid g={model.east} clockFor={clockFor} highlight={highlight} />
              </div>
            </div>

            {/* Bottom band: South tucked under the West bracket */}
            <div data-dir="south" className="-mt-1" style={{ marginLeft: COL_W, width: 3 * COL_W }}>
              <DirLabel caption="Opening West-round exits — final placement path">South</DirLabel>
              <DirectionGrid g={model.south} clockFor={clockFor} highlight={highlight} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

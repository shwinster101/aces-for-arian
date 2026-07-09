// ==========================================
// COMPASS DRAW CANVAS — the 2025 printed-sheet look, live
// ==========================================
// One spatial canvas: East flows left→right from the center column to a gold
// champion cell; West mirrors it right→left; North sits above, South below —
// the same geography as the 2025 Google-Sheet compass players already know.
// Names sit on underline rules (no boxes), winners advance with the score
// printed under the advancing name, connectors are border-only grid items
// (integer row math from lib/compass.js — no SVG, no measurement), so the
// whole canvas zooms with a single CSS transform. Paper-light by default for
// sunlight readability courtside; a dark token set is one prop away.
// Purely presentational: all data arrives resolved via buildCompassModel.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { buildCompassModel, COL_W, ROW_H } from './lib/compass';
import { SEED_CUT } from './lib/entrants';

const HDR = 1; // header row offset — model rows are 1-based below the column headers
const GAP = 40;
const PAD = 24;
const WEST_W = 4 * COL_W;
const EAST_W = 5 * COL_W;
const CANVAS_W = PAD * 2 + WEST_W + GAP + EAST_W; // 1672
const NORTH_OFF = WEST_W + GAP + COL_W;           // over East QF/SF
const SOUTH_OFF = 96;                             // under the West bracket

const THEMES = {
  paper: {
    '--cd-canvas': '#faf7f0', '--cd-ink': '#1c1917', '--cd-faint': 'rgba(28,25,23,0.45)',
    '--cd-rule': '#a8a29e', '--cd-gold': '#a16207', '--cd-gold-bg': '#fbbf24',
    '--cd-hit': 'rgba(251,191,36,0.4)', '--cd-live': '#047857', '--cd-live-bg': 'rgba(4,120,87,0.08)',
    '--cd-panel': '#f4efe4', '--cd-border': '#d6d3d1',
  },
  dark: {
    '--cd-canvas': '#101010', '--cd-ink': '#e4e4e7', '--cd-faint': 'rgba(228,228,231,0.4)',
    '--cd-rule': '#52525b', '--cd-gold': '#fbbf24', '--cd-gold-bg': '#fbbf24',
    '--cd-hit': 'rgba(251,191,36,0.22)', '--cd-live': '#34d399', '--cd-live-bg': 'rgba(52,211,153,0.08)',
    '--cd-panel': '#171717', '--cd-border': '#27272a',
  },
};

// One draw line: a name sitting on an underline rule, sheet-style.
function LineCell({ l, highlight, mirrored, hdr = HDR }) {
  const hit = !!(highlight && l.kind === 'name' && !l.wo && l.name && l.name.toLowerCase().includes(highlight));
  const text = l.kind === 'name' ? l.name : l.kind === 'bye' ? 'BYE' : l.kind === 'from' ? l.from : 'TBD';
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
      {l.seed != null && l.seed <= SEED_CUT && l.kind === 'name' && !l.wo && (
        <span className="shrink-0 mb-0.5 text-[8px] font-mono font-bold rounded px-1 border" style={{ color: 'var(--cd-gold)', borderColor: 'var(--cd-gold)' }}>{l.seed}</span>
      )}
      <span
        className={`text-[10px] leading-tight pb-px truncate ${faded ? 'italic' : hit ? 'font-black' : 'font-semibold'}`}
        style={{ color: l.live ? 'var(--cd-live)' : faded ? 'var(--cd-faint)' : 'var(--cd-ink)' }}
        title={l.kind === 'name' ? l.name : undefined}
      >
        {text}{l.wo ? ' (bye)' : ''}
      </span>
      {l.live && l.court && (
        <span className="ml-auto shrink-0 mb-0.5 text-[8px] font-black" style={{ color: 'var(--cd-live)' }}>Ct {l.court}</span>
      )}
      {/* score of the feeder match rides with the advancing name — pinned to
          the empty top half of the 26px cell so it can never collide with
          the match-meta chip that lives in the grid cell below the line */}
      {l.score && (
        <span className="absolute top-0.5 text-[8px] font-mono font-bold whitespace-nowrap" style={{ color: 'var(--cd-gold)', [mirrored ? 'left' : 'right']: '6px' }}>{l.score}</span>
      )}
    </div>
  );
}

// Match number + live/estimate chip on the spare row under the lower feeder.
function MetaCell({ m, estFor, mirrored, hdr = HDR }) {
  let text = null;
  let color = 'var(--cd-gold)';
  if (m.live) { text = m.court ? `Court ${m.court} · LIVE` : 'LIVE'; color = 'var(--cd-live)'; }
  else if (m.posted && !m.final && estFor) text = estFor(m.num);
  return (
    <div
      style={{ gridColumn: m.col, gridRow: m.row + hdr, justifyContent: mirrored ? 'flex-end' : 'flex-start' }}
      className="flex items-start gap-1.5 px-1.5 pt-0.5 min-w-0"
    >
      <span className="shrink-0 text-[8px] font-mono font-bold" style={{ color: 'var(--cd-faint)' }}>M{m.num}</span>
      {text && <span className="text-[8px] font-bold truncate" style={{ color }} title={text}>{text}</span>}
    </div>
  );
}

// One direction's bracket as a single CSS grid — lines, elbow connectors
// (border-right, or border-LEFT when mirrored for West), metas, and captions
// all placed by integer (row, col) from the model.
function DirectionGrid({ g, estFor, highlight }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${g.cols}, ${COL_W}px)`, gridAutoRows: `${ROW_H}px` }}>
      {g.headers.map((h, i) => (
        <div key={`h${i}`} style={{ gridColumn: i + 1, gridRow: 1, textAlign: g.mirrored ? 'right' : 'left' }} className="px-1.5 text-[9px] font-black uppercase tracking-widest self-center truncate" >
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
      {g.metas.map((m) => <MetaCell key={m.key} m={m} estFor={estFor} mirrored={g.mirrored} />)}
      {g.winner && (
        <div style={{ gridColumn: g.winner.col, gridRow: g.winner.row + HDR, textAlign: g.mirrored ? 'right' : 'left' }} className="px-1.5 pt-0.5 text-[8px] font-black uppercase tracking-widest" >
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

// Play-in / consolation panels — compact pairs in the sheet's top-left slot
// (play-ins go on court first, so first-read position).
function PairPanel({ dataDir, title, sub, items, estFor, highlight }) {
  if (!items || !items.length) return null;
  return (
    <div data-dir={dataDir} className="rounded-xl border px-3 pt-2 pb-3" style={{ background: 'var(--cd-panel)', borderColor: 'var(--cd-border)' }}>
      <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--cd-ink)' }}>{title}</div>
      {sub && <div className="text-[8px] mb-1.5" style={{ color: 'var(--cd-faint)' }}>{sub}</div>}
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {items.map((p) => {
          let metaText = null;
          let metaColor = 'var(--cd-gold)';
          if (p.meta.live) { metaText = p.meta.court ? `Court ${p.meta.court} · LIVE` : 'LIVE'; metaColor = 'var(--cd-live)'; }
          else if (p.meta.posted && !p.meta.final && estFor) metaText = estFor(p.num);
          return (
            <div key={p.num} style={{ width: COL_W }}>
              <div className="grid" style={{ gridTemplateColumns: `${COL_W}px`, gridAutoRows: `${ROW_H}px` }}>
                <LineCell l={p.a} highlight={highlight} hdr={0} />
                <LineCell l={p.b} highlight={highlight} hdr={0} />
              </div>
              <div className="flex items-baseline gap-1.5 pt-1 min-w-0">
                <span className="shrink-0 text-[8px] font-mono font-bold" style={{ color: 'var(--cd-faint)' }}>M{p.num}</span>
                {metaText && <span className="text-[8px] font-bold truncate" style={{ color: metaColor }} title={metaText}>{metaText}</span>}
              </div>
              {p.note && <div className="text-[8px] truncate" style={{ color: 'var(--cd-faint)' }} title={p.note}>{p.note}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DirLabel({ children, caption }) {
  return (
    <div className="flex items-baseline gap-3 mb-1">
      <span className="text-2xl font-black uppercase tracking-wide" style={{ color: 'var(--cd-ink)' }}>{children}</span>
      {caption && <span className="text-[9px] font-semibold" style={{ color: 'var(--cd-faint)' }}>{caption}</span>}
    </div>
  );
}

const JUMPS = [
  ['playin', 'Play-ins'], ['west', 'West'], ['east', 'East'], ['north', 'North'], ['south', 'South'],
];

export default function CompassDraw({
  eastNames, teams, pIns = 0, rowsByNum, estFor, highlight = '', showByes = false,
  theme = 'paper', title = 'Aces for Arian 2026 Doubles',
}) {
  // Cheap to rebuild every render (a few hundred tiny objects); rowsByNum is
  // a fresh Map each App render, so memoizing on it would never hit anyway.
  const model = buildCompassModel({ eastNames, teams, pIns, rows: rowsByNum, showByes });
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [fit, setFit] = useState(true);
  const [scale, setScale] = useState(1);
  const [natH, setNatH] = useState(1500);

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
      <div ref={wrapRef} className="overflow-auto rounded-2xl border border-zinc-800 max-h-[80vh] overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div style={{ width: CANVAS_W * scale, height: natH * scale }}>
          <div
            ref={canvasRef}
            className="relative"
            style={{ width: CANVAS_W, padding: PAD, transform: `scale(${scale})`, transformOrigin: 'top left', background: 'var(--cd-canvas)', ...(THEMES[theme] || THEMES.paper) }}
          >
            <div className="flex justify-center mb-5">
              <div className="px-6 py-2 rounded font-black uppercase tracking-widest text-sm text-center" style={{ background: 'var(--cd-gold-bg)', color: '#3b2405' }}>
                {title} · Compass Draw
              </div>
            </div>

            {model.playIns.length > 0 && (
              <div className="flex items-start gap-6 mb-5">
                <PairPanel dataDir="playin" title="Play-in — Round of 32" sub="First on court Saturday — winners take the open East lines" items={model.playIns} estFor={estFor} highlight={highlight} />
                <PairPanel title="Play-in Consolation" sub="Play-in first-round teams rotate here — everyone plays at least twice" items={model.consolation} estFor={estFor} highlight={highlight} />
              </div>
            )}

            <div data-dir="north" className="mb-3" style={{ marginLeft: NORTH_OFF, width: 3 * COL_W }}>
              <DirLabel caption="East quarterfinal exits — placement path">North</DirLabel>
              <DirectionGrid g={model.north} estFor={estFor} highlight={highlight} />
            </div>

            <div className="flex items-start" style={{ gap: GAP }}>
              <div data-dir="west">
                <DirLabel caption="East Round-of-16 exits — second path">West</DirLabel>
                <DirectionGrid g={model.west} estFor={estFor} highlight={highlight} />
              </div>
              <div data-dir="east">
                <DirLabel caption="Championship path — every team starts here">East</DirLabel>
                <DirectionGrid g={model.east} estFor={estFor} highlight={highlight} />
              </div>
            </div>

            <div data-dir="south" className="mt-3" style={{ marginLeft: SOUTH_OFF, width: 3 * COL_W }}>
              <DirLabel caption="Opening West-round exits — final placement path">South</DirLabel>
              <DirectionGrid g={model.south} estFor={estFor} highlight={highlight} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

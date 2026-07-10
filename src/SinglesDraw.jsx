// ==========================================
// SINGLES DRAW CANVAS — 32 double elimination, sheet-style
// ==========================================
// Same visual grammar as the doubles compass (shared primitives): names on
// underline rules, elbow connectors grouping matches, one compact token per
// match ("M2 · ~9:00 AM" / "Ct 5 LIVE"), scores riding the advancing line,
// projected times on EVERY match from the 9-court simulation. Layout:
// Winners bracket left (Round of 32 → Winners Final), Grand Final panel to
// its right, full Comeback backdraw below — pair-up rounds halve, drop-in
// rounds meet a fresh loser from the winners side (reversed order, per the
// engine). Gate: mounted only when DRAWS_PUBLIC.Singles flips.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { buildDoubleElimModel, COL_W, THEMES } from './lib/compass';
import { LineCell, DirectionGrid, DirLabel } from './CompassDraw';

const PAD = 20;
const CANVAS_W = PAD * 2 + 9 * COL_W; // comeback is the widest band (1840 @ COL_W 200)

const JUMPS = [['winners', 'Winners'], ['comeback', 'Comeback'], ['gf', 'Grand Final']];

export default function SinglesDraw({
  names, rowsByNum, clockFor, highlight = '', nextNum = null, showByes = false,
  theme = 'paper', title = 'Aces for Arian 2026 Singles',
}) {
  const model = buildDoubleElimModel({ names, rows: rowsByNum, showByes });
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [fit, setFit] = useState(true);
  const [scale, setScale] = useState(1);
  const [natH, setNatH] = useState(2400);

  useLayoutEffect(() => {
    const measure = () => {
      const wrapW = wrapRef.current ? wrapRef.current.clientWidth : CANVAS_W;
      setScale(fit ? Math.max(0.15, Math.min(1, wrapW / CANVAS_W)) : 1);
      if (canvasRef.current) setNatH(canvasRef.current.offsetHeight);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [fit]);

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

  // Phones land READING the Winners R32 matchups at 100%; Fit is one tap away.
  useEffect(() => {
    const wrapW = wrapRef.current ? wrapRef.current.clientWidth : CANVAS_W;
    if (wrapW < 700) {
      setFit(false);
      const t = setTimeout(() => jumpTo('winners'), 200);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Bring your NEXT match (▸ Next cell) into view first, else the first name hit.
  useEffect(() => {
    if ((!highlight && nextNum == null) || !canvasRef.current || !wrapRef.current) return;
    const el = canvasRef.current.querySelector('[data-next]') || canvasRef.current.querySelector('[data-hit]');
    if (!el) return;
    const wrap = wrapRef.current;
    const { x, y } = offsetIn(el);
    wrap.scrollTo({ left: Math.max(0, x * scale - wrap.clientWidth / 2), top: Math.max(0, y * scale - wrap.clientHeight / 3), behavior: 'smooth' });
  }, [highlight, nextNum, scale]);

  const chip = (active) => `whitespace-nowrap px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg border transition ${active ? 'bg-[#fbbf24] text-black border-[#fbbf24]' : 'bg-[#111] text-zinc-400 border-zinc-800 hover:bg-zinc-900'}`;

  // Grand Final panel — the two champions' lines + the conditional reset note.
  const gfMeta = model.gf.meta;
  let gfExtra = null, gfColor = 'var(--cd-gold)';
  if (gfMeta.live) { gfExtra = gfMeta.court ? `Ct ${gfMeta.court} LIVE` : 'LIVE'; gfColor = 'var(--cd-live)'; }
  else if (!gfMeta.final && clockFor) gfExtra = clockFor(62);

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <div className="flex gap-1">
          <button onClick={() => setFit(true)} className={chip(fit)}>Fit</button>
          <button onClick={() => setFit(false)} className={chip(!fit)}>100%</button>
        </div>
        <span className="w-px h-4 bg-zinc-800 mx-1 hidden sm:block" />
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {JUMPS.map(([d, label]) => (
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
            <div className="flex justify-center mb-3">
              <div className="px-6 py-1.5 rounded font-black uppercase tracking-widest text-sm text-center" style={{ background: 'var(--cd-gold-bg)', color: '#3b2405' }}>
                {title} · Double Elimination
              </div>
            </div>

            {/* Main band: Winners bracket | Grand Final panel */}
            <div className="flex items-start gap-8">
              <div data-dir="winners" className="shrink-0">
                <DirLabel caption="Championship path — lose here and you drop to the Comeback bracket">Winners</DirLabel>
                <DirectionGrid g={model.winners} clockFor={clockFor} highlight={highlight} nextNum={nextNum} />
              </div>
              <div data-dir="gf" className="shrink-0 mt-10" style={{ width: COL_W + 24 }}>
                <div className="rounded-lg border px-3 pt-1.5 pb-2.5" style={{ background: 'var(--cd-panel)', borderColor: 'var(--cd-border)' }}>
                  <div className="text-[9px] font-black uppercase tracking-[0.14em] mb-1.5" style={{ color: 'var(--cd-faint)' }}>Grand Final</div>
                  <div className="grid" style={{ gridTemplateColumns: `${COL_W}px`, gridAutoRows: '22px' }}>
                    <LineCell l={model.gf.a} highlight={highlight} hdr={0} />
                    <LineCell l={model.gf.b} highlight={highlight} hdr={0} />
                  </div>
                  <div className="flex items-baseline gap-1 pt-1 min-w-0">
                    <span className="shrink-0 text-[8px] font-mono font-bold" style={{ color: 'var(--cd-faint)' }}>M62</span>
                    {gfExtra && <span className="shrink-0 text-[8px] font-mono font-bold" style={{ color: gfColor }}>· {gfExtra}</span>}
                  </div>
                  <p className="text-[8px] leading-snug mt-1" style={{ color: 'var(--cd-faint)' }}>
                    {model.gf.reset
                      ? 'Bracket reset — M63 is ON: the Comeback champ took the Grand Final.'
                      : 'If the Comeback champ wins, a deciding reset (M63) is played — the Winners champ has not lost a match yet.'}
                  </p>
                </div>
                <div className="rounded-lg border-2 px-3 py-2 mt-3" style={{ borderColor: 'var(--cd-gold)', background: 'rgba(251,191,36,0.18)' }}>
                  <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--cd-gold)' }}>🏆 2026 Champion</div>
                  <div className="text-[11px] font-black truncate" style={{ color: 'var(--cd-ink)' }} title={model.champion.name || undefined}>{model.champion.name || 'Winner of M62'}</div>
                  {model.champion.score && <div className="text-[8px] font-mono font-bold mt-0.5" style={{ color: 'var(--cd-gold)' }}>{model.champion.score}</div>}
                </div>
              </div>
            </div>

            {/* Comeback backdraw below — every player's second life. A top rule +
                faint tint separates the second-life bracket from the Winners grid. */}
            <div data-dir="comeback" className="mt-4 pt-3 rounded-lg" style={{ borderTop: '2px solid var(--cd-border)', background: 'var(--cd-panel)' }}>
              <DirLabel caption="Lose once, fight back — drop-in rounds (dashed line) meet a fresh loser falling from the Winners side">Comeback</DirLabel>
              <DirectionGrid g={model.comeback} clockFor={clockFor} highlight={highlight} nextNum={nextNum} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

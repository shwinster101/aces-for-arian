// ==========================================
// FOLLOW MY TEAM — pick your name once, see your whole day
// ==========================================
// Dropdown of every entrant in the PUBLIC events (a hidden event contributes
// zero names — reveal-gate discipline), persisted per device. Shows played
// results, the live court, the next posted match with its estimate, and the
// projected win/lose paths from the engine's feeder graph ("Win → M12 ·
// Championship QF · Waits on M9 · ~10:40") before ops even posts the row.
// Selecting also drives the draw highlight, so the compass lights up and
// scrolls to your line.

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { teamOptions, teamTimeline, firstMatchFor } from './lib/compass';
import { estimateLabel, stakesFor } from './lib/schedule';

const LS_KEY = 'a4a-follow';
const EVENT_LABEL = { Doubles: 'Saturday Doubles', Singles: 'Sunday Singles' };

function loadSel() {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    return v && v.event && v.label ? v : null;
  } catch { return null; }
}

export default function TeamTracker({ seeds, matches, events, labelFor, nameFor, sched, now, pInsFor, clocks, onHighlight, onNextMatch, query = '', onQuery }) {
  const groups = teamOptions(seeds, matches, events, labelFor);
  const [sel, setSel] = useState(loadSel);

  // Restore highlight for a remembered pick — but never for a hidden event.
  useEffect(() => {
    if (sel && events.includes(sel.event) && onHighlight) onHighlight(sel.label);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (raw) => {
    let next = null;
    if (raw) { try { next = JSON.parse(raw); } catch { next = null; } }
    setSel(next);
    try {
      if (next) localStorage.setItem(LS_KEY, JSON.stringify(next));
      else localStorage.removeItem(LS_KEY);
    } catch { /* private mode — selection just won't persist */ }
    if (onHighlight) onHighlight(next ? next.label : '');
  };

  const active = sel && events.includes(sel.event) ? sel : null;
  const selValue = active ? JSON.stringify({ event: active.event, label: active.label }) : '';
  const tl = active ? teamTimeline(active.label, active.event, matches, sched, now, pInsFor(active.event)) : null;

  // Your NEXT match to play — the one the draw sheet rings with "▸ Next" and
  // scrolls to. Priority: on court now → next posted → the projected next round
  // once you've won (not yet posted) → your first match before anything posts.
  const nextNum = (() => {
    if (!active || !tl) return null;
    if (tl.live) return Number(tl.live.num);
    if (tl.upcoming[0]) return Number(tl.upcoming[0].num);
    const decided = (tl.next || []).find((b) => b.decided && !b.terminal && b.num != null);
    if (decided) return Number(decided.num);
    if (!tl.mine.length) {
      const seedRow = (seeds || []).find((s) => s.type === active.event && labelFor(s.name).toLowerCase() === active.label.toLowerCase());
      const fieldCount = (seeds || []).filter((s) => s.type === active.event).length;
      const fm = seedRow ? firstMatchFor(active.event, pInsFor(active.event), seedRow.rank, fieldCount) : null;
      return fm ? Number(fm.num) : null;
    }
    return null;
  })();
  const activeEvent = active ? active.event : null;
  const activeLabel = active ? active.label : null;
  // Push the ring target up to App (per event) whenever the pick or the day moves.
  useEffect(() => {
    if (onNextMatch) onNextMatch(activeEvent && nextNum != null ? { event: activeEvent, num: nextNum } : null);
  }, [activeEvent, activeLabel, nextNum, onNextMatch]);

  // Opponents display in board style (first names) when App provides the
  // formatter; the dropdown keeps full labels for identity.
  const show = (s) => (nameFor ? nameFor(s) : s) || 'TBD';
  const oppOf = (m, side) => show((side === 'a' ? m.b : m.a));

  return (
    <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-6">
      <div className="flex items-center gap-3 mb-1">
        <Search className="w-5 h-5 text-[#fbbf24]" />
        <h3 className="text-base font-black text-white uppercase tracking-wider">Follow my team</h3>
      </div>
      <p className="text-xs text-zinc-500 mb-4 max-w-2xl leading-relaxed">
        Pick yourself once — this device remembers. Results, your live court, and where you go next (win <em>or</em> lose) with estimated times, straight from the draw.
      </p>
      <select
        value={selValue}
        onChange={(e) => pick(e.target.value)}
        className="w-full max-w-sm bg-[#111] border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-[#fbbf24]/40 transition-colors"
      >
        <option value="">— Pick your team or name —</option>
        {groups.map((g) => (
          <optgroup key={g.event} label={EVENT_LABEL[g.event] || g.event}>
            {g.options.map((label) => (
              <option key={label} value={JSON.stringify({ event: g.event, label })}>{label}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {tl && (
        <div className="mt-4 space-y-1.5">
          {tl.played.map(({ m, side, won }) => (
            <div key={`p${m.id || m.num}`} className="flex items-center gap-3 bg-[#111] border border-zinc-800 rounded-lg px-3 py-2">
              <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black ${won ? 'bg-[#fbbf24] text-black' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`}>{won ? 'W' : 'L'}</span>
              <span className="text-xs text-zinc-300 min-w-0 truncate">
                <span className="text-zinc-500">{stakesFor(active.event, m.round)} · </span>
                vs <span className="font-semibold text-zinc-200">{oppOf(m, side)}</span>
              </span>
              {m.score && <span className="ml-auto shrink-0 text-xs font-mono text-zinc-400">{m.score}</span>}
            </div>
          ))}

          {tl.live && (
            <div className="flex items-center gap-3 bg-[#111] border border-emerald-500/30 rounded-lg px-3 py-2">
              <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-black uppercase tracking-wider shrink-0">{tl.live.court ? `On court ${tl.live.court}` : 'On court'}</span>
              <span className="text-xs text-zinc-300 min-w-0 truncate">vs <span className="font-semibold text-zinc-200">{oppOf(tl.live, tl.live.a && tl.live.a.toLowerCase().includes(active.label.toLowerCase()) ? 'a' : 'b')}</span></span>
              {tl.live.score && <span className="ml-auto shrink-0 text-xs font-mono text-emerald-300">{tl.live.score}</span>}
            </div>
          )}

          {tl.upcoming.map((m) => (
            <div key={`u${m.id || m.num}`} className="flex items-center gap-3 bg-[#111] border border-zinc-800 rounded-lg px-3 py-2">
              <span className="shrink-0 text-[9px] font-mono font-bold text-zinc-500">M{m.num}</span>
              <span className="text-xs text-zinc-300 min-w-0 truncate">
                <span className="text-zinc-500">{stakesFor(active.event, m.round)} · </span>
                vs <span className="font-semibold text-zinc-200">{oppOf(m, m.a && m.a.toLowerCase().includes(active.label.toLowerCase()) ? 'a' : 'b')}</span>
              </span>
              <span className="ml-auto shrink-0 text-[10px] font-bold text-[#fbbf24]/90">{estimateLabel(m, matches, sched, now)}</span>
            </div>
          ))}

          {tl.next.map((b) => (
            <div key={`n${b.kind}${b.num || 't'}`} className="flex items-center gap-3 bg-[#1c1408] border border-[#fbbf24]/20 rounded-lg px-3 py-2">
              <span className={`shrink-0 text-[9px] font-black uppercase tracking-wider rounded px-1.5 py-0.5 border ${b.kind === 'win' ? 'text-[#fbbf24] border-[#fbbf24]/40' : 'text-zinc-400 border-zinc-700'}`}>
                {b.decided ? 'Next' : b.kind === 'win' ? 'Win →' : 'Lose →'}
              </span>
              {b.terminal ? (
                <span className="text-xs text-zinc-300">{b.kind === 'win' ? 'Champions of this path 🏆' : "That wraps the day — every match counted."}</span>
              ) : (
                <>
                  <span className="text-xs text-zinc-300 min-w-0 truncate"><span className="font-mono text-zinc-500">M{b.num}</span> · {b.stakes}</span>
                  {b.waits && <span className="ml-auto shrink-0 text-[10px] font-bold text-[#fbbf24]/80">{b.waits}</span>}
                </>
              )}
            </div>
          ))}

          {/* Nothing posted yet — still give them their FIRST match straight
              off the seed placement + the 9-court schedule projection. */}
          {!tl.mine.length && (() => {
            const seedRow = (seeds || []).find(s => s.type === active.event && labelFor(s.name).toLowerCase() === active.label.toLowerCase());
            const fieldCount = (seeds || []).filter(s => s.type === active.event).length;
            const fm = seedRow ? firstMatchFor(active.event, pInsFor(active.event), seedRow.rank, fieldCount) : null;
            const time = fm && clocks && clocks[active.event] ? clocks[active.event](fm.num) : null;
            const oppRow = fm && fm.oppRank ? (seeds || []).find(s => s.type === active.event && s.rank === fm.oppRank) : null;
            const opp = oppRow ? show(labelFor(oppRow.name)) : (fm && fm.oppFrom) || null;
            if (!fm) return (
              <p className="text-xs text-zinc-500 leading-relaxed">
                No match posted for <span className="text-zinc-300 font-semibold">{active.label}</span> yet — your first match and the projected path appear here the moment the desk posts the draw.
              </p>
            );
            return (
              <div className="flex items-center gap-3 bg-[#111] border border-zinc-800 rounded-lg px-3 py-2">
                <span className="shrink-0 text-[9px] font-mono font-bold text-zinc-500">M{fm.num}</span>
                <span className="text-xs text-zinc-300 min-w-0 truncate">
                  <span className="text-zinc-500">Your first match · {stakesFor(active.event, fm.round)}</span>
                  {opp && <> · vs <span className="font-semibold text-zinc-200">{opp}</span></>}
                </span>
                {time && <span className="ml-auto shrink-0 text-[10px] font-bold text-[#fbbf24]/90">{time}</span>}
              </div>
            );
          })()}
        </div>
      )}

      {/* Free-text fallback BELOW the tracker (owner call: "Follow my team"
          leads; typing any name just lights up the draw sheet). */}
      {onQuery && (
        <div className="mt-4 pt-4 border-t border-zinc-800/60">
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Or type any name to light it up on the draw"
            className="w-full max-w-sm bg-[#111] border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-[#fbbf24]/40 transition-colors"
          />
          <p className="text-[10px] text-zinc-600 mt-1.5">Highlights the matching lines on the draw sheet below and auto-scrolls to them.</p>
        </div>
      )}
    </div>
  );
}

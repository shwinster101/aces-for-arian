import { useEffect, useMemo, useRef, useState } from 'react';
import { Trophy, Zap, Check, Grid3x3, Play, Clock, Sparkles, Search, Undo2 } from 'lucide-react';
import { playPos, isReadyRow, startClockLabel, estimateLabel, waitsOnLabel, stakesFor } from '../../lib/schedule';
import { resolve } from '../../lib/draw';
import { isEngineRow } from '../store';
import { Card, PageHeader, Pills, TextInput, Select, EmptyState, Toggle, SearchBox } from '../ui';

const clockTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const EVENTS = [
  { value: 'Singles', label: 'Sunday Singles' },
  { value: 'Doubles', label: 'Saturday Doubles' },
];
const COURTS = Array.from({ length: 9 }, (_, i) => String(i + 1));
const STATUS_FILTERS = [
  { value: 'live', label: 'Live now' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'final', label: 'Final' },
  { value: 'all', label: 'All' },
];

// A newly-live tile stays flagged NEW until the desk touches it — or this long,
// whichever comes first — so a promotion that scrolls past unnoticed still fades
// on its own rather than lingering forever.
const NEW_HIGHLIGHT_MS = 3 * 60 * 1000;
// Persisted so the toggle survives reloads on the courtside phone.
const AUTOFILL_KEY = 'a4a-autofill';
const loadAutoFill = () => {
  try { const v = localStorage.getItem(AUTOFILL_KEY); return v === null ? true : v === '1'; }
  catch { return true; }
};

const shortSide = (s) => {
  const v = (s || '').trim();
  return v || '—';
};

// SINGLES QFs GO ON TOGETHER (owner call): hold R3 rows out of the ready
// queue until the bracket says all four quarterfinal pairings are set
// (decided or both players known) — backdraw matches fill open courts in the
// meantime — then jump the QFs to the FRONT of the queue so the next four
// court openings take them. Doubles keeps its normal flow.
const qfGate = (evMatches, event, bracket) => {
  if (event !== 'Singles' || !bracket) return { hold: false, front: false, posted: false };
  const view = resolve(bracket);
  if (!view) return { hold: false, front: false, posted: false };
  const r3 = [];
  for (const sec of view.sections) for (const mm of sec.matches) if (mm.roundTag === 'R3') r3.push(mm);
  if (r3.length !== 4) return { hold: false, front: false, posted: false };
  const allSet = r3.every(mm => mm.winner || mm.contested);
  const posted = evMatches.some(m => m.round === 'R3');
  const pendingRows = evMatches.some(m => m.round === 'R3' && m.status === 'scheduled');
  return { hold: !allSet, front: allSet && pendingRows, posted };
};
// The playable queue under the gate — shared by the court board, the fill
// buttons, and the auto-fill engine so they can never disagree on "next".
const orderedReady = (evMatches, event, gate) => evMatches
  .filter(m => m.status === 'scheduled' && isReadyRow(m) && !(gate.hold && m.round === 'R3'))
  .sort((a, b) => {
    const pa = gate.front && a.round === 'R3' ? 0 : 1;
    const pb = gate.front && b.round === 'R3' ? 0 : 1;
    return pa - pb || playPos(a) - playPos(b);
  });

export default function Scores({ ops }) {
  const [event, setEvent] = useState('Singles');
  const [statusFilter, setStatusFilter] = useState('live');
  const [autoFill, setAutoFill] = useState(loadAutoFill);
  // id -> timestamp it went live; drives the NEW highlight. Cleared when the
  // desk interacts with the row (onSeen) or after NEW_HIGHLIGHT_MS.
  const [newLive, setNewLive] = useState({});

  const setAutoFillPersisted = (v) => {
    setAutoFill(v);
    try { localStorage.setItem(AUTOFILL_KEY, v ? '1' : '0'); } catch { /* private mode */ }
  };
  const seen = (id) => setNewLive(prev => {
    if (!prev[id]) return prev;
    const rest = { ...prev };
    delete rest[id];
    return rest;
  });

  const sched = ops.store.schedule;
  const courtsCount = Math.max(1, Math.min(12, Number(sched && sched.courts) || 9));
  const allMatches = ops.store.matches;

  // Court occupancy + the ready queue, derived once and shared by the board,
  // the fill buttons, and the per-row "Go live".
  const board = useMemo(() => {
    const evMatches = allMatches.filter(m => m.event === event);
    const liveByCourt = new Map();
    const liveUnassigned = [];
    for (const m of evMatches) {
      if (m.status !== 'live') continue;
      if (m.court) liveByCourt.set(String(m.court), m);
      else liveUnassigned.push(m);
    }
    const courtList = Array.from({ length: courtsCount }, (_, i) => String(i + 1));
    const openCourts = courtList.filter(c => !liveByCourt.has(c));
    const qf = qfGate(evMatches, event, ops.store.brackets[event]);
    const readyQueue = orderedReady(evMatches, event, qf);
    // Suggest a distinct next-up per open court (by position), so two open
    // courts never both point at the same match.
    const suggestByCourt = {};
    openCourts.forEach((c, i) => { if (readyQueue[i]) suggestByCourt[c] = readyQueue[i]; });
    return { courtList, liveByCourt, openCourts, liveUnassigned, readyQueue, suggestByCourt, qf };
  }, [allMatches, event, courtsCount, ops.store.brackets]);

  const goLive = (id, court) => ops.updateMatch(id, { status: 'live', ...(court ? { court } : {}) });
  // Take a match OFF its court: back to scheduled, court cleared — it rejoins
  // the ready queue at its play-order spot (usually the front), so the next
  // opening feeds it back in, or the desk Sends it wherever. The freed court
  // does NOT auto-fill (that only fires on a live→final) — pulling a match is
  // a deliberate act, the desk decides what goes on next.
  const pullBack = (id) => { seen(id); ops.updateMatch(id, { status: 'scheduled', court: '' }); };
  const lowestOpenCourt = () => board.openCourts[0] || '';
  const fillOpenCourts = () => {
    board.openCourts.forEach((court) => {
      const next = board.suggestByCourt[court];
      if (next) goLive(next.id, court);
    });
  };

  // --- Auto-fill + NEW-highlight engine -----------------------------------
  // React to STATE TRANSITIONS, never to standing state: a court that "just
  // opened" (a live match marked final) pulls the next ready match onto that
  // exact court. Seeding the ref on mount / event-switch and acting only on
  // transitions is what stops the board from mass-activating on a reload or
  // the night before — a freed court is a deliberate result entry.
  const prevRef = useRef(null); // { event, map: id -> status }
  useEffect(() => {
    const evMatches = allMatches.filter(m => m.event === event);
    const curMap = new Map(evMatches.map(m => [m.id, m.status]));
    const prev = prevRef.current;

    if (!prev || prev.event !== event) {
      prevRef.current = { event, map: curMap };
      return; // first pass for this event — observe only
    }

    const nowLiveIds = [];
    const freedCourts = [];
    for (const m of evMatches) {
      const before = prev.map.get(m.id);
      if (before !== 'live' && m.status === 'live') nowLiveIds.push(m.id);
      if (before === 'live' && m.status === 'final' && m.court) freedCourts.push(String(m.court));
    }

    if (nowLiveIds.length) {
      // Intentional: this effect's whole job is to translate match-status
      // transitions into UI (the NEW flag) + a follow-on court promotion. It
      // acts only on discrete, user-driven transitions and converges in one
      // extra render, so the cascading-render caution doesn't apply here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNewLive(prevNew => {
        const t = Date.now();
        const next = { ...prevNew };
        nowLiveIds.forEach(id => { next[id] = t; });
        return next;
      });
      nowLiveIds.forEach(id => setTimeout(() => seen(id), NEW_HIGHLIGHT_MS));
    }

    if (autoFill && freedCourts.length) {
      const occupied = new Set(evMatches.filter(m => m.status === 'live' && m.court).map(m => String(m.court)));
      // Same gated ordering as the court board — held QFs never auto-fill,
      // unlocked QFs take the next openings ahead of the backdraw.
      const ready = orderedReady(evMatches, event, qfGate(evMatches, event, ops.store.brackets[event]));
      let ri = 0;
      for (const court of freedCourts) {
        if (occupied.has(court)) continue; // a manual "Go live" already took it
        if (ri >= ready.length) break;
        const nextUp = ready[ri++];
        goLive(nextUp.id, court);
        occupied.add(court);
      }
    }

    prevRef.current = { event, map: curMap };
    // goLive/seen read live refs; depending on them would re-run needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMatches, event, autoFill]);

  const matches = useMemo(() => {
    return allMatches
      .filter(m => m.event === event)
      .filter(m => statusFilter === 'all' || m.status === statusFilter)
      .sort((a, b) => playPos(a) - playPos(b)); // play order: doubles play-ins (M29+) go first
  }, [allMatches, event, statusFilter]);

  const liveCount = board.liveByCourt.size + board.liveUnassigned.length;

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Scores & Courts" subtitle="The court board up top is the source of truth for what's live and where. Mark a winner and the court frees itself; the next ready match slides on automatically (toggle it off to place them by hand). New arrivals flash so nobody has to guess what changed." />

      <PlayerLookup ops={ops} event={event} sched={sched} />

      <AceTracker ops={ops} />

      <CourtBoard board={board} event={event} liveCount={liveCount}
        autoFill={autoFill} onToggleAutoFill={setAutoFillPersisted}
        onSend={goLive} onPull={pullBack} onFill={fillOpenCourts} onGoLiveFilter={() => setStatusFilter('live')} />

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><Trophy className="w-4 h-4 text-[#fbbf24]" /> Match scores</h3>
          <Pills value={event} onChange={setEvent} options={EVENTS} />
        </div>
        <Pills value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTERS} />

        {matches.length === 0 ? (
          <div className="mt-2">
            <EmptyState title="No matches here" hint="Post matchups from the Seeding & Draws tab — they'll show up here for live score entry." />
          </div>
        ) : (
          <div className="space-y-2 mt-3">
            {matches.map(m => (
              <ScoreRow key={m.id} m={m} ops={ops} allMatches={allMatches} sched={sched}
                isNew={!!newLive[m.id]} onSeen={() => seen(m.id)}
                canGoLive={m.status === 'scheduled'} onGoLive={() => goLive(m.id, lowestOpenCourt())}
                onPull={() => pullBack(m.id)} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// -------------------------------------------------- Player lookup
// "When's my next match and who do I play?" is the question the desk gets
// most — this answers it in one search. Built on the resolved bracket (like
// the Seeding call sheet) so it can answer even when the opponent is still
// "W of M12", with hand-added (non-engine) rows folded in; a lookup misses
// nothing that's posted.
const nameHas = (s, q) => (s || '').toLowerCase().includes(q);
const lookupBlockers = (e) => [e.a, e.b]
  .map(s => (s && !s.name && s.from ? Number((String(s.from).match(/M(\d+)/) || [])[1]) : null))
  .filter(Boolean);
const LOOKUP_MAX = 8;

function PlayerLookup({ ops, event, sched }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const allMatches = ops.store.matches;
  const bracket = ops.store.brackets[event];
  const view = useMemo(() => resolve(bracket), [bracket]);
  const posted = useMemo(
    () => new Map(allMatches.filter(m => m.event === event).map(m => [m.id, m])),
    [allMatches, event],
  );

  // One unified list: every real bracket match (byes never play) + every
  // hand-added row, in play order. Engine rows exist only when a bracket
  // does, so the two sources never double-count a match.
  const entries = useMemo(() => {
    const out = [];
    if (view) {
      for (const sec of view.sections) {
        for (const mm of sec.matches) {
          // Skip byes and pure walkovers (withdrawal auto-advances) — neither
          // is a match anyone will play, so neither is a useful lookup answer.
          if (mm.bye || (mm.winner && !mm.manual)) continue;
          out.push({ id: mm.id, num: mm.num, round: mm.roundTag, a: mm.slotA, b: mm.slotB });
        }
      }
    }
    for (const m of allMatches) {
      if (m.event !== event || isEngineRow(m)) continue;
      out.push({ id: m.id, num: Number(m.num) || 0, round: m.round, a: { name: m.a }, b: { name: m.b } });
    }
    return out.sort((x, y) => playPos({ num: x.num, event }) - playPos({ num: y.num, event }));
  }, [view, allMatches, event]);

  const hits = query.length >= 2
    ? entries.filter(e => nameHas(e.a.name, query) || nameHas(e.b.name, query))
    : [];
  const statusOf = (e) => { const p = posted.get(e.id); return p ? p.status : 'scheduled'; };
  const pending = hits.filter(e => statusOf(e) !== 'final');
  const played = hits.filter(e => statusOf(e) === 'final');
  const lastPlayed = played[played.length - 1] || null;
  const shownPending = pending.slice(0, LOOKUP_MAX);

  return (
    <Card className="p-4 sm:p-5">
      <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-1">
        <Search className="w-4 h-4 text-[#fbbf24]" /> Player lookup
        <span className="normal-case tracking-normal font-medium text-zinc-500">· {event}</span>
      </h3>
      <p className="text-[11px] text-zinc-500 mb-3">“When’s my next match, who do I play?” — type a name for the answer to read back: opponent, court or projected time, and what the match is for.</p>
      <SearchBox value={q} onChange={setQ} placeholder="Player name — first name is enough…" />

      {query.length >= 2 && (
        <div className="mt-3 space-y-2">
          {hits.length === 0 ? (
            <p className="text-xs text-zinc-500 px-1">No posted matches for “{q.trim()}” in {event.toLowerCase()} — check the spelling, or the draw may not be posted yet (Seeding &amp; Draws).</p>
          ) : (
            <>
              {shownPending.map(e => <LookupRow key={e.id} e={e} p={posted.get(e.id)} allMatches={allMatches} event={event} sched={sched} query={query} />)}
              {pending.length > LOOKUP_MAX && (
                <p className="text-[10px] text-zinc-600 px-1">+{pending.length - LOOKUP_MAX} more — keep typing to narrow it down.</p>
              )}
              {pending.length === 0 && (
                <p className="text-xs text-zinc-400 px-1">Nothing scheduled for them right now — either their run is done, or the next round posts once the opponent is decided (check the Draw board on Seeding &amp; Draws).</p>
              )}
              {lastPlayed && <LookupLast e={lastPlayed} p={posted.get(lastPlayed.id)} event={event} query={query} />}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

// A pending match, phrased for reading back to the player at the desk.
function LookupRow({ e, p, allMatches, event, sched, query }) {
  const status = p ? p.status : 'scheduled';
  const live = status === 'live';
  // Posted rows get the queue estimate ("~2 ahead · around 10:30" / "On court
  // 5 now"); an unposted future bracket match gets "Waits on M12 · ~10:40".
  const est = p
    ? estimateLabel(p, allMatches, sched)
    : (waitsOnLabel(lookupBlockers(e), allMatches, event, sched) || 'Posts once the feeders resolve');
  const stakes = stakesFor(event, e.round);
  const side = (s) => {
    const isThem = nameHas(s.name, query);
    if (s.name) return <span className={isThem ? 'text-[#fbbf24] font-black' : 'text-zinc-100 font-bold'}>{s.name}</span>;
    return <span className="text-zinc-500 italic">{s.from ? `Winner comes from ${s.from.replace(/^W of /i, '')}` : 'TBD'}</span>;
  };
  return (
    <div className="bg-[#111] border border-zinc-800 rounded-xl px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-wider">
        <span className={`flex items-center gap-1.5 ${live ? 'text-emerald-400' : 'text-zinc-500'}`}>
          {live && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          {live ? `Live${p && p.court ? ` · Court ${p.court}` : ''}` : 'Upcoming'}
        </span>
        <span className="text-zinc-600">M{e.num}</span>
        <span className="px-1.5 py-0.5 rounded border text-zinc-400 bg-zinc-800/60 border-zinc-700">{stakes}</span>
      </div>
      <div className="text-sm mt-1.5">{side(e.a)} <span className="text-zinc-600">vs</span> {side(e.b)}</div>
      {est && <div className={`text-[11px] mt-1 ${live ? 'text-emerald-400' : 'text-zinc-400'}`}>{est}</div>}
    </div>
  );
}

// Their most recent finished match — quick context for the desk ("you beat
// Sam 4-2, so next up is…") and a sanity check it's the right person.
function LookupLast({ e, p, event, query }) {
  const winnerName = p && p.winner ? (p.winner === 'a' ? p.a : p.b) : '';
  const won = winnerName && nameHas(winnerName, query);
  const oppo = nameHas(e.a.name, query) ? e.b.name : e.a.name;
  return (
    <p className="text-[11px] text-zinc-500 px-1">
      Last match: <span className={won ? 'text-emerald-400 font-bold' : 'text-zinc-300 font-bold'}>{winnerName ? (won ? 'won' : 'lost') : 'played'}</span>
      {oppo ? <> vs {oppo}</> : null}{p && p.score ? <> · {p.score}</> : null} <span className="text-zinc-600">({stakesFor(event, e.round)})</span>
    </p>
  );
}

// The physical constraint, made glanceable: one cell per court showing exactly
// who's on it, and open courts offering the next ready match with a one-tap
// send. This is what kills "wait, which matches are actually live?"
function CourtBoard({ board, event, liveCount, autoFill, onToggleAutoFill, onSend, onPull, onFill, onGoLiveFilter }) {
  const { courtList, liveByCourt, openCourts, liveUnassigned, suggestByCourt } = board;
  const fillable = openCourts.some(c => suggestByCourt[c]);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
          <Grid3x3 className="w-4 h-4 text-[#fbbf24]" /> Court board
          <span className="normal-case tracking-normal font-medium text-zinc-500">· {event}</span>
        </h3>
        <div className="flex items-center gap-2">
          <Toggle checked={autoFill} onChange={onToggleAutoFill} label="Auto-fill off" activeLabel="Auto-fill on" />
          <button onClick={onFill} disabled={!fillable}
            title="Send the next ready matches onto every open court now"
            className="flex items-center gap-1.5 min-h-11 px-3.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition active:scale-95 disabled:opacity-30 bg-[#fbbf24] border-[#fbbf24] text-black disabled:bg-[#111] disabled:border-zinc-800 disabled:text-zinc-500">
            <Play className="w-3.5 h-3.5" /> Fill open
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-zinc-500 mb-3">
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {liveCount} on court</span>
        <span className="text-zinc-700">·</span>
        <span>{openCourts.length} open</span>
        <button onClick={onGoLiveFilter} className="ml-auto text-zinc-500 hover:text-[#fbbf24] underline underline-offset-2 transition-colors">Jump to live rows</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {courtList.map((court) => {
          const live = liveByCourt.get(court);
          const next = suggestByCourt[court];
          if (live) {
            return (
              <div key={court} className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-3 py-2.5 flex flex-col">
                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Court {court}
                  {live.round && <span className="ml-auto text-emerald-400/70">{live.round}{live.num !== '' ? ` · M${live.num}` : ''}</span>}
                </div>
                <div className="mt-1.5 text-[11px] text-zinc-200 leading-snug flex-1">
                  <div className="truncate font-semibold">{shortSide(live.a)}</div>
                  <div className="text-zinc-600 text-[9px] my-0.5">vs</div>
                  <div className="truncate font-semibold">{shortSide(live.b)}</div>
                </div>
                <button onClick={() => onPull(live.id)}
                  title="Wrong send / plans changed — un-live this match and put it back in the queue; the court opens for whatever's next"
                  className="mt-2 flex items-center justify-center gap-1.5 min-h-9 rounded-lg text-[10px] font-black uppercase tracking-wider bg-black/30 border border-zinc-700 text-zinc-400 hover:text-rose-400 hover:border-rose-500/40 transition active:scale-95">
                  <Undo2 className="w-3 h-3" /> Back to queue
                </button>
              </div>
            );
          }
          return (
            <div key={court} className="rounded-xl border border-dashed border-zinc-800 bg-black/40 px-3 py-2.5 flex flex-col">
              <div className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Court {court} · open</div>
              {next ? (
                <>
                  <div className="mt-1.5 text-[11px] text-zinc-400 leading-snug flex-1">
                    <span className="text-zinc-600 text-[9px] uppercase tracking-wider">Next up{next.num !== '' ? ` · M${next.num}` : ''}</span>
                    <div className="truncate text-zinc-300">{shortSide(next.a)} <span className="text-zinc-600">v</span> {shortSide(next.b)}</div>
                  </div>
                  <button onClick={() => onSend(next.id, court)}
                    className="mt-2 flex items-center justify-center gap-1.5 min-h-9 rounded-lg text-[10px] font-black uppercase tracking-wider bg-[#fbbf24]/10 border border-[#fbbf24]/30 text-[#fbbf24] hover:bg-[#fbbf24]/20 transition active:scale-95">
                    <Play className="w-3 h-3" /> Send here
                  </button>
                </>
              ) : (
                <div className="mt-1.5 text-[10px] text-zinc-700 flex-1 flex items-center">No match waiting</div>
              )}
            </div>
          );
        })}
      </div>

      {liveUnassigned.length > 0 && (
        <p className="text-[10px] text-amber-400/80 mt-3 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          {liveUnassigned.length} live match{liveUnassigned.length === 1 ? '' : 'es'} without a court — assign one on its row so it shows here.
        </p>
      )}
      {board.qf && board.qf.hold && board.qf.posted && (
        <p className="text-[10px] text-[#fbbf24]/90 mt-3">
          Championship QFs are <strong>held so all four go on together</strong> — backdraw matches fill open courts until the last quarterfinal pairing is set.
        </p>
      )}
      {board.qf && board.qf.front && (
        <p className="text-[10px] text-[#fbbf24] mt-3">
          <strong>All four championship QFs are ready</strong> — they're at the front of the queue, so the next four court openings take them. For a truly simultaneous start: flip auto-fill off, let four courts clear, then tap Fill open.
        </p>
      )}
    </Card>
  );
}

function ScoreRow({ m, ops, allMatches, sched, isNew, onSeen, canGoLive, onGoLive, onPull }) {
  const engine = isEngineRow(m);
  const savedAt = ops.matchSavedAt[m.id] || 0;
  // Dirty/saved without reading a clock in render: on each edit we remember the
  // row's saved-timestamp AS OF that edit. If no push has landed since (savedAt
  // unchanged) the row is dirty; once any push bumps savedAt past that marker
  // (debounced auto-flush, the Save button, or a bracket re-sync) it's saved.
  const [editMarker, setEditMarker] = useState(null);
  const touch = () => { if (isNew) onSeen(); };
  const update = (patch) => { touch(); ops.updateMatch(m.id, patch); setEditMarker(savedAt); };

  // Winner: on a bracket-managed (engine) row, route through the draw engine so
  // the result ADVANCES the bracket — populates the next round and re-syncs
  // this flat row, exactly like the Draw board — instead of only flagging the
  // row final. Tapping the same side again un-marks it (markBracketWinner
  // toggles). It pushes immediately + stamps the row saved. Hand-added rows
  // (no bracket behind them) just set the flat winner/final.
  const setWinner = (side) => {
    touch();
    if (engine) { setEditMarker(savedAt); ops.markBracketWinner(m.event, m.id, side); }
    else update({ winner: m.winner === side ? '' : side, status: 'final' });
  };

  const dirty = editMarker !== null && savedAt === editMarker;
  const saved = editMarker !== null && savedAt > editMarker;

  const live = m.status === 'live';
  const final = m.status === 'final';
  const clockLabel = startClockLabel(m, allMatches, sched);

  return (
    <div className={`bg-[#111] rounded-xl p-3 space-y-2.5 transition-shadow ${
      isNew ? 'border border-[#fbbf24] shadow-[0_0_0_1px_rgba(251,191,36,0.5),0_0_18px_-2px_rgba(251,191,36,0.35)]' : 'border border-zinc-800'
    }`}>
      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest font-bold">
        {/* Status chip — glanceable live/scheduled/final without reading the dropdown. */}
        {live ? (
          <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live{m.court ? ` · Ct ${m.court}` : ' · no court'}</span>
        ) : final ? (
          <span className="text-zinc-500">Final</span>
        ) : (
          <span className="flex items-center gap-1.5 text-zinc-500"><Clock className="w-3 h-3" /> {clockLabel || 'Scheduled'}</span>
        )}
        {isNew && <span className="flex items-center gap-1 text-[#fbbf24]"><Sparkles className="w-3 h-3" /> New</span>}
        {m.round && <span className="text-[#fbbf24]/80">{m.round}</span>}
        {m.num !== '' && <span className="text-zinc-500">· M{m.num}</span>}
        <span className="ml-auto flex items-center gap-1.5 normal-case tracking-normal font-medium text-zinc-400">
          Court <Select value={m.court} onChange={(v) => update({ court: v })} options={COURTS} placeholder="—" />
        </span>
      </div>

      {canGoLive && (
        <button onClick={onGoLive}
          className="w-full flex items-center justify-center gap-1.5 min-h-11 rounded-lg text-[11px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition active:scale-[0.98]">
          <Play className="w-3.5 h-3.5" /> Go live{' '}
          <span className="normal-case tracking-normal font-medium text-emerald-400/70">— take the next open court</span>
        </button>
      )}
      {live && (
        <button onClick={onPull}
          title="Un-live this match and put it back in the queue — the court opens for whatever's next"
          className="w-full flex items-center justify-center gap-1.5 min-h-11 rounded-lg text-[11px] font-black uppercase tracking-wider bg-[#0d0d0d] border border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-rose-500/40 transition active:scale-[0.98]">
          <Undo2 className="w-3.5 h-3.5" /> Pull off court{' '}
          <span className="normal-case tracking-normal font-medium text-zinc-500">— back to scheduled</span>
        </button>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-2">
        {[['a', m.a], ['b', m.b]].map(([side, name]) => (
          <button key={side} onClick={() => setWinner(side)}
            className={`flex items-center justify-between gap-2 min-h-12 rounded-lg px-3 py-2.5 border text-left transition active:scale-[0.98] ${
              m.winner === side ? 'bg-[#fbbf24]/10 border-[#fbbf24]/40' : 'bg-black border-zinc-800 hover:border-zinc-700'
            }`}>
            <span className={`text-sm font-bold truncate ${m.winner === side ? 'text-[#fbbf24]' : 'text-zinc-200'}`}>{name || `Player/team ${side.toUpperCase()}`}</span>
            {m.winner === side && <Trophy className="w-3.5 h-3.5 text-[#fbbf24] shrink-0" />}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2.5">
        <TextInput value={m.score} onChange={(v) => update({ score: v })}
          placeholder="Score, e.g. 4-2, 3-4, 10-7" className="flex-1" />
        <Select value={m.status} onChange={(v) => update({ status: v })}
          options={['scheduled', 'live', 'final']} placeholder="Status" />
      </div>

      {/* Explicit save so a volunteer gets a per-row receipt, not just the
          global header. Flushes any pending push right now; in prod "Saved ✓"
          is a REAL delivery receipt (the /api/write adapter read the sheet's
          ok — see store.js flushMatchPush); on dev/legacy paths it still means
          "sent", so the tooltip keeps a soft spot-check nudge. */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => { touch(); ops.flushMatch(m.id); }}
          title="Sends this row to the sheet now. ✓ appears once delivery is confirmed; for big results a glance at the public board (View live) never hurts."
          className={`flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-xl text-[11px] font-black uppercase tracking-wider border transition active:scale-95 ${
            saved
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : dirty
                ? 'bg-[#fbbf24] border-[#fbbf24] text-black'
                : 'bg-[#111] border-zinc-700 text-zinc-300 hover:border-[#fbbf24]/40 hover:text-[#fbbf24]'
          }`}>
          {saved ? <><Check className="w-4 h-4" /> Saved ✓ · {clockTime(savedAt)}</> : 'Save result'}
        </button>
      </div>
    </div>
  );
}

// Courtside "+1 Ace" — pushes the running total to the sheet so the public
// Brackets tab's Live Ace Tracker ($1/ace) follows live.
// -1 covers a misclick; it's disabled at 0 so the count can't go negative.
function AceTracker({ ops }) {
  const count = ops.store.aces || 0;
  const dollars = count; // $1/ace

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><Zap className="w-4 h-4 text-[#fbbf24]" /> Live Ace Tracker</h3>
        <span className="text-[10px] text-zinc-500">$1/ace</span>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={ops.decrementAces} disabled={count === 0} aria-label="Remove an ace"
          className="shrink-0 w-11 h-11 rounded-xl bg-black border border-zinc-800 text-zinc-400 text-lg font-black hover:text-white hover:border-zinc-700 disabled:opacity-30 transition-colors">
          −
        </button>
        <div className="flex-1 text-center">
          <div className="text-4xl font-black text-white tabular-nums">{count}</div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
            Aces hit · ${dollars} raised
          </div>
        </div>
        <button onClick={ops.incrementAces} aria-label="Add an ace"
          className="shrink-0 inline-flex items-center justify-center min-w-20 h-11 bg-[#fbbf24] hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-colors active:scale-[0.97]">
          +1 Ace
        </button>
      </div>
      <p className="text-[10px] text-zinc-600 mt-3">Tap +1 for each ace — the public count follows within ~1 min. The site shows the <span className="text-zinc-400">count only</span>; add the <span className="text-zinc-400 font-bold">${dollars}</span> to the scholarship total in the Config sheet yourself.</p>
    </Card>
  );
}

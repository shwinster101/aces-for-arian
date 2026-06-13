import { useMemo, useState } from 'react';
import { Trophy, Zap } from 'lucide-react';
import { Card, PageHeader, Pills, TextInput, Select, EmptyState } from '../ui';

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

export default function Scores({ ops }) {
  const [event, setEvent] = useState('Singles');
  const [statusFilter, setStatusFilter] = useState('live');

  const matches = useMemo(() => {
    return ops.store.matches
      .filter(m => m.event === event)
      .filter(m => statusFilter === 'all' || m.status === statusFilter)
      .sort((a, b) => (Number(a.num) || 0) - (Number(b.num) || 0));
  }, [ops.store.matches, event, statusFilter]);

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Scores & Courts" subtitle="Work the queue in playing order: set a match live + assign its court when it goes on, then tap the winner and enter the score. The public board follows automatically. Reorder the queue from Seeding & Draws." />

      <AceTracker ops={ops} />

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
            {matches.map(m => <ScoreRow key={m.id} m={m} ops={ops} />)}
          </div>
        )}
      </Card>
    </div>
  );
}

function ScoreRow({ m, ops }) {
  const setWinner = (side) => ops.updateMatch(m.id, { winner: m.winner === side ? '' : side, status: 'final' });
  return (
    <div className="bg-[#111] border border-zinc-800 rounded-xl p-3 space-y-2.5">
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
        {m.round && <span className="text-[#fbbf24]">{m.round}</span>}
        {m.num !== '' && <span>· Match {m.num}</span>}
        <span className="ml-auto flex items-center gap-1.5 normal-case tracking-normal font-medium text-zinc-400">
          Court <Select value={m.court} onChange={(v) => ops.updateMatch(m.id, { court: v })} options={COURTS} placeholder="—" />
        </span>
      </div>

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
        <TextInput value={m.score} onChange={(v) => ops.updateMatch(m.id, { score: v })}
          placeholder="Score, e.g. 6-4, 3-6, 10-7" className="flex-1" />
        <Select value={m.status} onChange={(v) => ops.updateMatch(m.id, { status: v })}
          options={['scheduled', 'live', 'final']} placeholder="Status" />
      </div>
    </div>
  );
}

// Courtside "+1 Ace" — pushes the running total to the sheet so the public
// Brackets tab's Live Ace Tracker ($5/ace, capped at $500) follows live.
// -1 covers a misclick; it's disabled at 0 so the count can't go negative.
function AceTracker({ ops }) {
  const count = ops.store.aces || 0;
  const dollars = Math.min(count * 5, 500);
  const capped = count * 5 >= 500;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><Zap className="w-4 h-4 text-[#fbbf24]" /> Live Ace Tracker</h3>
        <span className="text-[10px] text-zinc-500">$5/ace · capped at $500</span>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={ops.decrementAces} disabled={count === 0} aria-label="Remove an ace"
          className="shrink-0 w-11 h-11 rounded-xl bg-black border border-zinc-800 text-zinc-400 text-lg font-black hover:text-white hover:border-zinc-700 disabled:opacity-30 transition-colors">
          −
        </button>
        <div className="flex-1 text-center">
          <div className="text-4xl font-black text-white tabular-nums">{count}</div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
            Aces hit · ${dollars} raised{capped ? ' · cap' : ''}
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


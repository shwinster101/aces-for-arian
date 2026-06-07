import { useMemo, useState } from 'react';
import { Grid3x3, Save, Trophy } from 'lucide-react';
import { Card, PageHeader, Pills, TextInput, Select, EmptyState } from '../ui';
import { SHEET_WRITE_URL } from '../../lib/sheet';

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
      <PageHeader title="Scores & Courts" subtitle="Update live scores as matches finish, reassign courts on the fly, and keep the public court board current." />

      <CourtBoardEditor ops={ops} />

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

function CourtBoardEditor({ ops }) {
  const { courts, updated } = ops.store.courtBoard;
  // Local draft so keystrokes don't republish (and re-timestamp) on every
  // character — "Publish" commits it to the store ops.setCourtBoard manages.
  // This component is the sole writer of courtBoard, so the lazy initial
  // value never goes stale across re-renders.
  const [draft, setDraft] = useState(() => courts);
  const [dirty, setDirty] = useState(false);

  const patch = (court, field, value) => {
    setDraft(d => d.map(c => (c.court === court ? { ...c, [field]: value } : c)));
    setDirty(true);
  };

  const publish = () => { ops.setCourtBoard(draft); setDirty(false); };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><Grid3x3 className="w-4 h-4 text-[#fbbf24]" /> Live court board</h3>
        <button onClick={publish} disabled={!dirty}
          className="flex items-center justify-center gap-1.5 min-h-11 text-[10px] font-black uppercase tracking-wider text-black bg-[#fbbf24] hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg px-3.5 py-2 transition-colors">
          <Save className="w-3.5 h-3.5" /> Publish
        </button>
      </div>
      <p className="text-[11px] text-zinc-500 mb-3">
        {updated ? `Last published ${updated}` : 'Not published yet'} ·{' '}
        {SHEET_WRITE_URL
          ? 'Publish pushes straight to the public site’s live court board.'
          : <>Saved on this device. To put it on the public site’s live board, deploy <code className="text-zinc-400">apps-script/ops-write-back.js</code> and set <code className="text-zinc-400">SHEET_WRITE_URL</code> in <code className="text-zinc-400">lib/sheet.js</code> — then Publish goes live automatically.</>}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {draft.map(c => (
          <div key={c.court} className="bg-[#111] border border-zinc-800 rounded-xl p-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#fbbf24] mb-2">Court {c.court}</div>
            <div className="space-y-1.5">
              <LabeledInput label="Now" value={c.now} onChange={(v) => patch(c.court, 'now', v)} />
              <LabeledInput label="Next" value={c.next} onChange={(v) => patch(c.court, 'next', v)} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function LabeledInput({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] uppercase tracking-wider text-zinc-500 w-9 shrink-0">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. #12 Alex/Sai vs Roy/Gus"
        className="flex-1 min-w-0 bg-black border border-zinc-800 rounded-lg min-h-11 px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-[#fbbf24]/40 transition-colors placeholder:text-zinc-700" />
    </div>
  );
}

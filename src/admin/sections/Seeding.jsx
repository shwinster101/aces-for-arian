import { useMemo, useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Swords, Users2 } from 'lucide-react';
import { Card, PageHeader, Pills, TextInput, Select, IconButton, EmptyState } from '../ui';
import { nextId } from '../store';

const EVENTS = [
  { value: 'Singles', label: 'Sunday Singles' },
  { value: 'Doubles', label: 'Saturday Doubles' },
];

const ROUND_PRESETS = ['R1', 'R2', 'R3', 'QF', 'SF', 'F', 'L1', 'L2', 'L3'];
const COURTS = Array.from({ length: 9 }, (_, i) => String(i + 1));

export default function Seeding({ participants, ops }) {
  const [event, setEvent] = useState('Singles');

  const namesInEvent = useMemo(() => {
    const list = participants.filter(p => p.events.includes(event)).map(p => p.name);
    return Array.from(new Set(list)).sort();
  }, [participants, event]);

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Seeding & Draws" subtitle="Set the seed order, assign doubles partners, and post or update the bracket matchups as the field locks in." />

      <Pills value={event} onChange={setEvent} options={EVENTS} />

      <SeedList event={event} ops={ops} namesInEvent={namesInEvent} />
      {event === 'Doubles' && <PartnerAssignments participants={participants} ops={ops} />}
      <DrawEditor event={event} ops={ops} namesInEvent={namesInEvent} />
    </div>
  );
}

// ---------------------------------------------------------------- Seed list
function SeedList({ event, ops, namesInEvent }) {
  const list = ops.store.seeds[event];
  const datalistId = `seed-names-${event}`;

  // Each mutation derives "next" from the updater's own `prev`, not the
  // `list` snapshot from this render — keeps rapid taps (e.g. rows reordered
  // right after one is added) from clobbering each other.
  const addRow = () => ops.setSeeds(event, prev => [...prev, { id: nextId(), rank: prev.length + 1, name: '', notes: '' }]);
  const removeRow = (id) => ops.setSeeds(event, prev => prev.filter(r => r.id !== id));
  const patchRow = (id, patch) => ops.setSeeds(event, prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const move = (idx, dir) => ops.setSeeds(event, prev => {
    const j = idx + dir;
    if (j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[idx], next[j]] = [next[j], next[idx]];
    return next;
  });

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><Swords className="w-4 h-4 text-[#fbbf24]" /> Seed order — {event}</h3>
        <button onClick={addRow} className="flex items-center justify-center gap-1.5 min-h-11 text-[10px] font-black uppercase tracking-wider text-[#fbbf24] bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 border border-[#fbbf24]/25 rounded-lg px-3 py-1.5 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add seed
        </button>
      </div>

      <datalist id={datalistId}>
        {namesInEvent.map(n => <option key={n} value={n} />)}
      </datalist>

      {list.length === 0 ? (
        <EmptyState title="No seeds set yet" hint={`Add the projected seeds for ${event.toLowerCase()} — order doubles as "Player A & Player B".`} />
      ) : (
        <div className="space-y-2">
          {list.map((row, i) => (
            <div key={row.id} className="flex items-center gap-2 bg-[#111] border border-zinc-800 rounded-xl p-2.5">
              <span className="w-7 h-7 shrink-0 rounded-lg bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-[#fbbf24] flex items-center justify-center text-xs font-black">{i + 1}</span>
              <input list={datalistId} value={row.name} onChange={(e) => patchRow(row.id, { name: e.target.value })}
                placeholder={event === 'Doubles' ? 'Player A & Player B' : 'Player name'}
                className="flex-1 min-w-0 bg-transparent outline-none text-sm font-bold text-zinc-100 placeholder:text-zinc-600 placeholder:font-normal" />
              <TextInput value={row.notes} onChange={(v) => patchRow(row.id, { notes: v })} placeholder="Note (optional)" className="hidden sm:block w-44" />
              <div className="flex items-center gap-0.5 shrink-0">
                <IconButton icon={ChevronUp} label="Move up" onClick={() => move(i, -1)} />
                <IconButton icon={ChevronDown} label="Move down" onClick={() => move(i, 1)} />
                <IconButton icon={Trash2} tone="danger" label="Remove seed" onClick={() => removeRow(row.id)} />
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-zinc-600 mt-3">Position in the list = seed rank. Drag isn't needed on mobile — use the up/down arrows to reorder.</p>
    </Card>
  );
}

// ---------------------------------------------------------- Partner pairing
function PartnerAssignments({ participants, ops }) {
  const doublesPlayers = useMemo(
    () => participants.filter(p => p.events.includes('Doubles')).sort((a, b) => a.name.localeCompare(b.name)),
    [participants]
  );
  const allNames = useMemo(() => doublesPlayers.map(p => p.name), [doublesPlayers]);

  return (
    <Card className="p-4 sm:p-5">
      <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-1"><Users2 className="w-4 h-4 text-[#fbbf24]" /> Doubles partners</h3>
      <p className="text-[11px] text-zinc-500 mb-3">Pulled from the registration form by default — override here for last-minute swaps or unpaired entrants.</p>
      <datalist id="doubles-names">
        {allNames.map(n => <option key={n} value={n} />)}
      </datalist>
      {doublesPlayers.length === 0 ? (
        <EmptyState title="No doubles entrants yet" />
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {doublesPlayers.map(p => (
            <div key={p.name} className="flex items-center gap-2.5 bg-[#111] border border-zinc-800 rounded-xl px-3 py-2.5">
              <span className="text-sm font-bold text-zinc-200 truncate flex-1">{p.name}</span>
              <span className="text-zinc-600 text-xs shrink-0">w/</span>
              <input list="doubles-names" value={p.overlay.partner || p.partner || ''}
                onChange={(e) => ops.setOverlay(p.name, { partner: e.target.value })}
                placeholder="assign partner"
                className="bg-black border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-[#fbbf24] outline-none focus:border-[#fbbf24]/40 transition-colors placeholder:text-zinc-700 w-36 shrink-0" />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------- Draws
const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'live', label: 'Live' },
  { value: 'final', label: 'Final' },
];
const STATUS_DOT = { scheduled: 'bg-zinc-600', live: 'bg-emerald-400 animate-pulse', final: 'bg-[#fbbf24]' };

export function DrawEditor({ event, ops, namesInEvent }) {
  // Sorted by match number = playing order (courts are assigned dynamically).
  const matches = ops.store.matches
    .filter(m => m.event === event)
    .sort((a, b) => (Number(a.num) || 0) - (Number(b.num) || 0));
  const datalistId = `draw-names-${event}`;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><Swords className="w-4 h-4 text-[#fbbf24]" /> Match order — {event}</h3>
        <button onClick={() => ops.addMatch(event)} className="flex items-center justify-center gap-1.5 min-h-11 text-[10px] font-black uppercase tracking-wider text-[#fbbf24] bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 border border-[#fbbf24]/25 rounded-lg px-3 py-1.5 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add match
        </button>
      </div>
      <datalist id={datalistId}>
        {namesInEvent.map(n => <option key={n} value={n} />)}
      </datalist>

      {matches.length === 0 ? (
        <EmptyState title="No matches posted yet" hint={`Add R1 matchups as seeds lock in — staff and players will see updates reflected here in real time as you edit them.`} />
      ) : (
        <div className="space-y-2">
          {matches.map(m => (
            <div key={m.id} className="bg-[#111] border border-zinc-800 rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[m.status]}`} />
                <Select value={m.round} onChange={(v) => ops.updateMatch(m.id, { round: v })} options={ROUND_PRESETS} placeholder="Round" />
                <TextInput value={m.num} onChange={(v) => ops.updateMatch(m.id, { num: v })} placeholder="Match #" className="w-20" type="number" />
                <Select value={m.court} onChange={(v) => ops.updateMatch(m.id, { court: v })} options={COURTS} placeholder="Court" />
                <Select value={m.status} onChange={(v) => ops.updateMatch(m.id, { status: v })} options={STATUS_OPTIONS.map(s => s.value)} placeholder="Status" />
                <span className="ml-auto" />
                <IconButton icon={ChevronUp} label="Bump earlier in the order" onClick={() => ops.moveMatch(m.id, -1)} />
                <IconButton icon={ChevronDown} label="Push later in the order" onClick={() => ops.moveMatch(m.id, 1)} />
                <IconButton icon={Trash2} tone="danger" label="Remove match" onClick={() => ops.removeMatch(m.id)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2">
                <input list={datalistId} value={m.a} onChange={(e) => ops.updateMatch(m.id, { a: e.target.value })} placeholder="Player / team A"
                  className="bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm font-bold text-zinc-100 outline-none focus:border-[#fbbf24]/40 transition-colors placeholder:text-zinc-600 placeholder:font-normal w-full" />
                <span className="text-zinc-600 text-xs font-bold uppercase text-center">vs</span>
                <input list={datalistId} value={m.b} onChange={(e) => ops.updateMatch(m.id, { b: e.target.value })} placeholder="Player / team B"
                  className="bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm font-bold text-zinc-100 outline-none focus:border-[#fbbf24]/40 transition-colors placeholder:text-zinc-600 placeholder:font-normal w-full" />
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-zinc-600 mt-3">Match # is the playing order — courts get assigned to whoever opens next, so teams may play on different courts through the day. Use ↑ / ↓ to bump a match earlier or later (e.g. someone needs to leave early).</p>
    </Card>
  );
}

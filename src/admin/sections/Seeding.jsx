import { Fragment, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Swords, Users2, GripVertical, ListChecks, LockKeyhole } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, PageHeader, Pills, TextInput, Select, IconButton, EmptyState, SearchBox, Toggle } from '../ui';
import { nextId } from '../store';
import { CONFIG_CSV_URL, mapConfig, parseCSV } from '../../lib/sheet';
import { deriveEntrants, seedListIssues, seedKeySet, doublesPartnerFlags, normName, ambiguousLooseKeys } from '../../lib/entrants';

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

  // The canonical field: one entrant per singles player / doubles team, with
  // reciprocal duplicate registrations already merged and partner problems
  // flagged. Drives the picker, the seed-row issue badges, and partner flags.
  const entrants = useMemo(() => deriveEntrants(participants, event), [participants, event]);

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Seeding & Draws" subtitle="Tap entrants into the seed order, drag to rank them, and post or update the bracket matchups as the field locks in." />

      <Pills value={event} onChange={setEvent} options={EVENTS} />

      <FieldPicker event={event} ops={ops} entrants={entrants} />
      <SeedList event={event} ops={ops} namesInEvent={namesInEvent} entrants={entrants} />
      <FieldLock ops={ops} />
      {event === 'Doubles' && <PartnerAssignments participants={participants} ops={ops} />}
      <DrawEditor event={event} ops={ops} namesInEvent={namesInEvent} />
    </div>
  );
}

// ------------------------------------------------------------- Issue chips
const CHIP_TONES = {
  amber: 'text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/25',
  rose: 'text-rose-400 bg-rose-500/10 border-rose-500/25',
  zinc: 'text-zinc-400 bg-zinc-800/60 border-zinc-700',
};

function Chip({ tone = 'zinc', title, children }) {
  return (
    <span title={title} className={`inline-flex items-center whitespace-nowrap text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${CHIP_TONES[tone]}`}>
      {children}
    </span>
  );
}

function EntrantChips({ entrant }) {
  return (
    <>
      {entrant.mergedCount > 1 && (
        <Chip tone="zinc" title={`${entrant.mergedCount} registrations merged into one entry (duplicate removed)`}>×{entrant.mergedCount} merged</Chip>
      )}
      {entrant.partnerMissing && (
        <Chip tone="amber" title="Their listed partner hasn't signed up yet">partner not signed up</Chip>
      )}
      {entrant.conflict && (
        <Chip tone="rose" title="Conflicting pairings — a player is claimed by more than one team">pairing conflict</Chip>
      )}
      {entrant.unpaired && (
        <Chip tone="zinc" title="Registered for doubles without naming a partner">needs partner</Chip>
      )}
    </>
  );
}

// -------------------------------------------------------------- Field picker
// Every registered singles player / canonical doubles team not yet in the
// seed list — one tap adds it. Reversed-partner duplicate registrations are
// already collapsed by deriveEntrants, so the "Ati & Ashwin" second copy
// simply never shows up here.
function FieldPicker({ event, ops, entrants }) {
  const list = ops.store.seeds[event];
  const [query, setQuery] = useState('');

  // A loose (first-name) key only counts as "already seeded" when it points
  // at a single entrant — otherwise seeding one "Alex" would hide every Alex.
  const ambiguous = useMemo(() => ambiguousLooseKeys(entrants), [entrants]);
  const isSeeded = (e, keys) => keys.has(e.key) || (!ambiguous.has(e.looseKey) && keys.has(e.looseKey));

  const seededKeys = useMemo(() => seedKeySet(list), [list]);
  const remaining = entrants.filter(e => !isSeeded(e, seededKeys));
  const q = query.trim().toLowerCase();
  const shown = q ? remaining.filter(e => e.display.toLowerCase().includes(q)) : remaining;

  const seedRow = (e, rank) => ({ id: nextId(), rank, name: e.display, notes: '' });
  const addEntrant = (entrant) => ops.setSeeds(event, prev => {
    if (isSeeded(entrant, seedKeySet(prev))) return prev;
    return [...prev, seedRow(entrant, prev.length + 1)];
  });
  const addAll = () => ops.setSeeds(event, prev => {
    const keys = seedKeySet(prev);
    const rest = entrants.filter(e => !isSeeded(e, keys));
    return [...prev, ...rest.map((e, i) => seedRow(e, prev.length + i + 1))];
  });

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><ListChecks className="w-4 h-4 text-[#fbbf24]" /> Field — {event}</h3>
        {remaining.length > 0 && (
          <button onClick={addAll} className="flex items-center justify-center gap-1.5 min-h-11 text-[10px] font-black uppercase tracking-wider text-[#fbbf24] bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 border border-[#fbbf24]/25 rounded-lg px-3 py-1.5 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Seed all {remaining.length}
          </button>
        )}
      </div>
      <p className="text-[11px] text-zinc-500 mb-3">
        {entrants.length} in the field · {remaining.length} not seeded yet. Duplicate registrations (both partner orderings of a team) are merged automatically — tap an entry to add it to the seed order.
      </p>

      {entrants.length > 8 && (
        <div className="mb-3"><SearchBox value={query} onChange={setQuery} placeholder="Filter the field…" /></div>
      )}

      {entrants.length === 0 ? (
        <EmptyState title={`No ${event.toLowerCase()} entrants yet`} hint="Registered players show up here automatically as the roster syncs." />
      ) : remaining.length === 0 ? (
        <EmptyState title="Everyone is seeded" hint="The whole field is in the seed order below — drag rows to rank them." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {shown.map(e => (
            <button key={e.key} onClick={() => addEntrant(e)}
              className="flex items-center gap-2 bg-[#111] border border-zinc-800 hover:border-[#fbbf24]/40 rounded-xl px-3 py-2.5 min-h-11 text-left transition-colors group">
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-zinc-200 truncate">{e.display}</span>
                <span className="flex flex-wrap gap-1 mt-0.5 empty:hidden"><EntrantChips entrant={e} /></span>
              </span>
              <Plus className="w-4 h-4 shrink-0 text-zinc-600 group-hover:text-[#fbbf24] transition-colors" />
            </button>
          ))}
          {shown.length === 0 && <p className="text-xs text-zinc-600 px-1 py-2 sm:col-span-2">No unseeded entrants match “{query}”.</p>}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- Seed list
function SeedList({ event, ops, namesInEvent, entrants }) {
  const list = ops.store.seeds[event];
  const datalistId = `seed-names-${event}`;
  const issues = useMemo(() => seedListIssues(list, entrants), [list, entrants]);

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    ops.setSeeds(event, prev => {
      const from = prev.findIndex(r => r.id === active.id);
      const to = prev.findIndex(r => r.id === over.id);
      if (from < 0 || to < 0) return prev;
      return arrayMove(prev, from, to);
    });
  };

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
        <EmptyState title="No seeds set yet" hint={`Tap entrants in the Field card above to build the ${event.toLowerCase()} seed order.`} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={list.map(r => r.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {list.map((row, i) => {
                const divider = bandDividerFor(event, i);
                return (
                  <Fragment key={row.id}>
                    {divider && <BandDivider label={divider} />}
                    <SortableSeedRow row={row} index={i} issue={issues[i] || {}}
                      datalistId={datalistId} patchRow={patchRow} removeRow={removeRow} move={move} />
                  </Fragment>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <p className="text-[10px] text-zinc-600 mt-3">Position in the list = bracket placement. Only 1–8 are individually seeded — 9–16{event === 'Singles' ? ' and 17–32' : ''} go into the draw as groups, but order within a group still sets which line they land on. Drag the grip to reorder, or use the up/down arrows.</p>
    </Card>
  );
}

// Bands in the seed order: 1–8 are the true seeds; 9–16 / 17–32 place in the
// bracket as groups; anything past the draw size is an alternate. Mirrors
// bandLabel/singleElim on the public site (src/App.jsx).
function bandDividerFor(event, i) {
  const cap = event === 'Doubles' ? 16 : 32;
  if (i === 8) return '9–16 · bracket group';
  if (i === 16) return cap === 16 ? 'Alternates — beyond the 16-team draw' : '17–32 · bracket group';
  if (i === 32 && cap === 32) return 'Alternates — beyond the 32-player draw';
  return null;
}

function BandDivider({ label }) {
  return (
    <div className="flex items-center gap-2 pt-1.5">
      <span className="h-px flex-1 bg-zinc-800" />
      <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-600">{label}</span>
      <span className="h-px flex-1 bg-zinc-800" />
    </div>
  );
}

function SortableSeedRow({ row, index, issue, datalistId, patchRow, removeRow, move }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const hasIssue = issue.duplicateOf !== undefined || issue.unknown;

  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-center gap-2 bg-[#111] border rounded-xl p-2.5 ${isDragging ? 'relative z-10 border-[#fbbf24]/50 shadow-lg shadow-black/50' : 'border-zinc-800'}`}>
      <button {...attributes} {...listeners} aria-label="Drag to reorder"
        className="touch-none cursor-grab active:cursor-grabbing min-h-11 -my-1 px-0.5 flex items-center text-zinc-600 hover:text-zinc-300 transition-colors shrink-0">
        <GripVertical className="w-4 h-4" />
      </button>
      <span className={`w-7 h-7 shrink-0 rounded-lg border flex items-center justify-center text-xs font-black ${index < 8 ? 'bg-[#fbbf24]/10 border-[#fbbf24]/20 text-[#fbbf24]' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>{index + 1}</span>
      <div className="flex-1 min-w-0">
        <input list={datalistId} value={row.name} onChange={(e) => patchRow(row.id, { name: e.target.value })}
          placeholder="Player / team"
          className="w-full bg-transparent outline-none text-sm font-bold text-zinc-100 placeholder:text-zinc-600 placeholder:font-normal" />
        {hasIssue && (
          <div className="flex flex-wrap gap-1 mt-1">
            {issue.duplicateOf !== undefined && (
              <button onClick={() => removeRow(row.id)}
                title="Same player/team as an earlier seed (partner order doesn't matter) — tap to remove this row"
                className={`inline-flex items-center whitespace-nowrap text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border transition-colors hover:bg-rose-500/25 ${CHIP_TONES.rose}`}>
                duplicate of #{issue.duplicateOf + 1} — tap to remove
              </button>
            )}
            {issue.unknown && (
              <Chip tone="amber" title="Doesn't match any registered entrant — typo, or they haven't signed up">not in the field</Chip>
            )}
          </div>
        )}
      </div>
      <TextInput value={row.notes} onChange={(v) => patchRow(row.id, { notes: v })} placeholder="Note (optional)" className="hidden sm:block w-44" />
      <div className="flex items-center gap-0.5 shrink-0">
        <IconButton icon={ChevronUp} label="Move up" onClick={() => move(index, -1)} />
        <IconButton icon={ChevronDown} label="Move down" onClick={() => move(index, 1)} />
        <IconButton icon={Trash2} tone="danger" label="Remove seed" onClick={() => removeRow(row.id)} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------- Field lock
// Public "Seeds Final" switch (Config tab, key "seeds final"). While draft,
// open bracket lines read TBD; once locked they read BYE — and byes fall to
// the top seeds first by construction (see singleElim in src/App.jsx).
// Reads the live Config on mount so the toggle shows the real current state.
function FieldLock({ ops }) {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(CONFIG_CSV_URL)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(t => {
        if (cancelled) return;
        const c = mapConfig(parseCSV(t));
        if (c.seedsFinal != null) setLocked(c.seedsFinal);
      })
      .catch(() => { /* empty/unset Config — treat as draft */ });
    return () => { cancelled = true; };
  }, []);

  const flip = (next) => {
    setLocked(next);
    ops.pushConfig({ seedsFinal: next });
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><LockKeyhole className="w-4 h-4 text-[#fbbf24]" /> Field lock</h3>
          <p className="text-[11px] text-zinc-500 mt-1 max-w-md">Flip once entries close: the public board switches to “Final Seeds” and open first-round lines show as BYEs (top seeds get them first) instead of TBD.</p>
        </div>
        <Toggle checked={locked} onChange={flip} label="Draft — open lines are TBD" activeLabel="Locked — open lines are BYEs" />
      </div>
      <p className="text-[10px] text-zinc-600 mt-2.5">Writes “seeds final” to the sheet’s Config tab (needs the latest Apps Script deployed — or set that row to yes/no by hand; the site follows within ~1 min).</p>
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
  const flags = useMemo(() => doublesPartnerFlags(participants), [participants]);
  // Who lists this (partner-less) player as THEIR partner — so "no partner"
  // rows that are actually covered by the other half's registration read as
  // paired instead of missing.
  const claimedBy = useMemo(() => {
    const m = new Map();
    for (const f of flags.values()) {
      if (f.resolvedName) m.set(normName(f.resolvedName), f.player.name);
    }
    return m;
  }, [flags]);

  return (
    <Card className="p-4 sm:p-5">
      <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-1"><Users2 className="w-4 h-4 text-[#fbbf24]" /> Doubles partners</h3>
      <p className="text-[11px] text-zinc-500 mb-3">Pulled from the registration form by default — override here for last-minute swaps or unpaired entrants. Amber = the listed partner hasn't signed up themselves yet.</p>
      <datalist id="doubles-names">
        {allNames.map(n => <option key={n} value={n} />)}
      </datalist>
      {doublesPlayers.length === 0 ? (
        <EmptyState title="No doubles entrants yet" />
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {doublesPlayers.map(p => {
            const f = flags.get(normName(p.name));
            const listedBy = f?.unpaired ? claimedBy.get(normName(p.name)) : undefined;
            return (
              <div key={p.name} className="bg-[#111] border border-zinc-800 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-bold text-zinc-200 truncate flex-1">{p.name}</span>
                  <span className="text-zinc-600 text-xs shrink-0">w/</span>
                  <input list="doubles-names" value={p.overlay.partner || p.partner || ''}
                    onChange={(e) => ops.setOverlay(p.name, { partner: e.target.value })}
                    placeholder="assign partner"
                    className="bg-black border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-[#fbbf24] outline-none focus:border-[#fbbf24]/40 transition-colors placeholder:text-zinc-700 w-36 shrink-0" />
                </div>
                {f && (f.missing || f.conflict || f.unpaired) && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {f.missing && <Chip tone="amber" title={`"${f.raw}" doesn't match any registered doubles player`}>partner not signed up</Chip>}
                    {f.conflict && <Chip tone="rose" title={`${f.resolvedName} lists a different partner`}>pairing conflict</Chip>}
                    {f.unpaired && (listedBy
                      ? <Chip tone="zinc" title={`${listedBy} named them as partner — confirm and assign it here`}>listed by {listedBy}</Chip>
                      : <Chip tone="zinc" title="No partner given on the form">no partner yet</Chip>)}
                  </div>
                )}
              </div>
            );
          })}
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

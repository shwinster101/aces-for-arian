import { useMemo, useState } from 'react';
import { UserPlus, Trash2, Users } from 'lucide-react';
import { Card, PageHeader, Stat, Pills, SearchBox, StatusBadge, RegStatusChip, TextInput, Select, IconButton, EmptyState } from '../ui';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'pending', label: 'Pending' },
  { value: 'waitlist', label: 'Waitlist' },
];

const EVENTS_OPTIONS = ['Singles', 'Doubles', 'Singles & Doubles', 'Supporter'];

// Effective registration status: an explicit ops override wins; otherwise
// derive a sensible default from the sheet's Verified/Pending status so every
// registrant lands in a bucket without staff having to triage all of them.
const effectiveStatus = (p) => p.overlay.regStatus || (p.status === 'Verified' ? 'confirmed' : 'pending');

export default function Registrations({ participants, ops }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const counts = useMemo(() => {
    const c = { all: participants.length, confirmed: 0, pending: 0, waitlist: 0 };
    participants.forEach(p => { c[effectiveStatus(p)] = (c[effectiveStatus(p)] || 0) + 1; });
    return c;
  }, [participants]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return participants.filter(p => {
      if (filter !== 'all' && effectiveStatus(p) !== filter) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [participants, filter, query]);

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Registrations"
        subtitle="Live roster from the Google Sheet, plus any walk-ups added here. Tap a status chip to set confirmed / waitlist / pending for tournament ops purposes."
        right={
          <button onClick={() => setShowAdd(s => !s)}
            className="flex items-center justify-center gap-2 min-h-11 bg-[#fbbf24] hover:bg-amber-400 text-black font-black text-[11px] uppercase tracking-wider px-4 py-2.5 rounded-xl transition-colors">
            <UserPlus className="w-4 h-4" />
            <span>Add walk-up</span>
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Stat label="Total" value={counts.all} />
        <Stat label="Confirmed" value={counts.confirmed} tone="emerald" />
        <Stat label="Waitlist" value={counts.waitlist} tone="amber" />
        <Stat label="Pending" value={counts.pending} />
      </div>

      {showAdd && <AddWalkUpForm ops={ops} onDone={() => setShowAdd(false)} />}

      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="sm:flex-1"><SearchBox value={query} onChange={setQuery} /></div>
        <Pills value={filter} onChange={setFilter} options={FILTERS} />
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={Users} title="No registrants match" hint="Try a different search or filter." />
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {filtered.map(p => (
              <RegistrationRow key={`${p.source}-${p.name}`} p={p} ops={ops} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function RegistrationRow({ p, ops }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4 px-4 py-3.5 hover:bg-zinc-900/40 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-zinc-100 text-sm truncate">{p.name}</span>
          {p.source === 'added' && (
            <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded px-1.5 py-0.5">Walk-up</span>
          )}
          <StatusBadge status={p.status} />
        </div>
        <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-2 flex-wrap">
          {p.classYear && <span>Class of {p.classYear}</span>}
          <span>{p.events}</span>
          {(p.overlay.partner || p.partner) && <span className="text-[#fbbf24]/80">w/ {p.overlay.partner || p.partner}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <RegStatusChip status={p.overlay.regStatus} onChange={(v) => {
          ops.setOverlay(p.name, { regStatus: v });
          // Only sheet-sourced registrants have a public roster row to flip;
          // walk-ups (source 'added') aren't public, so never push their names.
          if (p.source === 'sheet') ops.pushPublicStatus(p.name, v === 'confirmed' ? 'Verified' : 'Pending');
        }} />
        {p.source === 'added' && (
          <IconButton icon={Trash2} tone="danger" label="Remove walk-up" onClick={() => ops.removeWalkUp(p.addedId)} />
        )}
      </div>
    </div>
  );
}

function AddWalkUpForm({ ops, onDone }) {
  const [name, setName] = useState('');
  const [classYear, setClassYear] = useState('');
  const [events, setEvents] = useState('Singles');
  const [partner, setPartner] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    ops.addWalkUp({ name: name.trim(), classYear: classYear.trim(), events, partner: partner.trim() });
    setName(''); setClassYear(''); setPartner(''); setEvents('Singles');
    onDone();
  };

  return (
    <Card className="p-4">
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1.4fr_1.4fr_auto] gap-2.5 items-end">
        <Field label="Name *">
          <TextInput value={name} onChange={setName} placeholder="Full name" className="w-full" />
        </Field>
        <Field label="Class">
          <TextInput value={classYear} onChange={setClassYear} placeholder="e.g. 26" className="w-full" />
        </Field>
        <Field label="Events">
          <Select value={events} onChange={setEvents} options={EVENTS_OPTIONS} placeholder="Events" />
        </Field>
        <Field label="Partner">
          <TextInput value={partner} onChange={setPartner} placeholder="Doubles partner (optional)" className="w-full" />
        </Field>
        <button type="submit" className="bg-[#fbbf24] hover:bg-amber-400 text-black font-black text-[11px] uppercase tracking-wider px-4 py-2 rounded-lg transition-colors h-fit">
          Add
        </button>
      </form>
      <p className="text-[10px] text-zinc-600 mt-2.5">Walk-ups are saved to this device and marked Pending until ops confirms them — they won't appear on the public roster (that reads straight from the Google Sheet).</p>
    </Card>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

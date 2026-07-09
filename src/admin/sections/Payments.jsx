import { useMemo, useState, useEffect } from 'react';
import { CircleDollarSign, Shirt } from 'lucide-react';
import { Card, PageHeader, Stat, Pills, SearchBox, Toggle, Select, EmptyState } from '../ui';
import { CONFIG_CSV_URL, parseCSV, mapConfig } from '../../lib/sheet';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'no-shirt', label: 'No shirt yet' },
];

const PAYMENT_METHODS = ['Venmo', 'Zelle', 'Cash', 'Other'];
const SHIRT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

export default function Payments({ participants, ops }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const stats = useMemo(() => {
    const paid = participants.filter(p => p.overlay.paid).length;
    const shirts = participants.filter(p => p.overlay.shirt).length;
    const bySize = {};
    participants.forEach(p => { if (p.overlay.shirt && p.overlay.shirtSize) bySize[p.overlay.shirtSize] = (bySize[p.overlay.shirtSize] || 0) + 1; });
    return { paid, shirts, bySize };
  }, [participants]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return participants.filter(p => {
      if (filter === 'unpaid' && p.overlay.paid) return false;
      if (filter === 'no-shirt' && p.overlay.shirt) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [participants, filter, query]);

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Payments" subtitle="Track who's paid the $40 entry (and how) and who's collected their tournament tee. Order quantities live in the Merch tab." />
      <p className="text-[10px] text-emerald-400/70 -mt-1">Synced across devices (~30s) via the private ops sheet — safe to run from multiple phones/the laptop at once.</p>

      <p className="text-[10px] text-zinc-600 -mt-1">
        Staff reference — accepted methods: <span className="text-zinc-400 font-bold">Venmo @acesforarian</span> (QR/link on the public site) and{' '}
        <span className="text-zinc-400 font-bold">Zelle ashwinyedavalli@gmail.com</span> (Zelle is admin-only — not shown publicly).
      </p>

      <ScholarshipMeter ops={ops} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Stat label="Paid" value={`${stats.paid} / ${participants.length}`} tone="emerald" />
        <Stat label="Shirts given" value={`${stats.shirts} / ${participants.length}`} />
        {SHIRT_SIZES.filter(s => stats.bySize[s]).slice(0, 2).map(s => (
          <Stat key={s} label={`Size ${s}`} value={stats.bySize[s]} tone="amber" />
        ))}
      </div>
      {Object.keys(stats.bySize).length > 0 && (
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span className="text-zinc-600 uppercase tracking-widest font-bold pt-1.5">Shirt sizes:</span>
          {SHIRT_SIZES.filter(s => stats.bySize[s]).map(s => (
            <span key={s} className="font-mono font-bold bg-[#111] border border-zinc-800 rounded-md px-2 py-1 text-zinc-300">{s} × {stats.bySize[s]}</span>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="sm:flex-1"><SearchBox value={query} onChange={setQuery} /></div>
        <Pills value={filter} onChange={setFilter} options={FILTERS} />
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={CircleDollarSign} title="No one matches" hint="Try a different search or filter." />
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {filtered.map(p => (
              <div key={`${p.source}-${p.name}`} className="px-4 py-3.5 hover:bg-zinc-900/40 transition-colors">
                <div className="font-bold text-zinc-100 text-sm mb-2.5 truncate">{p.name}</div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Toggle
                    checked={p.overlay.paid}
                    onChange={(v) => ops.setOverlay(p.name, { paid: v })}
                    label="Mark paid"
                    activeLabel="Paid"
                  />
                  {p.overlay.paid && (
                    <Select
                      value={p.overlay.paymentMethod}
                      onChange={(v) => ops.setOverlay(p.name, { paymentMethod: v })}
                      options={PAYMENT_METHODS}
                      placeholder="Method?"
                    />
                  )}
                  <span className="w-px h-5 bg-zinc-800 mx-0.5 hidden sm:block" />
                  <Toggle
                    checked={p.overlay.shirt}
                    onChange={(v) => ops.setOverlay(p.name, { shirt: v })}
                    label="Mark shirt given"
                    activeLabel="Shirt given"
                  />
                  {p.overlay.shirt && (
                    <Select
                      value={p.overlay.shirtSize}
                      onChange={(v) => ops.setOverlay(p.name, { shirtSize: v })}
                      options={SHIRT_SIZES}
                      placeholder="Size?"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <p className="text-[10px] text-zinc-600 flex items-center gap-1.5"><Shirt className="w-3 h-3" /> Entry includes one tournament tee ($25 value) — sizes feed the order count for the gear locker.</p>
    </div>
  );
}

// Staff control for the PUBLIC scholarship meter. The total is staff-controlled
// (Config "raised" is the single public number — confirmed entries are NOT
// inferred as dollars; see HANDOFF.md), so this is the courtside surface for
// bumping it: type the total, Save, and writeConfig_ writes the Config tab the
// public meter reads. Reads the live Config on mount so you edit the real value.
function ScholarshipMeter({ ops }) {
  const [raised, setRaised] = useState('');
  const [goal, setGoal] = useState('');
  const [current, setCurrent] = useState(null);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(CONFIG_CSV_URL)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(t => {
        if (cancelled) return;
        const c = mapConfig(parseCSV(t));
        setCurrent(c);
        if (c.raised != null) setRaised(String(c.raised));
        if (c.goal != null) setGoal(String(c.goal));
      })
      .catch(() => { /* empty/unset Config — inputs stay blank w/ fallback placeholders */ });
    return () => { cancelled = true; };
  }, []);

  const dirty = (raised !== '' && String(current?.raised ?? '') !== raised) ||
                (goal !== '' && String(current?.goal ?? '') !== goal);

  const save = () => {
    const r = parseInt(raised, 10);
    const g = parseInt(goal, 10);
    ops.pushConfig({ raised: isNaN(r) ? undefined : r, goal: isNaN(g) ? undefined : g });
    setCurrent({ raised: isNaN(r) ? current?.raised : r, goal: isNaN(g) ? current?.goal : g });
    setSavedAt(Date.now());
  };

  const field = (label, val, setVal, ph) => (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">{label}</span>
      <input type="number" min="0" inputMode="numeric" value={val} onChange={(e) => setVal(e.target.value)} placeholder={ph}
        className="w-28 bg-black border border-zinc-800 rounded-lg min-h-11 px-3 text-sm font-bold text-zinc-100 outline-none focus:border-[#fbbf24]/40 transition-colors placeholder:text-zinc-700 placeholder:font-normal" />
    </label>
  );

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><CircleDollarSign className="w-4 h-4 text-[#fbbf24]" /> Scholarship Meter</h3>
        <span className="text-[10px] text-zinc-500">public total · live on the site</span>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {field('Raised $', raised, setRaised, String(current?.raised ?? '580'))}
        <span className="text-zinc-600 pb-3 font-black">/</span>
        {field('Goal $', goal, setGoal, String(current?.goal ?? '1750'))}
        <button onClick={save} disabled={!dirty}
          className="ml-auto min-h-11 px-5 bg-[#fbbf24] hover:bg-amber-400 disabled:opacity-30 disabled:hover:bg-[#fbbf24] text-black font-black text-xs uppercase tracking-wider rounded-xl transition-colors active:scale-[0.97]">
          {savedAt && !dirty ? 'Saved ✓' : 'Save'}
        </button>
      </div>
      <p className="text-[10px] text-zinc-600 mt-3">
        Single public number — fold in ace money (Scores → Live Ace Tracker shows the $) and any external/offline donations here by hand. Open public pages re-check within ~2 min; a reload picks it up immediately.
      </p>
    </Card>
  );
}

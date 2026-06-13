import { useMemo, useState } from 'react';
import { CircleDollarSign, Shirt } from 'lucide-react';
import { Card, PageHeader, Stat, Pills, SearchBox, Toggle, Select, EmptyState } from '../ui';

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

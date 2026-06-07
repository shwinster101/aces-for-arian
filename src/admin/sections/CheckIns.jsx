import { useMemo, useState } from 'react';
import { UserCheck, Clock } from 'lucide-react';
import { Card, PageHeader, Stat, Pills, SearchBox, EmptyState } from '../ui';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'in', label: 'Checked in' },
  { value: 'out', label: 'Not yet' },
];

export default function CheckIns({ participants, ops }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const checkedInCount = participants.filter(p => p.overlay.checkedIn).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return participants.filter(p => {
      if (filter === 'in' && !p.overlay.checkedIn) return false;
      if (filter === 'out' && p.overlay.checkedIn) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [participants, filter, query]);

  const toggle = (p) => {
    if (p.overlay.checkedIn) {
      ops.setOverlay(p.name, { checkedIn: false, checkedInAt: null });
    } else {
      ops.setOverlay(p.name, { checkedIn: true, checkedInAt: new Date().toISOString() });
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Day-of Check-in" subtitle="Search a name and tap to mark them arrived. Times are stamped automatically." />

      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="Checked in" value={`${checkedInCount} / ${participants.length}`} tone="emerald" />
        <Stat label="Still expected" value={Math.max(participants.length - checkedInCount, 0)} tone="amber" />
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="sm:flex-1"><SearchBox value={query} onChange={setQuery} placeholder="Find a player to check in…" /></div>
        <Pills value={filter} onChange={setFilter} options={FILTERS} />
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={UserCheck} title="No one matches" hint="Try a different search or filter." />
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {filtered.map(p => {
              const time = p.overlay.checkedInAt
                ? new Date(p.overlay.checkedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                : null;
              return (
                <div key={`${p.source}-${p.name}`} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-zinc-900/40 transition-colors">
                  <div className="min-w-0">
                    <div className="font-bold text-zinc-100 text-sm truncate">{p.name}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">{p.events}{p.classYear ? ` · '${p.classYear}` : ''}</div>
                  </div>
                  <button
                    onClick={() => toggle(p)}
                    className={`shrink-0 flex items-center justify-center gap-2 min-h-11 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition active:scale-95 ${
                      p.overlay.checkedIn
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-[#111] border-zinc-700 text-zinc-300 hover:border-[#fbbf24]/40 hover:text-[#fbbf24]'
                    }`}
                  >
                    {p.overlay.checkedIn ? (
                      <>
                        <UserCheck className="w-4 h-4" />
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3 opacity-70" />{time}</span>
                      </>
                    ) : (
                      <span>Check in</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

import { useMemo, useState, useEffect } from 'react';
import { CircleDollarSign } from 'lucide-react';
import { normName } from '../../lib/entrants';
import { Card, PageHeader, Stat, Pills, SearchBox, Toggle, Select, EmptyState } from '../ui';
import CashDrawer from '../CashDrawer';
import { CONFIG_CSV_URL, parseCSV, mapConfig } from '../../lib/sheet';

// ==========================================
// PAYMENTS — the money/accounting hub
// ==========================================
// Day-of COLLECTION happens on Check-ins (one row per arrival: collect $40 →
// shirt → finish). This tab is where the money is AUDITED: entry revenue and
// method breakdown, the public scholarship meter control, the cash-drawer
// close-out, and the unpaid list. Shirt tracking lives on Check-ins (hand-out)
// and Merch (inventory) — deliberately not duplicated here.

const ENTRY_FEE = 40;

const FILTERS = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
  { value: 'all', label: 'All' },
];

// 'Comped' is what the Check-ins collect flow writes for a fee exception —
// keep it selectable here so the reconciliation view round-trips it.
const PAYMENT_METHODS = ['Venmo', 'Zelle', 'Cash', 'Comped', 'Other'];

const isSupporter = (p) => /supporter/i.test(p.events || '');

export default function Payments({ participants, ops }) {
  // Default to the list that needs action: who still owes.
  const [filter, setFilter] = useState('unpaid');
  const [query, setQuery] = useState('');

  // Money picture: paid counts by method; comps collect $0 but stay visible.
  const money = useMemo(() => {
    const players = participants.filter(p => !isSupporter(p));
    const byMethod = {};
    let paid = 0;
    players.forEach(p => {
      if (!p.overlay.paid) return;
      paid += 1;
      const m = p.overlay.paymentMethod || 'Other';
      byMethod[m] = (byMethod[m] || 0) + 1;
    });
    const comped = byMethod.Comped || 0;
    return {
      players: players.length,
      paid,
      byMethod,
      collected: (paid - comped) * ENTRY_FEE,
      outstanding: (players.length - paid) * ENTRY_FEE,
    };
  }, [participants]);

  const payIntent = (p) => (ops.store.regPay || {})[normName(p.name)] || '';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return participants.filter(p => {
      if (isSupporter(p)) return false; // no fee — nothing to reconcile
      if (filter === 'unpaid' && p.overlay.paid) return false;
      if (filter === 'paid' && !p.overlay.paid) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [participants, filter, query]);

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Payments" subtitle="The money hub. Collection happens on Check-ins — audit it here: entry revenue by method, the public scholarship meter, and the cash-drawer close-out." />
      <p className="text-[10px] text-emerald-400/70 -mt-1">Synced across devices (~30s) via the private ops sheet — safe to run from multiple phones/the laptop at once.</p>

      <p className="text-[10px] text-zinc-600 -mt-1">
        Staff reference — accepted methods: <span className="text-zinc-400 font-bold">Venmo @acesforarian</span> (QR/link on the public site) and{' '}
        <span className="text-zinc-400 font-bold">Zelle ashwinyedavalli@gmail.com</span> (Zelle is admin-only — not shown publicly).
      </p>

      <ScholarshipMeter ops={ops} />

      {/* Entry-fee picture */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Stat label="Entry collected" value={`$${money.collected}`} tone="emerald" />
        <Stat label="Outstanding" value={`$${money.outstanding}`} tone={money.outstanding > 0 ? 'amber' : 'emerald'} />
        <Stat label="Paid" value={`${money.paid} / ${money.players}`} />
        <Stat label="Comped" value={money.byMethod.Comped || 0} />
      </div>
      <div className="flex flex-wrap gap-2 text-[10px]">
        <span className="text-zinc-600 uppercase tracking-widest font-bold pt-1.5">By method:</span>
        {PAYMENT_METHODS.filter(m => money.byMethod[m]).map(m => (
          <span key={m} className="font-mono font-bold bg-[#111] border border-zinc-800 rounded-md px-2 py-1 text-zinc-300">{m} × {money.byMethod[m]}</span>
        ))}
        {money.paid === 0 && <span className="text-zinc-600 pt-1.5">nothing collected yet</span>}
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="sm:flex-1"><SearchBox value={query} onChange={setQuery} placeholder="Find a player to audit…" /></div>
        <Pills value={filter} onChange={setFilter} options={FILTERS} />
      </div>

      {/* Reconciliation list — corrections only; collection lives on Check-ins */}
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={CircleDollarSign} title={filter === 'unpaid' ? 'Everyone has paid' : 'No one matches'} hint={filter === 'unpaid' ? 'Nothing outstanding — nice.' : 'Try a different search or filter.'} />
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {filtered.map(p => {
              const plan = payIntent(p);
              return (
                <div key={`${p.source}-${p.name}`} className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 hover:bg-zinc-900/40 transition-colors">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="font-bold text-zinc-100 text-sm truncate">{p.name}</span>
                    {!p.overlay.paid && plan && (
                      <span title={`Registration form: ${plan}`}
                        className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border bg-[#111] border-zinc-700 text-zinc-400 truncate max-w-32">
                        plans {plan}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Toggle
                      checked={p.overlay.paid}
                      onChange={(v) => ops.setOverlay(p.name, { paid: v, ...(v ? {} : { paymentMethod: '' }) })}
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <p className="text-[10px] text-zinc-600">Use this list for corrections (wrong method, mistaken paid mark) — collect at the Check-ins row so the drawer ledger stays in step. Supporters owe nothing and aren't listed. Shirt hand-outs: Check-ins · shirt inventory: Merch.</p>

      <CashDrawer ops={ops} defaultOpen title="Cash drawer — reconciliation" />
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

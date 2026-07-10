import { useMemo, useRef, useState } from 'react';
import { UserCheck, Clock, Shirt, CircleDollarSign, Megaphone } from 'lucide-react';
import { Card, PageHeader, Stat, Pills, SearchBox, EmptyState } from '../ui';
import CashDrawer from '../CashDrawer';

// ==========================================
// DAY-OF CHECK-IN — one row does the whole arrival
// ==========================================
// A volunteer working the line needs payment, shirt, and arrival on ONE
// player record — bouncing to the Payments tab mid-rush is how people get
// marked "arrived" without paying. Flow per row: Collect $40 (Venmo / Zelle
// / Cash with tendered shortcuts + change due / Comped) → shirt → Finish
// check-in (refuses until payment is resolved). Payments stays the
// reconciliation/reporting tab, not the working arrival screen.

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'in', label: 'Checked in' },
  { value: 'out', label: 'Not yet' },
];

const ENTRY_FEE = 40;
// One-tap tendered shortcuts for the common bills; anything odd goes in the
// custom box. Tap = payment recorded + drawer entry logged, change on screen.
const TENDER_QUICK = [40, 50, 60, 100];

const isSupporter = (p) => /supporter/i.test(p.events || '');

export default function CheckIns({ participants, ops }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  // key of the row whose collect panel is open + its cash sub-state.
  const [collect, setCollect] = useState(null); // { key, cash: bool, tendered: '' }
  const searchRef = useRef(null);

  const players = participants.filter(p => !isSupporter(p));
  const checkedInCount = players.filter(p => p.overlay.checkedIn).length;
  const paidCount = players.filter(p => p.overlay.paid).length;
  const shirtsGivenCount = players.filter(p => p.overlay.shirt).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return participants.filter(p => {
      if (filter === 'in' && !p.overlay.checkedIn) return false;
      if (filter === 'out' && p.overlay.checkedIn) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [participants, filter, query]);

  const keyOf = (p) => `${p.source}-${p.name}`;

  const markPaid = (p, method) => {
    ops.setOverlay(p.name, { paid: true, paymentMethod: method });
    setCollect(null);
  };
  const takeCash = (p, tendered) => {
    const t = Number(tendered);
    if (isNaN(t) || t < ENTRY_FEE) return;
    ops.setOverlay(p.name, { paid: true, paymentMethod: 'Cash' });
    ops.recordCash({ name: p.name, kind: 'entry', amount: ENTRY_FEE, tendered: t, change: t - ENTRY_FEE });
    setCollect(null);
  };
  const unmarkPaid = (p) => {
    if (!window.confirm(`Unmark ${p.name} as paid? (If it was cash, also remove their line in the Cash drawer ledger.)`)) return;
    ops.setOverlay(p.name, { paid: false, paymentMethod: '' });
  };
  const finish = (p) => {
    // Payment must be resolved first (Comped counts) — supporters owe nothing.
    if (!p.overlay.paid && !isSupporter(p)) {
      setCollect({ key: keyOf(p), cash: false, tendered: '' });
      return;
    }
    ops.setOverlay(p.name, { checkedIn: true, checkedInAt: new Date().toISOString() });
    setCollect(null);
    // Clear + refocus so the next player in line is one keystroke away.
    setQuery('');
    if (searchRef.current) searchRef.current.focus();
  };
  const undoArrival = (p) => ops.setOverlay(p.name, { checkedIn: false, checkedInAt: null });

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Day-of Check-in" subtitle="Everything for one arrival in one row: collect payment, hand the shirt, finish check-in. Times are stamped automatically." />
      <p className="text-[10px] text-emerald-400/70 -mt-1">Synced across devices (~30s) via the private ops sheet — volunteers sign in with the volunteer PIN.</p>

      <DeskScript ops={ops} />
      <CashDrawer ops={ops} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Stat label="Checked in" value={`${checkedInCount} / ${players.length}`} tone="emerald" />
        <Stat label="Still expected" value={Math.max(players.length - checkedInCount, 0)} tone="amber" />
        <Stat label="Paid" value={`${paidCount} / ${players.length}`} />
        <Stat label="Shirts given" value={`${shirtsGivenCount} / ${players.length}`} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="sm:flex-1"><SearchBox inputRef={searchRef} value={query} onChange={setQuery} placeholder="Find a player to check in…" /></div>
        <Pills value={filter} onChange={setFilter} options={FILTERS} />
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={UserCheck} title="No one matches" hint="Try a different search or filter." />
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {filtered.map(p => {
              const key = keyOf(p);
              const time = p.overlay.checkedInAt
                ? new Date(p.overlay.checkedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                : null;
              // Ops override (set at the desk, if the committee corrected a
              // size) wins over the size picked at registration.
              const size = p.overlay.shirtSize || p.shirtSize || '—';
              const supporter = isSupporter(p);
              const open = collect && collect.key === key;
              return (
                <div key={key} className="px-4 py-3.5 hover:bg-zinc-900/40 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-zinc-100 text-sm truncate">{p.name}</span>
                        {!supporter && (p.overlay.paid ? (
                          <button onClick={() => unmarkPaid(p)} title="Tap to unmark (mistake)"
                            className="shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md border bg-emerald-500/10 border-emerald-500/25 text-emerald-400">
                            ✓ Paid{p.overlay.paymentMethod ? ` · ${p.overlay.paymentMethod}` : ''}
                          </button>
                        ) : (
                          <span className="shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md border bg-rose-500/10 border-rose-500/30 text-rose-400">
                            Unpaid
                          </span>
                        ))}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{p.events}{p.classYear ? ` · '${p.classYear}` : ''}</span>
                        {!supporter && (
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-zinc-300 bg-[#111] border border-zinc-800 rounded-md px-1.5 py-0.5">
                            <Shirt className="w-3 h-3 opacity-70" />{size}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!supporter && !p.overlay.paid && (
                        <button
                          onClick={() => setCollect(open ? null : { key, cash: false, tendered: '' })}
                          className={`flex items-center justify-center gap-1.5 min-h-11 px-3 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition active:scale-95 ${
                            open ? 'bg-[#fbbf24] border-[#fbbf24] text-black' : 'bg-[#fbbf24]/10 border-[#fbbf24]/40 text-[#fbbf24] hover:bg-[#fbbf24]/20'
                          }`}
                        >
                          <CircleDollarSign className="w-4 h-4" />
                          <span>Collect ${ENTRY_FEE}</span>
                        </button>
                      )}
                      {!supporter && (
                        <button
                          onClick={() => ops.setOverlay(p.name, { shirt: !p.overlay.shirt })}
                          title="Toggle shirt given"
                          className={`flex items-center justify-center gap-1.5 min-h-11 px-3 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition active:scale-95 ${
                            p.overlay.shirt
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-[#111] border-zinc-700 text-zinc-300 hover:border-[#fbbf24]/40 hover:text-[#fbbf24]'
                          }`}
                        >
                          <Shirt className="w-4 h-4" />
                          <span>{p.overlay.shirt ? `${size} given` : `Give ${size}`}</span>
                        </button>
                      )}
                      <button
                        onClick={() => (p.overlay.checkedIn ? undoArrival(p) : finish(p))}
                        title={p.overlay.checkedIn ? 'Tap to undo arrival (mistake)' : undefined}
                        className={`flex items-center justify-center gap-2 min-h-11 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition active:scale-95 ${
                          p.overlay.checkedIn
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : p.overlay.paid || supporter
                              ? 'bg-[#111] border-zinc-700 text-zinc-300 hover:border-[#fbbf24]/40 hover:text-[#fbbf24]'
                              : 'bg-[#111] border-zinc-800 text-zinc-500'
                        }`}
                      >
                        {p.overlay.checkedIn ? (
                          <>
                            <UserCheck className="w-4 h-4" />
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3 opacity-70" />{time}</span>
                          </>
                        ) : (
                          <span>Finish check-in</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {open && !p.overlay.paid && (
                    <div className="mt-3 rounded-xl border border-[#fbbf24]/25 bg-[#1c1408] p-3 space-y-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#fbbf24]">
                        Collect ${ENTRY_FEE} entry — how are they paying?
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {['Venmo', 'Zelle'].map(mth => (
                          <button key={mth} onClick={() => markPaid(p, mth)}
                            className="min-h-11 px-4 rounded-xl border border-zinc-700 bg-[#111] text-zinc-200 text-[11px] font-black uppercase tracking-wider hover:border-emerald-500/40 hover:text-emerald-400 transition active:scale-95">
                            {mth}
                          </button>
                        ))}
                        <button onClick={() => setCollect(c => ({ ...c, cash: !c.cash, tendered: '' }))}
                          className={`min-h-11 px-4 rounded-xl border text-[11px] font-black uppercase tracking-wider transition active:scale-95 ${
                            collect.cash ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'bg-[#111] border-zinc-700 text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-400'
                          }`}>
                          Cash…
                        </button>
                        <button onClick={() => markPaid(p, 'Comped')}
                          className="min-h-11 px-4 rounded-xl border border-zinc-800 bg-[#111] text-zinc-400 text-[11px] font-black uppercase tracking-wider hover:text-zinc-200 transition active:scale-95">
                          Comped / exception
                        </button>
                      </div>
                      {collect.cash && (
                        <div className="space-y-2.5">
                          <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">They hand you… (one tap records it)</div>
                          <div className="flex flex-wrap items-center gap-2">
                            {TENDER_QUICK.map(t => (
                              <button key={t} onClick={() => takeCash(p, t)}
                                className="min-h-12 px-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-black transition active:scale-95">
                                <span className="text-sm">${t}</span>
                                <span className="block text-[9px] font-bold uppercase tracking-wider text-emerald-500/80">
                                  {t === ENTRY_FEE ? 'exact' : `$${t - ENTRY_FEE} change`}
                                </span>
                              </button>
                            ))}
                            <input type="number" inputMode="numeric" min={ENTRY_FEE} placeholder="other $"
                              value={collect.tendered}
                              onChange={(e) => setCollect(c => ({ ...c, tendered: e.target.value }))}
                              className="w-24 bg-black border border-zinc-800 rounded-xl min-h-12 px-3 text-sm font-bold text-zinc-100 outline-none focus:border-emerald-500/40 transition-colors placeholder:text-zinc-700 placeholder:font-normal" />
                            <button onClick={() => takeCash(p, parseFloat(collect.tendered))}
                              disabled={!(parseFloat(collect.tendered) >= ENTRY_FEE)}
                              className="min-h-12 px-4 rounded-xl bg-emerald-500 text-black text-[11px] font-black uppercase tracking-wider transition active:scale-95 disabled:opacity-30">
                              Take cash
                            </button>
                          </div>
                          {parseFloat(collect.tendered) >= ENTRY_FEE && (
                            <div className="text-base font-black text-[#fbbf24]">
                              Change due: ${parseFloat(collect.tendered) - ENTRY_FEE}
                            </div>
                          )}
                          <p className="text-[10px] text-zinc-600">Cash lands in the drawer ledger above automatically.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <p className="text-[10px] text-zinc-600">
        Finish check-in refuses until payment is resolved (Comped counts). Supporters have no fee — their row is just arrival. Tap a green chip/button to undo a mistake.
      </p>
    </div>
  );
}

// Pinned script — the three things a volunteer tells EVERY player at the
// desk. HQ fills the blanks at setup; big text on purpose (outdoor sun).
function DeskScript({ ops }) {
  const s = ops.store.deskScript;
  const line = (n, label, key, ph) => (
    <label className="flex items-center gap-2.5">
      <span className="shrink-0 w-5 h-5 rounded-full bg-[#fbbf24] text-black text-[10px] font-black flex items-center justify-center">{n}</span>
      <span className="shrink-0 w-28 sm:w-32 text-xs font-black uppercase tracking-wider text-zinc-200">{label}</span>
      <input value={s[key] || ''} onChange={(e) => ops.setDeskScript({ [key]: e.target.value })} placeholder={ph}
        className="flex-1 min-w-0 bg-black/40 border border-zinc-800 rounded-lg min-h-10 px-3 text-sm font-bold text-zinc-100 outline-none focus:border-[#fbbf24]/40 transition-colors placeholder:text-zinc-600 placeholder:font-normal" />
    </label>
  );
  return (
    <Card className="p-4 border-[#fbbf24]/20">
      <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-1">
        <Megaphone className="w-4 h-4 text-[#fbbf24]" /> Say this to every player
      </h3>
      <p className="text-[10px] text-zinc-500 mb-3">HQ fills these in each morning — read all three at every check-in so nobody wanders.</p>
      <div className="space-y-2">
        {line(1, 'Warm-up at', 'warmup', 'e.g. open courts until your match is called')}
        {line(2, 'Report scores', 'scores', 'e.g. the front desk tent')}
        {line(3, 'Next matches', 'next', 'Website + court board')}
      </div>
    </Card>
  );
}

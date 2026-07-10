// ==========================================
// CASH DRAWER — float, ledger, close-out
// ==========================================
// One physical cash box → one device: this ledger is deliberately LOCAL
// (never synced — two phones "running" one drawer is how counts drift).
// Entry fees land here automatically when a Check-ins collect takes Cash;
// merch cash and refunds go through the quick-adjust row. Expected drawer
// total = starting float + net cash in (change is handed back out of the
// drawer, so an entry's NET amount is what stays); close-out compares the
// counted drawer against expected and shows the variance.

import { useMemo, useState } from 'react';
import { Banknote, ChevronDown, ChevronUp, Trash2, TriangleAlert } from 'lucide-react';
import { Card, Stat, IconButton } from './ui';
import { cashMath } from './store';

const money = (n) => {
  const v = Math.round(Number(n) * 100) / 100;
  const abs = Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${v < 0 ? '−' : ''}$${abs}`;
};

function Field({ label, value, onChange, placeholder = '', type = 'text', width = 'w-32' }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">{label}</span>
      <input type={type} inputMode={type === 'number' ? 'decimal' : undefined} min={type === 'number' ? '0' : undefined}
        value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={`${width} bg-black border border-zinc-800 rounded-lg min-h-11 px-3 text-sm font-bold text-zinc-100 outline-none focus:border-[#fbbf24]/40 transition-colors placeholder:text-zinc-700 placeholder:font-normal`} />
    </label>
  );
}

export default function CashDrawer({ ops, defaultOpen = false, title = 'Cash drawer' }) {
  const [open, setOpen] = useState(defaultOpen);
  const [adjAmt, setAdjAmt] = useState('');
  const [adjNote, setAdjNote] = useState('');
  const cash = ops.store.cash;
  const m = useMemo(() => cashMath(cash), [cash]);

  const adjust = (sign) => {
    const n = parseFloat(adjAmt);
    if (isNaN(n) || n <= 0) return;
    ops.recordCash({
      kind: sign > 0 ? 'cash in' : 'cash out',
      name: adjNote.trim() || (sign > 0 ? 'Merch / other sale' : 'Refund / payout'),
      amount: sign * n,
    });
    setAdjAmt('');
    setAdjNote('');
  };

  return (
    <Card className="p-4 sm:p-5">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 text-left">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
          <Banknote className="w-4 h-4 text-[#fbbf24]" /> {title}
        </h3>
        <span className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] font-mono font-bold text-zinc-300">expected {money(m.expected)}</span>
          {open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </span>
      </button>

      {m.lowBills && (
        <p className="mt-3 flex items-start gap-2 text-xs font-bold text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/25 rounded-lg px-3 py-2">
          <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Change given ({money(m.changeGiven)}) is close to the starting float ({money(m.float)}) — small bills may be running low. Restock before the line builds.</span>
        </p>
      )}

      {open && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Starting float $" type="number" width="w-28" value={cash.float} onChange={(v) => ops.setCash({ float: v })} placeholder="0" />
            <Field label="Volunteer / shift" width="w-48" value={cash.volunteer} onChange={(v) => ops.setCash({ volunteer: v })} placeholder="who's on the box" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Stat label="Cash collected" value={money(m.cashIn)} tone="emerald" />
            <Stat label="Change given" value={money(m.changeGiven)} />
            <Stat label="Expected in drawer" value={money(m.expected)} tone="amber" />
            <Stat label="Entries" value={(cash.log || []).length} />
          </div>

          {(cash.log || []).length === 0 ? (
            <p className="text-[11px] text-zinc-600">No cash movements yet — a Cash payment taken on Check-ins lands here automatically.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto divide-y divide-zinc-800/60 border border-zinc-800 rounded-xl">
              {[...cash.log].reverse().map(r => (
                <div key={r.id} className="flex items-center gap-2.5 px-3 py-1.5 text-xs">
                  <span className="font-mono text-zinc-600 shrink-0">{new Date(r.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                  <span className="text-zinc-200 font-bold truncate min-w-0">{r.name || '—'}</span>
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 shrink-0 hidden sm:inline">{r.kind}</span>
                  {Number(r.tendered) > 0 && Number(r.change) > 0 && (
                    <span className="text-[10px] text-zinc-500 shrink-0 hidden sm:inline">{money(r.tendered)} − {money(r.change)} change</span>
                  )}
                  <span className={`ml-auto font-mono font-bold shrink-0 ${Number(r.amount) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {Number(r.amount) < 0 ? money(r.amount) : `+${money(r.amount)}`}
                  </span>
                  <IconButton icon={Trash2} tone="danger" label="Remove entry (mistake)" onClick={() => ops.removeCashEntry(r.id)} />
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2.5">
            <Field label="Adjust $" type="number" width="w-24" value={adjAmt} onChange={setAdjAmt} placeholder="0" />
            <Field label="What for" width="w-44" value={adjNote} onChange={setAdjNote} placeholder="merch, refund…" />
            <button onClick={() => adjust(1)}
              className="min-h-11 px-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[11px] font-black uppercase tracking-wider transition active:scale-95">
              + Cash in
            </button>
            <button onClick={() => adjust(-1)}
              className="min-h-11 px-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-[11px] font-black uppercase tracking-wider transition active:scale-95">
              − Cash out
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-4 pt-3 border-t border-zinc-800/60">
            <Field label="Counted at close $" type="number" width="w-32" value={cash.closing} onChange={(v) => ops.setCash({ closing: v })} placeholder="count the box" />
            {m.variance != null && (
              <div className="pb-0.5">
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Variance</div>
                <div className={`text-lg font-black leading-tight mt-0.5 ${m.variance === 0 ? 'text-emerald-400' : m.variance < 0 ? 'text-rose-400' : 'text-[#fbbf24]'}`}>
                  {m.variance === 0 ? 'Even ✓' : m.variance > 0 ? `${money(m.variance)} over` : `${money(Math.abs(m.variance))} short`}
                </div>
              </div>
            )}
          </div>

          <p className="text-[10px] text-zinc-600 leading-relaxed">
            One drawer = one device: this ledger lives only on the device next to the cash box and is never synced (payment <em>status</em> still syncs to every device). Removing an entry is the mistake-undo; the box itself is the receipt.
          </p>
        </div>
      )}
    </Card>
  );
}

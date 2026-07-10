import { useMemo } from 'react';
import { ShoppingCart, Package, Plus, Trash2, RotateCcw, CheckCircle2 } from 'lucide-react';
import { Card, PageHeader, Stat, Toggle, TextInput, IconButton } from '../ui';

// ==========================================
// LOGISTICS — day-of buy list + order confirmations
// ==========================================
// The TD's procurement checklist: consumables to buy (water, Gatorade, fruit,
// snacks, paper towels…) and merch/trophy orders to confirm (ordered → arrived).
// LOCAL to this device (like the cash drawer / desk script) — it's committee
// prep, not shared state. Seeded with the standard list so it's ready every
// year; the durable, editable-forever copy is docs/day-of-logistics.md.

export default function Logistics({ ops }) {
  const { buyList, orders } = ops.store.logistics;
  const gotCount = useMemo(() => buyList.filter(r => r.got).length, [buyList]);
  const confirmedCount = useMemo(() => orders.filter(r => r.confirmed).length, [orders]);
  const orderedCount = useMemo(() => orders.filter(r => r.ordered).length, [orders]);
  const orderTotal = useMemo(
    () => orders.reduce((t, r) => t + (parseFloat(String(r.cost).replace(/[^0-9.]/g, '')) || 0), 0),
    [orders]
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Logistics" subtitle="Day-of buy list + merch & trophy order confirmations. Check things off as you shop and as orders land." />
      <p className="text-[10px] text-emerald-400/70 -mt-1">Local to this device (not synced). The durable, reusable copy lives in docs/day-of-logistics.md — update it after the event for next year.</p>

      {/* --- BUY LIST ------------------------------------------------------- */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-[#fbbf24]" /> Buy list</h3>
          <div className="flex items-center gap-2">
            <Stat label="Got" value={`${gotCount} / ${buyList.length}`} tone={gotCount === buyList.length ? 'emerald' : 'amber'} />
            <button onClick={() => ops.addLogItem('buyList')}
              className="flex items-center gap-1.5 min-h-11 text-[10px] font-black uppercase tracking-wider text-[#fbbf24] bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 border border-[#fbbf24]/25 rounded-lg px-3 py-1.5 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add item
            </button>
          </div>
        </div>
        {buyList.length === 0 ? (
          <p className="text-xs text-zinc-600 py-2">List cleared. Tap “Add item”, or “Reset to standard list” below.</p>
        ) : (
          <div className="space-y-2">
            {buyList.map(r => (
              <div key={r.id} className={`flex flex-wrap items-center gap-2 rounded-xl border p-2.5 transition-colors ${r.got ? 'bg-emerald-500/5 border-emerald-500/25' : 'bg-[#111] border-zinc-800'}`}>
                <Toggle checked={r.got} onChange={(v) => ops.setLogItem('buyList', r.id, { got: v })} label="Get" activeLabel="Got ✓" />
                <input value={r.item} onChange={(e) => ops.setLogItem('buyList', r.id, { item: e.target.value })} placeholder="Item"
                  className={`flex-1 min-w-[9rem] bg-transparent outline-none text-sm font-bold ${r.got ? 'text-zinc-400 line-through' : 'text-zinc-100'} placeholder:text-zinc-600 placeholder:font-normal placeholder:no-underline`} />
                <TextInput value={r.target} onChange={(v) => ops.setLogItem('buyList', r.id, { target: v })} placeholder="Qty" className="w-24" />
                <TextInput value={r.note} onChange={(v) => ops.setLogItem('buyList', r.id, { note: v })} placeholder="Note" className="hidden sm:block w-40" />
                <IconButton icon={Trash2} tone="danger" label="Remove item" onClick={() => ops.removeLogItem('buyList', r.id)} />
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-zinc-600 mt-3">Quantities are starting suggestions for ~46 players + spectators over two days — adjust to the field. Ice, cups, and trash bags are easy to forget.</p>
      </Card>

      {/* --- ORDERS & CONFIRMATIONS ---------------------------------------- */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><Package className="w-4 h-4 text-[#fbbf24]" /> Orders &amp; confirmations</h3>
          <div className="flex items-center gap-2">
            <Stat label="Confirmed" value={`${confirmedCount} / ${orders.length}`} tone={confirmedCount === orders.length ? 'emerald' : 'amber'} />
            <button onClick={() => ops.addLogItem('orders')}
              className="flex items-center gap-1.5 min-h-11 text-[10px] font-black uppercase tracking-wider text-[#fbbf24] bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 border border-[#fbbf24]/25 rounded-lg px-3 py-1.5 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add order
            </button>
          </div>
        </div>
        {orders.length === 0 ? (
          <p className="text-xs text-zinc-600 py-2">No orders tracked. Tap “Add order”, or “Reset to standard list” below.</p>
        ) : (
          <div className="space-y-2.5">
            {orders.map(r => (
              <div key={r.id} className={`rounded-xl border p-3 space-y-2.5 transition-colors ${r.confirmed ? 'bg-emerald-500/5 border-emerald-500/25' : 'bg-[#111] border-zinc-800'}`}>
                <div className="flex items-center gap-2">
                  {r.confirmed && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  <input value={r.item} onChange={(e) => ops.setLogItem('orders', r.id, { item: e.target.value })} placeholder="Item (e.g. Trophies — doubles top 3)"
                    className="flex-1 min-w-0 bg-transparent outline-none text-sm font-bold text-zinc-100 placeholder:text-zinc-600 placeholder:font-normal" />
                  <IconButton icon={Trash2} tone="danger" label="Remove order" onClick={() => ops.removeLogItem('orders', r.id)} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Toggle checked={r.ordered} onChange={(v) => ops.setLogItem('orders', r.id, { ordered: v, ...(v ? {} : { confirmed: false }) })} label="Ordered" activeLabel="Ordered ✓" />
                  <Toggle checked={r.confirmed} onChange={(v) => ops.setLogItem('orders', r.id, { confirmed: v, ...(v ? { ordered: true } : {}) })} label="Arrived?" activeLabel="Confirmed ✓" />
                  <TextInput value={r.vendor} onChange={(v) => ops.setLogItem('orders', r.id, { vendor: v })} placeholder="Vendor" className="w-32" />
                  <TextInput value={r.cost} onChange={(v) => ops.setLogItem('orders', r.id, { cost: v })} placeholder="Cost $" className="w-24" />
                  <TextInput value={r.note} onChange={(v) => ops.setLogItem('orders', r.id, { note: v })} placeholder="Note" className="hidden sm:block flex-1 min-w-[8rem]" />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
          <p className="text-[10px] text-zinc-600">{orderedCount} ordered · {confirmedCount} confirmed{orderTotal > 0 ? ` · ~$${orderTotal.toLocaleString()} on orders` : ''}. Shirt size counts are on the Merch tab.</p>
        </div>
      </Card>

      <div className="flex justify-end">
        <button onClick={() => { if (window.confirm('Reset the buy list AND orders to the standard seeded checklist? This clears your edits on this device (the docs/day-of-logistics.md copy is unaffected).')) ops.resetLogistics(); }}
          className="flex items-center gap-1.5 min-h-11 text-[10px] font-black uppercase tracking-wider text-zinc-400 bg-zinc-900 hover:text-[#fbbf24] border border-zinc-800 rounded-lg px-3 py-1.5 transition-colors">
          <RotateCcw className="w-3.5 h-3.5" /> Reset to standard list
        </button>
      </div>
    </div>
  );
}

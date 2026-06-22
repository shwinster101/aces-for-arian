import { useMemo } from 'react';
import { Shirt, Package } from 'lucide-react';
import { Card, PageHeader, Stat } from '../ui';
import { MERCH_ITEMS } from '../../lib/sheet';

const money = (n) => `$${(Math.round(n * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

// Canonical adult shirt sizes; any other value a registrant typed gets appended.
const SHIRT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

const toInt = (v) => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };

function NumCell({ value, onChange, placeholder }) {
  return (
    <input type="number" min="0" inputMode="numeric" value={value === 0 ? '' : value}
      onChange={(e) => onChange(toInt(e.target.value))} placeholder={placeholder || '0'}
      className="w-16 bg-black border border-zinc-800 rounded-lg min-h-11 px-2 text-sm text-center font-bold text-zinc-100 outline-none focus:border-[#fbbf24]/40 transition-colors placeholder:text-zinc-700 placeholder:font-normal" />
  );
}

export default function Merch({ participants, ops }) {
  // Requested shirt sizes from registration (the form's "shirt size" column,
  // surfaced via mapRoster) — falls back to any size ops typed manually.
  const demand = useMemo(() => {
    const by = {};
    participants.forEach(p => {
      const raw = (p.shirtSize || p.overlay?.shirtSize || '').trim().toUpperCase();
      if (raw) by[raw] = (by[raw] || 0) + 1;
    });
    return by;
  }, [participants]);

  const sizes = useMemo(() => {
    const extra = Object.keys(demand).filter(s => !SHIRT_SIZES.includes(s)).sort();
    return [...SHIRT_SIZES, ...extra];
  }, [demand]);

  const merch = ops.store.merch;
  const get = (key) => merch[key] || { order: 0, stock: 0 };
  const totalRequested = Object.values(demand).reduce((a, b) => a + b, 0);
  const shirtsOrdered = sizes.reduce((a, s) => a + toInt(get(`shirt:${s}`).order), 0);

  // Live scholarship math for the extras: "sold" is inferred as ordered minus
  // what's still in the locker, so keeping "In stock" current keeps this honest.
  // net = revenue on sold units minus the sunk cost of everything ordered.
  const fin = MERCH_ITEMS.reduce((acc, item) => {
    const m = get(item.key);
    const order = toInt(m.order), stock = toInt(m.stock);
    const sold = Math.max(order - stock, 0);
    acc.revenue += sold * item.price;
    acc.cost += order * item.cost;
    acc.upside += stock * item.price;
    return acc;
  }, { revenue: 0, cost: 0, upside: 0 });
  const net = fin.revenue - fin.cost;

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Merch & Inventory"
        subtitle="Shirt sizes requested at registration drive the order count. Track how many of each item you've ordered and what's left in the gear locker." />

      <p className="text-[10px] text-zinc-600 -mt-1">
        Extra gear (below) is sold <span className="text-zinc-400 font-bold">per item via Venmo @acesforarian</span> on the public Merch tab — buyers are asked to put the item name in their Venmo note. Check Venmo activity/notifications to match payments to orders and keep "In stock" current; the scholarship totals update from it.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Stat label="Shirt requests" value={totalRequested} tone="amber" />
        <Stat label="Sizes requested" value={Object.keys(demand).length} />
        <Stat label="Shirts on order" value={shirtsOrdered} tone="emerald" />
        <Stat label="Registrants" value={participants.length} />
      </div>

      {/* Shirts — requested-size demand + order/stock per size */}
      <Card className="p-4 sm:p-5">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-3"><Shirt className="w-4 h-4 text-[#fbbf24]" /> Shirts — order planner</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                <th className="pb-2 pl-1">Size</th>
                <th className="pb-2 text-center">Requested</th>
                <th className="pb-2 text-center">To order</th>
                <th className="pb-2 text-center pr-1">In stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {sizes.map(size => {
                const key = `shirt:${size}`;
                const m = get(key);
                const req = demand[size] || 0;
                const short = req - toInt(m.order);
                return (
                  <tr key={size}>
                    <td className="py-2 pl-1 text-sm font-black text-zinc-200">{size}</td>
                    <td className="py-2 text-center">
                      <span className={`text-sm font-mono font-bold ${req > 0 ? 'text-[#fbbf24]' : 'text-zinc-600'}`}>{req}</span>
                      {short > 0 && toInt(m.order) > 0 && <span className="block text-[9px] text-rose-400/80 uppercase tracking-wider">{short} short</span>}
                    </td>
                    <td className="py-2 text-center"><NumCell value={toInt(m.order)} onChange={(v) => ops.setMerch(key, { order: v })} placeholder={req || '0'} /></td>
                    <td className="py-2 text-center pr-1"><NumCell value={toInt(m.stock)} onChange={(v) => ops.setMerch(key, { stock: v })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-zinc-600 mt-3">"Requested" comes straight from the registration form and updates as sign-ups arrive — use it to set your order. (Pre-fills the "to order" placeholder.)</p>
      </Card>

      {/* Other gear — no per-person size, just order + stock */}
      <Card className="p-4 sm:p-5">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-3"><Package className="w-4 h-4 text-[#fbbf24]" /> Other gear</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                <th className="pb-2 pl-1">Item</th>
                <th className="pb-2 text-center">Price</th>
                <th className="pb-2 text-center">Margin</th>
                <th className="pb-2 text-center">To order</th>
                <th className="pb-2 text-center pr-1">In stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {MERCH_ITEMS.map(item => {
                const m = get(item.key);
                return (
                  <tr key={item.key}>
                    <td className="py-2 pl-1 text-sm font-bold text-zinc-200">{item.label}</td>
                    <td className="py-2 text-center text-xs font-mono text-zinc-300">{money(item.price)}</td>
                    <td className="py-2 text-center text-xs font-mono text-emerald-400/80">+{money(item.price - item.cost)}</td>
                    <td className="py-2 text-center"><NumCell value={toInt(m.order)} onChange={(v) => ops.setMerch(item.key, { order: v })} /></td>
                    <td className="py-2 text-center pr-1"><NumCell value={toInt(m.stock)} onChange={(v) => ops.setMerch(item.key, { stock: v })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-zinc-600 mt-3">Price/margin are set in <span className="text-zinc-400 font-mono">lib/sheet.js</span> (cost from the contract sheet). Inventory is saved on this device (the gear-locker laptop).</p>
      </Card>

      {/* Live scholarship contribution from extras — sold is inferred from order − stock */}
      <Card className="p-4 sm:p-5">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-3"><Package className="w-4 h-4 text-emerald-400" /> Scholarship from merch</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Stat label="Sold (revenue)" value={money(fin.revenue)} tone="amber" />
          <Stat label="Inventory cost" value={money(fin.cost)} />
          <Stat label="Net to fund" value={money(net)} tone={net >= 0 ? 'emerald' : 'rose'} />
          <Stat label="If rest sells" value={`+${money(fin.upside)}`} tone="emerald" />
        </div>

        {/* Per-item break-even tracker — how close each SKU is to covering its own order */}
        <div className="mt-4">
          {MERCH_ITEMS.map(item => {
            const m = get(item.key);
            const order = toInt(m.order), stock = toInt(m.stock);
            const sold = Math.max(order - stock, 0);
            const breakEven = order > 0 ? Math.ceil((item.cost * order) / item.price) : 0;
            const itemNet = sold * item.price - order * item.cost;
            const pct = breakEven > 0 ? Math.min(100, Math.round((sold / breakEven) * 100)) : 0;
            return (
              <div key={item.key} className="py-2 border-t border-zinc-800/60">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div>
                    <span className="font-bold text-zinc-200">{item.label}</span>
                    <span className="text-zinc-600 ml-2 font-mono">{sold}/{order} sold</span>
                  </div>
                  <div className="text-right font-mono">
                    {order === 0
                      ? <span className="text-zinc-600">not ordered</span>
                      : sold >= breakEven
                        ? <span className="text-emerald-400">in the black · {money(itemNet)}</span>
                        : <span className="text-amber-400/90">{breakEven - sold} more to break even</span>}
                  </div>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${sold >= breakEven && order > 0 ? 'bg-emerald-500' : 'bg-[#fbbf24]'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-zinc-600 mt-3">"Sold" = ordered minus what's still in stock, so update "In stock" as Venmo sales clear. Each bar fills to break-even (units needed to cover that item's order); after that, every sale is net margin to the fund. Tees are included with entry and aren't counted here.</p>
      </Card>
    </div>
  );
}

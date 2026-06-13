import { useMemo } from 'react';
import { Shirt, Package } from 'lucide-react';
import { Card, PageHeader, Stat } from '../ui';

// Canonical adult shirt sizes; any other value a registrant typed gets appended.
const SHIRT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const OTHER_ITEMS = [
  { key: 'sweatbands', label: 'Sweatbands' },
  { key: 'towels', label: 'Towels' },
  { key: 'hats', label: 'Hats' },
];

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

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Merch & Inventory"
        subtitle="Shirt sizes requested at registration drive the order count. Track how many of each item you've ordered and what's left in the gear locker." />

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
                <th className="pb-2 text-center">To order</th>
                <th className="pb-2 text-center pr-1">In stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {OTHER_ITEMS.map(item => {
                const m = get(item.key);
                return (
                  <tr key={item.key}>
                    <td className="py-2 pl-1 text-sm font-bold text-zinc-200">{item.label}</td>
                    <td className="py-2 text-center"><NumCell value={toInt(m.order)} onChange={(v) => ops.setMerch(item.key, { order: v })} /></td>
                    <td className="py-2 text-center pr-1"><NumCell value={toInt(m.stock)} onChange={(v) => ops.setMerch(item.key, { stock: v })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-zinc-600 mt-3">Inventory is saved on this device (the gear-locker laptop).</p>
      </Card>
    </div>
  );
}

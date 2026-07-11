import { useMemo } from 'react';
import { Shirt, Package, Gift } from 'lucide-react';
import { Card, PageHeader, Stat } from '../ui';
import { MERCH_ITEMS } from '../../lib/sheet';

const money = (n) => `$${(Math.round(n * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

// Canonical adult shirt sizes; any other value a registrant typed gets appended.
const SHIRT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

// ==========================================
// FINAL CONTRACT ORDER (July order sheet) — pre-filled so the tab shows the
// real inventory with zero taps. Edits persist per-device via setMerch.
// ==========================================
// Shirts: 65 Vegas Gold @ $11.75 (every entry includes one — given at check-in).
const SHIRT_ORDER = { S: 9, M: 28, L: 22, XL: 6, XXL: 0 };
// Extra gear, per actual variant. `comp` = comped/donated (cost, no revenue):
//   · 1 maroon/gold sweatband donated (Ashwin)
//   · 1 hat to Dad — and this year's hat run is WHITE w/ RED text only
//     (the contract's black + gold/maroon split didn't ship).
const GEAR = [
  { key: 'hat:white-red', group: 'hat', label: 'AR Hat — white, red text', def: { order: 25, stock: 24, comp: 1 }, note: '1 comped: Dad' },
  { key: 'towel:maroon', group: 'towel', label: 'Towel — white, maroon AR', def: { order: 18, stock: 18, comp: 0 } },
  { key: 'towel:gold', group: 'towel', label: 'Towel — white, gold AR', def: { order: 18, stock: 18, comp: 0 } },
  { key: 'band:maroon-gold', group: 'wristbands', label: 'Sweatbands — maroon/gold', def: { order: 12, stock: 11, comp: 1 }, note: '1 donated: Ashwin' },
  { key: 'band:black-white', group: 'wristbands', label: 'Sweatbands — black/white', def: { order: 5, stock: 5, comp: 0 } },
  { key: 'band:white-gold', group: 'wristbands', label: 'Sweatbands — white/gold', def: { order: 8, stock: 8, comp: 0 } },
];
const itemFor = (group) => MERCH_ITEMS.find(i => i.key === group);

const toInt = (v) => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };

// Registration size answers arrive as free-ish text ("M", "adult L",
// "Medium") — collapse them onto the canonical sizes so demand, given, and
// ordered all count in the same buckets.
const normSize = (raw) => {
  const s = (raw || '').trim().toUpperCase().replace(/^ADULT\s*/, '').replace(/[^A-Z0-9]/g, '');
  if (/^(XXL|2XL|XXLARGE)$/.test(s)) return 'XXL';
  if (/^(XL|XLARGE|EXTRALARGE)$/.test(s)) return 'XL';
  if (/^(L|LG|LARGE)$/.test(s)) return 'L';
  if (/^(M|MED|MEDIUM)$/.test(s)) return 'M';
  if (/^(S|SM|SMALL)$/.test(s)) return 'S';
  return (raw || '').trim().toUpperCase();
};

function NumCell({ value, onChange, placeholder }) {
  return (
    <input type="number" min="0" inputMode="numeric" value={value === 0 ? '' : value}
      onChange={(e) => onChange(toInt(e.target.value))} placeholder={placeholder || '0'}
      className="w-16 bg-black border border-zinc-800 rounded-lg min-h-11 px-2 text-sm text-center font-bold text-zinc-100 outline-none focus:border-[#fbbf24]/40 transition-colors placeholder:text-zinc-700 placeholder:font-normal" />
  );
}

export default function Merch({ participants, ops }) {
  const merch = ops.store.merch;
  // Stored value wins; otherwise the contract-order default fills the row.
  const get = (key, def = { order: 0, stock: 0, comp: 0 }) =>
    ({ ...def, ...(merch[key] || {}) });

  // Requested sizes from registration vs shirts actually HANDED OUT at
  // check-in (the synced overlay's "shirt given" toggle) — this is the live
  // registration-vs-inventory cross-check.
  const { demand, given } = useMemo(() => {
    const demand = {}, given = {};
    participants.forEach(p => {
      const size = normSize(p.overlay?.shirtSize || p.shirtSize || '');
      if (size) demand[size] = (demand[size] || 0) + 1;
      if (p.overlay?.shirt) {
        const g = size || '?';
        given[g] = (given[g] || 0) + 1;
      }
    });
    return { demand, given };
  }, [participants]);

  const sizes = useMemo(() => {
    const extra = [...new Set([...Object.keys(demand), ...Object.keys(given)])]
      .filter(s => !SHIRT_SIZES.includes(s) && s !== '?').sort();
    return [...SHIRT_SIZES, ...extra];
  }, [demand, given]);

  const shirtRow = (size) => get(`shirt:${size}`, { order: SHIRT_ORDER[size] || 0, stock: 0, comp: 0 });
  const totals = sizes.reduce((t, s) => {
    const ordered = toInt(shirtRow(s).order);
    t.ordered += ordered; t.req += demand[s] || 0; t.given += given[s] || 0;
    return t;
  }, { ordered: 0, req: 0, given: 0 });
  const unknownGiven = given['?'] || 0;

  // Scholarship math over the real variants. sold = ordered − in stock −
  // comped: comps carry their cost but bring in no revenue, so recording the
  // donated sweatband/hat here keeps "net to fund" honest.
  const fin = GEAR.reduce((acc, g) => {
    const item = itemFor(g.group);
    const m = get(g.key, g.def);
    const order = toInt(m.order), stock = toInt(m.stock), comp = toInt(m.comp);
    const sold = Math.max(order - stock - comp, 0);
    acc.revenue += sold * item.price;
    acc.cost += order * item.cost;
    acc.upside += stock * item.price;
    return acc;
  }, { revenue: 0, cost: 0, upside: 0 });
  const net = fin.revenue - fin.cost;

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Merch & Inventory"
        subtitle="Pre-filled with the final contract order. Shirt hand-outs flow in live from the check-in desk; keep gear 'in stock' current as Venmo sales clear." />
      <p className="text-[10px] text-amber-400/70 -mt-1">Order/stock edits are device-local (gear-locker laptop). Shirt "given" counts DO sync — they come from the check-in toggle on every device.</p>

      <p className="text-[10px] text-zinc-600 -mt-1">
        Extra gear is sold <span className="text-zinc-400 font-bold">per item via Venmo @acesforarian</span> on the public Merch tab — buyers put the item name in their Venmo note. Match payments to orders in Venmo activity and keep "In stock" current; the scholarship totals update from it.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Stat label="Shirts ordered" value={totals.ordered} tone="emerald" />
        <Stat label="Sizes requested" value={totals.req} tone="amber" />
        <Stat label="Shirts given" value={totals.given + unknownGiven} />
        <Stat label="Shirts left" value={Math.max(totals.ordered - totals.given - unknownGiven, 0)} />
      </div>

      {/* Shirts — the registration-vs-inventory cross-check, per size */}
      <Card className="p-4 sm:p-5">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-3"><Shirt className="w-4 h-4 text-[#fbbf24]" /> Shirts — Vegas Gold, 65 ordered</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                <th className="pb-2 pl-1">Size</th>
                <th className="pb-2 text-center">Ordered</th>
                <th className="pb-2 text-center">Requested</th>
                <th className="pb-2 text-center">Given</th>
                <th className="pb-2 text-center pr-1">Left</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {sizes.map(size => {
                const m = shirtRow(size);
                const ordered = toInt(m.order);
                const req = demand[size] || 0;
                const out = given[size] || 0;
                const left = ordered - out;
                if (!ordered && !req && !out) return null;
                return (
                  <tr key={size}>
                    <td className="py-2 pl-1 text-sm font-black text-zinc-200">{size}</td>
                    <td className="py-2 text-center"><NumCell value={ordered} onChange={(v) => ops.setMerch(`shirt:${size}`, { order: v })} /></td>
                    <td className="py-2 text-center">
                      <span className={`text-sm font-mono font-bold ${req > 0 ? 'text-[#fbbf24]' : 'text-zinc-600'}`}>{req}</span>
                      {req > ordered && <span className="block text-[9px] text-rose-400/80 uppercase tracking-wider">{req - ordered} short</span>}
                    </td>
                    <td className="py-2 text-center text-sm font-mono font-bold text-emerald-400">{out}</td>
                    <td className={`py-2 text-center pr-1 text-sm font-mono font-bold ${left < 0 ? 'text-rose-400' : left <= 2 ? 'text-amber-400' : 'text-zinc-300'}`}>{left}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {unknownGiven > 0 && (
          <p className="text-[10px] text-amber-400/80 mt-2">{unknownGiven} shirt{unknownGiven > 1 ? 's' : ''} given to players with no size on file — counted in the totals, not in a size row.</p>
        )}
        <p className="text-[10px] text-zinc-600 mt-3">"Requested" is the registration form; "Given" is the live synced check-in toggle. "Left" = ordered − given: amber at ≤2, red means you handed out more than the order sheet says you have (recount the box). Tees are included with entry — no revenue counted here.</p>
      </Card>

      {/* Other gear — real variants from the order, with comps tracked */}
      <Card className="p-4 sm:p-5">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-3"><Package className="w-4 h-4 text-[#fbbf24]" /> Other gear — by variant</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                <th className="pb-2 pl-1">Variant</th>
                <th className="pb-2 text-center">Price</th>
                <th className="pb-2 text-center">Ordered</th>
                <th className="pb-2 text-center">Comped</th>
                <th className="pb-2 text-center">In stock</th>
                <th className="pb-2 text-center pr-1">Sold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {GEAR.map(g => {
                const item = itemFor(g.group);
                const m = get(g.key, g.def);
                const sold = Math.max(toInt(m.order) - toInt(m.stock) - toInt(m.comp), 0);
                return (
                  <tr key={g.key}>
                    <td className="py-2 pl-1">
                      <span className="text-sm font-bold text-zinc-200">{g.label}</span>
                      {g.note && <span className="flex items-center gap-1 text-[9px] text-amber-400/80 uppercase tracking-wider"><Gift className="w-3 h-3" />{g.note}</span>}
                    </td>
                    <td className="py-2 text-center text-xs font-mono text-zinc-300">{money(item.price)}</td>
                    <td className="py-2 text-center"><NumCell value={toInt(m.order)} onChange={(v) => ops.setMerch(g.key, { ...m, order: v })} /></td>
                    <td className="py-2 text-center"><NumCell value={toInt(m.comp)} onChange={(v) => ops.setMerch(g.key, { ...m, comp: v })} /></td>
                    <td className="py-2 text-center"><NumCell value={toInt(m.stock)} onChange={(v) => ops.setMerch(g.key, { ...m, stock: v })} /></td>
                    <td className={`py-2 text-center pr-1 text-sm font-mono font-bold ${sold > 0 ? 'text-emerald-400' : 'text-zinc-600'}`}>{sold}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-zinc-600 mt-3">Pre-filled from the final order: hats are <span className="text-zinc-400 font-bold">white with red text only</span> this year (the black + gold/maroon split didn't ship). "Comped" = given away (Dad's hat, the donated sweatband) — carries cost, earns nothing. Sold = ordered − in stock − comped, so a Venmo sale just means ticking "In stock" down one.</p>
      </Card>

      {/* Live scholarship contribution from extras */}
      <Card className="p-4 sm:p-5">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-3"><Package className="w-4 h-4 text-emerald-400" /> Scholarship from merch</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Stat label="Sold (revenue)" value={money(fin.revenue)} tone="amber" />
          <Stat label="Inventory cost" value={money(fin.cost)} />
          <Stat label="Net to fund" value={money(net)} tone={net >= 0 ? 'emerald' : 'rose'} />
          <Stat label="If rest sells" value={`+${money(fin.upside)}`} tone="emerald" />
        </div>

        {/* Per-item break-even — variants rolled up to the three products */}
        <div className="mt-4">
          {MERCH_ITEMS.map(item => {
            const rows = GEAR.filter(g => g.group === item.key).map(g => get(g.key, g.def));
            const order = rows.reduce((a, m) => a + toInt(m.order), 0);
            const stock = rows.reduce((a, m) => a + toInt(m.stock), 0);
            const comp = rows.reduce((a, m) => a + toInt(m.comp), 0);
            const sold = Math.max(order - stock - comp, 0);
            const breakEven = order > 0 ? Math.ceil((item.cost * order) / item.price) : 0;
            const itemNet = sold * item.price - order * item.cost;
            const pct = breakEven > 0 ? Math.min(100, Math.round((sold / breakEven) * 100)) : 0;
            return (
              <div key={item.key} className="py-2 border-t border-zinc-800/60">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div>
                    <span className="font-bold text-zinc-200">{item.label}</span>
                    <span className="text-zinc-600 ml-2 font-mono">{sold}/{order} sold{comp > 0 ? ` · ${comp} comped` : ''}</span>
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

        <p className="text-[10px] text-zinc-600 mt-3">Each bar fills to break-even (units needed to cover that item's whole order, comps included in the cost); after that every sale is net margin to the fund. Update "In stock" as Venmo sales clear so these stay honest.</p>
      </Card>
    </div>
  );
}

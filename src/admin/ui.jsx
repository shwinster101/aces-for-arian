import { useState } from 'react';
import { Search, X } from 'lucide-react';

// Small shared UI primitives for the ops admin — kept utilitarian (dense,
// large tap targets, dark theme matching the public site's branding) since
// this is a tool for staff on phones courtside, not a marketing page.

export function BrandLogo({ className = "w-12 h-12" }) {
  const [ok, setOk] = useState(true);
  if (!ok) {
    return (
      <div className={`${className} rounded-full bg-[#5c1313] text-[#fbbf24] flex items-center justify-center font-black text-lg`}>A4A</div>
    );
  }
  return (
    <div className={`${className} rounded-full bg-[#f7f1e3] flex items-center justify-center overflow-hidden shadow-md`}>
      <img src="/ar-logo.png" alt="Aces for Arian logo" className="w-[82%] h-[82%] object-contain"
        draggable={false} onError={() => setOk(false)} />
    </div>
  );
}

export function Card({ className = "", children }) {
  return <div className={`bg-[#151515] border border-zinc-800 rounded-2xl ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, right }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      <div>
        <h2 className="text-base font-black text-white uppercase tracking-wider">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function Stat({ label, value, tone = "default" }) {
  const tones = {
    default: 'text-zinc-200 border-zinc-800 bg-[#111]',
    amber: 'text-[#fbbf24] border-[#fbbf24]/20 bg-[#fbbf24]/10',
    emerald: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
  };
  return (
    <div className={`rounded-xl border px-3.5 py-2.5 ${tones[tone]}`}>
      <div className="text-[9px] uppercase tracking-widest opacity-70 font-bold">{label}</div>
      <div className="text-lg font-black leading-tight mt-0.5">{value}</div>
    </div>
  );
}

export function Pills({ value, onChange, options }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar">
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`whitespace-nowrap min-h-11 px-4 py-2 text-[11px] font-black uppercase tracking-wider rounded-xl transition shrink-0 ${
              active ? 'bg-[#fbbf24] text-black shadow-md shadow-amber-500/10' : 'bg-[#111] text-zinc-400 border border-zinc-800 hover:bg-zinc-900'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search by name…" }) {
  return (
    <div className="flex items-center gap-2.5 bg-[#111] border border-zinc-800 rounded-xl px-3.5 py-2.5 focus-within:border-[#fbbf24]/40 transition-colors">
      <Search className="w-4 h-4 text-zinc-600 shrink-0" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent outline-none text-sm text-white w-full placeholder:text-zinc-600"
      />
      {value && (
        <button onClick={() => onChange('')} aria-label="Clear search" className="text-zinc-600 hover:text-white shrink-0">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

const STATUS_STYLES = {
  confirmed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Verified: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pending: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  Pending: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  waitlist: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

export function StatusBadge({ status }) {
  return (
    <span className={`inline-block text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
      {status || 'pending'}
    </span>
  );
}

// Cycles confirmed -> waitlist -> pending -> confirmed on tap; one big chip,
// easy to hit on a phone mid-checkin-line.
const REG_CYCLE = ['confirmed', 'waitlist', 'pending'];
const REG_STYLES = {
  confirmed: 'bg-emerald-500 text-black border-emerald-400',
  waitlist: 'bg-amber-400 text-black border-amber-300',
  pending: 'bg-zinc-800 text-zinc-300 border-zinc-700',
};
export function RegStatusChip({ status, onChange }) {
  const s = status || 'pending';
  const next = () => onChange(REG_CYCLE[(REG_CYCLE.indexOf(s) + 1) % REG_CYCLE.length]);
  return (
    <button onClick={next} className={`min-h-11 text-[10px] font-mono font-black uppercase tracking-wider px-3.5 py-1.5 rounded-lg border transition active:scale-95 ${REG_STYLES[s]}`}>
      {s}
    </button>
  );
}

export function Toggle({ checked, onChange, label, activeLabel }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2.5 min-h-11 px-3.5 py-2 rounded-xl border text-xs font-bold transition active:scale-95 ${
        checked ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-[#111] border-zinc-800 text-zinc-400 hover:border-zinc-700'
      }`}
    >
      <span className={`w-8 h-4.5 rounded-full relative transition-colors shrink-0 ${checked ? 'bg-emerald-500' : 'bg-zinc-700'}`} style={{ height: '1.125rem' }}>
        <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${checked ? 'left-[1.125rem]' : 'left-0.5'}`} />
      </span>
      <span>{checked && activeLabel ? activeLabel : label}</span>
    </button>
  );
}

export function Select({ value, onChange, options, placeholder = "—" }) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[#111] border border-zinc-800 rounded-lg min-h-11 px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-[#fbbf24]/40 transition-colors"
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export function TextInput({ value, onChange, placeholder, className = "", type = "text" }) {
  return (
    <input
      type={type}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-[#111] border border-zinc-800 rounded-lg min-h-11 px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-[#fbbf24]/40 transition-colors placeholder:text-zinc-600 ${className}`}
    />
  );
}

export function IconButton({ icon: Icon, onClick, label, tone = "default" }) {
  const tones = {
    default: 'text-zinc-500 hover:text-white hover:bg-zinc-800',
    danger: 'text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10',
  };
  return (
    <button onClick={onClick} aria-label={label} title={label} className={`min-w-11 min-h-11 flex items-center justify-center rounded-lg transition ${tones[tone]}`}>
      <Icon className="w-4 h-4" />
    </button>
  );
}

export function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="text-center py-10 px-4">
      {Icon && <Icon className="w-8 h-8 text-zinc-700 mx-auto mb-3" />}
      <div className="text-sm font-bold text-zinc-400">{title}</div>
      {hint && <div className="text-xs text-zinc-600 mt-1 max-w-sm mx-auto leading-relaxed">{hint}</div>}
    </div>
  );
}

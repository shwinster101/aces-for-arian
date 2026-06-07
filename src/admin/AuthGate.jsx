import { useState } from 'react';
import { LockKeyhole, ShieldAlert } from 'lucide-react';
import { BrandLogo } from './ui';
import { ADMIN_PIN, unlock } from './auth';

export default function AuthGate({ onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (pin.trim() === ADMIN_PIN) {
      unlock();
      onUnlock();
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-zinc-200 font-sans flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-xs bg-[#151515] border border-zinc-800 rounded-3xl p-7 text-center shadow-2xl shadow-black">
        <div className="flex justify-center mb-4">
          <BrandLogo className="w-14 h-14" />
        </div>
        <h1 className="text-sm font-black text-white uppercase tracking-widest">Tournament Ops</h1>
        <p className="text-[11px] text-zinc-500 mt-1.5 mb-6 leading-relaxed">Staff only — enter the ops PIN to manage registrations, check-ins, and the live court board.</p>

        <div className={`flex items-center gap-2.5 bg-black border rounded-xl px-4 py-3.5 transition-colors ${error ? 'border-rose-500/60' : 'border-zinc-800 focus-within:border-[#fbbf24]/50'}`}>
          <LockKeyhole className="w-4 h-4 text-zinc-600 shrink-0" />
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={pin}
            onChange={(e) => { setPin(e.target.value); setError(false); }}
            placeholder="Ops PIN"
            className="bg-transparent outline-none text-white text-sm tracking-[0.3em] font-mono w-full placeholder:text-zinc-700 placeholder:tracking-normal"
          />
        </div>

        {error && (
          <div className="flex items-center justify-center gap-1.5 mt-3 text-[11px] font-bold text-rose-400">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Wrong PIN — try again</span>
          </div>
        )}

        <button type="submit" className="w-full mt-5 bg-[#fbbf24] hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider py-3.5 rounded-xl transition-colors">
          Unlock
        </button>
      </form>
    </div>
  );
}

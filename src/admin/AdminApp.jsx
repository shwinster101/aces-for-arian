import { useEffect, useState } from 'react';
import {
  ClipboardList,
  UserCheck,
  CircleDollarSign,
  Swords,
  Grid3x3,
  RefreshCw,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import { ROSTER_CSV_URL, fallbackRoster, parseCSV, mapRoster } from '../lib/sheet';
import { SHEET_WRITE_URL } from '../lib/sheet';
import AuthGate from './AuthGate';
import { isUnlocked, lock } from './auth';
import { useOpsStore } from './store';
import { BrandLogo } from './ui';
import Registrations from './sections/Registrations';
import CheckIns from './sections/CheckIns';
import Payments from './sections/Payments';
import Seeding from './sections/Seeding';
import Scores from './sections/Scores';

const TABS = [
  { id: 'registrations', label: 'Registrations', icon: ClipboardList },
  { id: 'checkins', label: 'Check-ins', icon: UserCheck },
  { id: 'payments', label: 'Payments & Merch', icon: CircleDollarSign },
  { id: 'seeding', label: 'Seeding & Draws', icon: Swords },
  { id: 'scores', label: 'Scores & Courts', icon: Grid3x3 },
];

// Where each admin section shows up on the public site — drives the contextual
// "View live ↗" link (deep-links into the public app's hash router) so staff
// can one-tap confirm "what I entered shows correctly."
const PUBLIC_VIEW = {
  registrations: { hash: 'home', label: 'public roster' },
  checkins: { hash: 'home', label: 'public roster' },
  payments: { hash: 'home', label: 'public roster' },
  seeding: { hash: 'seeding', label: 'projected seeds' },
  scores: { hash: 'brackets', label: 'live court board' },
};

export default function AdminApp() {
  const [unlocked, setUnlocked] = useState(isUnlocked);

  if (!unlocked) return <AuthGate onUnlock={() => setUnlocked(true)} />;
  return <OpsConsole onLock={() => { lock(); setUnlocked(false); }} />;
}

function OpsConsole({ onLock }) {
  const [tab, setTab] = useState('registrations');
  const [roster, setRoster] = useState(fallbackRoster);
  const [rosterLive, setRosterLive] = useState(false);
  const [syncedAt, setSyncedAt] = useState(null);
  // Driven only by the manual "Sync" button (an event handler, not the
  // effect) — the effect's own setState calls all live inside the fetch's
  // async callbacks, mirroring the roster-sync effect in App.jsx.
  const [spinning, setSpinning] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const ops = useOpsStore();

  useEffect(() => {
    let cancelled = false;
    fetch(ROSTER_CSV_URL)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(text => {
        if (cancelled) return;
        const players = mapRoster(parseCSV(text));
        if (players.length) { setRoster(players); setRosterLive(true); }
        setSyncedAt(new Date());
      })
      .catch(() => { /* keep last-known roster */ })
      .finally(() => { if (!cancelled) setSpinning(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const sync = () => { setSpinning(true); setRefreshKey(k => k + 1); };

  // Merge the live sheet roster with locally-added walk-ups into one ops-facing
  // list, each entry carrying its localStorage overlay (status/check-in/etc).
  // Cheap enough (tens of rows) that it doesn't need memoizing.
  const fromSheet = roster.map(p => ({ ...p, source: 'sheet' }));
  const fromWalkUps = ops.store.added.map(a => ({
    name: a.name, classYear: a.classYear, events: a.events, partner: a.partner,
    status: 'Pending', bio: '', source: 'added', addedId: a.id,
  }));
  const participants = [...fromSheet, ...fromWalkUps].map(p => ({ ...p, overlay: ops.getOverlay(p.name) }));

  const sectionProps = { participants, ops, roster };

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-zinc-200 font-sans flex flex-col selection:bg-[#fbbf24] selection:text-[#5c1313]">

      {/* --- HEADER --- */}
      <header className="bg-[#5c1313] sticky top-0 z-40 shadow-lg shadow-black/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo className="w-9 h-9 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-wide uppercase text-white truncate">Tournament Ops</h1>
              <p className="text-[10px] text-[#fefcbf]/70 truncate">Aces for Arian · July 10–12 · Dunlap HS</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a href={`/#${PUBLIC_VIEW[tab].hash}`} target="_blank" rel="noopener noreferrer"
              title={`Open the ${PUBLIC_VIEW[tab].label} on the public site`}
              className="flex items-center justify-center gap-1.5 min-w-11 min-h-11 text-[10px] font-bold uppercase tracking-wider text-zinc-300 hover:text-white bg-black/20 hover:bg-black/40 border border-white/10 rounded-lg px-3 py-2 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">View live</span>
            </a>
            <button onClick={sync} disabled={spinning}
              className="flex items-center justify-center gap-1.5 min-w-11 min-h-11 text-[10px] font-bold uppercase tracking-wider text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/25 hover:bg-[#fbbf24]/20 rounded-lg px-3 py-2 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${spinning ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>
            <button onClick={onLock}
              className="flex items-center justify-center gap-1.5 min-w-11 min-h-11 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white bg-black/20 hover:bg-black/40 border border-white/10 rounded-lg px-3 py-2 transition-colors">
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </button>
          </div>
        </div>
        {/* Sync status strip */}
        <div className="bg-[#3a0a0a] border-t border-[#fbbf24]/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-1.5 flex items-center gap-2 flex-wrap text-[10px]">
            <span className={`w-1.5 h-1.5 rounded-full ${rosterLive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`}></span>
            <span className="text-zinc-400">
              {rosterLive ? 'Live roster from Google Sheet' : 'Showing fallback roster'}
              {syncedAt && <span className="text-zinc-600"> · synced {syncedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}
            </span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-500">
              {SHEET_WRITE_URL ? 'Edits sync to the sheet + this device' : 'Edits saved on this device (set SHEET_WRITE_URL in lib/sheet.js to push to Sheets)'}
            </span>
          </div>
        </div>
      </header>

      {/* --- TAB NAV --- */}
      <div className="sticky top-[88px] sm:top-[84px] z-30 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-zinc-800">
        <nav className="max-w-6xl mx-auto px-2 sm:px-6 flex gap-1 overflow-x-auto no-scrollbar py-2">
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 min-h-11 px-3.5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition shrink-0 ${
                  active ? 'bg-[#fbbf24] text-black shadow-md shadow-amber-500/10' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
              >
                <t.icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* --- MAIN --- */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-5 sm:px-6">
        {tab === 'registrations' && <Registrations {...sectionProps} />}
        {tab === 'checkins' && <CheckIns {...sectionProps} />}
        {tab === 'payments' && <Payments {...sectionProps} />}
        {tab === 'seeding' && <Seeding {...sectionProps} />}
        {tab === 'scores' && <Scores {...sectionProps} />}
      </main>

      <footer className="py-6 text-center text-[10px] text-zinc-700 border-t border-zinc-900">
        <p>Ops console · not linked from the public site ·{' '}
          <a href="/" className="inline-flex items-center gap-1 text-zinc-600 hover:text-[#fbbf24] transition-colors">
            View public site <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </p>
      </footer>
    </div>
  );
}

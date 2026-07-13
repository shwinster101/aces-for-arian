import { useMemo } from 'react';
import { Grid3x3, UserCheck, CircleDollarSign, Megaphone, Zap, ChevronRight, RefreshCw } from 'lucide-react';
import { Card, PageHeader, Stat } from '../ui';
import { cashMath } from '../store';

// ==========================================
// COMMAND CENTER — day-of dashboard (HQ, read-only)
// ==========================================
// The TD's "how's the day going" glance so they don't tab-hop during the moment
// they can't. Pure composition of the store — no mutations, no new data/sync.
// Every card deep-links to the tab that owns the number.

const isSupporter = (p) => /supporter/i.test(p.events || '');
const clock = (ts) => (ts ? new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null);

// A dashboard card whose header deep-links to the tab that owns the number.
function Section({ icon: Icon, title, tab, onGoTab, children }) {
  return (
    <Card className="p-4 sm:p-5">
      <button onClick={() => tab && onGoTab(tab)} className="w-full flex items-center justify-between gap-2 mb-3 text-left group">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><Icon className="w-4 h-4 text-[#fbbf24]" /> {title}</h3>
        {tab && <span className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 group-hover:text-[#fbbf24] transition-colors">Open <ChevronRight className="w-3.5 h-3.5" /></span>}
      </button>
      {children}
    </Card>
  );
}

export default function CommandCenter({ participants, ops, onGoTab, rosterLive, syncedAt }) {
  const players = useMemo(() => participants.filter(p => !isSupporter(p)), [participants]);
  const checkedIn = players.filter(p => p.overlay.checkedIn).length;
  const paid = players.filter(p => p.overlay.paid).length;
  const unpaid = Math.max(players.length - paid, 0);

  const matches = ops.store.matches;
  const live = useMemo(() => matches.filter(m => m.status === 'live').sort((a, b) => (Number(a.court) || 99) - (Number(b.court) || 99)), [matches]);
  const scheduled = matches.filter(m => m.status === 'scheduled').length;

  const cash = useMemo(() => cashMath(ops.store.cash), [ops.store.cash]);
  const aces = ops.store.aces || 0;
  const aceDollars = aces; // $1/ace
  // A 'clear' post suppresses the public banner, so show it as clear here too.
  const top = ops.store.announcements[0];
  const banner = top && top.category !== 'clear' ? top : null;
  const pushAt = clock(ops.lastPushAt);

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Command Center" subtitle="Everything at a glance — courts, check-in, money, the live banner. Tap any card to jump to its tab." />

      {/* Freshness strip */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] -mt-1">
        <span className={`inline-flex items-center gap-1.5 ${rosterLive ? 'text-emerald-400/80' : 'text-zinc-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${rosterLive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
          {rosterLive ? 'Live roster' : 'Fallback roster'}{syncedAt ? ` · synced ${clock(syncedAt)}` : ''}
        </span>
        {pushAt && <span className="text-zinc-600">· last push attempted {pushAt}</span>}
        <span className="inline-flex items-center gap-1 text-zinc-600"><RefreshCw className="w-3 h-3" /> tap Sync (top-right) to refresh the roster</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Courts live now */}
        <Section icon={Grid3x3} title="On court now" tab="scores" onGoTab={onGoTab}>
          {live.length === 0 ? (
            <p className="text-xs text-zinc-500">No matches live right now · <span className="text-zinc-400">{scheduled} scheduled</span>. Set a match live on Scores &amp; Courts.</p>
          ) : (
            <div className="space-y-1.5">
              {live.map(m => (
                <div key={m.id} className="flex items-center gap-2.5 bg-[#111] border border-emerald-500/25 rounded-lg px-3 py-2">
                  <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="shrink-0 text-[10px] font-mono font-bold text-emerald-400 w-10">{m.court ? `Ct ${m.court}` : '—'}</span>
                  <span className="text-xs text-zinc-200 font-semibold min-w-0 truncate">{m.a || 'TBD'} <span className="text-zinc-600 font-normal">vs</span> {m.b || 'TBD'}</span>
                  {m.score && <span className="ml-auto shrink-0 text-xs font-mono text-emerald-300">{m.score}</span>}
                </div>
              ))}
              <p className="text-[10px] text-zinc-600 pt-1">{live.length} on court · {scheduled} scheduled to come.</p>
            </div>
          )}
        </Section>

        {/* Check-in */}
        <Section icon={UserCheck} title="Check-in" tab="checkins" onGoTab={onGoTab}>
          <div className="grid grid-cols-2 gap-2.5">
            <Stat label="Checked in" value={`${checkedIn} / ${players.length}`} tone="emerald" />
            <Stat label="Still expected" value={Math.max(players.length - checkedIn, 0)} tone="amber" />
          </div>
          <p className="text-[10px] text-zinc-600 mt-2.5">Player count only (supporters excluded). Roster is manual-refresh — the total can lag until you Sync.</p>
        </Section>

        {/* Money */}
        <Section icon={CircleDollarSign} title="Money" tab="payments" onGoTab={onGoTab}>
          <div className="grid grid-cols-3 gap-2.5">
            <Stat label="Paid" value={`${paid} / ${players.length}`} tone="emerald" />
            <Stat label="Unpaid" value={unpaid} tone={unpaid > 0 ? 'amber' : 'default'} />
            <Stat label="Cash collected" value={`$${cash.cashIn.toLocaleString()}`} />
          </div>
          {cash.lowBills && <p className="text-[10px] text-[#fbbf24] mt-2.5 font-bold">⚠ Cash drawer: small bills may be running low — check the drawer.</p>}
          <p className="text-[10px] text-zinc-600 mt-2.5">“Paid” includes Comped. Cash figure is the drawer’s collected total; card/Venmo aren’t in the drawer.</p>
        </Section>

        {/* Live banner + aces */}
        <Section icon={Megaphone} title="Live banner" tab="announce" onGoTab={onGoTab}>
          {banner ? (
            <div className="bg-[#1c1408] border border-[#fbbf24]/25 rounded-lg px-3 py-2.5">
              <div className="text-[9px] font-black uppercase tracking-widest text-[#fbbf24] mb-1">{banner.category} · {banner.event}</div>
              <p className="text-xs text-zinc-200 leading-relaxed line-clamp-3">{banner.message}</p>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">No announcement posted — the public banner is clear.</p>
          )}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800/60 text-xs text-zinc-400">
            <Zap className="w-4 h-4 text-[#fbbf24]" />
            <span><strong className="text-zinc-200">{aces}</strong> aces live · <strong className="text-zinc-200">${aceDollars}</strong> toward the scholarship at $1/ace</span>
          </div>
        </Section>
      </div>
    </div>
  );
}

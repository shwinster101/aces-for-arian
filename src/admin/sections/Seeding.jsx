import { useMemo, useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Swords, Users2, ListChecks, Wand2 } from 'lucide-react';
import { Card, PageHeader, Pills, TextInput, Select, IconButton, EmptyState } from '../ui';
import { nextId } from '../store';

const EVENTS = [
  { value: 'Singles', label: 'Sunday Singles' },
  { value: 'Doubles', label: 'Saturday Doubles' },
];

const ROUND_PRESETS = ['R1', 'R2', 'R3', 'QF', 'SF', 'F', 'L1', 'L2', 'L3'];
const COURTS = Array.from({ length: 9 }, (_, i) => String(i + 1));

const norm = (s) => (s || '').trim().toLowerCase();

// Order-insensitive matching key so a hand-typed "B & A" seed row still counts
// the derived "A & B" team as seeded (tolerates "and" / "/" / "+" separators).
const entryKey = (name) => norm(name).split(/\s*(?:&|\/|\+|\band\b)\s*/).filter(Boolean).sort().join(' & ');

// Same effective-status rule as Registrations so "confirmed" counts agree
// across tabs: an explicit ops confirm OR the sheet's Verified flag.
const isConfirmed = (p) => p.overlay.regStatus === 'confirmed' || p.status === 'Verified';

// Derive doubles TEAMS from who actually signed up: pair each doubles entrant
// with their form-submitted partner (or the ops override from the partner
// card). Flags surface exactly what needs chasing before seeds can lock:
//   mutual      — both players named each other
//   unconfirmed — one-way pick; the partner is signed up but didn't name them back
//   missing     — named partner isn't on the signup list (yet)
// Players with no partner (or whose partner is already taken) land in
// `unpaired` so nobody silently falls out of the draw.
function deriveDoublesTeams(participants) {
  const players = participants.filter(p => p.events.includes('Doubles'));
  const byName = new Map(players.map(p => [norm(p.name), p]));
  const partnerOf = (p) => (p.overlay.partner || p.partner || '').trim();
  const used = new Set();
  const teams = [];
  const unpaired = [];
  players.forEach(p => {
    const key = norm(p.name);
    if (used.has(key)) return;
    used.add(key);
    const partner = partnerOf(p);
    const pk = norm(partner);
    if (!pk) { unpaired.push({ player: p, reason: 'no partner listed' }); return; }
    const mate = byName.get(pk);
    if (!mate) { teams.push({ name: `${p.name} & ${partner}`, members: [p], flag: 'missing' }); return; }
    if (used.has(pk)) { unpaired.push({ player: p, reason: `${mate.name} is already on another team` }); return; }
    used.add(pk);
    const mutual = norm(partnerOf(mate)) === key;
    teams.push({ name: `${p.name} & ${mate.name}`, members: [p, mate], flag: mutual ? 'mutual' : 'unconfirmed' });
  });
  return { teams, unpaired };
}

export default function Seeding({ participants, ops }) {
  const [event, setEvent] = useState('Singles');

  const doubles = useMemo(() => deriveDoublesTeams(participants), [participants]);

  // The seedable field for the selected event, straight from signups:
  // Singles -> entrants; Doubles -> derived TEAMS (seeded as one unit).
  const entries = useMemo(() => {
    if (event === 'Doubles') {
      return doubles.teams.map(t => ({
        key: entryKey(t.name),
        name: t.name,
        flag: t.flag,
        confirmed: t.flag !== 'missing' && t.members.every(isConfirmed),
      }));
    }
    const seen = new Map();
    participants.filter(p => p.events.includes('Singles')).forEach(p => {
      const key = entryKey(p.name);
      if (key && !seen.has(key)) seen.set(key, { key, name: p.name, flag: null, confirmed: isConfirmed(p) });
    });
    return Array.from(seen.values());
  }, [participants, doubles, event]);

  const namesInEvent = useMemo(() => {
    const list = participants.filter(p => p.events.includes(event)).map(p => p.name);
    const teamNames = event === 'Doubles' ? doubles.teams.map(t => t.name).sort() : [];
    return Array.from(new Set([...teamNames, ...Array.from(new Set(list)).sort()]));
  }, [participants, doubles, event]);

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Seeding & Draws" subtitle="The field builds itself from signups — pair doubles teams, tap names into the seed order, then generate Round 1 straight from the seeds." />

      <Pills value={event} onChange={setEvent} options={EVENTS} />

      <SignupPool event={event} ops={ops} entries={entries} unpaired={event === 'Doubles' ? doubles.unpaired : []} />
      {event === 'Doubles' && <PartnerAssignments participants={participants} ops={ops} />}
      <SeedList event={event} ops={ops} namesInEvent={namesInEvent} />
      <DrawEditor event={event} ops={ops} namesInEvent={namesInEvent} />
    </div>
  );
}

// ------------------------------------------------------------- Signup pool
// Who's signed up for this event vs who's in the seed list — the working
// surface for seeding day: tap "Seed" to append an entrant/team at the next
// rank, then fine-tune order in the seed list below.
const FLAG_CHIP = {
  unconfirmed: { label: '1-way pick', cls: 'text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/25' },
  missing: { label: 'partner not signed up', cls: 'text-rose-400 bg-rose-500/10 border-rose-500/25' },
};

function SignupPool({ event, ops, entries, unpaired }) {
  const seeds = ops.store.seeds[event];
  const seededRank = useMemo(() => {
    const m = new Map();
    seeds.forEach((r, i) => { const k = entryKey(r.name); if (k && !m.has(k)) m.set(k, i + 1); });
    return m;
  }, [seeds]);

  const unseeded = entries.filter(e => !seededRank.has(e.key));
  const addToSeeds = (names) => ops.setSeeds(event, prev => [
    ...prev,
    ...names.map((name, i) => ({ id: nextId(), rank: prev.length + i + 1, name, notes: '' })),
  ]);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-[#fbbf24]" /> Signed up — {event}
          <span className="text-zinc-500 normal-case tracking-normal font-bold">{entries.length - unseeded.length}/{entries.length} seeded</span>
        </h3>
        {unseeded.length > 0 && (
          <button onClick={() => addToSeeds(unseeded.map(e => e.name))}
            className="flex items-center justify-center gap-1.5 min-h-11 text-[10px] font-black uppercase tracking-wider text-[#fbbf24] bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 border border-[#fbbf24]/25 rounded-lg px-3 py-1.5 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Seed all {unseeded.length}
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <EmptyState title={`No ${event.toLowerCase()} signups yet`}
          hint={event === 'Doubles' ? 'Teams appear here once doubles entrants (and their partners) come in from the form or walk-ups.' : 'Entrants appear here as registrations come in from the form or walk-ups.'} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {entries.map(e => {
            const rank = seededRank.get(e.key);
            const chip = e.flag && FLAG_CHIP[e.flag];
            return (
              <div key={e.key} className="flex items-center gap-2.5 bg-[#111] border border-zinc-800 rounded-xl px-3 py-2 min-h-14">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-zinc-200 truncate">{e.name}</div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    {!e.confirmed && <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border text-zinc-400 bg-zinc-800 border-zinc-700">pending</span>}
                    {chip && <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${chip.cls}`}>{chip.label}</span>}
                  </div>
                </div>
                {rank ? (
                  <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/20 rounded-lg px-2.5 py-1.5">Seed {rank}</span>
                ) : (
                  <button onClick={() => addToSeeds([e.name])}
                    className="shrink-0 flex items-center gap-1 min-h-11 text-[10px] font-black uppercase tracking-wider text-zinc-300 hover:text-black bg-zinc-800 hover:bg-[#fbbf24] border border-zinc-700 hover:border-[#fbbf24] rounded-lg px-3 py-1.5 transition-colors active:scale-95">
                    <Plus className="w-3.5 h-3.5" /> Seed
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {unpaired.length > 0 && (
        <div className="mt-3 border-t border-zinc-800 pt-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Needs a partner ({unpaired.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {unpaired.map(({ player, reason }) => (
              <span key={player.name} title={reason} className="text-[11px] font-bold text-zinc-300 bg-[#111] border border-zinc-800 rounded-lg px-2.5 py-1.5">
                {player.name} <span className="text-zinc-600 font-normal">— {reason}</span>
              </span>
            ))}
          </div>
          <p className="text-[10px] text-zinc-600 mt-2">Assign partners in the card below — they'll turn into a seedable team here.</p>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- Seed list
function SeedList({ event, ops, namesInEvent }) {
  const list = ops.store.seeds[event];
  const datalistId = `seed-names-${event}`;

  // Each mutation derives "next" from the updater's own `prev`, not the
  // `list` snapshot from this render — keeps rapid taps (e.g. rows reordered
  // right after one is added) from clobbering each other.
  const addRow = () => ops.setSeeds(event, prev => [...prev, { id: nextId(), rank: prev.length + 1, name: '', notes: '' }]);
  const removeRow = (id) => ops.setSeeds(event, prev => prev.filter(r => r.id !== id));
  const patchRow = (id, patch) => ops.setSeeds(event, prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const move = (idx, dir) => ops.setSeeds(event, prev => {
    const j = idx + dir;
    if (j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[idx], next[j]] = [next[j], next[idx]];
    return next;
  });

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><Swords className="w-4 h-4 text-[#fbbf24]" /> Seed order — {event}</h3>
        <button onClick={addRow} className="flex items-center justify-center gap-1.5 min-h-11 text-[10px] font-black uppercase tracking-wider text-[#fbbf24] bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 border border-[#fbbf24]/25 rounded-lg px-3 py-1.5 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add seed
        </button>
      </div>

      <datalist id={datalistId}>
        {namesInEvent.map(n => <option key={n} value={n} />)}
      </datalist>

      {list.length === 0 ? (
        <EmptyState title="No seeds set yet" hint={`Tap "Seed" on the signed-up ${event === 'Doubles' ? 'teams' : 'players'} above to build the list, then reorder — or add rows by hand here.`} />
      ) : (
        <div className="space-y-2">
          {list.map((row, i) => (
            <div key={row.id} className="flex items-center gap-2 bg-[#111] border border-zinc-800 rounded-xl p-2.5">
              <span className="w-7 h-7 shrink-0 rounded-lg bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-[#fbbf24] flex items-center justify-center text-xs font-black">{i + 1}</span>
              <input list={datalistId} value={row.name} onChange={(e) => patchRow(row.id, { name: e.target.value })}
                placeholder={event === 'Doubles' ? 'Player A & Player B' : 'Player name'}
                className="flex-1 min-w-0 bg-transparent outline-none text-sm font-bold text-zinc-100 placeholder:text-zinc-600 placeholder:font-normal" />
              <TextInput value={row.notes} onChange={(v) => patchRow(row.id, { notes: v })} placeholder="Note (optional)" className="hidden sm:block w-44" />
              <div className="flex items-center gap-0.5 shrink-0">
                <IconButton icon={ChevronUp} label="Move up" onClick={() => move(i, -1)} />
                <IconButton icon={ChevronDown} label="Move down" onClick={() => move(i, 1)} />
                <IconButton icon={Trash2} tone="danger" label="Remove seed" onClick={() => removeRow(row.id)} />
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-zinc-600 mt-3">Position in the list = seed rank. Drag isn't needed on mobile — use the up/down arrows to reorder.</p>
    </Card>
  );
}

// ---------------------------------------------------------- Partner pairing
function PartnerAssignments({ participants, ops }) {
  const doublesPlayers = useMemo(
    () => participants.filter(p => p.events.includes('Doubles')).sort((a, b) => a.name.localeCompare(b.name)),
    [participants]
  );
  const allNames = useMemo(() => doublesPlayers.map(p => p.name), [doublesPlayers]);

  return (
    <Card className="p-4 sm:p-5">
      <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-1"><Users2 className="w-4 h-4 text-[#fbbf24]" /> Doubles partners</h3>
      <p className="text-[11px] text-zinc-500 mb-3">Pulled from the registration form by default — override here for last-minute swaps or unpaired entrants. Teams above update as you pair.</p>
      <datalist id="doubles-names">
        {allNames.map(n => <option key={n} value={n} />)}
      </datalist>
      {doublesPlayers.length === 0 ? (
        <EmptyState title="No doubles entrants yet" />
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {doublesPlayers.map(p => (
            <div key={p.name} className="flex items-center gap-2.5 bg-[#111] border border-zinc-800 rounded-xl px-3 py-2.5">
              <span className="text-sm font-bold text-zinc-200 truncate flex-1">{p.name}</span>
              <span className="text-zinc-600 text-xs shrink-0">w/</span>
              <input list="doubles-names" value={p.overlay.partner || p.partner || ''}
                onChange={(e) => ops.setOverlay(p.name, { partner: e.target.value })}
                placeholder="assign partner"
                className="bg-black border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-[#fbbf24] outline-none focus:border-[#fbbf24]/40 transition-colors placeholder:text-zinc-700 w-36 shrink-0" />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------- Draws
const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'live', label: 'Live' },
  { value: 'final', label: 'Final' },
];
const STATUS_DOT = { scheduled: 'bg-zinc-600', live: 'bg-emerald-400 animate-pulse', final: 'bg-[#fbbf24]' };

// Standard bracket placement for a power-of-two draw: returns seed positions
// in slot order so adjacent pairs are the R1 matches (1 v N, then the seed-2
// half, etc). Positions beyond the entry count are byes for the top seeds.
function bracketSlots(size) {
  let slots = [1];
  while (slots.length < size) {
    const m = slots.length * 2 + 1;
    slots = slots.flatMap(s => [s, m - s]);
  }
  return slots;
}

export function DrawEditor({ event, ops, namesInEvent }) {
  // Sorted by match number = playing order (courts are assigned dynamically).
  const matches = ops.store.matches
    .filter(m => m.event === event)
    .sort((a, b) => (Number(a.num) || 0) - (Number(b.num) || 0));
  const datalistId = `draw-names-${event}`;

  // One-tap bracket creation: turn the seed list into Round 1, standard
  // placement, byes to the top seeds when the field isn't a power of two.
  const buildR1 = () => {
    const seedNames = ops.store.seeds[event].map(s => s.name.trim()).filter(Boolean);
    if (seedNames.length < 2) {
      window.alert(`Seed at least 2 ${event === 'Doubles' ? 'teams' : 'players'} first — Round 1 is built straight from the seed order above.`);
      return;
    }
    let size = 1;
    while (size < seedNames.length) size *= 2;
    const slots = bracketSlots(size);
    const rows = [];
    const byes = [];
    for (let i = 0; i < slots.length; i += 2) {
      const a = seedNames[slots[i] - 1];
      const b = seedNames[slots[i + 1] - 1];
      if (a && b) rows.push({ round: 'R1', num: rows.length + 1, a, b });
      else if (a || b) byes.push(a || b);
    }
    const ok = window.confirm(
      `Build Round 1 for ${event} from the ${seedNames.length} seeds?\n\n` +
      `• ${size}-draw, ${rows.length} R1 match${rows.length === 1 ? '' : 'es'}\n` +
      (byes.length ? `• Byes straight to R2: ${byes.join(', ')}\n` : '') +
      (matches.length ? `\nThis replaces all ${matches.length} ${event} match${matches.length === 1 ? '' : 'es'} currently posted.` : '')
    );
    if (!ok) return;
    ops.setEventMatches(event, rows);
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><Swords className="w-4 h-4 text-[#fbbf24]" /> Match order — {event}</h3>
        <div className="flex items-center gap-2">
          <button onClick={buildR1} className="flex items-center justify-center gap-1.5 min-h-11 text-[10px] font-black uppercase tracking-wider text-black bg-[#fbbf24] hover:bg-amber-400 rounded-lg px-3 py-1.5 transition-colors">
            <Wand2 className="w-3.5 h-3.5" /> Build R1 from seeds
          </button>
          <button onClick={() => ops.addMatch(event)} className="flex items-center justify-center gap-1.5 min-h-11 text-[10px] font-black uppercase tracking-wider text-[#fbbf24] bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 border border-[#fbbf24]/25 rounded-lg px-3 py-1.5 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add match
          </button>
        </div>
      </div>
      <datalist id={datalistId}>
        {namesInEvent.map(n => <option key={n} value={n} />)}
      </datalist>

      {matches.length === 0 ? (
        <EmptyState title="No matches posted yet" hint={`Tap "Build R1 from seeds" to generate the opening round from the seed order, or add matchups by hand — staff and players see updates in real time.`} />
      ) : (
        <div className="space-y-2">
          {matches.map(m => (
            <div key={m.id} className="bg-[#111] border border-zinc-800 rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[m.status]}`} />
                <Select value={m.round} onChange={(v) => ops.updateMatch(m.id, { round: v })} options={ROUND_PRESETS} placeholder="Round" />
                <TextInput value={m.num} onChange={(v) => ops.updateMatch(m.id, { num: v })} placeholder="Match #" className="w-20" type="number" />
                <Select value={m.court} onChange={(v) => ops.updateMatch(m.id, { court: v })} options={COURTS} placeholder="Court" />
                <Select value={m.status} onChange={(v) => ops.updateMatch(m.id, { status: v })} options={STATUS_OPTIONS.map(s => s.value)} placeholder="Status" />
                <span className="ml-auto" />
                <IconButton icon={ChevronUp} label="Bump earlier in the order" onClick={() => ops.moveMatch(m.id, -1)} />
                <IconButton icon={ChevronDown} label="Push later in the order" onClick={() => ops.moveMatch(m.id, 1)} />
                <IconButton icon={Trash2} tone="danger" label="Remove match" onClick={() => ops.removeMatch(m.id)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2">
                <input list={datalistId} value={m.a} onChange={(e) => ops.updateMatch(m.id, { a: e.target.value })} placeholder="Player / team A"
                  className="bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm font-bold text-zinc-100 outline-none focus:border-[#fbbf24]/40 transition-colors placeholder:text-zinc-600 placeholder:font-normal w-full" />
                <span className="text-zinc-600 text-xs font-bold uppercase text-center">vs</span>
                <input list={datalistId} value={m.b} onChange={(e) => ops.updateMatch(m.id, { b: e.target.value })} placeholder="Player / team B"
                  className="bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm font-bold text-zinc-100 outline-none focus:border-[#fbbf24]/40 transition-colors placeholder:text-zinc-600 placeholder:font-normal w-full" />
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-zinc-600 mt-3">Match # is the playing order — courts get assigned to whoever opens next, so teams may play on different courts through the day. Use ↑ / ↓ to bump a match earlier or later (e.g. someone needs to leave early).</p>
    </Card>
  );
}

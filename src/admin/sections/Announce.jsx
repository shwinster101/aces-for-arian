import { useState } from 'react';
import { Megaphone, Trash2, CloudRain, Clock, Swords, Grid3x3, Search, Utensils, Trophy, Info } from 'lucide-react';
import { Card, PageHeader, Pills, IconButton, EmptyState } from '../ui';
import { ANNOUNCE_CATEGORIES } from '../../lib/sheet';

const EVENT_OPTS = [
  { value: 'Both', label: 'Both days' },
  { value: 'Doubles', label: 'Sat Doubles' },
  { value: 'Singles', label: 'Sun Singles' },
];

const CATEGORY_ICONS = {
  weather: CloudRain,
  schedule: Clock,
  round: Swords,
  courts: Grid3x3,
  'lost-found': Search,
  food: Utensils,
  awards: Trophy,
  general: Info,
};

const MAX_LEN = 400;

// Staff announcements — weather delays, schedule changes, round calls, court
// moves, lost & found. Posts land in the public Announcements tab (via the
// 'announce' write-back) and surface as the site-wide banner + Home feed.
export default function Announce({ ops }) {
  const [category, setCategory] = useState('weather');
  const [event, setEvent] = useState('Both');
  const [message, setMessage] = useState('');
  const posted = ops.store.announcements;

  const post = () => {
    if (!message.trim()) return;
    ops.postAnnouncement({ event, category, message });
    setMessage('');
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Announcements" subtitle="Post site-wide updates — weather delays, schedule changes, round calls, court moves, lost & found. The newest post becomes the banner on every public page." />

      <Card className="p-4 sm:p-5">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-3"><Megaphone className="w-4 h-4 text-[#fbbf24]" /> New announcement</h3>

        <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1.5">Category</div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {ANNOUNCE_CATEGORIES.map(({ key, label }) => {
            const Icon = CATEGORY_ICONS[key] || Info;
            const on = category === key;
            return (
              <button key={key} onClick={() => setCategory(key)}
                className={`flex items-center gap-1.5 min-h-11 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition ${on ? 'bg-[#fbbf24] text-black' : 'bg-[#111] text-zinc-400 border border-zinc-800 hover:bg-zinc-900'}`}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            );
          })}
        </div>

        <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1.5">Applies to</div>
        <Pills value={event} onChange={setEvent} options={EVENT_OPTS} />

        <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
          rows={4} placeholder="What do players and fans need to know? Lead with the action — “Rain hold: matches paused until ~1:30, stay near the courts.”"
          className="mt-4 w-full bg-black border border-zinc-800 rounded-xl px-3.5 py-3 text-sm text-zinc-100 leading-relaxed outline-none focus:border-[#fbbf24]/40 transition-colors placeholder:text-zinc-700" />
        <div className="flex items-center justify-between gap-3 mt-2">
          <span className="text-[10px] text-zinc-600">{message.length}/{MAX_LEN}</span>
          <button onClick={post} disabled={!message.trim()}
            className="min-h-11 px-6 bg-[#fbbf24] hover:bg-amber-400 disabled:opacity-30 disabled:hover:bg-[#fbbf24] text-black font-black text-xs uppercase tracking-wider rounded-xl transition-colors active:scale-[0.97]">
            Post
          </button>
        </div>
        <p className="text-[10px] text-zinc-600 mt-2.5">
          Posts to the public Announcements tab (needs the latest Apps Script deployed). Open public pages pick it up within ~1 min; the banner shows the newest post site-wide.
        </p>
      </Card>

      <Card className="p-4 sm:p-5">
        <h3 className="text-xs font-black text-white uppercase tracking-widest mb-3">Posted from this device</h3>
        {posted.length === 0 ? (
          <EmptyState icon={Megaphone} title="Nothing posted yet" hint="Posts appear here newest-first, with a delete to retract them from the public feed." />
        ) : (
          <div className="space-y-2">
            {posted.map((a) => {
              const Icon = CATEGORY_ICONS[a.category] || Info;
              const label = (ANNOUNCE_CATEGORIES.find(c => c.key === a.category) || {}).label || a.category;
              return (
                <div key={a.id} className="flex items-start gap-3 bg-[#111] border border-zinc-800 rounded-xl px-3.5 py-3">
                  <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${a.category === 'weather' ? 'text-[#fbbf24]' : 'text-zinc-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                      <span>{label}</span>
                      <span className="text-zinc-700">·</span>
                      <span>{a.event}</span>
                      <span className="text-zinc-700">·</span>
                      <span>{a.ts ? new Date(a.ts).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : ''}</span>
                    </div>
                    <p className="text-sm text-zinc-200 mt-1 leading-relaxed break-words">{a.message}</p>
                  </div>
                  <IconButton icon={Trash2} tone="danger" label="Delete announcement"
                    onClick={() => { if (window.confirm('Delete this announcement? It is removed from the public feed too.')) ops.deleteAnnouncement(a.id); }} />
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

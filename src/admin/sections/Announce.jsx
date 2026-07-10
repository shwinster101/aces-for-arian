import { useState } from 'react';
import { Megaphone, Trash2, CloudRain, Clock, Swords, Grid3x3, Search, Utensils, Trophy, Info, Mail, Copy, Check, X, CloudDownload } from 'lucide-react';
import { Card, PageHeader, Pills, IconButton, EmptyState } from '../ui';
import { ANNOUNCE_CATEGORIES, SHEET_WRITE_URL } from '../../lib/sheet';

// Gates the mode=emails read in apps-script/ops-write-back.js (roster email
// column for the BCC list). Ships in the admin bundle, so it's a drive-by
// deterrent only — rotate it after the event (here + in the Apps Script).
const EMAILS_TOKEN = 'a4a-mail-766673c3d6e53f1463738ba7';

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

// One-tap starting points for the most common under-pressure post: a status
// change while people are asking in person. Each just pre-fills category +
// message into the SAME composer/Post flow below — nothing new to learn,
// nothing posts until you hit Post, and the text stays editable (add a
// resume time, etc.) before it goes out.
const STATUS_PRESETS = [
  { label: 'On time', category: 'schedule', message: 'Play is on schedule — no delays right now.' },
  { label: 'Delayed', category: 'schedule', message: 'Matches are running behind — updates here as the schedule firms up.' },
  { label: 'Paused for rain', category: 'weather', message: 'Play is paused for rain. Stay near the courts — updates here as soon as we resume.' },
  { label: 'Resumed', category: 'schedule', message: 'Play has resumed — courts are back on.' },
];

// Round-call templates — the other under-pressure post. Fill in the [brackets]
// / Court __ before posting (same fill-then-Post flow; nothing sends on tap).
const ROUND_PRESETS = [
  { label: 'Calling a round', category: 'round', message: 'Now calling the [round] — please report to the desk for your court assignment.' },
  { label: 'On deck', category: 'round', message: 'On deck: [players] — please be ready courtside for Court __.' },
  { label: 'Finals starting', category: 'round', message: 'Finals are starting on Court __ — come watch and cheer!' },
  { label: 'Report scores', category: 'round', message: 'Winners: please report your score at the front desk before you leave the court.' },
];

// One-tap "clear the banner": posts a benign all-clear that the PUBLIC banner
// suppresses (App.jsx AnnouncementBanner hides on category 'clear'), so a
// lingering rain-hold/round banner actually disappears. Posts directly (it's a
// fixed message); the Home feed still lists it as history.
const CLEAR_POST = { event: 'Both', category: 'clear', message: 'All clear — back to normal play.' };

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

  const applyPreset = (preset) => {
    setCategory(preset.category);
    setMessage(preset.message);
  };

  // Clear the public banner — posts the all-clear directly (no edit step).
  const clearBanner = () => {
    ops.postAnnouncement(CLEAR_POST);
    setMessage('');
  };
  const bannerLive = posted[0] && posted[0].category !== 'clear';

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Announcements" subtitle="Post site-wide updates — weather delays, schedule changes, round calls, court moves, lost & found. The newest post becomes the banner on every public page." />

      <Card className="p-4 sm:p-5">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-3"><Megaphone className="w-4 h-4 text-[#fbbf24]" /> New announcement</h3>

        <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1.5">Quick status — fills in below, still needs Post</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {STATUS_PRESETS.map((preset) => (
            <button key={preset.label} onClick={() => applyPreset(preset)}
              className="min-h-11 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-[#111] text-zinc-300 border border-zinc-700 hover:border-[#fbbf24]/50 hover:text-[#fbbf24] transition-colors">
              {preset.label}
            </button>
          ))}
        </div>

        <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1.5">Round calls — fill the [blanks] / Court, then Post</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {ROUND_PRESETS.map((preset) => (
            <button key={preset.label} onClick={() => applyPreset(preset)}
              className="min-h-11 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-[#111] text-zinc-300 border border-zinc-700 hover:border-[#fbbf24]/50 hover:text-[#fbbf24] transition-colors">
              {preset.label}
            </button>
          ))}
        </div>

        {/* Clear the banner — one tap, posts directly (suppresses the public banner). */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={clearBanner}
            className="flex items-center gap-1.5 min-h-11 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors">
            <Check className="w-3.5 h-3.5" /> Clear the banner
          </button>
          <span className="text-[10px] text-zinc-600">{bannerLive ? 'A banner is live — this hides it (posts one time).' : 'Banner is clear.'}</span>
        </div>

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

      <EmailBlast ops={ops} />
    </div>
  );
}

// Gmail-BCC list for an email blast from a phone: fetch the roster's email
// column from the sheet (mode=emails, own token), add one-off addresses by
// hand, then Copy BCC and paste straight into Gmail's BCC field. The list is
// device-local (ops.store.emails) — emails never go to the public site.
function EmailBlast({ ops }) {
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  const [fetching, setFetching] = useState(false);
  const [copied, setCopied] = useState(false);
  const emails = ops.store.emails;

  const add = () => {
    if (!draft.trim()) return;
    const { parsed, valid, added } = ops.addEmails(draft);
    setDraft('');
    setNote(
      added ? `Added ${added}${valid < parsed ? ` · skipped ${parsed - valid} invalid` : ''}${added < valid ? ` · ${valid - added} already on the list` : ''}`
        : valid ? 'Already on the list' : 'No valid email in that — check for typos'
    );
  };

  const fetchFromSheet = async () => {
    setFetching(true); setNote('');
    try {
      const res = await fetch(`${SHEET_WRITE_URL}?mode=emails&token=${EMAILS_TOKEN}`);
      const text = res.ok ? await res.text() : '';
      const found = text.split('\n').map(s => s.trim()).filter(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
      if (!found.length) {
        setNote('Nothing came back — this needs the latest Apps Script deployed (Manage deployments → New version). Add emails by hand below as the fallback.');
      } else {
        const { added } = ops.addEmails(found.join('\n'));
        setNote(`Sheet has ${found.length} email${found.length === 1 ? '' : 's'} — ${added ? `added ${added} new` : 'all already on the list'}.`);
      }
    } catch {
      setNote('Couldn’t reach the sheet — check signal, or add emails by hand below.');
    }
    setFetching(false);
  };

  const copyBcc = async () => {
    const text = emails.join(', ');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older WebViews: fall back to a hidden textarea copy.
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* best effort */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><Mail className="w-4 h-4 text-[#fbbf24]" /> Email blast — BCC list</h3>
        <span className="text-[10px] font-mono text-zinc-500">{emails.length} email{emails.length === 1 ? '' : 's'}</span>
      </div>
      <p className="text-[11px] text-zinc-500 leading-relaxed mb-4 max-w-2xl">
        Pull participant emails from the sign-up sheet, add anyone extra by hand, then <span className="text-zinc-300 font-semibold">Copy BCC</span> and paste into Gmail&rsquo;s BCC field. Stays on this device only.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={fetchFromSheet} disabled={fetching}
          className="flex items-center gap-1.5 min-h-11 px-4 text-[10px] font-black uppercase tracking-wider text-[#fbbf24] bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 disabled:opacity-40 border border-[#fbbf24]/25 rounded-xl transition-colors">
          <CloudDownload className="w-3.5 h-3.5" /> {fetching ? 'Fetching…' : 'Fetch from sheet'}
        </button>
        <button onClick={copyBcc} disabled={!emails.length}
          className="flex items-center gap-1.5 min-h-11 px-4 bg-[#fbbf24] hover:bg-amber-400 disabled:opacity-30 disabled:hover:bg-[#fbbf24] text-black font-black text-[10px] uppercase tracking-wider rounded-xl transition-colors active:scale-[0.97]">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? `Copied ${emails.length}` : 'Copy BCC'}
        </button>
        {emails.length > 0 && (
          <button onClick={() => { if (window.confirm('Clear the whole email list? (Device-local only — the sheet is untouched.)')) ops.clearEmails(); }}
            className="flex items-center gap-1.5 min-h-11 px-3 text-[10px] font-black uppercase tracking-wider text-red-400/80 hover:text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/15 rounded-xl transition-colors ml-auto">
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder="Add emails — one or many, separated by commas or spaces" inputMode="email" autoCapitalize="none"
          className="flex-1 min-w-0 bg-black border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 outline-none focus:border-[#fbbf24]/40 transition-colors placeholder:text-zinc-700" />
        <button onClick={add} disabled={!draft.trim()}
          className="min-h-11 px-4 text-[10px] font-black uppercase tracking-wider text-zinc-200 bg-[#111] hover:bg-zinc-900 disabled:opacity-30 border border-zinc-700 rounded-xl transition-colors">
          Add
        </button>
      </div>
      {note && <p className="text-[11px] text-amber-300/80 leading-relaxed mb-3">{note}</p>}

      {emails.length === 0 ? (
        <EmptyState icon={Mail} title="No emails yet" hint="Fetch from the sheet or add addresses by hand — the list persists on this device for the weekend." />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {emails.map((e) => (
            <span key={e.toLowerCase()} className="flex items-center gap-1.5 bg-[#111] border border-zinc-800 rounded-full pl-3 pr-1.5 py-1 text-xs font-mono text-zinc-300">
              {e}
              <button onClick={() => ops.removeEmail(e)} aria-label={`Remove ${e}`}
                className="w-6 h-6 flex items-center justify-center rounded-full text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="text-[10px] text-zinc-600 mt-3">Copy gives a comma-separated list — Gmail&rsquo;s BCC field takes it as-is. Emails never appear on the public site; the fetch needs the latest Apps Script deployed once.</p>
    </Card>
  );
}

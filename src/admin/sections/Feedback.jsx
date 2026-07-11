import { useState } from 'react';
import { Send, Check, Mail } from 'lucide-react';
import { Card, PageHeader, TextInput } from '../ui';
import { pushToSheet } from '../store';
import { SHEET_WRITE_URL } from '../../lib/sheet';

// Where feedback lands. This is the SAME inbox the public "got an idea?" box
// emails (apps-script/ops-write-back.js -> IDEA_EMAIL) — shown here only so
// staff know where their note goes; the actual send happens server-side.
const FEEDBACK_EMAIL = 'acesforarian@gmail.com';
const MAX_LEN = 4000;

// A quick category just prefixes the emailed body so the owner can triage at a
// glance ("is this a bug or a nice-to-have?"). Kept short — it's a phone form.
const CATEGORIES = [
  { key: 'bug', label: 'Something broke' },
  { key: 'idea', label: 'Idea / suggestion' },
  { key: 'logistics', label: 'Logistics' },
  { key: 'other', label: 'Other' },
];

// Ops-console feedback box. Reuses the already-deployed public idea mail path
// (doPost type:'idea' -> handleIdea_ -> MailApp.sendEmail to acesforarian@gmail.com)
// so it works with ZERO Apps Script changes — we just tag the body/from so an
// ops note reads differently from a public-site idea in the inbox.
export default function Feedback() {
  const [category, setCategory] = useState('bug');
  const [message, setMessage] = useState('');
  const [from, setFrom] = useState('');
  const [sent, setSent] = useState(false);

  const canSend = message.trim().length > 0 && !!SHEET_WRITE_URL;

  const submit = () => {
    const text = message.trim();
    if (!text || !SHEET_WRITE_URL) return;
    const label = (CATEGORIES.find(c => c.key === category) || {}).label || category;
    pushToSheet('idea', {
      text: `[Ops feedback · ${label}]\n\n${text}`,
      from: from.trim() ? `Ops console — ${from.trim()}` : 'Ops console (anonymous)',
    });
    setSent(true);
    setMessage('');
    setFrom('');
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Feedback"
        subtitle="Spot a bug, have an idea, or hit a snag running the desk? Send it straight to the organizers." />

      {sent ? (
        <Card className="p-6 sm:p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mb-4">
            <Check className="w-6 h-6 text-emerald-400" />
          </div>
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Thanks — feedback sent</h3>
          <p className="text-xs text-zinc-500 mt-2 max-w-sm mx-auto leading-relaxed">
            It&rsquo;s on its way to <span className="text-zinc-300 font-mono">{FEEDBACK_EMAIL}</span>. Sent fire-and-forget from your phone, so we can&rsquo;t confirm delivery here — if it was urgent, grab an organizer too.
          </p>
          <button onClick={() => setSent(false)}
            className="mt-5 min-h-11 px-6 bg-[#fbbf24] hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-colors active:scale-[0.97]">
            Send another
          </button>
        </Card>
      ) : (
        <Card className="p-4 sm:p-5">
          <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1.5">What kind of note?</div>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {CATEGORIES.map(({ key, label }) => {
              const on = category === key;
              return (
                <button key={key} onClick={() => setCategory(key)}
                  className={`min-h-11 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition ${on ? 'bg-[#fbbf24] text-black' : 'bg-[#111] text-zinc-400 border border-zinc-800 hover:bg-zinc-900'}`}>
                  {label}
                </button>
              );
            })}
          </div>

          <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1.5">Your feedback</div>
          <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
            rows={5} placeholder="What happened, or what would make this better? Be specific — “Check-ins tab won’t save the shirt size on my phone” beats “it’s broken.”"
            className="w-full bg-black border border-zinc-800 rounded-xl px-3.5 py-3 text-sm text-zinc-100 leading-relaxed outline-none focus:border-[#fbbf24]/40 transition-colors placeholder:text-zinc-700" />
          <div className="text-right"><span className="text-[10px] text-zinc-600">{message.length}/{MAX_LEN}</span></div>

          <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1.5 mt-3">Your name or contact <span className="text-zinc-700 normal-case tracking-normal font-normal">(optional — so we can follow up)</span></div>
          <TextInput value={from} onChange={setFrom} placeholder="e.g. Priya — 555-0142" />

          <div className="flex items-center justify-between gap-3 mt-4">
            <span className="flex items-center gap-1.5 text-[10px] text-zinc-600"><Mail className="w-3.5 h-3.5" /> Emails the organizers</span>
            <button onClick={submit} disabled={!canSend}
              className="flex items-center gap-2 min-h-11 px-6 bg-[#fbbf24] hover:bg-amber-400 disabled:opacity-30 disabled:hover:bg-[#fbbf24] text-black font-black text-xs uppercase tracking-wider rounded-xl transition-colors active:scale-[0.97]">
              <Send className="w-3.5 h-3.5" /> Send
            </button>
          </div>

          {!SHEET_WRITE_URL && (
            <p className="text-[10px] text-rose-400/80 mt-3">Sending is off — SHEET_WRITE_URL isn&rsquo;t set in lib/sheet.js, so feedback can&rsquo;t leave this device.</p>
          )}
          <p className="text-[10px] text-zinc-600 mt-3">
            Goes to the organizers&rsquo; inbox ({FEEDBACK_EMAIL}) — the same place the public site&rsquo;s idea box lands, tagged so they know it came from ops. Nothing here shows on the public site.
          </p>
        </Card>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, 
  Award, 
  TrendingUp, 
  ShoppingBag, 
  ExternalLink,
  Heart,
  BookOpen,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Image as ImageIcon,
  Home,
  GraduationCap
} from 'lucide-react';

// ==========================================
// 1. BRANDING & STATIC ASSETS
// ==========================================

function ARLogo({ className = "w-12 h-12" }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="7" strokeLinejoin="miter" strokeLinecap="square">
      <line x1="48" y1="20" x2="48" y2="80" />
      <path d="M 48 20 L 22 80" />
      <line x1="32" y1="60" x2="48" y2="60" />
      <path d="M 48 20 L 66 20 C 80 20 80 50 66 50 L 48 50" />
      <path d="M 60 50 L 78 80" />
    </svg>
  );
}

// Brand mark: uses the uploaded /ar-logo.png on a cream badge (so a dark/maroon
// monogram shows on the dark header). Falls back to the line-art AR if the file
// isn't present yet, so the header never breaks.
function BrandLogo({ className = "" }) {
  const [ok, setOk] = useState(true);
  if (!ok) return <span className="text-[#fbbf24] inline-flex"><ARLogo className={className} /></span>;
  return (
    <div className={`${className} rounded-full bg-[#f7f1e3] flex items-center justify-center overflow-hidden shadow-md`}>
      <img src="/ar-logo.png" alt="Aces for Arian logo" className="w-[82%] h-[82%] object-contain"
        draggable={false} onError={() => setOk(false)} />
    </div>
  );
}

// Past champions + downloadable result archives, per event (singles | doubles).
function ResultsArchive({ event }) {
  const isS = event === 'singles';
  const champ = isS
    ? { label: '2025 Singles Champion', name: 'Alex', format: '32-player double elimination', podium: [{ place: '2nd', name: 'Andrew' }, { place: '3rd', name: 'Shaan' }], pdf: '/archive/aces-for-arian-2025-singles.pdf' }
    : { label: '2025 Doubles Champions', name: 'Greyson & Andy', format: '16-team compass draw', podium: [], pdf: '/archive/aces-for-arian-2025-doubles.pdf' };
  const past = [
    { label: '2024 Results', url: '/archive/aces-for-arian-2024-results.pdf' },
    { label: '2023 Results', url: '/archive/aces-for-arian-2023-results.pdf' },
    { label: '2022 Results', url: '/archive/aces-for-arian-2022-results.pdf' },
  ];
  return (
    <>
      <div className="bg-gradient-to-br from-[#1c1408] to-[#151515] border border-[#fbbf24]/30 rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/20 rounded px-2 py-0.5">Archive</span>
          <h4 className="text-sm font-black text-white uppercase tracking-wider">{champ.label}</h4>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex items-center gap-4">
            <Trophy className="w-10 h-10 text-[#fbbf24] shrink-0" />
            <div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">{isS ? 'Champion' : 'Champions'}</div>
              <div className="text-2xl font-black text-white leading-none">{champ.name}</div>
              <div className="text-[11px] text-zinc-500 mt-1">{champ.format}</div>
            </div>
          </div>
          {champ.podium.length > 0 && (
            <div className="flex gap-2">
              {champ.podium.map(p => (
                <div key={p.place} className="bg-[#111] border border-zinc-800 rounded-xl px-4 py-2 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-zinc-500">{p.place}</div>
                  <div className="text-sm font-bold text-zinc-200">{p.name}</div>
                </div>
              ))}
            </div>
          )}
          <a href={champ.pdf} target="_blank" rel="noopener noreferrer"
            className="sm:ml-auto inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-[#fbbf24] transition-colors">
            <span>Full bracket (PDF)</span><ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-5 md:p-6">
        <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">Past Tournament Results</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {past.map(p => (
            <a key={p.label} href={p.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between bg-[#111] hover:bg-zinc-900 border border-zinc-800 hover:border-[#fbbf24]/40 rounded-xl px-4 py-3 transition-colors group">
              <span className="text-sm font-bold text-white">{p.label}</span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 group-hover:text-[#fbbf24] transition-colors">PDF <ExternalLink className="h-3 w-3" /></span>
            </a>
          ))}
        </div>
      </div>

      <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-5 md:p-6">
        <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">2021 · Eagle Classic — Final Standings</h4>
        <p className="text-[11px] text-zinc-500 mb-4">From the Eagle Classic era — when Arian was still out on the court with the team.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          {[
            ['Doubles', ['1. Atishay / Ashwin', '2. Arian / Venil', '3. Doug / Graham']],
            ['Doubles (Ladies)', ['1. Anagha / Akshara', '2. Sophie / Leah']],
            ['Singles', ['1. Venil', '2. Ashwin', 'Semifinals: Kushal, Matthew', 'Back-draw: Abhi']],
            ['Singles (Ladies)', ['1. Shikha', '2. Anna', 'Back-draw: Shaina']],
          ].map(([div, places]) => (
            <div key={div}>
              <div className="text-[10px] font-black uppercase tracking-widest text-[#fbbf24] mb-1.5">{div}</div>
              {places.map(p => <div key={p} className="text-zinc-400 leading-relaxed">{p}</div>)}
            </div>
          ))}
        </div>
        <a href="/archive/eagle-classic-2021-results.pdf" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-5 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-[#fbbf24] transition-colors">
          <span>Full results (PDF)</span><ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-5 md:p-6">
        <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">2020 · Eagle Classic <span className="text-[#fbbf24]">— The Inaugural</span></h4>
        <p className="text-[11px] text-zinc-500 mb-4">The very first Eagle Classic — and Arian &amp; Venil took the doubles title.</p>
        <div className="flex items-center gap-3 mb-4 bg-[#1c1408] border border-[#fbbf24]/20 rounded-xl p-4">
          <Trophy className="w-6 h-6 text-[#fbbf24] shrink-0" />
          <div>
            <div className="text-[9px] uppercase tracking-widest text-[#fbbf24]">Men's Doubles Champions · Maroon</div>
            <div className="text-base font-black text-white leading-tight">Arian &amp; Venil</div>
            <div className="text-xs text-zinc-400">def. Aanan &amp; Imadh · 6-4, 7-6(5)</div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#fbbf24] mb-1.5">Men's Doubles — Gold</div>
            <div className="text-zinc-400 leading-relaxed">Timmy &amp; Alex def. Andrew &amp; Karthik, 8-5</div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#fbbf24] mb-1.5">Ladies Doubles</div>
            <div className="text-zinc-400 leading-relaxed">Shikha &amp; Shreya — round-robin winners</div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#fbbf24] mb-1.5">Men's Singles</div>
            <div className="text-zinc-400 leading-relaxed">Maroon: Victor Spolidorio '17 def. Aanan Kashyap '20, 6-1</div>
            <div className="text-zinc-400 leading-relaxed mt-1">Gold: Timmy Liu '24 def. Abhilash Pentela '26, 6-2</div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#fbbf24] mb-1.5">Women's Singles</div>
            <div className="text-zinc-400 leading-relaxed">Maroon: Taylor Disharoon '21 def. Shikha Agarwal '24</div>
            <div className="text-zinc-400 leading-relaxed mt-1">Gold: Sophie Muir '24</div>
          </div>
        </div>
        <a href="/archive/eagle-classic-2020-pools.pdf" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-5 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-[#fbbf24] transition-colors">
          <span>Original draws &amp; schedule (PDF)</span><ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </>
  );
}

// Name your 10 photos exactly these names and place them in the "public" folder!
const heroImages = [
  "photo1.jpg",
  "photo2.jpg",
  "photo3.jpg",
  "photo4.jpg",
  "photo5.jpg",
  "photo6.jpg",
  "photo7.jpg",
  "photo8.jpg",
  "photo9.jpg",
  "photo10.jpg"
];

// The yearly Google Photos albums. `images` are optimized files in /public, so
// the slideshow is fully self-hosted (ZERO third-party calls — no trackers, no
// account hand-off). To self-host a year's photos: open the album in Google
// Photos -> (3-dot menu) -> "Download all", drop the files into /public, and
// list the filenames below. The `url` is always shown as a "full album" link.
const ALBUMS = [
  {
    year: "2025",
    url: "https://photos.app.goo.gl/uTSWwjTgaYcDoHij9",
    images: [
      "photo1.jpg", "photo2.jpg", "photo3.jpg", "photo4.jpg", "photo5.jpg",
      "photo6.jpg", "photo7.jpg", "photo8.jpg", "photo9.jpg", "photo10.jpg",
      "photo11.jpg",
    ],
  },
  { year: "2024", url: "https://photos.app.goo.gl/HjjNMQh3cQTKL4GW7", images: [] },
  { year: "2023", url: "https://photos.app.goo.gl/JTonkVSzso5fnhAQ6", images: [] },
];

// Arian Rahbar Memorial Tennis Scholarship.
const SCHOLARSHIP_APPLY_URL = "https://docs.google.com/document/d/11MrcbAXJIgxAz7ZRyTaMK8aIvh2XrE9n_lUvyoQY9Pw/edit?usp=sharing"; // application doc — low-key bottom link for now; promote in spring
const SCHOLARSHIP_WINNERS = [
  { year: "2025", names: ["Carolina Gusso", "Alex Fei"] },
  { year: "2024", names: ["Sophie Muir", "Shikha Agarwal"] },
];

// Flattened, captioned slides across every album.
const GALLERY = ALBUMS.flatMap(a => a.images.map(src => ({ src, caption: a.year })));

// ==========================================
// 2. THE SINGLE SOURCE OF TRUTH (DATA)
// ==========================================

// --- LIVE ROSTER (auto-syncs from your Google Form responses) -------------
// 1. In the Google Sheet that collects your form responses, add a NEW tab
//    with ONLY these public-safe columns (do NOT publish emails/phones):
//        Name | Class | Events | Status
//    Set Status to "Verified" once you've confirmed someone's $40 payment;
//    anything else (or blank) shows as "Pending".
// 2. File -> Share -> Publish to web -> choose that tab -> CSV -> Publish.
// 3. Paste the generated link between the quotes below.
//    Leave it "" to fall back to the static list underneath.
const ROSTER_CSV_URL = "";

// Where the header "Donate" button sends people (currently your Venmo).
const DONATE_URL = "https://venmo.com/u/ashwiny";

// Live court board for tournament day. Flip live=true and fill each court's
// now/next with a match label (e.g. "#12 Alex/Sai vs Roy/Gus"). 9 courts.
const COURT_BOARD = {
  live: false,
  updated: "",
  courts: Array.from({ length: 9 }, (_, i) => ({ court: i + 1, now: "", next: "" })),
};

// Publish a sheet with columns Court | Now | Next and paste its CSV link here to
// drive the board live from your phone. Empty = use the static COURT_BOARD above.
const COURT_BOARD_CSV_URL = "";

// Parse the court-board CSV into 9 court rows (overlaid onto empty courts).
function mapCourtBoard(rows) {
  if (rows.length < 2) return null;
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const col = (...names) => headers.findIndex(h => names.some(n => h.includes(n)));
  const iCourt = col("court"), iNow = col("now", "current", "on"), iNext = col("next", "up");
  if (iCourt < 0) return null;
  const by = {};
  rows.slice(1).forEach(r => {
    const c = parseInt(String(r[iCourt] || "").replace(/\D/g, ""), 10);
    if (c >= 1 && c <= 9) by[c] = { now: iNow >= 0 ? (r[iNow] || "").trim() : "", next: iNext >= 0 ? (r[iNext] || "").trim() : "" };
  });
  return Array.from({ length: 9 }, (_, i) => ({ court: i + 1, now: by[i + 1]?.now || "", next: by[i + 1]?.next || "" }));
}

// Fallback shown only when ROSTER_CSV_URL is blank or the live fetch fails,
// so the dashboard NEVER renders an empty roster.
const fallbackRoster = [
  { name: "Ashwin Yedavalli", classYear: "19", events: "Singles & Doubles", status: "Verified", bio: "Founder. Still chasing that elusive down-the-line winner." },
  { name: "Aanan Kashyap", classYear: "19", events: "Doubles", status: "Verified" },
  { name: "Venil Tummarakota", classYear: "Alumni", events: "Singles & Doubles", status: "Verified", bio: "2017 State champ, back to defend the name." },
  { name: "Tyler Miller", classYear: "Alumni", events: "Doubles", status: "Pending" }
];

// Minimal RFC-4180-ish CSV parser (handles quoted fields, commas, newlines).
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Map CSV rows -> roster objects via flexible, case-insensitive header matching,
// so it works even if your column names aren't exactly "Name/Class/Events/Status".
function mapRoster(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const col = (...names) => headers.findIndex(h => names.some(n => h.includes(n)));
  const iName = col("name");
  const iClass = col("class", "year", "grad");
  const iEvents = col("event");
  const iStatus = col("status", "paid", "verif", "confirm");
  const iBio = col("bio", "line", "about", "yearbook", "quote");
  if (iName < 0) return [];
  return rows.slice(1)
    .filter(r => (r[iName] || "").trim())
    .map(r => {
      const s = (iStatus >= 0 ? r[iStatus] : "").trim().toLowerCase();
      const verified = /verif|paid|confirm|complete/.test(s) ||
        ["y", "yes", "true", "1", "done", "✓"].includes(s);
      return {
        name: r[iName].trim(),
        classYear: iClass >= 0 ? (r[iClass] || "").trim() : "",
        events: iEvents >= 0 ? (r[iEvents] || "").trim() : "",
        status: verified ? "Verified" : "Pending",
        bio: iBio >= 0 ? (r[iBio] || "").trim() : "",
      };
    });
}

// Baseline seeding: prior A4A results first, then public UTR / WTN where players
// have them, then committee + community refinement. result/utr/wtn are optional.
const topSeeds = [
  // Singles
  { name: "Alex", type: "Singles", rank: 1, result: "2025 Champion", notes: "Reigning singles champion — automatic top seed." },
  { name: "Andrew", type: "Singles", rank: 2, result: "2025 Finalist", notes: "Stormed the back draw to the final last year." },
  { name: "Shaan", type: "Singles", rank: 3, result: "2025 3rd", notes: "2025 No. 1 seed." },
  { name: "Ashwin Yedavalli", type: "Singles", rank: 4, utr: "7.2", notes: "100-win club. State contender." },
  { name: "Venil Tummarakota", type: "Singles", rank: 5, utr: "7.0", notes: "2017 State champ." },
  { name: "Aanan Kashyap", type: "Singles", rank: 6, utr: "6.9", notes: "DHS singles mainstay." },
  { name: "Siddharth Patel", type: "Singles", rank: 7, utr: "6.4", notes: "Current varsity No. 1 court." },
  // Doubles
  { name: "Greyson & Andy", type: "Doubles", rank: 1, result: "2025 Champions", notes: "Reigning doubles champions." },
  { name: "A. Yedavalli / V. Tummarakota", type: "Doubles", rank: 2, utr: "7.1", notes: "Original champions." },
  { name: "A. Kashyap / T. Miller", type: "Doubles", rank: 3, utr: "6.5", notes: "Varsity alumni standouts." }
];

// ==========================================
// DRAW BUILDERS (drafts — every slot is TBD until registration closes)
// ==========================================

// Standard single-elimination seeding order for a bracket of size n.
function seedOrder(n) {
  let seeds = [1, 2];
  while (seeds.length < n) {
    const total = seeds.length * 2 + 1;
    const next = [];
    for (const s of seeds) next.push(s, total - s);
    seeds = next;
  }
  return seeds;
}

// Build the rounds of a single-elimination draw of n entrants.
// Round 1 optionally shows seed lines (1..n); later rounds are TBD advancers.
// Seed names for an event, ordered by rank (seed 1 first) — drives bracket auto-seeding.
const seededNames = (type) => topSeeds.filter(s => s.type === type).sort((a, b) => a.rank - b.rank).map(s => s.name);

function singleElim(n, seeded = true, names = []) {
  const order = seedOrder(n);
  const slot = (pos) => (seeded ? { seed: pos, name: names[pos - 1] || null } : {});
  const r1 = [];
  for (let i = 0; i < n; i += 2) {
    r1.push({ a: slot(order[i]), b: slot(order[i + 1]) });
  }
  const rounds = [r1];
  let m = n / 2;
  while (m > 1) {
    m /= 2;
    rounds.push(Array.from({ length: m }, () => ({ a: {}, b: {} })));
  }
  return rounds;
}

// Losers bracket of a 32-player double elimination (match counts per round).
function losersBracket32() {
  return [8, 8, 4, 4, 2, 2, 1, 1].map(c =>
    Array.from({ length: c }, () => ({ a: {}, b: {} }))
  );
}

// Stamp a match number onto each match. numberRounds: explicit per-round start
// numbers (used to mirror the PrintYourBrackets 1–62 singles scheme).
function numberRounds(rounds, starts) {
  return rounds.map((matches, ri) => { let n = starts[ri]; return matches.map(m => ({ ...m, num: n++ })); });
}
// numberSeq: number sequentially across all rounds from `start`; returns { rounds, next }.
function numberSeq(rounds, start) {
  let n = start;
  return { rounds: rounds.map(ms => ms.map(m => ({ ...m, num: n++ }))), next: n };
}

const roundLabel = (matches) =>
  ({ 1: 'Final', 2: 'Semifinals', 4: 'Quarterfinals', 8: 'Round of 16', 16: 'Round of 32' }[matches] || `Round of ${matches * 2}`);

function Slot({ slot }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
      <span className={`text-[11px] truncate ${slot && slot.name ? 'text-zinc-200' : 'text-zinc-600'}`}>
        {slot && slot.name ? slot.name : 'TBD'}
      </span>
      {slot && slot.seed != null && (
        <span className="shrink-0 text-[9px] font-mono font-bold text-[#fbbf24]/90 bg-[#fbbf24]/10 border border-[#fbbf24]/20 rounded px-1.5">
          {slot.seed}
        </span>
      )}
    </div>
  );
}

function MatchCard({ match }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="w-5 shrink-0 text-right text-[8px] font-mono font-bold text-zinc-500">{match.num != null ? match.num : ''}</span>
      <div className="w-40 md:w-44 rounded-lg border border-zinc-800 bg-[#111] divide-y divide-zinc-800/80 overflow-hidden">
        <Slot slot={match.a} />
        <Slot slot={match.b} />
      </div>
    </div>
  );
}

function Bracket({ rounds, names }) {
  return (
    <div className="flex gap-4 md:gap-6 overflow-x-auto no-scrollbar pb-2">
      {rounds.map((matches, ri) => (
        <div key={ri} className="flex flex-col shrink-0">
          <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2 pl-1 whitespace-nowrap">
            {names ? names[ri] : roundLabel(matches.length)}
          </div>
          <div className="flex flex-col justify-around flex-1 gap-1.5">
            {matches.map((m, mi) => <MatchCard key={mi} match={m} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// Self-hosted auto-advancing gallery slideshow. No third-party scripts.
function Slideshow({ images, interval = 5000 }) {
  const items = images.map(x => (typeof x === 'string' ? { src: x } : x));
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || items.length <= 1) return;
    const id = setInterval(() => setIdx(i => (i + 1) % items.length), interval);
    return () => clearInterval(id);
  }, [paused, items.length, interval]);

  if (!items.length) return null;
  const go = (n) => setIdx((n + items.length) % items.length);

  return (
    <div
      className="relative w-full h-[60vh] min-h-[360px] max-h-[640px] bg-black rounded-2xl overflow-hidden group select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {items.map(({ src }, i) => (
        <img
          key={src}
          src={src}
          alt={`Tournament photo ${i + 1}`}
          loading={i === 0 ? 'eager' : 'lazy'}
          draggable={false}
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-700 ${i === idx ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}

      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

      {items[idx].caption && (
        <div className="absolute bottom-3 left-4 text-[10px] font-mono font-bold text-[#fbbf24] bg-black/50 border border-[#fbbf24]/20 rounded-full px-2.5 py-1 backdrop-blur-sm">
          {items[idx].caption}
        </div>
      )}

      <button onClick={() => go(idx - 1)} aria-label="Previous photo"
        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 border border-white/10 text-white flex items-center justify-center backdrop-blur-sm transition-colors">
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <button onClick={() => go(idx + 1)} aria-label="Next photo"
        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 border border-white/10 text-white flex items-center justify-center backdrop-blur-sm transition-colors">
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
      </button>

      <div className="absolute top-3 right-3 text-[10px] font-mono font-bold text-white/90 bg-black/50 border border-white/10 rounded-full px-2.5 py-1 backdrop-blur-sm">
        {idx + 1} / {items.length}
      </div>

      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 px-4 flex-wrap">
        {items.map((_, i) => (
          <button key={i} onClick={() => go(i)} aria-label={`Go to photo ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? 'w-5 bg-[#fbbf24]' : 'w-1.5 bg-white/40 hover:bg-white/70'}`} />
        ))}
      </div>
    </div>
  );
}

// ==========================================
// 3. MAIN APPLICATION
// ==========================================

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [bracketEvent, setBracketEvent] = useState('doubles');
  const [seedingEvent, setSeedingEvent] = useState('Singles');
  const [currentHeroImageIndex, setCurrentHeroImageIndex] = useState(0);
  const [roster, setRoster] = useState(fallbackRoster);
  const [courtBoard, setCourtBoard] = useState(COURT_BOARD);
  const [rosterLive, setRosterLive] = useState(false);
  const navRef = useRef(null);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentHeroImageIndex(prev => (prev + 1) % heroImages.length);
    }, 4500);
    return () => clearInterval(intervalId);
  }, []);

  // Auto-sync the roster from the published Google Sheet; fails over silently
  // to fallbackRoster so the dashboard never breaks.
  useEffect(() => {
    if (!ROSTER_CSV_URL) return;
    let cancelled = false;
    fetch(ROSTER_CSV_URL)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(text => {
        const players = mapRoster(parseCSV(text));
        if (!cancelled && players.length) { setRoster(players); setRosterLive(true); }
      })
      .catch(() => { /* keep fallbackRoster */ });
    return () => { cancelled = true; };
  }, []);

  // Live court board from a published sheet; refreshes every 60s. Falls back to
  // the static COURT_BOARD if no URL is set or a fetch fails.
  useEffect(() => {
    if (!COURT_BOARD_CSV_URL) return;
    let cancelled = false;
    const load = () => fetch(`${COURT_BOARD_CSV_URL}${COURT_BOARD_CSV_URL.includes('?') ? '&' : '?'}cb=${Date.now()}`)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(text => {
        const courts = mapCourtBoard(parseCSV(text));
        if (courts && !cancelled) setCourtBoard({ live: true, updated: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), courts });
      })
      .catch(() => { /* keep previous / static board */ });
    load();
    const id = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Keep the active tab centered in the sticky nav strip (esp. on mobile).
  useEffect(() => {
    navRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [activeTab]);

  // Financial tracking math
  const scholarshipGoal = 1500;
  const registrationFee = 40;
  const baseDonations = 380; // Add your direct offline donations here
  const confirmedCount = roster.filter(p => p.status === 'Verified').length;
  // Scholarship meter is pinned for now. Set fixedFunding to null to auto-calc
  // from confirmed (paid) players: baseDonations + confirmedCount * registrationFee.
  const fixedFunding = 500;
  const calculatedFunding = fixedFunding ?? (baseDonations + confirmedCount * registrationFee);
  const percentageGoal = Math.min(Math.round((calculatedFunding / scholarshipGoal) * 100), 100);

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-zinc-200 font-sans flex flex-col selection:bg-[#fbbf24] selection:text-[#5c1313]">
      
      {/* --- HEADER --- */}
      <header className="bg-[#5c1313] relative overflow-hidden">
        {/* Subtle Court Lines Pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="w-full h-full border-2 border-[#fbbf24] absolute top-2 left-2 right-2 bottom-2"></div>
          <div className="w-1/2 h-full border-r-2 border-[#fbbf24] absolute left-0"></div>
          <div className="w-full h-1/2 border-b-2 border-[#fbbf24] absolute top-0"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            <div className="flex items-center gap-4">
              <BrandLogo className="w-12 h-12 md:w-14 md:h-14 shrink-0" />
              <h1 className="text-xl md:text-2xl font-black tracking-wide uppercase text-white">
                Aces for Arian <span className="text-base md:text-lg font-light text-[#fefcbf]">2026</span>
              </h1>
            </div>

            <span className="inline-flex items-center gap-1.5 self-start md:self-center text-[10px] font-black uppercase tracking-wider text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/30 rounded-full px-3 py-1.5">
              <Trophy className="w-3.5 h-3.5 shrink-0" />
              Five Years Hitting Aces for Arian
            </span>

            <div className="flex items-center gap-4 md:gap-5 bg-[#3a0a0a] px-5 py-3 rounded-xl border border-[#fbbf24]/30 shadow-lg">
              <div>
                <span className="text-[10px] text-[#fbbf24] font-bold uppercase tracking-widest block mb-1">Scholarship Fund</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-black text-white">${calculatedFunding}</span>
                  <span className="text-[10px] text-zinc-300">/ ${scholarshipGoal}</span>
                </div>
              </div>
              <div className="w-16 md:w-24 h-2 bg-black/50 rounded-full overflow-hidden">
                <div className="h-full bg-[#fbbf24] rounded-full" style={{ width: `${percentageGoal}%` }}></div>
              </div>
              <a
                href={DONATE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1.5 bg-[#fbbf24] hover:bg-amber-400 text-black font-black text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-lg transition-colors"
              >
                <Heart className="w-3.5 h-3.5" />
                <span>Donate</span>
              </a>
            </div>

          </div>
        </div>

      </header>

      {/* Sticky tab nav — lifted out of the overflow-hidden header so position:sticky works */}
      <div className="sticky top-0 z-40 bg-[#5c1313]/95 backdrop-blur-sm border-b-2 border-[#fbbf24] shadow-lg shadow-black/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <nav ref={navRef} className="flex space-x-6 md:space-x-8 py-3 overflow-x-auto no-scrollbar">
            {[
              { id: 'home', label: 'Home', icon: Home },
              { id: 'seeding', label: 'Projected Seeds', icon: TrendingUp },
              { id: 'draws', label: 'Brackets', icon: Award },
              { id: 'photos', label: 'Photos', icon: ImageIcon },
              { id: 'rules', label: 'Rules', icon: BookOpen },
              { id: 'merch', label: 'Merch', icon: ShoppingBag },
              { id: 'legacy', label: 'Legacy', icon: Heart },
              { id: 'scholarship', label: 'Scholarship', icon: GraduationCap }
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  data-active={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 pb-1 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                    active ? 'text-[#fbbf24] border-b-2 border-[#fbbf24]' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="pointer-events-none absolute right-0 inset-y-0 w-10 bg-gradient-to-l from-[#5c1313] to-transparent md:hidden"></div>
        </div>
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8">

        {/* ==========================================
            TAB: HOME (REGISTRATION & ROSTER)
            ========================================== */}
        {activeTab === 'home' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Hero Section */}
            <div className="bg-[#111111] border border-zinc-800 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden shadow-2xl shadow-black">
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                <div className="w-full h-full border border-zinc-700 absolute top-1 left-1 right-1 bottom-1"></div>
              </div>
              
              <div className="flex-1 space-y-4 relative z-10">
                <div className="text-[10px] font-mono text-zinc-300 bg-zinc-900 px-3 py-1.5 rounded-lg w-fit flex items-center gap-2 border border-zinc-800">
                    <Calendar className='w-3.5 h-3.5 text-[#fbbf24]' /> July 11–12, 2026 • Dunlap High Courts
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight leading-none">Play in the 5th Annual Aces for Arian</h3>
                <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
                  Singles, doubles, or both — $40 covers the full weekend, plus a tournament tee, court snacks, and pro photos. Come play with the Dunlap tennis community; every dollar funds the Arian Rahbar Memorial Scholarship.
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                  <a href="https://forms.gle/rLnyakinZfkSePpv7" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-[#fbbf24] hover:bg-amber-400 text-black font-black text-sm uppercase tracking-wider px-6 py-3.5 rounded-xl transition-colors shadow-lg shadow-amber-500/10">
                    <span>Register — $40</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <span className="text-xs text-zinc-500">Sign-ups close July 6</span>
                </div>
              </div>

              {/* Rotating Canvas */}
              <div className="relative w-full md:w-80 aspect-[2/3] flex-shrink-0 bg-black rounded-2xl overflow-hidden border border-zinc-800 group">
                <img 
                  src={heroImages[currentHeroImageIndex]} 
                  alt="Tournament Highlights" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                  {heroImages.map((_, i) => (
                    <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === currentHeroImageIndex ? 'w-4 bg-[#fbbf24]' : 'w-1.5 bg-white/40'}`} />
                  ))}
                </div>
              </div>
            </div>

            {/* Registration Workflow */}
            <div className="bg-[#151515] border border-zinc-800/60 rounded-3xl p-6 md:p-8 relative">
              <div className="relative z-10">
                <h3 className="text-lg font-black text-white uppercase tracking-wider mb-2">3 Steps to Play</h3>
                <p className="text-xs text-zinc-400 mb-6">Complete all three steps to secure your draw placement. The ledger below updates automatically as players are confirmed.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Step 1 */}
                  <div className="bg-[#111] border border-[#fbbf24]/30 rounded-2xl p-6 flex flex-col justify-between shadow-lg shadow-amber-500/5">
                    <div>
                      <div className="w-8 h-8 rounded-full bg-[#fbbf24]/10 text-[#fbbf24] flex items-center justify-center font-black mb-4">1</div>
                      <h4 className="text-base font-bold text-white mb-2">Google Form</h4>
                      <p className="text-xs text-zinc-400 mb-6 leading-relaxed">Select your singles/doubles events, note your partner, and choose your shirt size on the official form.</p>
                    </div>
                    <a href="https://forms.gle/rLnyakinZfkSePpv7" target="_blank" rel="noopener noreferrer" className="w-full bg-[#fbbf24] hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
                      <span>Open Form</span>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-[#111] border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between">
                    <div>
                      <div className="w-8 h-8 rounded-full bg-zinc-800 text-white flex items-center justify-center font-black mb-4">2</div>
                      <h4 className="text-base font-bold text-white mb-2">Submit $40 Entry Fee</h4>
                      <p className="text-xs text-zinc-400 mb-6 leading-relaxed">Send your entry fee via Venmo, Zelle, or cash. Ashwin will verify the payment and update the roster below.</p>
                    </div>
                    <div className="bg-black rounded-xl p-4 text-xs font-mono text-zinc-300 space-y-3 border border-zinc-800/50">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500 uppercase tracking-widest font-bold text-[10px]">Venmo</span>
                        <strong className="text-white text-sm">@ashwiny</strong>
                      </div>
                      <div className="border-t border-zinc-800"></div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500 uppercase tracking-widest font-bold text-[10px]">Zelle</span>
                        <strong className="text-white text-xs truncate max-w-[140px]" title="ashwinyedavalli@gmail.com">ashwinyeda...</strong>
                      </div>
                      <div className="border-t border-zinc-800"></div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500 uppercase tracking-widest font-bold text-[10px]">Cash</span>
                        <strong className="text-white text-sm">In person</strong>
                      </div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-[#111] border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between">
                    <div>
                      <div className="w-8 h-8 rounded-full bg-zinc-800 text-white flex items-center justify-center font-black mb-4">3</div>
                      <h4 className="text-base font-bold text-white mb-2">Wait for Sync</h4>
                      <p className="text-xs text-zinc-400 mb-6 leading-relaxed">You're done! Ashwin will verify your payment and add you to the dashboard roster within 24 hours.</p>
                    </div>
                    <div className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl flex items-center justify-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Ready to Play</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Roster & Info Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="lg:col-span-2 bg-[#151515] border border-zinc-800 rounded-3xl p-6">
                <div className="flex justify-between items-center pb-4 border-b border-zinc-800 mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Tournament Ledger</h3>
                    {rosterLive && (
                      <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Live
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-[#fbbf24]/10 border border-[#fbbf24]/20 px-3 py-1 rounded-md text-[#fbbf24]">
                    {confirmedCount} Confirmed · {roster.length} Registered
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead>
                      <tr className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                        <th className="pb-3 pl-2">Athlete</th>
                        <th className="pb-3">Class</th>
                        <th className="pb-3">Events</th>
                        <th className="pb-3 text-right pr-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50 text-sm">
                      {roster.map((player, i) => (
                        <tr key={i} className="hover:bg-zinc-900/50 transition-colors">
                          <td className="py-4 pl-2">
                            <div className="font-bold text-zinc-200">{player.name}</div>
                            {player.bio && <div className="text-[11px] text-zinc-500 font-normal italic mt-0.5 max-w-[15rem] truncate sm:whitespace-normal" title={player.bio}>{player.bio}</div>}
                          </td>
                          <td className="py-4 text-zinc-400 text-xs">{player.classYear}</td>
                          <td className="py-4 text-zinc-400 text-xs">{player.events}</td>
                          <td className="py-4 pr-2 text-right">
                            <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                              player.status === 'Verified' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            }`}>
                              {player.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-6 flex flex-col justify-center">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider mb-5">Coordinators</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-[#111] p-3 rounded-xl border border-zinc-800/60">
                      <span className="text-xs text-zinc-300 font-semibold">Ashwin Yedavalli</span>
                      <a href="tel:3093618746" className="text-[#fbbf24] font-mono text-[11px] hover:underline">309-361-8746</a>
                    </div>
                    <div className="flex justify-between items-center bg-[#111] p-3 rounded-xl border border-zinc-800/60">
                      <span className="text-xs text-zinc-300 font-semibold">Venil Tummarakota</span>
                      <a href="tel:3093406375" className="text-[#fbbf24] font-mono text-[11px] hover:underline">309-340-6375</a>
                    </div>
                    <div className="flex justify-between items-center bg-[#111] p-3 rounded-xl border border-zinc-800/60">
                      <span className="text-xs text-zinc-300 font-semibold">Aanan Kashyap</span>
                      <a href="tel:3097136182" className="text-[#fbbf24] font-mono text-[11px] hover:underline">309-713-6182</a>
                    </div>
                  </div>
                </div>

                <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Tournament Rules</h3>
                  </div>
                  <ul className="text-xs text-zinc-400 space-y-2.5">
                    <li>• Arrive <strong className="text-zinc-200">15 minutes</strong> early for all matches.</li>
                    <li>• Players 15 minutes late will be defaulted.</li>
                    <li>• Pre-payment required before taking the court.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Tournament Memories — auto slideshow across all years */}
            <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-2 md:p-3">
              <div className="px-3 pt-2 pb-1">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Tournament Memories</h3>
              </div>
              <Slideshow images={GALLERY} />
            </div>

          </div>
        )}

        {/* ==========================================
            TAB: PROJECTED SEEDS
            ========================================== */}
        {activeTab === 'seeding' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-[#151515] border border-zinc-800 p-6 md:p-8 rounded-3xl">
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Projected Seeds</h2>
              <p className="text-sm text-zinc-400 mt-2 max-w-2xl leading-relaxed">
                Baseline seeding starts from objective signals — prior Aces for Arian results plus public UTR and WTN ratings where players have them — then the committee and community refine it. Reigning champions get an automatic top seed.
              </p>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              <button onClick={() => setSeedingEvent('Singles')} className={`whitespace-nowrap px-6 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition ${seedingEvent === 'Singles' ? 'bg-[#fbbf24] text-black shadow-lg shadow-amber-500/10' : 'bg-[#151515] text-zinc-400 border border-zinc-800 hover:bg-zinc-900'}`}>Sunday Singles</button>
              <button onClick={() => setSeedingEvent('Doubles')} className={`whitespace-nowrap px-6 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition ${seedingEvent === 'Doubles' ? 'bg-[#fbbf24] text-black shadow-lg shadow-amber-500/10' : 'bg-[#151515] text-zinc-400 border border-zinc-800 hover:bg-zinc-900'}`}>Saturday Doubles</button>
            </div>

            <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-6">
              <div className="grid grid-cols-1 gap-3">
                {topSeeds.filter(item => item.type === seedingEvent).map((candidate, idx) => {
                  const isTop3 = candidate.rank <= 3;
                  return (
                    <div key={idx} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4.5 rounded-2xl border ${isTop3 ? 'bg-[#111] border-[#fbbf24]/30' : 'bg-[#111] border-zinc-800/50'}`}>
                      <div className="flex items-center gap-5 w-full">
                        <div className={`w-12 h-12 flex items-center justify-center font-black text-xl rounded-xl shrink-0 ${isTop3 ? 'bg-[#fbbf24] text-black shadow-inner' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`}>
                          {candidate.rank}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-base font-bold text-white">{candidate.name}</h4>
                            {candidate.result && (
                              <span className="text-[10px] font-mono font-bold bg-[#fbbf24]/10 px-2 py-0.5 rounded-md text-[#fbbf24] border border-[#fbbf24]/20">{candidate.result}</span>
                            )}
                            {candidate.utr && (
                              <span className="text-[10px] font-mono bg-black px-2 py-0.5 rounded-md text-emerald-400 border border-zinc-800">UTR {candidate.utr}</span>
                            )}
                            {candidate.wtn && (
                              <span className="text-[10px] font-mono bg-black px-2 py-0.5 rounded-md text-sky-400 border border-zinc-800">WTN {candidate.wtn}</span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 mt-1 italic">"{candidate.notes}"</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Crowdsource CTA */}
            <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-5 md:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <h4 className="text-sm font-black text-white uppercase tracking-wider">Help seed the draw</h4>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">Drop your UTR / WTN and recent results on the registration form — and flag any seed that looks off. The committee finalizes from there.</p>
              </div>
              <a href="https://forms.gle/rLnyakinZfkSePpv7" target="_blank" rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-2 bg-[#fbbf24] hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition-colors">
                <span>Add my rating</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB: DRAWS & BRACKETS
            ========================================== */}
        {activeTab === 'draws' && (
          <div className="space-y-6 animate-fade-in">

            {/* Live court board — answers "when is my next match?" */}
            <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-6">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${courtBoard.live ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`}></span>
                  <h2 className="text-xl font-black text-white uppercase tracking-wider">Live Court Board</h2>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">{courtBoard.live ? `Updated ${courtBoard.updated}` : 'Goes live tournament morning'}</span>
              </div>
              <p className="text-sm text-zinc-400 mb-5 max-w-2xl leading-relaxed">
                Find your match number to see what's <span className="text-emerald-400 font-semibold">on now</span> and what's <span className="text-zinc-200 font-semibold">up next</span> across all 9 courts.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {courtBoard.courts.map(c => (
                  <div key={c.court} className="bg-[#111] border border-zinc-800 rounded-xl p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#fbbf24] mb-2">Court {c.court}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] uppercase tracking-wider text-emerald-400 w-11 shrink-0">On now</span>
                      <span className="text-sm text-zinc-100 font-bold truncate">{c.now || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-800/60">
                      <span className="text-[9px] uppercase tracking-wider text-zinc-500 w-11 shrink-0">Next</span>
                      <span className="text-sm text-zinc-400 truncate">{c.next || '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#151515] border border-zinc-800 p-6 md:p-8 rounded-3xl">
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Tournament Draws</h2>
              <p className="text-sm text-zinc-400 mt-2 max-w-2xl leading-relaxed">
                Draft brackets. Seeds and matchups are placeholders until registration closes July 6 — slots fill in as players are confirmed.
              </p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pt-5">
                <button onClick={() => setBracketEvent('doubles')} className={`whitespace-nowrap px-6 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition ${bracketEvent === 'doubles' ? 'bg-[#fbbf24] text-black shadow-lg shadow-amber-500/10' : 'bg-[#111] text-zinc-400 border border-zinc-800 hover:bg-zinc-900'}`}>Saturday Doubles</button>
                <button onClick={() => setBracketEvent('singles')} className={`whitespace-nowrap px-6 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition ${bracketEvent === 'singles' ? 'bg-[#fbbf24] text-black shadow-lg shadow-amber-500/10' : 'bg-[#111] text-zinc-400 border border-zinc-800 hover:bg-zinc-900'}`}>Sunday Singles</button>
              </div>
            </div>

            {/* SATURDAY DOUBLES — Compass Draw (16 teams) */}
            {bracketEvent === 'doubles' && (
              <div className="space-y-5">
                <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Award className="w-5 h-5 text-[#fbbf24]" />
                    <h3 className="text-base font-black text-white uppercase tracking-wider">Compass Draw · 16 Teams</h3>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
                    Every team is guaranteed multiple matches. A loss slides you to the next direction instead of sending you home.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs">
                    {[
                      ['East', 'Championship — all 16 teams', 'text-[#fbbf24]'],
                      ['West', 'Round-of-16 East losers (8)', 'text-zinc-200'],
                      ['North', 'Quarterfinal East losers (4)', 'text-zinc-200'],
                      ['South', 'First-round West losers (4)', 'text-zinc-200'],
                    ].map(([dir, desc, color]) => (
                      <div key={dir} className="bg-[#111] border border-zinc-800 rounded-xl p-3">
                        <div className={`font-black uppercase tracking-wider ${color}`}>{dir}</div>
                        <div className="text-zinc-500 mt-1 leading-snug">{desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {(() => {
                  let next = 1;
                  return [
                    ['East — Championship Draw', singleElim(16, true, seededNames('Doubles'))],
                    ['West Draw', singleElim(8, false)],
                    ['North Draw', singleElim(4, false)],
                    ['South Draw', singleElim(4, false)],
                  ].map(([title, rounds]) => {
                    const numbered = numberSeq(rounds, next); next = numbered.next;
                    return (
                      <div key={title} className="bg-[#151515] border border-zinc-800 rounded-3xl p-5 md:p-6">
                        <h4 className="text-sm font-black text-white uppercase tracking-wider mb-4">{title}</h4>
                        <Bracket rounds={numbered.rounds} />
                      </div>
                    );
                  });
                })()}

                <ResultsArchive event="doubles" />
              </div>
            )}

            {/* SUNDAY SINGLES — Double Elimination (32 players) */}
            {bracketEvent === 'singles' && (
              <div className="space-y-5">
                <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Trophy className="w-5 h-5 text-[#fbbf24]" />
                    <h3 className="text-base font-black text-white uppercase tracking-wider">Double Elimination · 32 Players</h3>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
                    Two losses and you're out. First-round losers drop into the losers bracket and can battle all the way back to the Grand Final.
                  </p>
                </div>

                <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-5 md:p-6">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider mb-4">Winners Bracket</h4>
                  <Bracket rounds={numberRounds(singleElim(32, true, seededNames('Singles')), [1, 25, 41, 53, 59])} />
                </div>

                <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-5 md:p-6">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider mb-4">Losers Bracket</h4>
                  <Bracket
                    rounds={numberRounds(losersBracket32(), [17, 33, 45, 49, 55, 57, 60, 61])}
                    names={['Losers R1', 'Losers R2', 'Losers R3', 'Losers R4', 'Losers R5', 'Losers R6', 'Losers R7', 'Losers Final']}
                  />
                </div>

                <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-5 md:p-6">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider mb-4">Grand Final <span className="text-[10px] font-mono font-normal text-zinc-500">· Match 62 (+ 63 if reset)</span></h4>
                  <div className="flex items-center gap-5 flex-wrap">
                    <div className="w-60 shrink-0 rounded-lg border border-[#fbbf24]/30 bg-[#111] divide-y divide-zinc-800">
                      <div className="px-3 py-2 text-xs text-zinc-200">Winners Bracket Champion</div>
                      <div className="px-3 py-2 text-xs text-zinc-200">Losers Bracket Champion</div>
                    </div>
                    <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                      If the Losers Bracket Champion wins, a deciding "bracket reset" set is played — the Winners Champion hadn't lost yet.
                    </p>
                  </div>
                </div>

                <ResultsArchive event="singles" />
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            TAB: PHOTOS
            ========================================== */}
        {activeTab === 'photos' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-[#151515] border border-zinc-800 p-6 md:p-8 rounded-3xl flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-wider">Tournament Gallery</h2>
                <p className="text-sm text-zinc-400 mt-2">Relive the highlights — rotating through every year of Aces for Arian.</p>
              </div>
              <ImageIcon className='w-12 h-12 text-zinc-800 hidden sm:block' />
            </div>

            {/* Self-hosted auto-slideshow across all years — no third-party scripts */}
            <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-2 md:p-3">
              <Slideshow images={GALLERY} />
            </div>

            {/* Full albums on Google Photos (one per year) */}
            <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-5 md:p-6">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">Browse the Full Albums</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {ALBUMS.map(a => (
                  <a key={a.year} href={a.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between bg-[#111] hover:bg-zinc-900 border border-zinc-800 hover:border-[#fbbf24]/40 rounded-xl px-4 py-3 transition-colors group">
                    <span className="text-sm font-bold text-white">{a.year}</span>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 group-hover:text-[#fbbf24] transition-colors">
                      Google Photos <ExternalLink className="h-3 w-3" />
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB: FORMAT & RULES
            ========================================== */}
        {activeTab === 'rules' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#151515] border border-zinc-800 p-6 md:p-8 rounded-3xl">
                <div className="w-12 h-12 rounded-xl bg-[#fbbf24]/10 text-[#fbbf24] flex items-center justify-center mb-6">
                  <Award className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-wider mb-1">Saturday Doubles</h3>
                <p className="text-xs text-zinc-500 mb-4">July 11 · first matches 9:00 AM</p>
                <ul className="space-y-4 text-sm text-zinc-400 leading-relaxed list-disc list-outside pl-4">
                  <li><strong className="text-zinc-200">Format:</strong> Compass Draw — every team is guaranteed at least 3 matches (up to 5).</li>
                  <li><strong className="text-zinc-200">Scoring:</strong> Best 2 of 3 Fast-4 sets (first to 4 games, no-ad; tiebreak at 3–3, first to 5 points).</li>
                  <li><strong className="text-zinc-200">Quarterfinals on:</strong> teams may switch to 2-of-3 regular sets if everyone in the round agrees.</li>
                  <li><strong className="text-zinc-200">Prizes:</strong> awarded to the top 3.</li>
                </ul>
              </div>
              <div className="bg-[#151515] border border-zinc-800 p-6 md:p-8 rounded-3xl">
                <div className="w-12 h-12 rounded-xl bg-[#5c1313]/30 text-rose-500 flex items-center justify-center mb-6">
                  <Trophy className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-wider mb-1">Sunday Singles</h3>
                <p className="text-xs text-zinc-500 mb-4">July 12 · first matches 8:00 AM</p>
                <ul className="space-y-4 text-sm text-zinc-400 leading-relaxed list-disc list-outside pl-4">
                  <li><strong className="text-zinc-200">Format:</strong> Double elimination — two losses to be out.</li>
                  <li><strong className="text-zinc-200">Scoring:</strong> 6-game no-ad sets.</li>
                  <li><strong className="text-zinc-200">Main-draw QF / SF / F:</strong> 8-game sets or best 2 of 3 Fast-4, as the players decide.</li>
                  <li><strong className="text-zinc-200">Awards:</strong> given to the top finishers.</li>
                </ul>
              </div>
            </div>

            <div className="bg-[#151515] border border-zinc-800 p-6 md:p-8 rounded-3xl">
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-black text-white uppercase tracking-wider">Check-In &amp; Conduct</h3>
              </div>
              <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm text-zinc-400 leading-relaxed list-disc list-outside pl-4">
                <li>Pay the <strong className="text-zinc-200">$40</strong> at sign-in before your first match — and grab your t-shirt.</li>
                <li>Held at the <strong className="text-zinc-200">Dunlap High School tennis courts</strong>.</li>
                <li><strong className="text-zinc-200">Arrive early and sign in.</strong> More than 15 minutes past match time is a default.</li>
                <li>Schedule conflict? Tell a coordinator <strong className="text-zinc-200">ASAP</strong>.</li>
              </ul>
            </div>

            {/* Day-of schedule (tentative, from the 2025 timeline) */}
            <div className="bg-[#151515] border border-zinc-800 p-6 md:p-8 rounded-3xl">
              <div className="flex items-center gap-3 mb-1">
                <Clock className="w-5 h-5 text-[#fbbf24]" />
                <h3 className="text-lg font-black text-white uppercase tracking-wider">Day-of Schedule</h3>
              </div>
              <p className="text-xs text-zinc-500 mb-6">Tentative — based on the 2025 timeline. Exact times are posted with the draw.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <div className="text-xs font-black uppercase tracking-widest text-[#fbbf24] mb-3">Saturday · Doubles</div>
                  {[["9:00 AM", "Round 1"], ["~10:00 AM", "Round 2"], ["~11:00 AM", "Round 3"], ["—", "Lunch break"], ["~1:15 PM", "Round 4"], ["~3:00 PM", "Final round"]].map(([t, l]) => (
                    <div key={l} className="flex items-baseline gap-3 py-1.5 border-b border-zinc-800/50 last:border-0">
                      <span className="text-xs font-mono font-bold text-[#fbbf24] w-20 shrink-0">{t}</span>
                      <span className="text-sm text-zinc-300">{l}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-widest text-[#fbbf24] mb-3">Sunday · Singles</div>
                  {[["8:00 AM", "First matches"], ["Morning", "Main & back-draw rounds"], ["Afternoon", "Quarterfinals → Final"]].map(([t, l]) => (
                    <div key={l} className="flex items-baseline gap-3 py-1.5 border-b border-zinc-800/50 last:border-0">
                      <span className="text-xs font-mono font-bold text-[#fbbf24] w-20 shrink-0">{t}</span>
                      <span className="text-sm text-zinc-300">{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* FAQ */}
            <div className="bg-[#151515] border border-zinc-800 p-6 md:p-8 rounded-3xl">
              <div className="flex items-center gap-3 mb-5">
                <BookOpen className="w-5 h-5 text-[#fbbf24]" />
                <h3 className="text-lg font-black text-white uppercase tracking-wider">FAQ</h3>
              </div>
              <div className="space-y-5">
                {[
                  ["What if it rains?", "Matches are weather-permitting. If rain moves in, coordinators will pause and reschedule as needed — keep an eye on your phone for updates."],
                  ["What should I bring?", "Your racquet, water, and court shoes. Balls, court snacks, and your tournament tee are provided."],
                  ["Can I get a refund?", "Entry fees go straight to the scholarship, so they're non-refundable — but you can transfer your spot to another player; just tell a coordinator."],
                ].map(([q, a]) => (
                  <div key={q}>
                    <div className="text-sm font-bold text-zinc-200">{q}</div>
                    <div className="text-sm text-zinc-400 mt-1 leading-relaxed">{a}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB: MERCH LOCKER
            ========================================== */}
        {activeTab === 'merch' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-[#151515] border border-zinc-800 p-6 md:p-8 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-center md:text-left">
                <h2 className="text-xl font-black text-white uppercase tracking-wider">2026 Gear Locker</h2>
                <p className="text-xs text-zinc-400 mt-1">To order standalone merch, text Ashwin or add it to your Venmo payment details.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: 'Player Tee', price: '$25', desc: 'Included with entry. Eagle Black.', svg: <path d="M40,50 L55,40 L70,48 L130,48 L145,40 L160,50 L150,85 L135,80 L135,170 L65,170 L65,80 L50,85 Z" fill="#222" /> },
                { title: 'Dad Hat', price: '$20', desc: 'Embroidered cardinal/gold on black cap.', svg: <path d="M50,110 C50,60 150,60 150,110 Z M40,112 Q100,105 160,112 C170,122 155,128 100,123 C45,128 30,122 40,112 Z" fill="#222" /> },
                { title: 'Wristbands', price: '$10', desc: 'Thick cardinal red bands with gold trim.', svg: <rect x="60" y="70" width="80" height="60" rx="5" fill="#5c1313" /> }
              ].map((item, i) => (
                <div key={i} className="bg-[#151515] border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between hover:border-zinc-700 transition">
                  <div>
                    <div className="bg-[#0a0a0a] rounded-2xl aspect-square flex items-center justify-center mb-6 border border-zinc-900 shadow-inner">
                      <svg viewBox="0 0 200 200" className="w-32 h-32 text-zinc-800">{item.svg}</svg>
                    </div>
                    <div className="flex justify-between items-baseline mb-2">
                      <h3 className="text-base font-bold text-white">{item.title}</h3>
                      <span className="text-[#fbbf24] font-mono font-bold text-sm">{item.price}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mb-2">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==========================================
            TAB: ARIAN'S LEGACY
            ========================================== */}
        {activeTab === 'legacy' && (
          <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-8 md:p-12 animate-fade-in relative overflow-hidden">
            <div className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-end">
              <ARLogo className="w-96 h-96 text-zinc-100 transform translate-x-1/4" />
            </div>
            
            <div className="flex flex-col lg:flex-row gap-10 items-center lg:items-start relative z-10">
              <div className="w-full sm:w-72 shrink-0">
                <div className="rounded-3xl overflow-hidden border border-[#fbbf24]/30 shadow-2xl bg-black">
                  <img src="/arian.jpg" alt="Arian Rahbar at the Dunlap High School tennis courts" className="w-full h-auto object-cover" loading="lazy" />
                </div>
                <div className="mt-3 text-center">
                  <div className="text-white font-black text-lg">Arian Rahbar</div>
                  <div className="text-[#fbbf24] font-mono text-xs tracking-wide">Dunlap Eagles · Class of 2019</div>
                </div>
              </div>

              <div className="flex-1 space-y-5">
                <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-wide">Remembering Arian</h2>
                <div className="w-12 h-1 bg-[#fbbf24] rounded-full"></div>
                <p className="text-zinc-400 text-sm leading-relaxed md:text-base">
                  Arian was one of those people who made everything more fun — especially the tennis court. Sure, he could play (a 100-win Dunlap Eagle and a State qualifier in both singles and doubles), but if you knew him, it's the energy and the grin you remember, not the trophies.
                </p>
                <p className="text-zinc-400 text-sm leading-relaxed md:text-base">
                  He was also low-key brilliant — near-perfect grades, headed to USC for Computer Science with a Facebook internship lined up — and one of the original champions of this tournament back when it was still the Eagle Classic (doubles, with Venil).
                </p>
                <p className="text-zinc-400 text-sm leading-relaxed md:text-base">
                  We lost Arian in December 2021. So every summer we get the community back on the courts to play the way he did — all heart, lots of laughs. Whatever we raise goes to the <strong className="text-zinc-200">Arian Rahbar Memorial Scholarship</strong> for Dunlap seniors chasing their next thing.
                </p>
              </div>
            </div>

            <div className="relative z-10 mt-8 pt-6 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="text-sm font-black text-white uppercase tracking-wider">Support the Scholarship</div>
                <div className="text-xs text-zinc-400 mt-1 leading-relaxed">100% of entry fees and donations fund the Arian Rahbar Memorial Scholarship for Dunlap seniors pursuing higher education.</div>
              </div>
              <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-2 bg-[#fbbf24] hover:bg-amber-400 text-black font-black text-sm uppercase tracking-wider px-6 py-3.5 rounded-xl transition-colors shadow-lg shadow-amber-500/10">
                <Heart className="w-4 h-4" />
                <span>Donate to the Scholarship</span>
              </a>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB: SCHOLARSHIP
            ========================================== */}
        {activeTab === 'scholarship' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-gradient-to-br from-[#1c1408] to-[#151515] border border-[#fbbf24]/30 rounded-3xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-2">
                <GraduationCap className="w-6 h-6 text-[#fbbf24] shrink-0" />
                <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider">Arian Rahbar Memorial Tennis Scholarship</h2>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed max-w-3xl">
                An award honoring Arian's legacy of academic excellence and radiating positivity on the court — granted to graduating Dunlap tennis seniors through a short essay and their record as scholar-athletes.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[#151515] border border-zinc-800 rounded-3xl p-6 md:p-8">
                <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4">The Essay <span className="text-zinc-500 font-bold normal-case">· 500 words or less</span></h3>
                <blockquote className="border-l-2 border-[#fbbf24] pl-4 text-sm md:text-base text-zinc-300 italic leading-relaxed">
                  “While at DHS, Arian embodied sportsmanship qualities such as positivity, discipline, competitiveness, and a continuous desire to learn on the court and in the classroom. Reflect on the importance of sportsmanship in both athletics and academics, drawing from personal experiences on the DHS tennis team. How do you plan to apply these values in your college life?”
                </blockquote>
              </div>
              <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-6 md:p-8">
                <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4">How It's Judged</h3>
                <ul className="space-y-3 text-sm text-zinc-400">
                  <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-zinc-200">Scholar-athlete synthesis</strong> — excellence in the classroom and on court.</span></li>
                  <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-zinc-200">Varsity tenure</strong> — commitment to the program.</span></li>
                  <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-zinc-200">Exceptional sportsmanship</strong> — how you carry yourself, win or lose.</span></li>
                </ul>
                <p className="text-xs text-zinc-500 mt-4 leading-relaxed">Scored on the essay together with your scholar-athlete record.</p>
              </div>
            </div>

            <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 className="w-5 h-5 text-[#fbbf24]" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Eligibility &amp; Requirements</h3>
              </div>
              <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3.5 text-sm text-zinc-400 leading-relaxed">
                <li className="flex gap-2.5"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /><span>Be a <strong className="text-zinc-200">DHS senior</strong>.</span></li>
                <li className="flex gap-2.5"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /><span>Cumulative <strong className="text-zinc-200">GPA of 3.25 or higher</strong>.</span></li>
                <li className="flex gap-2.5"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-zinc-200">Tennis tenure:</strong> two years on Varsity, or three years on the team (including senior year).</span></li>
                <li className="flex gap-2.5"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /><span>A <strong className="text-zinc-200">500-word-or-less essay</strong> answering the prompt above.</span></li>
                <li className="flex gap-2.5"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /><span>An official <strong className="text-zinc-200">DHS transcript</strong> (order through Parchment).</span></li>
              </ul>
            </div>

            <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-6 md:p-8">
              <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4">Past Recipients</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SCHOLARSHIP_WINNERS.map(w => (
                  <div key={w.year} className="bg-[#111] border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#fbbf24]/10 text-[#fbbf24] flex items-center justify-center shrink-0"><GraduationCap className="w-5 h-5" /></div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{w.year}</div>
                      <div className="text-sm font-bold text-white">{w.names.join(' · ')}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 bg-[#111] border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">2022 – 2023</div>
                  <div className="text-sm font-bold text-white">A Bench in Arian's Memory</div>
                  <div className="text-xs text-zinc-400 mt-1 leading-relaxed">The 2022 and 2023 tournaments helped place a memorial bench at the Dunlap courts — a lasting spot for the team to gather and remember.</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <img src="/bench1.jpg" alt="The Arian memorial bench at the Dunlap courts" className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover border border-zinc-800" loading="lazy" />
                  <img src="/bench2.jpg" alt="The Arian memorial bench at the Dunlap courts" className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover border border-zinc-800" loading="lazy" />
                </div>
              </div>
            </div>

            {/* Application link — kept low-key off-season; promote in spring */}
            <div className="text-center pt-1">
              <a href={SCHOLARSHIP_APPLY_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-[#fbbf24] transition-colors">
                <span>Scholarship Application — opens each spring</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

      </main>

      {/* --- FOOTER --- */}
      <footer className="bg-black py-10 text-center text-xs text-zinc-600 border-t border-zinc-900 mt-auto">
        <p className="uppercase tracking-widest font-bold mb-2">Aces for Arian 2026</p>
        <p>Built for DHS '19 & The Dunlap Tennis Community.</p>
      </footer>
    </div>
  );
}
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ROSTER_CSV_URL,
  CONFIG_CSV_URL,
  SEED_BOARD_PUBLIC_CSV_URL,
  PHOTOS_CSV_URL,
  MATCHES_CSV_URL,
  ACES_CSV_URL,
  OPSSTATUS_CSV_URL,
  SHEET_WRITE_URL,
  MERCH_ITEMS,
  MERCH_BUNDLE,
  TEE_PRICE,
  fallbackRoster,
  parseCSV,
  mapRoster,
  mapConfig,
  mapSeeds,
  mapGallery,
  mapMatches,
  mapAces,
  mapOpsStatus,
} from './lib/sheet';
import { DRAW_CAP, SEED_CUT, deriveEntrants } from './lib/entrants';
import {
  Trophy, 
  Award, 
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
  GraduationCap,
  Menu,
  X,
  ChevronRight,
  Mail,
  Share2
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

// Tennis-ball glyph for the Live Ace Tracker — drawn in brand colors (amber
// ball, maroon seams) so it reads as "tennis" without a new accent color.
function TennisBallIcon({ className = "w-12 h-12" }) {
  return (
    <svg viewBox="0 0 100 100" className={className}>
      <circle cx="50" cy="50" r="46" fill="#fbbf24" />
      <path d="M10,28 C32,44 32,56 10,72" stroke="#5c1313" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M90,28 C68,44 68,56 90,72" stroke="#5c1313" strokeWidth="6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// "Add to calendar" — builds a self-hosted .ics on the fly (no third-party
// widget/tracker) so it imports into Apple/Google/Outlook alike. Times are
// tentative: first serve ~9 AM Sat (Central); the event spans both days.
function AddToCalendarButton({ className = "" }) {
  const href = useMemo(() => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Aces for Arian//Tournament//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:aces-for-arian-2026@aces-for-arian.pages.dev',
      'DTSTAMP:20260101T000000Z',
      'DTSTART:20260711T140000Z', // Sat Jul 11, ~9:00 AM CDT
      'DTEND:20260712T220000Z',   // Sun Jul 12, ~5:00 PM CDT
      'SUMMARY:Aces for Arian 2026 — Memorial Tennis Tournament',
      'LOCATION:Dunlap High School\\, Dunlap\\, IL',
      'DESCRIPTION:5th Annual Aces for Arian. Doubles Sat July 11\\, Singles Sun July 12. First serve tentatively 9 AM Saturday (start times vary by final counts). Register: https://aces-for-arian.pages.dev/',
      'URL:https://aces-for-arian.pages.dev/',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    return URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  }, []);
  return (
    <a href={href} download="aces-for-arian-2026.ics" className={className}>
      <Calendar className="w-3.5 h-3.5" /> Add to calendar
    </a>
  );
}

// "Share / invite" — native share sheet on mobile (Web Share API), clipboard
// copy as the desktop fallback. Feeds the field-momentum loop on the Home tab.
function ShareInvite({ className = "" }) {
  const [copied, setCopied] = useState(false);
  const url = 'https://aces-for-arian.pages.dev/';
  const text = 'Play in the 5th Annual Aces for Arian — July 11–12 at Dunlap. Singles, doubles, or both:';
  const onShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: 'Aces for Arian 2026', text, url }); return; }
      catch (e) { if (e?.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — no-op */ }
  };
  return (
    <button onClick={onShare} className={className}>
      <Share2 className="w-3.5 h-3.5" /> {copied ? 'Link copied!' : 'Share / invite'}
    </button>
  );
}

// Past champions + downloadable result archives, per event (singles | doubles).
function HallOfFame() {
  const champs2025 = [
    { label: '2025 Singles Champion', name: 'Alex', single: true, format: '32-player double elimination', podium: [{ place: '2nd', name: 'Andrew' }, { place: '3rd', name: 'Shaan' }], pdf: '/archive/aces-for-arian-2025-singles.pdf' },
    { label: '2025 Doubles Champions', name: 'Greyson & Andy', single: false, format: '16-team compass draw', podium: [], pdf: '/archive/aces-for-arian-2025-doubles.pdf' },
  ];
  const past = [
    { label: '2024 Results', url: '/archive/aces-for-arian-2024-results.pdf' },
    { label: '2023 Results', url: '/archive/aces-for-arian-2023-results.pdf' },
    { label: '2022 Results', url: '/archive/aces-for-arian-2022-results.pdf' },
  ];
  // Dunlap Eagles' IHSA Class 1A boys tennis state hardware. The 2017 title is
  // Arian's — he was part of that championship team (see "Remembering Arian").
  const stateHonors = [
    { year: '2017', place: 'State Champions', accent: true, note: "Arian's championship team." },
    { year: '2024', place: 'State Runner-Up', note: 'Class 1A boys tennis.' },
    { year: '2022', place: 'State Third Place', note: 'Class 1A boys tennis.' },
  ];
  return (
    <>
      {/* The champion's trophy — every A4A division winner takes one home */}
      <div className="bg-gradient-to-br from-[#1c1408] to-[#151515] border border-[#fbbf24]/30 rounded-3xl p-5 md:p-6 flex items-center gap-4">
        <Trophy className="w-9 h-9 text-[#fbbf24] shrink-0" />
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[#fbbf24]">The hardware</div>
          <div className="text-sm font-black text-white">Every Aces for Arian division winner takes home the flame trophy</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Tennis-ball-and-racquet award, engraved "Aces for Arian" with the year and division.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {champs2025.map(champ => (
          <div key={champ.label} className="bg-gradient-to-br from-[#1c1408] to-[#151515] border border-[#fbbf24]/30 rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/20 rounded px-2 py-0.5">2025</span>
              <h4 className="text-sm font-black text-white uppercase tracking-wider">{champ.label}</h4>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <Trophy className="w-10 h-10 text-[#fbbf24] shrink-0" />
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500">{champ.single ? 'Champion' : 'Champions'}</div>
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
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-[#fbbf24] transition-colors">
                <span>Full bracket (PDF)</span><ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Dunlap's IHSA state honors — program legacy, anchored by Arian's 2017 title */}
      <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-5 md:p-6">
        <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">Dunlap Tennis · IHSA State Honors</h4>
        <p className="text-[11px] text-zinc-500 mb-4">The Eagles' Class 1A boys tennis state hardware — anchored by the 2017 championship Arian helped bring home.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {stateHonors.map(h => (
            <div key={h.year} className={`rounded-2xl p-4 border ${h.accent ? 'bg-gradient-to-br from-[#1c1408] to-[#151515] border-[#fbbf24]/30' : 'bg-[#111] border-zinc-800'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Trophy className={`w-6 h-6 shrink-0 ${h.accent ? 'text-[#fbbf24]' : 'text-zinc-500'}`} />
                <span className={`text-lg font-black leading-none ${h.accent ? 'text-[#fbbf24]' : 'text-zinc-300'}`}>{h.year}</span>
              </div>
              <div className="text-sm font-black text-white uppercase tracking-wide">{h.place}</div>
              <div className="text-[11px] text-zinc-500 mt-1">{h.note}</div>
            </div>
          ))}
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
// Two portrait hero slideshows flanking the register blurb. Split across the
// two sets so each side shows a different rotation; which set lands on which
// side (and the starting frame of each) is randomized per visit.
const HERO_SET_A = ["photo1.jpg", "photo2.jpg", "photo3.jpg", "photo4.jpg", "photo5.jpg"];
const HERO_SET_B = ["photo6.jpg", "photo7.jpg", "photo8.jpg", "photo9.jpg", "photo10.jpg", "photo11.jpg"];

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
// Add an optional `amount` (e.g. amount: 1000) per year to light up the
// running dollar total in <ScholarsList>; without it, the stat shows scholar count.
const SCHOLARSHIP_WINNERS = [
  { year: "2026", names: ["Anton Dahlin", "Noelle Daccache"], amount: 1500 },
  { year: "2025", names: ["Carolina Gusso", "Alex Fei"], amount: 1000 },
  { year: "2024", names: ["Sophie Muir", "Shikha Agarwal"], amount: 1000 },
];

// Flattened, captioned slides across every album.
const GALLERY = ALBUMS.flatMap(a => a.images.map(src => ({ src, caption: a.year })));

// ==========================================
// 2. THE SINGLE SOURCE OF TRUTH (DATA)
// ==========================================

// The CSV data pipeline (Google Sheet URLs, parsing, mapping) is shared with
// the ops admin panel — see src/lib/sheet.js for the full tab-by-tab rundown.

// Tournament Venmo — entry fees + donations. The URL is the account's
// QR-code permalink (opens the Venmo app to pay @acesforarian directly when
// tapped on mobile — handy for courtside payments), so it doubles as both
// the "Donate" link and the Step 2 entry-fee link below.
const VENMO_HANDLE = "@acesforarian";
const VENMO_URL = "https://venmo.com/code?user_id=4618810715800962447&created=1781373203.858971&printed=1";
// Where the header "Donate" button sends people.
const DONATE_URL = VENMO_URL;

// The Google Form players register through — reused by every "Register" CTA.
const REGISTER_FORM_URL = "https://forms.gle/rLnyakinZfkSePpv7";

// Baseline seeding: prior A4A results first, then public UTR / WTN where players
// have them, then committee + community refinement. result/utr/wtn are optional.
const topSeeds = [
  // Singles
  { name: "Alex", type: "Singles", rank: 1, result: "2025 Champion", notes: "Reigning singles champion — automatic top seed." },
  { name: "Andrew", type: "Singles", rank: 2, result: "2025 Finalist", notes: "Stormed the back draw to the final last year." },
  { name: "Shaan", type: "Singles", rank: 3, result: "2025 3rd", notes: "2025 No. 1 seed." },
  { name: "Ashwin Yedavalli", type: "Singles", rank: 4, utr: "7.2", notes: "what's a backhand?" },
  { name: "Venil Tummarakota", type: "Singles", rank: 5, utr: "7.0", notes: "Can't buy a second serve." },
  { name: "Aanan Kashyap", type: "Singles", rank: 6, utr: "6.9", notes: "DHS singles mainstay." },
  { name: "Imadh Khan", type: "Singles", rank: 7, notes: "Triad champ" },
  { name: "David Wu", type: "Singles", rank: 8, notes: "Does he still play?" },
  // Doubles
  { name: "Greyson & Andy", type: "Doubles", rank: 1, result: "2025 Champions", notes: "We talkin' bout practice" },
  { name: "Doug & Graham", type: "Doubles", rank: 2, notes: "Da boys" },
  { name: "Aanan & Shaan", type: "Doubles", rank: 3, notes: "Bro life" },
  { name: "Atishay & Ashwin", type: "Doubles", rank: 4, notes: "DUPR don't lie" }
];

// Seeding lifecycle: Projected Seed → Final Seed. Flip to true once the
// committee locks the field at the entry cutoff (or set the Config tab's
// "Seeds Final" row, which overrides this constant).
const SEEDS_FINAL = false;

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
// Seed names for an event, ordered by rank (seed 1 first) — drives bracket
// auto-seeding. Reads from a seed list (live `seeds` state in App, which the
// admin-published SeedBoardPublic tab replaces on every page load — so a
// refresh repopulates the brackets in the committee's latest order).
const seedNamesFrom = (seedList, type) =>
  seedList.filter(s => s.type === type).sort((a, b) => a.rank - b.rank).map(s => s.name);

// Only positions 1–8 are true seeds; 9–16 and 17–32 place as GROUPS (their
// order in the seed list sets bracket position, but they aren't individually
// ranked — see bandLabel in Slot). When `fieldLocked` (committee locked the
// field at the entry cutoff), an unfilled R1 slot opposite a named entrant
// renders as a BYE — and because slot names fill positions 1..k in seed
// order while seedOrder pairs 1v16, 2v15, …, byes automatically go to the
// top seeds first, per standard draw rules.
function singleElim(n, seeded = true, names = [], fieldLocked = false) {
  const order = seedOrder(n);
  const slot = (pos) => (seeded ? { seed: pos, name: names[pos - 1] || null } : {});
  const r1 = [];
  for (let i = 0; i < n; i += 2) {
    const a = slot(order[i]), b = slot(order[i + 1]);
    if (fieldLocked && seeded) {
      if (a.name && !b.name) b.bye = true;
      if (b.name && !a.name) a.bye = true;
    }
    r1.push({ a, b });
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

// Seed badge: shown ONLY for the true seeds (1..SEED_CUT). Positions 9+ are
// deliberately unlabeled — publicly they read the same as unseeded entrants,
// so nobody sees themselves ranked near the bottom of the draw. SEED_CUT/
// DRAW_CAP live in lib/entrants.js, shared with the admin seed list.
function Slot({ slot }) {
  const bye = !!(slot && slot.bye);
  return (
    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
      <span className={`text-[11px] truncate ${slot && slot.name ? 'text-zinc-200' : bye ? 'text-zinc-500 italic' : 'text-zinc-600'}`}>
        {slot && slot.name ? slot.name : bye ? 'BYE' : 'TBD'}
      </span>
      {slot && slot.seed != null && slot.seed <= SEED_CUT && !bye && (
        <span className="shrink-0 text-[9px] font-mono font-bold rounded px-1.5 border text-[#fbbf24]/90 bg-[#fbbf24]/10 border-[#fbbf24]/20">
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

// Compact portrait hero slideshow: random starting frame on entry, then
// auto-advances cyclically with a soft crossfade. No third-party scripts.
function HeroCanvas({ images, className = "" }) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * images.length));
  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => setIdx(i => (i + 1) % images.length), 4500);
    return () => clearInterval(id);
  }, [images.length]);

  return (
    <div className={`relative aspect-[2/3] flex-shrink-0 bg-black rounded-2xl overflow-hidden border border-zinc-800 group ${className}`}>
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt="Aces for Arian tournament highlight"
          loading={i === 0 ? 'eager' : 'lazy'}
          draggable={false}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i === idx ? 'opacity-100' : 'opacity-0'} group-hover:scale-105`}
        />
      ))}
      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
        {images.map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? 'w-4 bg-[#fbbf24]' : 'w-1.5 bg-white/40'}`} />
        ))}
      </div>
    </div>
  );
}

// Shared "scholars we've funded" block — a running total, the recipients grid,
// and the memorial-bench card. Rendered in BOTH the Scholarship tab (credibility
// next to apply/donate) and the Legacy tab (tribute), so the two never drift.
// Add a per-year `amount` to SCHOLARSHIP_WINNERS to light up the dollar total.
function ScholarsList({ showDonate = false }) {
  const scholarCount = SCHOLARSHIP_WINNERS.reduce((n, w) => n + w.names.length, 0);
  const totalAwarded = SCHOLARSHIP_WINNERS.reduce((s, w) => s + (w.amount || 0), 0);
  const years = SCHOLARSHIP_WINNERS.map(w => parseInt(w.year, 10)).filter(Boolean);
  const since = years.length ? Math.min(...years) : null;
  return (
    <>
      <div className="bg-gradient-to-br from-[#1c1408] to-[#151515] border border-[#fbbf24]/30 rounded-2xl p-5 mb-4 flex items-center gap-4">
        <GraduationCap className="w-8 h-8 text-[#fbbf24] shrink-0" />
        <div>
          <div className="text-2xl font-black text-white leading-none">
            {totalAwarded > 0 ? `$${totalAwarded.toLocaleString()}` : scholarCount}
            <span className="text-sm font-bold text-zinc-400"> {totalAwarded > 0 ? `· ${scholarCount} scholars` : 'scholars'}</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">awarded {since ? `since ${since}` : 'to date'} through Aces for Arian</div>
        </div>
      </div>

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
          <img src="/Bench1.jpg" alt="The Arian memorial bench at the Dunlap courts" className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover border border-zinc-800" loading="lazy" />
          <img src="/Bench2.jpg" alt="The Arian memorial bench at the Dunlap courts" className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover border border-zinc-800" loading="lazy" />
        </div>
      </div>

      {showDonate && (
        <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#fbbf24] hover:text-amber-300 transition-colors">
          <Heart className="w-4 h-4" /><span>Fund the next scholar — donate</span>
        </a>
      )}
    </>
  );
}

// Every tab in one place — the source of truth for both the sticky strip and
// the mobile "Explore" menu. `blurb` is the 1-line "what's here" hook that turns
// the menu into a discovery tool, not just navigation.
const TABS = [
  { id: 'home', label: 'Home', icon: Home, blurb: 'Register, roster & day-of basics' },
  { id: 'rules', label: 'Rules', icon: BookOpen, blurb: 'Format, schedule & FAQ' },
  { id: 'draws', label: 'Brackets', icon: Award, blurb: 'Your match, live court board & scores' },
  { id: 'scholarship', label: 'Scholarship', icon: GraduationCap, blurb: 'Apply, recipients & the cause' },
  { id: 'legacy', label: 'Legacy', icon: Heart, blurb: "Arian's story, Hall of Fame & past results" },
  { id: 'photos', label: 'Photos', icon: ImageIcon, blurb: 'Tournament memories, 2020 to today' },
  { id: 'merch', label: 'Merch', icon: ShoppingBag, blurb: 'Tournament tees & gear' },
];

// Deep-linkable tabs: friendly URL hash slugs (#brackets, #seeding, …) so the
// admin can link straight to "what players see", and links are shareable. The
// only non-obvious one is the "draws" tab, whose public label is "Brackets".
const TAB_SLUGS = { draws: 'brackets' };
const slugForTab = (id) => TAB_SLUGS[id] || id;
const tabForSlug = (slug) => {
  if (!slug) return null;
  // The public "Seeds" tab was retired (seed order is committee-private; the
  // draw is the only public surface) — send old #seeding links to Brackets.
  if (slug === 'seeding') return 'draws';
  if (TABS.some(t => t.id === slug)) return slug;
  const alias = Object.entries(TAB_SLUGS).find(([, s]) => s === slug);
  return alias ? alias[0] : null;
};

// Public "got an idea?" box — fire-and-forget POST to the Apps Script (type
// 'idea'), which emails the organizers. no-cors means we can't read a response,
// so we confirm optimistically.
function IdeaBox() {
  const [text, setText] = useState('');
  const [from, setFrom] = useState('');
  const [sent, setSent] = useState(false);
  if (!SHEET_WRITE_URL) return null;
  const submit = (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    try {
      fetch(SHEET_WRITE_URL, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ type: 'idea', payload: { text: body.slice(0, 3000), from: from.trim().slice(0, 150) } }),
      }).catch(() => {});
    } catch { /* fire and forget */ }
    setText(''); setFrom(''); setSent(true);
  };
  return (
    <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-6 md:p-7">
      <h3 className="text-sm font-black text-white uppercase tracking-wider">Got an idea?</h3>
      <p className="text-xs text-zinc-400 mt-1 mb-4 max-w-2xl leading-relaxed">A new event, a format tweak, a sponsor, something for next year — send it straight to the organizers.</p>
      {sent ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-300">
          Thanks — your idea's on its way. <button onClick={() => setSent(false)} className="text-emerald-400/80 hover:text-emerald-200 underline underline-offset-2 ml-1">Send another</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-2.5">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={3000}
            placeholder="Your idea…"
            className="w-full bg-[#111] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-[#fbbf24]/40 transition-colors resize-y" />
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input value={from} onChange={(e) => setFrom(e.target.value)} maxLength={150}
              placeholder="Name or email (optional, so we can reply)"
              className="sm:flex-1 bg-[#111] border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-[#fbbf24]/40 transition-colors" />
            <button type="submit" disabled={!text.trim()}
              className="shrink-0 inline-flex items-center justify-center gap-2 bg-[#fbbf24] hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition-colors">
              Send idea
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// Public "suggest the seeds" tool — open until the committee locks the field
// (seedsFinal hides it). A word bank of REGISTERED entrants only, built with
// deriveEntrants — the same helper the ops console uses — so doubles teams
// are pre-merged and singles-only vs doubles-only entrants land in the right
// bank (no free typing, no misspelled names). Tapping builds a ranked top-10
// per event; submitting emails the committee through the existing token-less
// 'idea' pipeline (handleIdea_ in apps-script/ops-write-back.js). Deliberately
// email-only: raw participant submissions must never be stored in the
// link-viewable sheet — see the PUBLIC / COMMITTEE DATA SEPARATION note in
// lib/sheet.js. Entrant chips show display names ONLY (no committee flags).
const SUGGEST_EVENTS = ['Singles', 'Doubles'];
const SUGGEST_MAX = 10;

function SeedSuggestionBox({ participants, seedsFinal }) {
  const [event, setEvent] = useState('Singles');
  const [picks, setPicks] = useState({ Singles: [], Doubles: [] }); // ranked display names
  const [from, setFrom] = useState('');
  const [sent, setSent] = useState(false);

  const banks = useMemo(() => ({
    Singles: deriveEntrants(participants, 'Singles'),
    Doubles: deriveEntrants(participants, 'Doubles'),
  }), [participants]);

  if (!SHEET_WRITE_URL || seedsFinal) return null;

  const list = picks[event];
  const bank = banks[event].filter(e => !list.includes(e.display));
  const full = list.length >= SUGGEST_MAX;

  const setList = (next) => setPicks(p => ({ ...p, [event]: next }));
  const add = (name) => { if (!full && !list.includes(name)) setList([...list, name]); };
  const removeAt = (i) => setList(list.filter((_, j) => j !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
  };

  const submit = () => {
    const sections = SUGGEST_EVENTS
      .filter(ev => picks[ev].length)
      .map(ev => `${ev}:\n` + picks[ev].map((n, i) => `${i + 1}. ${n}`).join('\n'));
    if (!sections.length) return;
    const text = `SEED SUGGESTION — top ${SUGGEST_MAX}\n\n${sections.join('\n\n')}`;
    try {
      fetch(SHEET_WRITE_URL, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ type: 'idea', payload: { text: text.slice(0, 3000), from: from.trim().slice(0, 150) } }),
      }).catch(() => {});
    } catch { /* fire and forget */ }
    setSent(true);
  };

  const rowBtn = 'min-w-8 min-h-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors shrink-0';

  return (
    <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-6 md:p-7">
      <h3 className="text-sm font-black text-white uppercase tracking-wider">Suggest the seeds</h3>
      <p className="text-xs text-zinc-400 mt-1 mb-4 max-w-2xl leading-relaxed">
        Think you know the field? Tap registered players and teams into your top {SUGGEST_MAX} — order matters — and send it straight to the seeding committee. Advisory only (the committee weighs suggestions against results, UTR/WTN, and its own review), and open until the draw locks.
      </p>
      {sent ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-300">
          Thanks — your picks are with the committee. <button onClick={() => setSent(false)} className="text-emerald-400/80 hover:text-emerald-200 underline underline-offset-2 ml-1">Suggest again</button>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-4">
            {SUGGEST_EVENTS.map(ev => (
              <button key={ev} onClick={() => setEvent(ev)}
                className={`whitespace-nowrap px-4 py-2 text-[11px] font-black uppercase tracking-wider rounded-xl transition ${event === ev ? 'bg-[#fbbf24] text-black' : 'bg-[#111] text-zinc-400 border border-zinc-800 hover:bg-zinc-900'}`}>
                {ev === 'Singles' ? 'Sunday Singles' : 'Saturday Doubles'}{picks[ev].length > 0 && ` · ${picks[ev].length}`}
              </button>
            ))}
          </div>

          {list.length > 0 && (
            <ol className="space-y-1.5 mb-4">
              {list.map((n, i) => (
                <li key={n} className="flex items-center gap-2 bg-[#111] border border-zinc-800 rounded-xl px-3 py-1.5">
                  <span className="w-6 h-6 shrink-0 rounded-md bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-[#fbbf24] flex items-center justify-center text-[11px] font-black">{i + 1}</span>
                  <span className="flex-1 min-w-0 text-sm font-bold text-zinc-200 truncate">{n}</span>
                  <button onClick={() => move(i, -1)} aria-label={`Move ${n} up`} className={rowBtn}>↑</button>
                  <button onClick={() => move(i, 1)} aria-label={`Move ${n} down`} className={rowBtn}>↓</button>
                  <button onClick={() => removeAt(i)} aria-label={`Remove ${n}`} className="min-w-8 min-h-8 flex items-center justify-center rounded-md text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0">×</button>
                </li>
              ))}
            </ol>
          )}

          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">
            {event} field — tap to add{full ? ' · your ten are set' : ` · ${SUGGEST_MAX - list.length} spots left`}
          </div>
          {bank.length === 0 ? (
            <p className="text-xs text-zinc-600 mb-4">{full ? 'Reorder above or send it in.' : 'No registered entrants yet — check back once signups land.'}</p>
          ) : (
            <div className="flex flex-wrap gap-2 mb-4">
              {bank.map(e => (
                <button key={e.key} onClick={() => add(e.display)} disabled={full}
                  className="text-xs font-bold text-zinc-300 bg-[#111] border border-zinc-800 hover:border-[#fbbf24]/40 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-3 py-2 transition-colors">
                  {e.display}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input value={from} onChange={(e) => setFrom(e.target.value)} maxLength={150}
              placeholder="Name or email (optional, so the committee can follow up)"
              className="sm:flex-1 bg-[#111] border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-[#fbbf24]/40 transition-colors" />
            <button onClick={submit} disabled={!picks.Singles.length && !picks.Doubles.length}
              className="shrink-0 inline-flex items-center justify-center gap-2 bg-[#fbbf24] hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition-colors">
              Send my picks
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Public "notify me about next year" capture — fire-and-forget POST to the Apps
// Script (type 'subscribe'), which appends to a PRIVATE Subscribers tab (never in
// the public read allowlist). no-cors means we can't read a response, so we
// confirm optimistically. Mirrors IdeaBox. `source` tags where the signup came from.
function NotifyMeBox({ source = 'site' }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  if (!SHEET_WRITE_URL) return null;
  const valid = (s) => /\S@\S/.test(s.trim());
  const submit = (e) => {
    e.preventDefault();
    const em = email.trim();
    if (!valid(em)) return;
    try {
      fetch(SHEET_WRITE_URL, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ type: 'subscribe', payload: { email: em.slice(0, 500), source } }),
      }).catch(() => {});
    } catch { /* fire and forget */ }
    setEmail(''); setSent(true);
  };
  return (
    <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-6 md:p-7">
      <div className="flex items-center gap-2.5">
        <Mail className="h-4 w-4 text-[#fbbf24] shrink-0" />
        <h3 className="text-sm font-black text-white uppercase tracking-wider">Get next year's date + updates</h3>
      </div>
      <p className="text-xs text-zinc-400 mt-1 mb-4 max-w-2xl leading-relaxed">Drop your email and we'll send you the date, the registration link, and tournament news for next year — nothing else.</p>
      {sent ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-300">
          Thanks — we'll send you next year's date and updates. <button onClick={() => setSent(false)} className="text-emerald-400/80 hover:text-emerald-200 underline underline-offset-2 ml-1">Add another</button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2.5">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" maxLength={500}
            placeholder="you@email.com"
            className="sm:flex-1 bg-[#111] border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-[#fbbf24]/40 transition-colors" />
          <button type="submit" disabled={!valid(email)}
            className="shrink-0 inline-flex items-center justify-center gap-2 bg-[#fbbf24] hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition-colors">
            Notify me
          </button>
        </form>
      )}
    </div>
  );
}

// ==========================================
// 3. MAIN APPLICATION
// ==========================================

export default function App() {
  const [activeTab, setActiveTab] = useState(() => tabForSlug((typeof location !== 'undefined' ? location.hash : '').replace(/^#/, '')) || 'home');
  const [bracketEvent, setBracketEvent] = useState('doubles');
  // Randomize which photo set lands on the left vs. right on each visit.
  const [heroSwap] = useState(() => Math.random() < 0.5);
  const heroLeft = heroSwap ? HERO_SET_B : HERO_SET_A;
  const heroRight = heroSwap ? HERO_SET_A : HERO_SET_B;
  const [rawRoster, setRawRoster] = useState(fallbackRoster);
  const [rosterLive, setRosterLive] = useState(false);
  const [opsStatus, setOpsStatus] = useState({}); // OpsStatus tab: name -> Verified/Pending overlay
  const [config, setConfig] = useState({});        // from the "Config" tab
  const [seeds, setSeeds] = useState(topSeeds);     // from the sanitized "SeedBoardPublic" tab — never raw committee data
  const [seedsLive, setSeedsLive] = useState(false); // true once real SeedBoardPublic rows loaded (vs topSeeds fallback)
  const [gallery, setGallery] = useState(GALLERY);  // from the "Photos" tab
  const [matches, setMatches] = useState([]);       // live scores, from the "Matches" tab
  const [matchesLive, setMatchesLive] = useState(false);
  const [matchesUpdated, setMatchesUpdated] = useState('');
  const [matchesLastOkAt, setMatchesLastOkAt] = useState(0);
  const [aces, setAces] = useState(0);              // live ace count, from the "Aces" tab
  const [acesLive, setAcesLive] = useState(false);
  const [now, setNow] = useState(() => Date.now()); // 30s heartbeat clock so "Live" badges can go stale on their own
  const [menuOpen, setMenuOpen] = useState(false);  // mobile "Explore" tab menu
  const [ledgerFilter, setLedgerFilter] = useState('all'); // ledger: all | singles | doubles
  const [matchQuery, setMatchQuery] = useState(''); // day-of "find my match" search
  const navRef = useRef(null);

  // Field-lock lifecycle: the Config tab's "Seeds Final" row (set from the
  // ops console or by hand in the sheet) overrides the SEEDS_FINAL constant.
  // Locked = seeds badge flips to "Final Seeds" and the brackets show BYEs
  // for unfilled first-round slots instead of TBD. Byes additionally require
  // seedsLive: config and the seed board load independently, so without this
  // gate a locked flag + failed/slow seed fetch would draw authoritative-
  // looking BYEs against the hardcoded fallback names.
  const seedsFinal = config.seedsFinal ?? SEEDS_FINAL;
  const showByes = seedsFinal && seedsLive;

  // Auto-sync the roster from the published Google Sheet; fails over silently
  // to fallbackRoster so the dashboard never breaks.
  useEffect(() => {
    if (!ROSTER_CSV_URL) return;
    let cancelled = false;
    fetch(ROSTER_CSV_URL)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(text => {
        const players = mapRoster(parseCSV(text));
        if (!cancelled && players.length) { setRawRoster(players); setRosterLive(true); }
      })
      .catch(() => { /* keep fallbackRoster */ });
    return () => { cancelled = true; };
  }, []);

  // Auto-sync Config / Seeds / Photos from their tabs; each fails over silently
  // to the static defaults so a missing tab never breaks the dashboard.
  useEffect(() => {
    let cancelled = false;
    const grab = (url) => fetch(url)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(text => parseCSV(text));

    grab(CONFIG_CSV_URL).then(rows => {
      const cfg = mapConfig(rows);
      if (!cancelled && Object.keys(cfg).length) setConfig(cfg);
    }).catch(() => {});

    // Sanitized seed board ONLY — see SEED_BOARD_PUBLIC_CSV_URL in lib/sheet.js.
    // Never point this at committee-side seed data.
    grab(SEED_BOARD_PUBLIC_CSV_URL).then(rows => {
      const s = mapSeeds(rows);
      if (!cancelled && s.length) { setSeeds(s); setSeedsLive(true); }
    }).catch(() => {});

    grab(PHOTOS_CSV_URL).then(rows => {
      const g = mapGallery(rows);
      if (!cancelled && g.length) setGallery(g);
    }).catch(() => {});

    // Admin reg-status overlay (Name|Status) — merged over the roster's own
    // Status column below so an admin "Confirmed" shows as Verified publicly.
    // Empty/missing tab just means no overrides (board uses the sheet's Status).
    grab(OPSSTATUS_CSV_URL).then(rows => {
      if (!cancelled) setOpsStatus(mapOpsStatus(rows));
    }).catch(() => {});

    return () => { cancelled = true; };
  }, []);

  // Live match scores from a published sheet. Polls every 60s; on a failed
  // fetch it backs off (60s -> 120s -> 240s max), resetting to 60s on success.
  // Hidden entirely until the "Matches" tab has rows.
  useEffect(() => {
    if (!MATCHES_CSV_URL) return;
    let cancelled = false, timer, delay = 60000;
    const load = () => fetch(MATCHES_CSV_URL)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(text => {
        if (cancelled) return;
        delay = 60000;
        const m = mapMatches(parseCSV(text));
        if (m.length) {
          setMatches(m);
          setMatchesLive(true);
          setMatchesUpdated(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
          setMatchesLastOkAt(Date.now());
        }
      })
      .catch(() => { if (!cancelled) delay = Math.min(delay * 2, 240000); })
      .finally(() => { if (!cancelled) timer = setTimeout(load, delay); });
    load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  // Live ace counter — same poll/backoff shape as Matches above. Hidden
  // entirely (mapAces returns null) until the admin's first +1 creates the
  // "Aces" tab, so the public Brackets tab never shows a premature "0".
  useEffect(() => {
    if (!ACES_CSV_URL) return;
    let cancelled = false, timer, delay = 60000;
    const load = () => fetch(ACES_CSV_URL)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(text => {
        if (cancelled) return;
        delay = 60000;
        const a = mapAces(parseCSV(text));
        if (a) { setAces(a.count); setAcesLive(true); }
      })
      .catch(() => { if (!cancelled) delay = Math.min(delay * 2, 240000); })
      .finally(() => { if (!cancelled) timer = setTimeout(load, delay); });
    load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  // Heartbeat: re-render every 30s so the "Live" badges can flip to
  // "reconnecting…" on their own once a feed has been stale for >3 min.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Close the mobile menu on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Keep the active tab centered in the sticky nav strip (esp. on mobile).
  useEffect(() => {
    navRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [activeTab]);

  // Deep links: honor #brackets / #seeding / … on load + back/forward, and keep
  // the URL hash in sync as tabs change (replaceState, so it doesn't pile up
  // history). Lets the admin's "View live ↗" jump straight to the right view.
  useEffect(() => {
    const apply = () => { const id = tabForSlug(location.hash.replace(/^#/, '')); if (id) setActiveTab(id); };
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);
  useEffect(() => {
    const slug = slugForTab(activeTab);
    if (location.hash.replace(/^#/, '') !== slug) history.replaceState(null, '', `#${slug}`);
  }, [activeTab]);

  // Merge the admin's OpsStatus overlay over the sheet roster: a name the admin
  // has set Confirmed/Pending wins, so the public badge follows the ops console
  // (see mapOpsStatus in lib/sheet.js). No overlay rows -> the roster is used
  // as-is. Cheap (tens of rows), so recomputing each render is fine.
  const roster = Object.keys(opsStatus).length
    ? rawRoster.map(p => {
        const o = opsStatus[(p.name || '').trim().toLowerCase()];
        return o ? { ...p, status: o } : p;
      })
    : rawRoster;

  // Roster status math. "Verified" means the entry is confirmed for the public
  // roster; actual payment confirmation lives in the admin Payments tab.
  const confirmedCount = roster.filter(p => p.status === 'Verified').length;
  // Event counts ("Singles & Doubles" players count in both) + the filtered view.
  const singlesCount = roster.filter(p => p.events.includes('Singles')).length;
  const doublesCount = roster.filter(p => p.events.includes('Doubles')).length;
  // Field-filling momentum: doubles run as 16 teams (~2 players each), singles
  // as a 32 draw. Countdown to the July 6 sign-up close, live off the heartbeat.
  const doublesTeams = Math.ceil(doublesCount / 2);
  const daysLeft = Math.ceil((new Date('2026-07-06T23:59:59') - now) / 86400000);
  const closeText = daysLeft > 1 ? `in ${daysLeft} days` : daysLeft === 1 ? 'tomorrow' : daysLeft === 0 ? 'today' : 'closed';
  const filteredRoster =
    ledgerFilter === 'singles' ? roster.filter(p => p.events.includes('Singles'))
    : ledgerFilter === 'doubles' ? roster.filter(p => p.events.includes('Doubles'))
    : roster;

  // Privacy-friendly ledger identity: show first name only, and a 'XX class
  // year — but add a last initial when two registrants share a first name.
  const firstNameCounts = roster.reduce((m, p) => {
    const f = p.name.trim().split(/\s+/)[0].toLowerCase();
    m[f] = (m[f] || 0) + 1;
    return m;
  }, {});
  const ledgerName = (full) => {
    const parts = full.trim().split(/\s+/);
    const first = parts[0];
    return (firstNameCounts[first.toLowerCase()] > 1 && parts.length > 1)
      ? `${first} ${parts[parts.length - 1][0].toUpperCase()}.`
      : first;
  };
  const classTag = (cy) => {
    const m = (cy || '').match(/\d{2,4}/);
    return m ? `'${m[0].slice(-2)}` : (cy || '').trim();
  };
  // Scholarship total is staff-controlled. Config "raised" is the authoritative
  // public total; do not infer dollars from Verified entries because Verified
  // means confirmed entry, not paid. The live ace chip is a teaser/count only;
  // add ace pledge dollars to Config "raised" when they should affect the meter.
  const scholarshipGoal = config.goal ?? 1750;
  const calculatedFunding = config.raised ?? 580;
  const percentageGoal = Math.min(Math.round((calculatedFunding / scholarshipGoal) * 100), 100);
  const showScholarshipBar = config.showBar ?? true;

  // A feed counts as "Live" only if its last good fetch was under 3 min ago;
  // otherwise the badge honestly shows "reconnecting…".
  const FRESH_MS = 180000;
  const matchesFresh = matchesLive && matchesLastOkAt && now - matchesLastOkAt < FRESH_MS;

  // Courts are assigned dynamically (the next match goes to whichever court
  // opens first), so the stable structure is: matches currently ON a court
  // (live), plus an ordered "up next" queue by play order (match number). Final
  // matches drop off; entering a score advances the queue automatically.
  const livePlaying = matches
    .filter(m => m.status === 'live')
    .sort((a, b) => (Number(a.num) || 0) - (Number(b.num) || 0));
  const upNextQueue = matches
    .filter(m => m.status !== 'live' && m.status !== 'final')
    .sort((a, b) => (Number(a.num) || 0) - (Number(b.num) || 0));
  const queuePos = new Map(upNextQueue.map((m, i) => [m, i + 1]));

  // The board is entirely match-derived: live once matches are posted, else a
  // pre-tournament placeholder.
  const useMatchBoard = matchesLive && matches.length > 0;
  const boardLive = useMatchBoard;
  const boardFresh = matchesFresh;
  const boardUpdated = matchesUpdated;

  // "Find my match" — look up the player's posted matches and say where/when.
  const myMatches = matchQuery.trim().length >= 2
    ? matches.filter(m => `${m.a || ''} ${m.b || ''}`.toLowerCase().includes(matchQuery.trim().toLowerCase()))
    : [];
  const matchWhere = (m) =>
    m.status === 'live' ? { label: `On Court ${m.court} now`, cls: 'text-emerald-400' }
    : m.status === 'final' ? { label: `Final${m.score ? ` · ${m.score}` : ''}`, cls: 'text-[#fbbf24]' }
    : queuePos.get(m) === 1 ? { label: 'On deck · up next', cls: 'text-emerald-400/80' }
    : queuePos.has(m) ? { label: `Up next · #${queuePos.get(m)} in line`, cls: 'text-zinc-100' }
    : { label: 'Scheduled', cls: 'text-zinc-400' };

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

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6">
            
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <BrandLogo className="w-12 h-12 md:w-14 md:h-14 shrink-0" />
                <h1 className="text-xl md:text-2xl font-black tracking-wide uppercase text-white">
                  Aces for Arian <span className="text-base md:text-lg font-light text-[#fefcbf]">2026</span>
                </h1>
              </div>
            </div>

            {/* Both badges share one row so the header reads as a single tidy strip.
                Live ace count is hidden until the admin's first +1 (acesLive). $5/ace, cap $500. */}
            <div className="flex flex-wrap items-center justify-start gap-2 self-start md:self-center">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/30 rounded-full px-3 py-1.5 whitespace-nowrap">
                <Trophy className="w-3.5 h-3.5 shrink-0" />
                5 Years of Aces for Arian
              </span>
              {acesLive && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/30 rounded-full px-3 py-1.5 whitespace-nowrap">
                  <TennisBallIcon className="w-3.5 h-3.5 shrink-0" />
                  {aces} {aces === 1 ? 'Ace' : 'Aces'} hit live
                </span>
              )}
            </div>

            <div className="bg-[#3a0a0a] px-4 py-2 rounded-xl border border-[#fbbf24]/30 shadow-lg">
              <div className="flex items-center gap-4 md:gap-5">
                {showScholarshipBar && (
                  <div className="min-w-0">
                    <span className="text-[9px] text-[#fbbf24] font-bold uppercase tracking-widest block mb-0.5 whitespace-nowrap">Scholarship Fund</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-black text-white">${calculatedFunding}</span>
                      <span className="text-[10px] text-zinc-300">/ ${scholarshipGoal}</span>
                    </div>
                  </div>
                )}
                {/* Inline bar on desktop; mobile gets a full-width bar below so it
                    isn't squished into ~60px next to the label + donate button. */}
                {showScholarshipBar && (
                  <div className="hidden md:block w-24 h-2 bg-black/50 rounded-full overflow-hidden">
                    <div className="h-full bg-[#fbbf24] rounded-full" style={{ width: `${percentageGoal}%` }}></div>
                  </div>
                )}
                <a
                  href={DONATE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto shrink-0 flex items-center gap-1.5 bg-transparent border border-[#fbbf24]/60 hover:border-[#fbbf24] hover:bg-[#fbbf24]/10 text-[#fbbf24] font-black text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-lg transition-colors"
                >
                  <Heart className="w-3.5 h-3.5" />
                  <span>Donate</span>
                </a>
              </div>
              {showScholarshipBar && (
                <div className="md:hidden mt-2 h-1.5 bg-black/50 rounded-full overflow-hidden">
                  <div className="h-full bg-[#fbbf24] rounded-full" style={{ width: `${percentageGoal}%` }}></div>
                </div>
              )}
            </div>

          </div>
        </div>

      </header>

      {/* Sticky tab nav — lifted out of the overflow-hidden header so position:sticky
          works. On mobile the tabs WRAP into rows so every section is visible at a
          glance (no hidden horizontal scroll); desktop keeps them on one row. */}
      <div className="sticky top-0 z-40 bg-[#5c1313]/95 backdrop-blur-sm border-b-2 border-[#fbbf24] shadow-lg shadow-black/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-start gap-1">
          <nav ref={navRef} className="flex-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 py-2.5 md:flex-nowrap md:justify-start md:gap-x-8 md:py-3">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  data-active={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 pb-1 text-[11px] md:text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                    active ? 'text-[#fbbf24] border-b-2 border-[#fbbf24]' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
          {/* Guide pinned top-right (mobile only) — opens the richer "Explore" view
              with 1-line blurbs. Icon-only and narrow so the tab row centers cleanly
              and stays at two rows. Stays in the sticky strip, reachable on scroll. */}
          <button onClick={() => setMenuOpen(true)} aria-label="Browse all sections with descriptions" aria-expanded={menuOpen}
            className="md:hidden shrink-0 mt-2 p-1 text-[#fbbf24]/80 hover:text-[#fbbf24]">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile "Explore" menu — the full tab list with 1-line blurbs */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMenuOpen(false)}></div>
          <div className="absolute inset-x-0 top-0 max-h-[92dvh] overflow-y-auto bg-[#5c1313] border-b-2 border-[#fbbf24] shadow-2xl shadow-black animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#fbbf24]/20">
              <span className="text-sm font-black uppercase tracking-wider text-white">Explore the Dashboard</span>
              <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="text-zinc-300 hover:text-white p-1">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-3 space-y-1">
              {TABS.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${active ? 'bg-[#fbbf24] text-black' : 'text-zinc-100 hover:bg-white/5'}`}>
                    <tab.icon className="w-5 h-5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold">{tab.label}</div>
                      <div className={`text-xs ${active ? 'text-black/70' : 'text-zinc-400'}`}>{tab.blurb}</div>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 ${active ? 'text-black/60' : 'text-zinc-500'}`} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8">

        {/* ==========================================
            TAB: HOME (REGISTRATION & ROSTER)
            ========================================== */}
        {activeTab === 'home' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Hero Section — twin slideshows flanking the register blurb + flyer */}
            <div className="bg-[#111111] border border-zinc-800 rounded-3xl p-4 md:p-8 flex flex-wrap md:flex-nowrap items-stretch gap-4 md:gap-8 relative overflow-hidden shadow-2xl shadow-black">
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                <div className="w-full h-full border border-zinc-700 absolute top-1 left-1 right-1 bottom-1"></div>
              </div>

              {/* Left slideshow */}
              <HeroCanvas images={heroLeft} className="relative z-10 order-2 md:order-1 w-[calc(50%-0.625rem)] md:w-72 md:aspect-auto md:self-stretch" />

              {/* Center blurb */}
              <div className="order-1 md:order-2 w-full md:w-auto md:flex-1 space-y-3 relative z-10 text-center md:text-left">
                <div className="text-[10px] font-mono text-zinc-300 bg-zinc-900 px-3 py-1.5 rounded-lg w-fit mx-auto md:mx-0 flex items-center gap-2 border border-zinc-800">
                    <Calendar className='w-3.5 h-3.5 text-[#fbbf24]' /> July 11–12, 2026 • Dunlap High Courts
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight leading-[1.05]">Play in the 5th Annual <span className="whitespace-nowrap">Aces for Arian</span></h3>
                <button onClick={() => { setActiveTab('legacy'); window.scrollTo({ top: 0 }); }}
                  className="group inline-flex items-center gap-1 text-[10px] md:text-xs font-semibold tracking-tight text-[#fbbf24]/90 hover:text-[#fbbf24] transition-colors">
                  <Heart className="w-3 h-3 shrink-0" />
                  <span>In memory of Arian Rahbar — every dollar funds his scholarship</span>
                  <span className="opacity-60 group-hover:translate-x-0.5 transition-transform" aria-hidden>→</span>
                </button>
                <p className="text-[13px] text-zinc-400 max-w-xl mx-auto md:mx-0 leading-relaxed">
                  Singles, doubles, or both — $40 covers the full weekend, plus a tournament tee, court snacks, and great photos. Come play with the Dunlap tennis community. It's the 5th Annual Aces for Arian — 7 straight summers since Eagle Classic 2020!
                </p>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-2 pt-1">
                  <a href={REGISTER_FORM_URL} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-[#fbbf24] hover:bg-amber-400 text-black font-black text-sm uppercase tracking-wider px-6 py-3 rounded-xl transition-colors shadow-lg shadow-amber-500/10">
                    <span>Register Here!</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <span className="text-[11px] text-zinc-400 bg-zinc-900/60 border border-zinc-800 rounded-full px-2.5 py-1">Open to DHS students, alumni &amp; friends — all levels</span>
                </div>
                {/* Field-filling momentum — social proof + scarcity off the live roster */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1 text-[11px] text-zinc-400">
                  <span><strong className="text-[#fbbf24] font-bold">{doublesTeams}</strong><span className="text-zinc-600">/16</span> doubles teams</span>
                  <span className="text-zinc-700">·</span>
                  <span><strong className="text-[#fbbf24] font-bold">{singlesCount}</strong><span className="text-zinc-600">/32</span> singles</span>
                  <span className="text-zinc-700">·</span>
                  <span className="text-zinc-500">sign-ups close <strong className="text-zinc-300 font-semibold">{closeText}</strong> (July 6)</span>
                </div>

                {/* Flyer poster — sits beneath the blurb in the center column */}
                <a
                  href={REGISTER_FORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Aces for Arian 2026 tournament flyer — register for $40"
                  className="group block w-full max-w-sm md:max-w-[260px] mx-auto rounded-2xl overflow-hidden border border-zinc-800 shadow-xl shadow-black focus:outline-none focus-visible:ring-2 focus-visible:ring-[#fbbf24] transition-transform hover:-translate-y-0.5"
                >
                  <img
                    src="/flyer.jpg"
                    alt="Aces for Arian 2026 Tennis Tournament at Dunlap High School courts. Doubles Saturday July 11, Singles Sunday July 12. Register by July 6."
                    className="w-full"
                    loading="lazy"
                  />
                </a>
              </div>

              {/* Right slideshow */}
              <HeroCanvas images={heroRight} className="relative z-10 order-3 md:order-3 w-[calc(50%-0.625rem)] md:w-72 md:aspect-auto md:self-stretch" />
            </div>
            <p className="text-center text-[10px] text-zinc-600 italic">Photos by Noah L. &amp; Aashu V.</p>

            {/* Next steps: reassurance, quick actions, discreet payment note */}
            <div className="mx-auto w-full max-w-xl text-center space-y-3">
              <p className="text-xs text-zinc-400 leading-relaxed">Pick singles, doubles, or both, and your shirt size. <span className="text-zinc-300 font-semibold">No doubles partner yet? Register solo</span> — add or change your partner anytime before the draw. Women's &amp; mixed doubles welcome; if you need a partner, <a href="mailto:acesforarian@gmail.com?subject=Doubles%20partner%20matching%20—%20Aces%20for%20Arian" className="text-[#fbbf24]/80 hover:text-[#fbbf24] underline underline-offset-2 transition-colors">we'll match you</a>.</p>

              {/* Format reassurance — defuses the "what if I lose round 1?" hesitation for new players */}
              <p className="inline-flex items-center gap-1.5 text-[11px] text-zinc-300 bg-zinc-900/60 border border-zinc-800 rounded-full px-3 py-1.5 leading-snug">
                <Award className="w-3.5 h-3.5 text-[#fbbf24] shrink-0" />
                <span>Compass draw — every entrant is guaranteed <strong className="text-white font-bold">3+ matches</strong>, win or lose.</span>
              </p>

              {/* Quick actions — secondary to Register, styled as ghost buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <AddToCalendarButton className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-300 border border-zinc-700 hover:border-[#fbbf24]/50 hover:text-[#fbbf24] rounded-lg px-3 py-2 transition-colors" />
                <ShareInvite className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-300 border border-zinc-700 hover:border-[#fbbf24]/50 hover:text-[#fbbf24] rounded-lg px-3 py-2 transition-colors" />
              </div>

              <p className="text-[10px] text-zinc-600">$40 entry — pay <a href={VENMO_URL} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-[#fbbf24] underline underline-offset-2 transition-colors">{VENMO_HANDLE} on Venmo</a> or cash at sign-in.</p>
            </div>

            {/* Roster & Info Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="lg:col-span-2 bg-[#151515] border border-zinc-800 rounded-3xl p-6">
                <div className="pb-4 border-b border-zinc-800 mb-4">
                  <div className="flex justify-between items-center gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">Roster</h3>
                      {rosterLive && (
                        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Live
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] font-mono font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-md text-emerald-400">
                      {confirmedCount} confirmed
                    </span>
                  </div>
                  {/* Filter the roster by event — the chips double as live counts */}
                  <div className="flex gap-2 flex-wrap items-center">
                    {[['all', 'All', roster.length], ['singles', 'Singles', singlesCount], ['doubles', 'Doubles', doublesCount]].map(([key, label, n]) => {
                      const on = ledgerFilter === key;
                      return (
                        <button key={key} onClick={() => setLedgerFilter(key)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition ${on ? 'bg-[#fbbf24] text-black' : 'bg-[#111] text-zinc-400 border border-zinc-800 hover:bg-zinc-900'}`}>
                          {label} <span className={on ? 'text-black/60' : 'text-zinc-500'}>{n}</span>
                        </button>
                      );
                    })}
                  </div>
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
                      {filteredRoster.map((player, i) => {
                        return (
                        <tr key={i} className="hover:bg-zinc-900/50 transition-colors">
                          <td className="py-4 pl-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-zinc-200">{ledgerName(player.name)}</span>
                            </div>
                            {player.partner
                              ? <div className="text-[11px] text-[#fbbf24]/80 font-medium mt-0.5">w/ {player.partner.split(/\s+/)[0]}</div>
                              : player.events.includes('Doubles') && <div className="text-[11px] text-sky-400/90 font-medium mt-0.5">looking for a partner</div>}
                            {player.bio && <div className="text-[11px] text-zinc-500 font-normal italic mt-0.5 max-w-[15rem] truncate sm:whitespace-normal" title={player.bio}>{player.bio}</div>}
                          </td>
                          <td className="py-4 text-zinc-400 text-xs">{classTag(player.classYear)}</td>
                          <td className="py-4 text-zinc-400 text-xs">{player.events}</td>
                          <td className="py-4 pr-2 text-right">
                            <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                              player.status === 'Verified' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            }`}>
                              {player.status === 'Verified' ? 'Confirmed' : player.status}
                            </span>
                          </td>
                        </tr>
                        );
                      })}
                      {filteredRoster.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-xs text-zinc-500">
                            No {ledgerFilter} entries yet — be the first.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-zinc-600 mt-3 px-1 leading-relaxed">
                  Registered as a pair? You'll show as <span className="text-[#fbbf24]/70 font-medium">"w/ [partner]"</span> here once both you and your partner are confirmed — until then, doubles entries read <span className="text-sky-400/70">"looking for a partner."</span>
                </p>
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

            <NotifyMeBox source="home-hero" />

            <IdeaBox />

          </div>
        )}


        {/* ==========================================
            TAB: DRAWS & BRACKETS
            ========================================== */}
        {activeTab === 'draws' && (
          <div className="space-y-6 animate-fade-in">

            {/* Live Ace Tracker — every ace hit on a live court adds $5
                toward Arian's scholarship, up to $500. Hidden until the
                admin's first +1 (see mapAces in lib/sheet.js). */}
            {acesLive && (
              <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-6 md:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5 md:gap-8">
                  <div className="flex items-center gap-4 shrink-0">
                    <TennisBallIcon className="w-14 h-14 md:w-16 md:h-16 shrink-0" />
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#fbbf24] mb-1">Live Ace Tracker</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl md:text-5xl font-black text-white tabular-nums">{aces}</span>
                        <span className="text-sm text-zinc-400 uppercase tracking-wider font-bold">{aces === 1 ? 'Ace' : 'Aces'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 w-full">
                    <p className="text-sm text-zinc-400 leading-relaxed">Every ace served this weekend goes toward Arian's scholarship. Counted live courtside — keep 'em coming.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Live court board — answers "when is my next match?" */}
            <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-6">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${boardFresh ? 'bg-emerald-400 animate-pulse' : boardLive ? 'bg-amber-400' : 'bg-zinc-600'}`}></span>
                  <h2 className="text-xl font-black text-white uppercase tracking-wider">Live Court Board</h2>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">{boardFresh ? `Updated ${boardUpdated}` : boardLive ? 'Reconnecting…' : 'Goes live tournament morning'}</span>
              </div>
              {boardLive ? (
                <>
                  {/* Find my match — type a name, instantly see your court + when */}
                  {useMatchBoard && (
                    <div className="mb-5">
                      <input value={matchQuery} onChange={(e) => setMatchQuery(e.target.value)}
                        placeholder="Find your match — type your name"
                        className="w-full bg-[#111] border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-[#fbbf24]/40 transition-colors" />
                      {matchQuery.trim().length >= 2 && (
                        <div className="mt-2 space-y-1.5">
                          {myMatches.length === 0 ? (
                            <p className="text-xs text-zinc-500 px-1">No match posted for "{matchQuery.trim()}" yet — check the spelling, or it may not be up yet.</p>
                          ) : myMatches.map((m, i) => {
                            const w = matchWhere(m);
                            return (
                              <div key={i} className="flex items-center justify-between gap-3 bg-[#111] border border-zinc-800 rounded-lg px-3 py-2">
                                <span className="text-xs text-zinc-300 font-semibold truncate">{m.a || '?'} <span className="text-zinc-600 font-normal">vs</span> {m.b || '?'}</span>
                                <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider ${w.cls}`}>{w.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-zinc-400 mb-4 max-w-2xl leading-relaxed">
                    Courts open up as matches finish, so the <span className="text-zinc-200 font-semibold">order</span> is what to watch — the next match goes to whichever court frees up first.
                  </p>
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2">On court now</div>
                  {livePlaying.length === 0 ? (
                    <p className="text-xs text-zinc-500 mb-5">No match on a court yet — first up is in the queue below.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
                      {livePlaying.map((m, i) => (
                        <div key={i} className="bg-[#111] border border-emerald-500/20 rounded-xl p-4">
                          <div className="text-[10px] font-black uppercase tracking-widest text-[#fbbf24] mb-1.5">{m.court ? `Court ${m.court}` : 'On court'}</div>
                          <div className="text-sm text-zinc-100 font-bold truncate">{m.a || '?'} <span className="text-zinc-600 font-normal">vs</span> {m.b || '?'}</div>
                          {m.score && <div className="text-xs text-zinc-400 font-mono mt-1">{m.score}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Up next</div>
                    <div className="text-[10px] text-zinc-600">called to the next open court</div>
                  </div>
                  {upNextQueue.length === 0 ? (
                    <p className="text-xs text-zinc-500">Nothing queued — check back as rounds advance.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {upNextQueue.slice(0, 8).map((m, i) => (
                        <div key={i} className="flex items-center gap-3 bg-[#111] border border-zinc-800 rounded-lg px-3 py-2">
                          <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black ${i === 0 ? 'bg-[#fbbf24] text-black' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`}>{i + 1}</span>
                          <span className="text-sm text-zinc-200 font-semibold truncate">{m.a || '?'} <span className="text-zinc-600 font-normal">vs</span> {m.b || '?'}</span>
                          {i === 0 && <span className="ml-auto shrink-0 text-[9px] font-bold uppercase tracking-wider text-emerald-400/80">On deck</span>}
                        </div>
                      ))}
                      {upNextQueue.length > 8 && <p className="text-[10px] text-zinc-600 pl-1 pt-1">+{upNextQueue.length - 8} more in the queue</p>}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-zinc-500 leading-relaxed max-w-2xl">
                  The board lights up tournament morning — once play starts, type your name above to jump straight to your court, and see what's <span className="text-emerald-400/80 font-semibold">on now</span> and <span className="text-zinc-300 font-semibold">up next</span> across all 9 courts.
                </p>
              )}
            </div>

            {/* Live scores — only appears once ops has posted at least one match */}
            {matchesLive && matches.length > 0 && (
              <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-6">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${matchesFresh ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                    <h2 className="text-xl font-black text-white uppercase tracking-wider">Live Scores</h2>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">{matchesFresh ? `Updated ${matchesUpdated}` : 'Reconnecting…'}</span>
                </div>
                <p className="text-sm text-zinc-400 mb-5 max-w-2xl leading-relaxed">
                  Match results as they're posted courtside — <span className="text-emerald-400 font-semibold">live</span> matches update in real time, and <span className="text-[#fbbf24] font-semibold">winners</span> are highlighted once a match goes final.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {matches.map((m, i) => {
                    const meta = [m.event, m.round && `Rd ${m.round}`, m.num && `M${m.num}`, m.court && `Court ${m.court}`].filter(Boolean).join(' · ');
                    const badge = {
                      live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                      final: { label: 'Final', cls: 'text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/20' },
                      scheduled: { label: 'Scheduled', cls: 'text-zinc-400 bg-zinc-800/60 border-zinc-700' },
                    }[m.status] || { label: m.status, cls: 'text-zinc-400 bg-zinc-800/60 border-zinc-700' };
                    return (
                      <div key={i} className="bg-[#111] border border-zinc-800 rounded-xl p-4">
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 truncate">{meta}</span>
                          <span className={`shrink-0 text-[9px] font-black uppercase tracking-wider border rounded-full px-2 py-0.5 ${badge.cls}`}>{badge.label}</span>
                        </div>
                        <div className="space-y-1.5">
                          <div className={`text-sm font-bold truncate ${m.winner === 'a' ? 'text-[#fbbf24]' : 'text-zinc-100'}`}>{m.a || '—'}</div>
                          <div className={`text-sm font-bold truncate ${m.winner === 'b' ? 'text-[#fbbf24]' : 'text-zinc-100'}`}>{m.b || '—'}</div>
                        </div>
                        {m.score && <div className="text-xs text-zinc-400 font-mono mt-2.5 pt-2.5 border-t border-zinc-800/60">{m.score}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-[#151515] border border-zinc-800 p-6 md:p-8 rounded-3xl">
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Tournament Draws</h2>
              <p className="text-sm text-zinc-400 mt-2 max-w-2xl leading-relaxed">
                {seedsFinal
                  ? "Final draws. The top 8 are seeded (seeds 1–4 can't meet before the semifinals; 5–8 are slated for the quarterfinals) and open lines are byes — top seeds get the byes first."
                  : 'Draft brackets. Seeds and matchups are placeholders until registration closes July 6 — slots fill in as players are confirmed. Only the top 8 carry a seed number.'}
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
                    Every team is guaranteed multiple matches. If a round does not go your way, you rotate into a new direction with another path to compete.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs">
                    {[
                      ['East', 'Championship path — all 16 teams', 'text-[#fbbf24]'],
                      ['West', 'Second path after East Round of 16 (8)', 'text-zinc-200'],
                      ['North', 'Placement path after East Quarterfinals (4)', 'text-zinc-200'],
                      ['South', 'Final placement path after opening West round (4)', 'text-zinc-200'],
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
                    ['East — Championship Draw', singleElim(DRAW_CAP.Doubles, true, seedNamesFrom(seeds, 'Doubles'), showByes)],
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
                    Players get a two-match cushion. After a first setback, you move into the comeback bracket and can still battle all the way back to the Grand Final.
                  </p>
                </div>

                <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-5 md:p-6">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider mb-4">Winners Bracket</h4>
                  <Bracket rounds={numberRounds(singleElim(DRAW_CAP.Singles, true, seedNamesFrom(seeds, 'Singles'), showByes), [1, 25, 41, 53, 59])} />
                </div>

                <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-5 md:p-6">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider mb-4">Comeback Bracket</h4>
                  <Bracket
                    rounds={numberRounds(losersBracket32(), [17, 33, 45, 49, 55, 57, 60, 61])}
                    names={['Comeback R1', 'Comeback R2', 'Comeback R3', 'Comeback R4', 'Comeback R5', 'Comeback R6', 'Comeback R7', 'Comeback Final']}
                  />
                </div>

                <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-5 md:p-6">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider mb-4">Grand Final <span className="text-[10px] font-mono font-normal text-zinc-500">· Match 62 (+ 63 if reset)</span></h4>
                  <div className="flex items-center gap-5 flex-wrap">
                    <div className="w-60 shrink-0 rounded-lg border border-[#fbbf24]/30 bg-[#111] divide-y divide-zinc-800">
                      <div className="px-3 py-2 text-xs text-zinc-200">Winners Bracket Champion</div>
                      <div className="px-3 py-2 text-xs text-zinc-200">Comeback Bracket Champion</div>
                    </div>
                    <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                      If the Comeback Bracket Champion wins, a deciding "bracket reset" set is played because the Winners Champion has not dropped a match yet.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Crowdsourced seeding input — hidden once the field locks */}
            <SeedSuggestionBox participants={roster} seedsFinal={seedsFinal} />

            <button onClick={() => setActiveTab('legacy')} className="w-full bg-[#151515] hover:bg-zinc-900 border border-zinc-800 hover:border-[#fbbf24]/40 rounded-2xl p-5 flex items-center justify-between gap-3 transition-colors group text-left">
              <div className="flex items-center gap-3">
                <Trophy className="w-5 h-5 text-[#fbbf24] shrink-0" />
                <div>
                  <div className="text-sm font-bold text-white">Past champions &amp; full results archive</div>
                  <div className="text-xs text-zinc-500">Every winner since 2020 — now in the Legacy tab.</div>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 group-hover:text-[#fbbf24] transition-colors shrink-0">Legacy →</span>
            </button>
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
              <div className="px-3 pt-2 pb-1">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Tournament Memories</h3>
              </div>
              <Slideshow images={gallery} />
              <div className="px-3 pt-2 pb-1 text-[10px] text-zinc-600 italic">Photos by Noah L. &amp; Aashu V.</div>
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
                  <li><strong className="text-zinc-200">Format:</strong> Double elimination — every player has a two-match cushion.</li>
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
                <p className="text-xs text-zinc-400 mt-1">Your tournament tee is included with entry. Order extra gear below to back the scholarship — you keep the gear as a thank-you, and every dollar over cost goes straight to the fund. Paid via Venmo.</p>
              </div>
            </div>

            {/* Player tee — included with entry, spares for sale */}
            <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-6 flex flex-col sm:flex-row items-center gap-5">
              <div className="bg-white rounded-2xl w-20 h-20 sm:w-24 sm:h-24 shrink-0 overflow-hidden border border-zinc-900 shadow-inner">
                <img src="/merch-tee.jpg" alt="Vegas Gold player tee" className="w-full h-full object-cover" loading="lazy" decoding="async" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1 flex-wrap">
                  <h3 className="text-base font-bold text-white">Player Tee</h3>
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">Included with entry</span>
                </div>
                <p className="text-xs text-zinc-500">Vegas Gold, in the size you picked at registration — pick it up day-of at the gear locker.</p>
                <p className="text-[11px] text-zinc-500 mt-2">Want a spare, or not playing? Extra tees are <span className="text-[#fbbf24] font-bold">${TEE_PRICE}</span> while they last — put your size (S/M/L/XL) in the Venmo note.</p>
              </div>
              <a href={VENMO_URL} target="_blank" rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center justify-center gap-2 border border-[#fbbf24]/40 hover:border-[#fbbf24] text-[#fbbf24] font-black text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition-colors">
                <Heart className="w-3.5 h-3.5" />
                <span>Order a Tee — ${TEE_PRICE}</span>
              </a>
            </div>

            {/* Extra gear — per-item price, Buy via Venmo */}
            <div>
              <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">Extra Gear — Every Order Funds the Scholarship</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {MERCH_ITEMS.map((item) => (
                  <div key={item.key} className="bg-[#151515] border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between hover:border-zinc-700 transition">
                    <div>
                      <div className="bg-white rounded-2xl aspect-square overflow-hidden mb-6 border border-zinc-900 shadow-inner">
                        <img src={item.img} alt={item.label} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      </div>
                      <div className="flex justify-between items-baseline mb-2">
                        <h3 className="text-base font-bold text-white">{item.label}</h3>
                        <span className="text-[#fbbf24] font-mono font-bold text-sm">${item.price}</span>
                      </div>
                      <p className="text-xs text-zinc-500 mb-4">{item.desc}</p>
                    </div>
                    <a href={VENMO_URL} target="_blank" rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 bg-[#fbbf24] hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider py-3 rounded-xl transition-colors">
                      <Heart className="w-3.5 h-3.5" />
                      <span>Order — ${item.price}</span>
                    </a>
                    <p className="text-[10px] text-zinc-600 mt-2 text-center">Add "{item.label}" (and color) to your Venmo note so we know what to bring.</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Locker bundle — all three extras, small discount */}
            <div className="bg-gradient-to-br from-[#1a1710] to-[#151515] border border-[#fbbf24]/30 rounded-3xl p-6 flex flex-col sm:flex-row items-center gap-5">
              <div className="flex-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1 flex-wrap">
                  <h3 className="text-base font-black text-white uppercase tracking-wide">{MERCH_BUNDLE.label}</h3>
                  <span className="text-[9px] font-black uppercase tracking-wider text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/30 rounded-full px-2 py-0.5">Save ${MERCH_BUNDLE.keys.reduce((s, k) => s + (MERCH_ITEMS.find((i) => i.key === k)?.price || 0), 0) - MERCH_BUNDLE.price}</span>
                </div>
                <p className="text-xs text-zinc-400">{MERCH_BUNDLE.desc}</p>
                <p className="text-[10px] text-zinc-600 mt-1">Add "Bundle" + your hat & sweatband colors to the Venmo note.</p>
              </div>
              <div className="text-center shrink-0">
                <div className="text-2xl font-black text-[#fbbf24] font-mono leading-none">${MERCH_BUNDLE.price}</div>
                <a href={VENMO_URL} target="_blank" rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center justify-center gap-2 bg-[#fbbf24] hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition-colors">
                  <Heart className="w-3.5 h-3.5" />
                  <span>Order the Bundle</span>
                </a>
              </div>
            </div>

            <p className="text-[10px] text-zinc-600 text-center">Every order is a donation to the scholarship — pay via Venmo {VENMO_HANDLE}, and pick up your gear at the locker once it clears.</p>
          </div>
        )}

        {/* ==========================================
            TAB: ARIAN'S LEGACY
            ========================================== */}
        {activeTab === 'legacy' && (
          <div className="space-y-8 animate-fade-in">

            {/* 1 — Remembering Arian */}
            <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-8 md:p-12 relative overflow-hidden">
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
                  Arian Rahbar (DHS class of 2019) achieved an impressive 4-year high school career playing for the Dunlap Eagles Tennis Team. Arian is part of an elite group of Dunlap Tennis players in the <strong className="text-zinc-200">100 win club</strong>, and is a 3-time IHSA State qualifier. This includes being a part of the <strong className="text-zinc-200">2017 State Championship Dunlap Tennis Team</strong>! Also a 3-time selection on the Mid-Illini All-Conference team, Arian is 1 of only 13 Dunlap men to qualify for the State Tournament in both Singles and Doubles.
                </p>
                <p className="text-zinc-400 text-sm leading-relaxed md:text-base">
                  Arian's positivity radiates on and off the court. Graduating from DHS with a nearly perfect GPA, he took his talents to study Computer Science at <strong className="text-zinc-200">USC</strong> in Los Angeles. His diligence earned him an upcoming summer internship at <strong className="text-zinc-200">Facebook</strong> following his Junior year.
                </p>
                <p className="text-zinc-400 text-sm leading-relaxed md:text-base">
                  Arian tragically lost his life in December 2021 as a pedestrian victim to senseless street racing in LA. Let us come together for the 5th Annual Aces for Arian — our 7th straight summer of this tournament as a Dunlap community — to enjoy some summer tennis as Arian would, playing to his heart's content on the court. After all, Arian was one of the first champions back in 2020, when this tournament was the Eagle Classic!
                </p>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  <a href="https://www.pjstar.com/story/news/2021/12/13/arian-rahbar-dunlop-illinois-killed-in-los-angeles/6491771001/" target="_blank" rel="noopener noreferrer" className="text-[#fbbf24]/80 hover:text-[#fbbf24] underline underline-offset-2 transition-colors">
                    Read the Peoria Journal Star's coverage →
                  </a>
                </p>
              </div>
            </div>

            <div className="relative z-10 mt-8 pt-6 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="text-sm font-black text-white uppercase tracking-wider">Play in Arian's memory</div>
                <div className="text-xs text-zinc-400 mt-1 leading-relaxed">100% of entry fees and donations fund the Arian Rahbar Memorial Scholarship for Dunlap seniors pursuing higher education.</div>
              </div>
              <div className="shrink-0 flex flex-col sm:flex-row gap-2.5">
                <a href={REGISTER_FORM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-[#fbbf24] hover:bg-amber-400 text-black font-black text-sm uppercase tracking-wider px-6 py-3.5 rounded-xl transition-colors shadow-lg shadow-amber-500/10">
                  <span>Register to Play — $40</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 border border-[#fbbf24]/40 hover:border-[#fbbf24] text-[#fbbf24] font-black text-sm uppercase tracking-wider px-6 py-3.5 rounded-xl transition-colors">
                  <Heart className="w-4 h-4" />
                  <span>Donate</span>
                </a>
              </div>
            </div>
          </div>

            {/* 2 — Hall of Fame (moved here from the Brackets tab) */}
            <section className="border-t border-zinc-800 pt-8">
              <div className="flex items-center gap-3 mb-1">
                <Trophy className="w-5 h-5 text-[#fbbf24]" />
                <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-wide">Hall of Fame</h2>
              </div>
              <div className="w-12 h-1 bg-[#fbbf24] rounded-full mb-3"></div>
              <p className="text-sm text-zinc-400 mb-5 max-w-2xl leading-relaxed">Champions from every year — the Eagle Classic era to today.</p>
              <div className="space-y-5">
                <HallOfFame />
              </div>
            </section>

            {/* 3 — Scholars we've funded (moved here from the Scholarship tab) — the emotional close */}
            <section className="border-t border-zinc-800 pt-8">
              <div className="flex items-center gap-3 mb-1">
                <GraduationCap className="w-5 h-5 text-[#fbbf24]" />
                <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-wide">Scholars We've Funded</h2>
              </div>
              <div className="w-12 h-1 bg-[#fbbf24] rounded-full mb-3"></div>
              <p className="text-sm text-zinc-400 mb-5 max-w-2xl leading-relaxed">Every entry fee and donation goes to the Arian Rahbar Memorial Scholarship for Dunlap seniors. Here's where it's landed.</p>
              <ScholarsList showDonate />
            </section>

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
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Scholarship Recipients</h3>
                <button onClick={() => setActiveTab('legacy')} className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-[#fbbf24] transition-colors">Arian's story → Legacy</button>
              </div>
              <ScholarsList />
            </div>

            {/* Register CTA — entry fees fund this scholarship; give cause-aligned visitors a way to act */}
            <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-6 md:p-8 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="text-sm font-black text-white uppercase tracking-wider">Fund it by playing</div>
                <div className="text-xs text-zinc-400 mt-1 leading-relaxed">Every entry fee goes straight to this scholarship. Grab a spot in the July 11–12 tournament — singles, doubles, or both.</div>
              </div>
              <a href={REGISTER_FORM_URL} target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-2 bg-[#fbbf24] hover:bg-amber-400 text-black font-black text-sm uppercase tracking-wider px-6 py-3.5 rounded-xl transition-colors shadow-lg shadow-amber-500/10">
                <span>Register to Play — $40</span>
                <ExternalLink className="h-4 w-4" />
              </a>
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

      {/* Universal email capture — renders under every tab, above the footer */}
      <section className="max-w-7xl w-full mx-auto px-4 pb-10 sm:px-6 lg:px-8">
        <NotifyMeBox source="footer" />
      </section>

      {/* --- FOOTER --- */}
      <footer className="bg-black py-10 text-center text-xs text-zinc-600 border-t border-zinc-900 mt-auto">
        <p className="uppercase tracking-widest font-bold mb-2">Aces for Arian 2026</p>
        <p>Built for DHS '19 & The Dunlap Tennis Community.</p>
      </footer>
    </div>
  );
}

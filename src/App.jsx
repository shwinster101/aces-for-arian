import React, { useState, useEffect } from 'react';
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
  Phone,
  ShieldCheck,
  CheckCircle2,
  Image as ImageIcon,
  Home
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

const photoAlbums = [
  { title: "2025 Highlights", url: "https://photos.app.goo.gl/uTSWwjTgaYcDoHij9", image: "photo1.jpg" },
  { title: "Arian's Journey", url: "https://photos.app.goo.gl/uTSWwjTgaYcDoHij9", image: "photo2.jpg" },
  { title: "Dunlap Legacy", url: "https://photos.app.goo.gl/uTSWwjTgaYcDoHij9", image: "photo3.jpg" }
];

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

// Fallback shown only when ROSTER_CSV_URL is blank or the live fetch fails,
// so the dashboard NEVER renders an empty roster.
const fallbackRoster = [
  { name: "Ashwin Yedavalli", classYear: "19", events: "Singles & Doubles", status: "Verified" },
  { name: "Aanan Kashyap", classYear: "19", events: "Doubles", status: "Verified" },
  { name: "Venil Tummarakota", classYear: "Alumni", events: "Singles & Doubles", status: "Verified" },
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
      };
    });
}

const topSeeds = [
  // Singles
  { name: "Ashwin Yedavalli", type: "Singles", utr: "7.2", rank: 1, notes: "100-win club. State Contender." },
  { name: "Venil Tummarakota", type: "Singles", utr: "7.0", rank: 2, notes: "2017 State Champ." },
  { name: "Aanan Kashyap", type: "Singles", utr: "6.9", rank: 3, notes: "DHS Singles mainstay." },
  { name: "Siddharth Patel", type: "Singles", utr: "6.4", rank: 4, notes: "Current Varsity #1 court." },
  // Doubles
  { name: "A. Yedavalli / V. Tummarakota", type: "Doubles", utr: "7.1", rank: 1, notes: "Original Champions." },
  { name: "A. Kashyap / T. Miller", type: "Doubles", utr: "6.5", rank: 2, notes: "Varsity alumni standouts." }
];

// ==========================================
// 3. MAIN APPLICATION
// ==========================================

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [bracketEvent, setBracketEvent] = useState('doubles');
  const [seedingEvent, setSeedingEvent] = useState('Singles');
  const [currentHeroImageIndex, setCurrentHeroImageIndex] = useState(0);
  const [roster, setRoster] = useState(fallbackRoster);
  const [rosterLive, setRosterLive] = useState(false);

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

  // Financial tracking math
  const scholarshipGoal = 1500;
  const registrationFee = 40;
  const baseDonations = 380; // Add your direct offline donations here
  const confirmedCount = roster.filter(p => p.status === 'Verified').length;
  const calculatedFunding = baseDonations + (confirmedCount * registrationFee);
  const percentageGoal = Math.min(Math.round((calculatedFunding / scholarshipGoal) * 100), 100);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-200 font-sans flex flex-col selection:bg-[#fbbf24] selection:text-[#5c1313]">
      
      {/* --- HEADER --- */}
      <header className="border-b-2 border-[#fbbf24] bg-[#5c1313] relative overflow-hidden">
        {/* Subtle Court Lines Pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="w-full h-full border-2 border-[#fbbf24] absolute top-2 left-2 right-2 bottom-2"></div>
          <div className="w-1/2 h-full border-r-2 border-[#fbbf24] absolute left-0"></div>
          <div className="w-full h-1/2 border-b-2 border-[#fbbf24] absolute top-0"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            <div className="flex items-center gap-5">
              <div className="text-[#fbbf24]">
                <ARLogo className="w-12 h-12 md:w-14 md:h-14" />
              </div>
              <div>
                <span className="text-[9px] md:text-[10px] tracking-widest font-black uppercase text-[#fbbf24]/80 block mb-0.5">
                  Dunlap High School Tennis Alumni
                </span>
                <h1 className="text-xl md:text-2xl font-black tracking-wide uppercase text-white">
                  Aces for Arian <span className="text-base md:text-lg font-light text-[#fefcbf]">2026</span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-6 bg-[#3a0a0a] px-5 py-3 rounded-xl border border-[#fbbf24]/30 shadow-lg">
              <div>
                <span className="text-[10px] text-[#fbbf24] font-bold uppercase tracking-widest block mb-1">Scholarship Fund</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-black text-white">${calculatedFunding}</span>
                  <span className="text-[10px] text-zinc-300">/ ${scholarshipGoal}</span>
                </div>
              </div>
              <div className="w-20 md:w-24 h-2 bg-black/50 rounded-full overflow-hidden">
                <div className="h-full bg-[#fbbf24] rounded-full" style={{ width: `${percentageGoal}%` }}></div>
              </div>
            </div>

          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-black/30">
          <nav className="flex space-x-6 md:space-x-8 py-3 overflow-x-auto no-scrollbar">
            {[
              { id: 'home', label: 'Home', icon: Home },
              { id: 'seeding', label: 'Projected Seeds', icon: TrendingUp },
              { id: 'draws', label: 'Brackets', icon: Award },
              { id: 'photos', label: 'Photos', icon: ImageIcon },
              { id: 'rules', label: 'Rules', icon: BookOpen },
              { id: 'merch', label: 'Merch', icon: ShoppingBag },
              { id: 'legacy', label: 'Legacy', icon: Heart }
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
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
        </div>
      </header>

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
                    <Calendar className='w-3.5 h-3.5 text-[#fbbf24]' /> July 10-12, 2026 • Dunlap High Courts
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight leading-none">Join us for the 5th annual Aces for Arian</h3>
                <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
                  The $40 flat registration covers play on both days, a Commemorative T-Shirt, court snacks, and professional photos. All proceeds fund the Arian Rahbar Memorial Scholarship.
                </p>
              </div>

              {/* Rotating Canvas */}
              <div className="relative w-full md:w-80 h-52 flex-shrink-0 bg-black rounded-2xl overflow-hidden border border-zinc-800 group">
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
                      <p className="text-xs text-zinc-400 mb-6 leading-relaxed">Send your entry fee via Venmo or Zelle. Ashwin will verify the payment and update the roster below.</p>
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
                          <td className="py-4 pl-2 font-bold text-zinc-200">{player.name}</td>
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
                    <li>• Arrive **15 mins** early for all matches.</li>
                    <li>• Players 15 minutes late will be defaulted.</li>
                    <li>• Pre-payment required before taking the court.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB: PROJECTED SEEDS
            ========================================== */}
        {activeTab === 'seeding' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-[#151515] border border-zinc-800 p-6 md:p-8 rounded-3xl">
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Projected Top 8 Seeds</h2>
              <p className="text-sm text-zinc-400 mt-2 max-w-2xl leading-relaxed">
                These are the projected bracket placements organized by the Tournament Committee. Placements are primarily based on historic High School Varsity/Collegiate play and baseline UTR ratings.
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
                          <div className="flex items-center gap-3 flex-wrap">
                            <h4 className="text-base font-bold text-white">{candidate.name}</h4>
                            <span className="text-[10px] font-mono bg-black px-2 py-0.5 rounded-md text-emerald-400 border border-zinc-800">UTR: {candidate.utr || 'N/A'}</span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-1 italic">"{candidate.notes}"</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB: DRAWS & BRACKETS
            ========================================== */}
        {activeTab === 'draws' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-[#151515] border border-zinc-800 p-6 md:p-8 rounded-3xl">
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Live Brackets</h2>
              <p className="text-sm text-zinc-400 mt-2">Draws will be published directly from Google Sheets the week of the tournament.</p>
            </div>

            <div className="bg-[#151515] border border-zinc-800 rounded-3xl p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
              <Award className="w-16 h-16 text-zinc-800 mb-4" />
              <h3 className="text-lg font-bold text-zinc-300">Brackets Pending</h3>
              <p className="text-xs text-zinc-500 mt-2">Check back after July 6th once registration officially closes.</p>
            </div>
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
                <p className="text-sm text-zinc-400 mt-2">Explore the official action shots from DHS.</p>
              </div>
              <ImageIcon className='w-12 h-12 text-zinc-800 hidden sm:block' />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {photoAlbums.map((album, index) => (
                <div key={index} className="bg-[#151515] border border-zinc-800 rounded-2xl p-5 group flex flex-col justify-between hover:border-zinc-700 transition">
                  <div>
                    <div className="bg-[#111] rounded-xl aspect-video flex items-center justify-center mb-4 overflow-hidden border border-zinc-900">
                      <img src={album.image} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-2">{album.title}</h3>
                  </div>
                  <a href={album.url} target="_blank" rel="noopener noreferrer" className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-[10px] uppercase tracking-wider py-3 rounded-xl flex items-center justify-center gap-2 transition mt-4">
                    <span>View Album</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
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
                <h3 className="text-lg font-black text-white uppercase tracking-wider mb-4">Saturday Doubles Format</h3>
                <ul className="space-y-4 text-sm text-zinc-400 leading-relaxed list-disc list-outside pl-4">
                  <li><strong className="text-zinc-200">Format:</strong> Compass Draw. Minimum 4 matches guaranteed per team.</li>
                  <li><strong className="text-zinc-200">Scoring:</strong> Best 2 out of 3 Fast-4 Sets. First to 4 games wins the set. No-Ad scoring is utilized.</li>
                  <li><strong className="text-zinc-200">Tiebreak:</strong> Played at 3-3 in any set (First to 5 points wins).</li>
                </ul>
              </div>
              <div className="bg-[#151515] border border-zinc-800 p-6 md:p-8 rounded-3xl">
                <div className="w-12 h-12 rounded-xl bg-[#5c1313]/30 text-rose-500 flex items-center justify-center mb-6">
                  <Trophy className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-wider mb-4">Sunday Singles Format</h3>
                <ul className="space-y-4 text-sm text-zinc-400 leading-relaxed list-disc list-outside pl-4">
                  <li><strong className="text-zinc-200">Format:</strong> Double Elimination Draw. Minimum 2 matches guaranteed.</li>
                  <li><strong className="text-zinc-200">Scoring:</strong> Single 6-Game Set (No-Ad).</li>
                  <li><strong className="text-zinc-200">Later Rounds (QF+):</strong> Upgraded to 8-game pro sets or 2/3 Fast-4 sets based on player consensus.</li>
                  <li><strong className="text-zinc-200">Defaults:</strong> 15-minute grace period strictly enforced.</li>
                </ul>
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
            
            <div className="flex flex-col lg:flex-row gap-10 items-center relative z-10">
              <div className="w-56 h-56 bg-[#5c1313] rounded-3xl border border-[#fbbf24]/30 flex flex-col justify-end p-6 relative overflow-hidden flex-shrink-0 shadow-2xl">
                <h3 className="text-white font-black text-xl relative z-10">Arian Rahbar</h3>
                <span className="text-[#fbbf24] font-mono text-sm relative z-10">1999 - 2021</span>
              </div>
              
              <div className="flex-1 space-y-5">
                <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-wide">Scholar & DHS State Champion</h2>
                <div className="w-12 h-1 bg-[#fbbf24] rounded-full"></div>
                <p className="text-zinc-400 text-sm leading-relaxed md:text-base">
                  Arian was an exceptional student, athlete, and friend. Competing for the Dunlap Eagles, he entered the elite 100-Win Club and was a 3-time IHSA State qualifier, notably helping secure the 2017 State Championship.
                </p>
                <p className="text-zinc-400 text-sm leading-relaxed md:text-base">
                  After Dunlap, Arian pursued Computer Science at USC, earning a prestigious internship at Facebook. This tournament honors his legacy, funding a $1,500 scholarship for DHS seniors pursuing higher education.
                </p>
              </div>
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
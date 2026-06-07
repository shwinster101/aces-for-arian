// ==========================================
// SHARED GOOGLE SHEET / CSV PIPELINE
// ==========================================
// One published Google Sheet drives both the public dashboard (App.jsx) and
// the ops admin panel (admin). Each tab is fetched as CSV via the gviz/tq
// endpoint — the sheet just needs to be link-viewable ("Anyone with the
// link -> Viewer"); no "Publish to web" needed.
//
//   • Roster  -> the default first tab (raw Google Form responses).
//   • Config  -> a tab named "Config"  (scholarship $, goal, show/hide bar).
//   • Seeds   -> a tab named "Seeds"   (Name | Event | Rank | Note ...).
//   • Photos  -> a tab named "Photos"  (image URL | Caption).
//   • Courts  -> a tab named "Courts"  (Court | Now | Next) — live court board.
//   • Matches -> a tab named "Matches" (Event | Round | Num | Player A/B | ...) — live scores.
//
// Any tab that doesn't exist yet is simply ignored and callers fall back to
// static defaults — so tabs can be added one at a time. The last two
// (Courts, Matches) are written automatically by the Apps Script in
// apps-script/ops-write-back.js the first time the admin panel publishes a
// court board or posts a match — you don't have to create them by hand.
export const SHEET_ID = "1u94hz6xL-WbLEQAOW9HLgSvKJ9B1LoqFX7lW1JMnjNM";
export const sheetCsv = (tab) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv${tab ? `&sheet=${encodeURIComponent(tab)}` : ""}`;

export const ROSTER_CSV_URL  = sheetCsv();           // default tab = Form responses
export const CONFIG_CSV_URL  = sheetCsv("Config");   // scholarship $ + toggles
export const SEEDS_CSV_URL   = sheetCsv("Seeds");    // projected seeds
export const PHOTOS_CSV_URL  = sheetCsv("Photos");   // gallery / wheel images
export const COURT_BOARD_CSV_URL = sheetCsv("Courts");  // live court board (Court | Now | Next)
export const MATCHES_CSV_URL     = sheetCsv("Matches"); // live scores (Event | Round | Num | ...)

// --- WRITE-BACK ------------------------------------------------------------
// Google's CSV export is read-only, so by itself the admin panel can only
// write to this browser's localStorage (see pushToSheet in admin/store.js —
// it already fires a POST here on every edit; it's just a no-op while this
// is blank). To make admin edits actually land in the spreadsheet — and
// therefore flow through to the public site's live reads above — deploy the
// ready-to-go Apps Script at apps-script/ops-write-back.js (full setup
// instructions are in that file's header comment) and paste its Web App URL
// below:
//
//   export const SHEET_WRITE_URL = "https://script.google.com/macros/s/AKfycb.../exec";
//
// That one script is what makes Seeds, the Court Board, and Match scores
// actually go live from the admin panel — COURT_BOARD_CSV_URL and
// MATCHES_CSV_URL above are already pointed at the tabs it creates. Until
// it's deployed, every admin screen keeps working fully offline against
// localStorage (and roster reads still come live from ROSTER_CSV_URL) — it
// just doesn't write back to the spreadsheet yet.
export const SHEET_WRITE_URL = "https://script.google.com/macros/s/AKfycbw1VE647EivpMDggivfPqDRoWTj2u7LMBCY5vNCKFd-1lPD4ERekRvZPq6UUUDwcyrtOA/exec";

// Static fallback for the live court board — shown until COURT_BOARD_CSV_URL
// resolves (or if the fetch ever fails). 9 empty courts; "live" flips to true
// automatically once a real "Courts" tab is found.
export const COURT_BOARD = {
  live: false,
  updated: "",
  courts: Array.from({ length: 9 }, (_, i) => ({ court: i + 1, now: "", next: "" })),
};

// Fallback shown only when ROSTER_CSV_URL is blank or the live fetch fails,
// so neither the dashboard nor the admin panel ever renders an empty roster.
export const fallbackRoster = [
  { name: "Ashwin Yedavalli", classYear: "19", events: "Singles & Doubles", status: "Verified", bio: "what's a backhand?" },
  { name: "Aanan Kashyap", classYear: "19", events: "Doubles", status: "Verified", bio: "Onion Ketchup." },
  { name: "Venil Tummarakota", classYear: "Alumni", events: "Singles & Doubles", status: "Verified", bio: "Can't buy a second serve." }
];

// Minimal RFC-4180-ish CSV parser (handles quoted fields, commas, newlines).
export function parseCSV(text) {
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

// Map CSV rows -> roster objects via flexible, case-insensitive header matching.
// Works with both a simple "Name/Class/Events/Status/Bio" sheet AND a raw Google
// Form responses sheet (where Singles/Doubles are separate yes/no questions).
//
// Optional columns that can be added to the form-responses sheet (to the right
// of the auto-filled form columns) to control the public dashboard:
//   • "Status"  -> put "Verified" once payment is confirmed.
//   • "Hide"    -> put "y" (or x/true/1) to hide that person from the dashboard.
export function mapRoster(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const col = (...names) => headers.findIndex(h => names.some(n => h.includes(n)));
  const iName = col("name");
  const iClass = col("class", "year", "grad");
  // A single explicit "Events" column wins; otherwise derive from the two
  // separate Form questions ("Doubles tourney (Saturday…)" / "Singles tourney…").
  const iEvents = headers.findIndex(h => /\bevents?\b/.test(h) && !h.includes("tourney"));
  const iDoubles = headers.findIndex(h => h.includes("doubles") && (h.includes("tourney") || h.includes("saturday")));
  const iSingles = headers.findIndex(h => h.includes("singles") && (h.includes("tourney") || h.includes("sunday")));
  // Status: explicit Status/Verified/Confirm column only — NOT the form's
  // "Payment method" question (which isn't a confirmation of payment).
  const iStatus = col("status", "verif", "confirm");
  const iBio = col("bio", "yearbook", "nickname", "about", "quote");
  const iHide = col("hide", "hidden");
  const iPartner = col("partner");
  if (iName < 0) return [];

  // Did they opt in to an event? "Sign me up!" = yes; "No thanks." / "Not
  // playing…" / blank / "N/A" = no.
  const optedIn = v => {
    const s = (v || "").trim().toLowerCase();
    return !!s && !/(no thanks|not playing|^no\b|^n\/a$|^nope$|^-+$)/.test(s);
  };

  return rows.slice(1)
    .filter(r => (r[iName] || "").trim())
    .filter(r => !(iHide >= 0 && /^(y|yes|true|1|hide|x|✓)$/i.test((r[iHide] || "").trim())))
    .map(r => {
      const s = (iStatus >= 0 ? r[iStatus] : "").trim().toLowerCase();
      const verified = /verif|paid|confirm|complete/.test(s) ||
        ["y", "yes", "true", "1", "done", "✓"].includes(s);
      let events = iEvents >= 0 ? (r[iEvents] || "").trim() : "";
      if (!events) {
        const d = iDoubles >= 0 && optedIn(r[iDoubles]);
        const g = iSingles >= 0 && optedIn(r[iSingles]);
        events = d && g ? "Singles & Doubles" : d ? "Doubles" : g ? "Singles" : "Supporter";
      }
      const partnerRaw = iPartner >= 0 ? (r[iPartner] || "").trim() : "";
      const partner = (events.includes("Doubles") && optedIn(partnerRaw))
        ? partnerRaw.replace(/\b\w/g, c => c.toUpperCase())
        : "";
      return {
        name: r[iName].trim(),
        classYear: iClass >= 0 ? (r[iClass] || "").trim() : "",
        events,
        partner,
        status: verified ? "Verified" : "Pending",
        bio: iBio >= 0 ? (r[iBio] || "").trim() : "",
      };
    });
}

// --- CONFIG TAB -> { raised, goal, showBar } -------------------------------
// Expects a two-column "Key | Value" tab. Recognized keys (case/spacing
// insensitive): "raised" (current $), "goal" (target $), "show bar" (yes/no).
// Returns only the keys it actually found, so unset keys keep their defaults.
export function mapConfig(rows) {
  if (!rows || rows.length < 1) return {};
  const out = {};
  const truthy = v => /^(y|yes|true|1|on|show)$/i.test((v || "").trim());
  const falsy = v => /^(n|no|false|0|off|hide)$/i.test((v || "").trim());
  rows.forEach(r => {
    const key = (r[0] || "").trim().toLowerCase().replace(/\s+/g, " ");
    const val = (r[1] || "").trim();
    if (!key || key === "key") return; // skip a header row if present
    if (/raised|funding|amount|current/.test(key)) {
      const n = parseInt(val.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(n)) out.raised = n;
    } else if (/goal|target/.test(key)) {
      const n = parseInt(val.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(n)) out.goal = n;
    } else if (/bar|meter|progress|scholarship/.test(key)) {
      if (truthy(val)) out.showBar = true;
      else if (falsy(val)) out.showBar = false;
    }
  });
  return out;
}

// --- SEEDS TAB -> [{ name, type, rank, result, utr, wtn, notes }] ----------
// Columns (flexible, any order): Name | Event | Rank | Result | UTR | WTN | Note
export function mapSeeds(rows) {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const col = (...names) => headers.findIndex(h => names.some(n => h.includes(n)));
  const iName = col("name", "team", "player");
  const iType = col("event", "type", "draw");
  const iRank = col("rank", "seed");
  const iResult = col("result");
  const iUtr = col("utr");
  const iWtn = col("wtn");
  const iNotes = col("note", "blurb", "comment");
  if (iName < 0 || iType < 0) return [];
  return rows.slice(1)
    .filter(r => (r[iName] || "").trim())
    .map(r => {
      const typeRaw = (r[iType] || "").trim().toLowerCase();
      const type = typeRaw.includes("doub") ? "Doubles" : "Singles";
      const rank = parseInt(String(r[iRank] || "").replace(/[^0-9]/g, ""), 10);
      return {
        name: r[iName].trim(),
        type,
        rank: isNaN(rank) ? 99 : rank,
        result: iResult >= 0 ? (r[iResult] || "").trim() : "",
        utr: iUtr >= 0 ? (r[iUtr] || "").trim() : "",
        wtn: iWtn >= 0 ? (r[iWtn] || "").trim() : "",
        notes: iNotes >= 0 ? (r[iNotes] || "").trim() : "",
      };
    })
    .sort((a, b) => a.rank - b.rank);
}

// --- PHOTOS TAB -> [{ src, caption }] --------------------------------------
// Columns (flexible): URL (or Image/Link/Photo) | Caption (or Year/Label).
// URLs must be DIRECT image links (end in .jpg/.png, or be hotlinkable).
export function mapGallery(rows) {
  if (!rows || rows.length < 1) return [];
  let headers = rows[0].map(h => h.trim().toLowerCase());
  const looksLikeHeader = headers.some(h => /url|image|link|photo|caption|year|label/.test(h));
  let body = rows;
  let iUrl = 0, iCap = 1;
  if (looksLikeHeader) {
    const col = (...names) => headers.findIndex(h => names.some(n => h.includes(n)));
    iUrl = col("url", "image", "link", "photo", "src");
    iCap = col("caption", "year", "label", "title");
    body = rows.slice(1);
    if (iUrl < 0) iUrl = 0;
  }
  return body
    .map(r => ({ src: (r[iUrl] || "").trim(), caption: iCap >= 0 ? (r[iCap] || "").trim() : "" }))
    .filter(p => /^https?:\/\//i.test(p.src));
}

// Parse the court-board CSV into 9 court rows (overlaid onto empty courts).
export function mapCourtBoard(rows) {
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

// --- MATCHES TAB -> [{ event, round, num, a, b, court, status, score, winner }]
// Columns (flexible): Event | Round | Num | Player A | Player B | Court | Status | Score | Winner
// This is what the public "Live Scores" section reads — it's written
// automatically by apps-script/ops-write-back.js as the admin scores matches.
export function mapMatches(rows) {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const col = (...names) => headers.findIndex(h => names.some(n => h.includes(n)));
  const iEvent = col("event", "draw");
  const iRound = col("round");
  const iNum = col("num", "match");
  const iA = col("player a", "team a", "side a");
  const iB = col("player b", "team b", "side b");
  const iCourt = col("court");
  const iStatus = col("status");
  const iScore = col("score");
  const iWinner = col("winner");
  if (iA < 0 || iB < 0) return [];
  return rows.slice(1)
    .filter(r => (r[iA] || r[iB] || "").toString().trim())
    .map(r => {
      const typeRaw = (iEvent >= 0 ? r[iEvent] : "").toString().trim().toLowerCase();
      return {
        event: typeRaw.includes("doub") ? "Doubles" : "Singles",
        round: iRound >= 0 ? (r[iRound] || "").toString().trim() : "",
        num: iNum >= 0 ? (r[iNum] || "").toString().trim() : "",
        a: (r[iA] || "").toString().trim(),
        b: (r[iB] || "").toString().trim(),
        court: iCourt >= 0 ? (r[iCourt] || "").toString().trim() : "",
        status: (iStatus >= 0 ? (r[iStatus] || "").toString().trim().toLowerCase() : "") || "scheduled",
        score: iScore >= 0 ? (r[iScore] || "").toString().trim() : "",
        winner: iWinner >= 0 ? (r[iWinner] || "").toString().trim().toLowerCase() : "",
      };
    });
}

// Fetch + parse a tab; resolves to [] / null on any failure so callers can
// always fall back to static defaults without a try/catch of their own.
export function fetchSheet(url) {
  if (!url) return Promise.resolve([]);
  return fetch(`${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}`)
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
    .then(parseCSV)
    .catch(() => []);
}

// ==========================================================================
// Aces for Arian — ops console write-back (Google Apps Script Web App)
// ==========================================================================
// This is the missing half of the data pipeline documented in
// src/lib/sheet.js (SHEET_WRITE_URL) and src/admin/store.js (pushToSheet).
// Right now the admin panel's edits land only in each device's localStorage —
// deploying this script lets them also land in the spreadsheet, where the
// public site already knows how to read them back live.
//
// WHAT THIS DOES
//   • Seeds          -> publishes ONLY Name | Event | Rank into a
//                       "SeedBoardPublic" tab, which the public "Projected
//                       Seeds" page reads live via SEED_BOARD_PUBLIC_CSV_URL +
//                       mapSeeds (see lib/sheet.js). This tab is the sole
//                       sanctioned bridge from the admin's committee seed data
//                       to the public site — see "WHY SEEDS ARE SANITIZED
//                       HERE, NOT JUST CLIENT-SIDE" near writeSeeds_ below.
//   • Court board    -> mirrors the 9-court Now/Next grid into a "Courts"
//                       tab, which the public "Live Court Board" already
//                       reads live once COURT_BOARD_CSV_URL is set.
//   • Match scores   -> mirrors each match edit into a "Matches" tab, which
//                       the public "Live Scores" section reads live via
//                       MATCHES_CSV_URL + mapMatches.
//   • Ace counter    -> writes a single running total into an "Aces" tab,
//                       which the public "Live Ace Tracker" (Brackets tab)
//                       reads live via ACES_CSV_URL + mapAces.
//   • Registration status -> writes display-safe Name | Status rows to
//                       "OpsStatus" so the public roster can show confirmed
//                       entries without touching raw Form responses.
//   • Check-ins / payments / shirts / walk-ups -> mirrored into PRIVATE
//                       "OpsDesk" / "OpsWalkups" tabs (never in READABLE, so
//                       they never flow through the public Cloudflare read
//                       path) so the ~5 ops devices — volunteer phones, the
//                       HQ phone, the check-in laptop — see the same
//                       check-in/payment/shirt state. Read back via
//                       mode=opsdesk (own token, JSON out). Per-field
//                       last-write-wins: a device only sends the fields it
//                       actually changed, so two devices editing different
//                       fields for the same person can't clobber each other.
//
// All three target tabs are created automatically (with the right header
// row) the first time the matching edit comes through, so you don't have to
// pre-build them — just deploy this script and start using the admin panel.
//
// --------------------------------------------------------------------------
// DEPLOYMENT (one-time, ~5 minutes, from the tournament Google Sheet)
// --------------------------------------------------------------------------
//   1. Extensions -> Apps Script. This opens a blank script bound to the sheet.
//   2. Delete whatever's in Code.gs and paste this entire file in its place.
//   3. Click Deploy -> New deployment.
//        - Click the gear icon next to "Select type" -> choose "Web app".
//        - Description: "ops write-back" (anything you like).
//        - Execute as: Me.
//        - Who has access: Anyone.
//      Click Deploy, then "Authorize access" and approve the prompts (you'll
//      see a Google "unverified app" warning — that's expected for a script
//      you wrote yourself; click Advanced -> Go to (your project) -> Allow).
//   4. Copy the "Web app" URL it gives you.
//   5. Paste that URL as SHEET_WRITE_URL in src/lib/sheet.js, e.g.:
//        export const SHEET_WRITE_URL = "https://script.google.com/macros/s/AKfycb.../exec";
//      Rebuild/redeploy the site. That's it — pushToSheet() starts firing for
//      real, and COURT_BOARD_CSV_URL / MATCHES_CSV_URL (already pointed at
//      the "Courts" / "Matches" tabs in lib/sheet.js) start finding data.
//
// If you ever need to change the code, edit it here, then Deploy -> Manage
// deployments -> pencil icon -> "New version" -> Deploy. (Creating a brand
// new deployment instead would change the URL and break the live site.)
//
// --------------------------------------------------------------------------
// MAKING THE SHEET PRIVATE (closes the gviz backdoor) — see doGet below
// --------------------------------------------------------------------------
// This script also serves READS via doGet so the public site keeps working
// after you set the sheet to "Restricted". To turn that on:
//   1. Redeploy this script (Manage deployments -> New version) so doGet is live.
//   2. In Cloudflare Pages -> your project -> Settings -> Variables, add:
//        SHEET_READ_URL   = this web app's /exec URL (same one as the write URL)
//        SHEET_READ_TOKEN = the READ_TOKEN value below
//      Redeploy the Pages project.
//   3. Confirm the live site still loads, THEN set the Google Sheet to
//      "Restricted" (Share -> General access -> Restricted).
// Until SHEET_READ_URL is set in Cloudflare, the Function keeps reading via
// public gviz, so nothing breaks before you flip it.
// ==========================================================================

// RUN THIS ONCE from the editor before deploying (pick `authorize` in the
// function dropdown -> Run). It touches every scope the script needs —
// Spreadsheet read/write AND sending email — so Google shows the consent
// screen now (click Advanced -> "Go to ... (unsafe)" -> Allow). doPost/doGet
// can't be Run directly (they need a request), and handleIdea_ exits before it
// emails, so this is the only function that reliably triggers the MailApp
// prompt. It sends nothing and changes nothing.
function authorize() {
  SpreadsheetApp.getActiveSpreadsheet().getName();   // Spreadsheet scope
  MailApp.getRemainingDailyQuota();                  // send-email scope
  return 'authorized';
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    // Public idea/suggestion box — no token (anyone on the site can submit).
    // Emails the owner; capped + trimmed so it can't be abused as a relay.
    if (body.type === 'idea') { handleIdea_(body.payload); return ContentService.createTextOutput('ok'); }
    // Public "notify me next year" capture — no token. Appends to a PRIVATE
    // Subscribers tab that is intentionally absent from the public read allowlist
    // (functions/api/sheet.js), so the emails are never served to the browser.
    // Locked like the ops writes below — it mutates a tab via the same
    // read-modify-write pattern.
    if (body.type === 'subscribe') { withLock_(function () { writeSubscribe_(body.payload); }); return ContentService.createTextOutput('ok'); }
    // Shared-secret gate — must match WRITE_TOKEN in src/admin/store.js.
    // Obfuscation only (the token ships in the public bundle), but it stops
    // drive-by writes from anyone who merely opens /admin.html.
    if (body.token !== 'a4a-ea5316b9f5d5b04e49115a20') {
      return ContentService.createTextOutput('forbidden');
    }
    // EVERY tab mutation runs under the script lock. Each handler does a full
    // read-modify-write of its tab; without the lock, two concurrent
    // executions (a burst of pushes from one device, or five ops devices at
    // once) interleave and silently drop rows. A waitLock timeout throws into
    // the outer catch — consistent with the fire-and-forget contract.
    withLock_(function () {
      switch (body.type) {
        case 'seeds':        writeSeeds_(body.payload); break;
        case 'court-board':  writeCourtBoard_(body.payload); break;
        case 'match':        writeMatch_(body.payload); break;
        case 'match-delete': deleteMatch_(body.payload); break;
        case 'matches-replace': replaceEngineMatches_(body.payload); break;
        case 'aces':         writeAces_(body.payload); break;
        case 'status':       writeStatus_(body.payload); break;
        case 'config':       writeConfig_(body.payload); break;
        case 'announce':        writeAnnounce_(body.payload); break;
        case 'announce-delete': deleteAnnounce_(body.payload); break;
        case 'opsdesk':      writeOpsDesk_(body.payload); break;
        case 'walkup':       writeWalkup_(body.payload); break;
        case 'walkup-delete':deleteWalkup_(body.payload); break;
        case 'opsdraw':      writeOpsDraw_(body.payload); break;
      }
    });
  } catch (err) {
    // Apps Script web apps can't hand a readable response back to a
    // mode:'no-cors' fetch anyway, so there's no one to tell — just don't
    // let a bad payload 500 the endpoint for the next request.
  }
  return ContentService.createTextOutput('ok');
}

// Serialize tab mutations: acquire the script-wide lock, run fn, always
// release. waitLock throws on timeout — callers let it bubble to doPost's
// outer catch (the client can't read the response anyway; the next push or
// poll re-converges state).
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { fn(); } finally { lock.releaseLock(); }
}

// Public "got an idea?" box on the site -> emails the owner. Runs as the owner,
// so MailApp can send. (First deploy with this will prompt for a new "send
// email" permission — approve it.) Length-capped so it can't relay spam.
var IDEA_EMAIL = 'acesforarian@gmail.com';
function handleIdea_(payload) {
  var text = String((payload && payload.text) || '').slice(0, 4000).trim();
  if (!text) return;
  var from = String((payload && payload.from) || '').slice(0, 200).trim();
  MailApp.sendEmail(
    IDEA_EMAIL,
    'Aces for Arian — idea from the site' + (from ? ' (' + from + ')' : ''),
    [text, '', 'From: ' + (from || '(anonymous)'), 'Sent ' + new Date()].join('\n')
  );
}

// Public "notify me next year" capture -> appends to a PRIVATE Subscribers tab.
// Never exposed: "Subscribers" is intentionally absent from the ALLOWED read set
// in functions/api/sheet.js. Validated + length-capped + deduped to limit abuse.
function writeSubscribe_(payload) {
  var email = String((payload && payload.email) || '').slice(0, 500).trim();
  if (!email || !/\S@\S/.test(email)) return;
  var source = String((payload && payload.source) || '').slice(0, 100).trim();
  var sheet = sheetByName_('Subscribers', ['Email', 'Source', 'Timestamp']);
  var rows = readRows_(sheet);
  var lower = email.toLowerCase();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim().toLowerCase() === lower) return; // already subscribed
  }
  rows.push([email, source, new Date().toISOString()]);
  writeRows_(sheet, rows);
}

// --------------------------------------------------------------------------
// READ PROXY (doGet) — lets the site keep reading once the sheet is PRIVATE
// --------------------------------------------------------------------------
// Called server-to-server ONLY by the Cloudflare Function (functions/api/
// sheet.js), never by a browser. Once the spreadsheet is set to "Restricted"
// (private), gviz can no longer read it anonymously — but THIS script runs as
// the owner, so it still can. The Cloudflare Function holds READ_TOKEN in an
// env var (never shipped to the browser) and passes it as ?token=...; without
// the right token this returns nothing. That's what closes the "anyone with
// the SHEET_ID can hit gviz" backdoor.
//
// Contract: valid token + existing allowlisted tab -> that tab as CSV.
// Anything else (no/bad token, unknown tab, missing tab) -> EMPTY, so callers
// fall back to their static defaults.
//
// READ_TOKEN is NOT a real secret — this very file is committed in the PUBLIC
// repo, so treat it like WRITE_TOKEN: a drive-by deterrent, nothing more. The
// actual PII protection is that doGet itself strips the roster down to the
// public columns (filterRosterCols_ below) before returning — so even with the
// token in hand, the raw roster (email/phone/payment) NEVER leaves this script.
// The Cloudflare Function filters again on its side (defense in depth).
var READ_TOKEN = 'a4a-read-8db082a282da9e0b622178164cd9b202'; // matches SHEET_READ_TOKEN in Cloudflare (obfuscation only)
var READABLE = ['', 'Config', 'SeedBoardPublic', 'Photos', 'Courts', 'Matches', 'Aces', 'OpsStatus', 'Announcements']; // '' = roster (first tab)

// Email-blast token — gates ONLY the mode=emails read below (the roster's
// email column for the ops Announce tab's Gmail-BCC list). Deliberately a
// SEPARATE token from READ_TOKEN/WRITE_TOKEN: it ships in the public admin
// bundle (src/admin/sections/Announce.jsx), so like the others it is a
// drive-by deterrent, not a real secret. Rotate it after the event (change
// here + in Announce.jsx, redeploy New version).
var EMAILS_TOKEN = 'a4a-mail-766673c3d6e53f1463738ba7';

// Multi-device ops sync token — gates ONLY the mode=opsdesk read below (the
// private check-in/payment/shirt/walk-up state shared across the ~5 ops
// devices: volunteer phones, HQ phone, the check-in laptop). Same trust
// model as EMAILS_TOKEN — ships in the admin bundle, drive-by deterrent
// only. Rotate after the event (here + in src/admin/store.js).
var OPSDESK_TOKEN = 'a4a-desk-2f9b6a1e4c7d0358b1a9e6f2';

function doGet(e) {
  var p = (e && e.parameter) || {};
  // Ops-only email list — its own token, checked inside; never tab-readable.
  if (p.mode === 'emails') return rosterEmailsOut_(p.token);
  // Ops-only desk sync (check-in/payment/shirt/walk-ups) — own token, JSON
  // out, never tab-readable (OpsDesk/OpsWalkups are absent from READABLE).
  if (p.mode === 'opsdesk') return opsDeskOut_(p.token);
  if (p.token !== READ_TOKEN) return csvOut_('');          // fail closed: no/bad token
  var tab = p.tab || '';
  if (READABLE.indexOf(tab) < 0) return csvOut_('');        // not allowlisted
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = tab ? ss.getSheetByName(tab) : ss.getSheets()[0]; // '' = default/roster tab
  if (!sheet) return csvOut_('');                           // tab doesn't exist -> empty
  var rows = sheet.getLastRow(), cols = sheet.getLastColumn();
  if (rows < 1 || cols < 1) return csvOut_('');
  var values = sheet.getRange(1, 1, rows, cols).getValues();
  if (tab === '') values = filterRosterCols_(values);       // strip PII from the raw roster
  if (tab === 'OpsStatus') values = filterOpsStatusRows_(values);
  return csvOut_(rowsToCsv_(values));
}

// Keep only the roster columns the public site renders (name/class/events/
// partner/status/bio/hide) — drops email/phone/payment/comments. Mirrors
// isPublicRosterCol() in functions/api/sheet.js so the two boundaries agree.
function filterRosterCols_(values) {
  if (!values.length) return values;
  var keep = values[0].map(function (h) { return isPublicRosterCol_(h); });
  return values.map(function (row) {
    return row.filter(function (_, i) { return keep[i]; });
  });
}

// mode=emails: return the roster's email column ONLY — deduped, validated,
// one address per line, no names or other columns. This is the one sanctioned
// path for emails to leave the sheet (the ops Announce tab's BCC list); the
// public read path (tab=...) still strips the email column entirely via
// filterRosterCols_, and functions/api/sheet.js filters again. Fail-closed:
// bad token, missing sheet, or no email column -> empty body.
function rosterEmailsOut_(token) {
  if (token !== EMAILS_TOKEN) return csvOut_('');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]; // roster = first tab
  if (!sheet) return csvOut_('');
  var rows = sheet.getLastRow(), cols = sheet.getLastColumn();
  if (rows < 2 || cols < 1) return csvOut_('');
  var values = sheet.getRange(1, 1, rows, cols).getValues();
  var idx = -1;
  for (var i = 0; i < values[0].length; i++) {
    if (String(values[0][i] || '').trim().toLowerCase().indexOf('email') >= 0) { idx = i; break; }
  }
  if (idx < 0) return csvOut_('');
  var seen = {}, out = [];
  for (var r = 1; r < values.length; r++) {
    var v = String(values[r][idx] || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) continue; // skip blanks/junk
    var k = v.toLowerCase();
    if (seen[k]) continue;
    seen[k] = true;
    out.push(v);
  }
  return csvOut_(out.join('\n'));
}

function filterOpsStatusRows_(values) {
  if (!values.length) return values;
  return values.filter(function (r, i) {
    return i === 0 || String(r[0] || '').trim().indexOf('__') !== 0;
  });
}

function isPublicRosterCol_(header) {
  var h = String(header == null ? '' : header).trim().toLowerCase();
  return (
    h.indexOf('name') >= 0 ||
    h.indexOf('class') >= 0 || h.indexOf('grad') >= 0 || h.indexOf('year') >= 0 ||
    (h.indexOf('doubles') >= 0 && (h.indexOf('tourney') >= 0 || h.indexOf('saturday') >= 0)) ||
    (h.indexOf('singles') >= 0 && (h.indexOf('sunday') >= 0 || h.indexOf('tourney') >= 0)) ||
    /\bevents?\b/.test(h) ||
    h.indexOf('partner') >= 0 ||
    h.indexOf('bio') >= 0 || h.indexOf('yearbook') >= 0 || h.indexOf('nickname') >= 0 ||
    h.indexOf('about') >= 0 || h.indexOf('quote') >= 0 ||
    h.indexOf('status') >= 0 || h.indexOf('verif') >= 0 || h.indexOf('confirm') >= 0 ||
    h.indexOf('hide') >= 0 || h.indexOf('hidden') >= 0 ||
    h.indexOf('shirt') >= 0 // shirt size — not sensitive; feeds the merch order planner
  );
}

function csvOut_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.CSV);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function rowsToCsv_(rows) {
  return rows.map(function (r) {
    return r.map(function (f) {
      var s = (f === null || f === undefined) ? '' : String(f);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',');
  }).join('\n');
}

// SeedBoardPublic is the SANITIZED public board — Name | Event | Rank ONLY.
// It deliberately has no Notes/Result/UTR/WTN columns: this script is the
// last line of defense before data lands in the link-viewable spreadsheet
// (see "PUBLIC / COMMITTEE DATA SEPARATION" in src/lib/sheet.js — the whole
// sheet is fetchable by anyone with the link, tab name and all), so it must
// never persist committee notes/votes/internal comments even if a client sent
// them. The admin already strips `notes` before this request is sent (see
// setSeeds in src/admin/store.js) — this header list is what makes that the
// *enforced* contract rather than just a client-side courtesy.
var SEED_HEADERS  = ['Name', 'Event', 'Rank'];
var COURT_HEADERS = ['Court', 'Now', 'Next'];
var MATCH_HEADERS = ['Event', 'Round', 'Num', 'Player A', 'Player B', 'Court', 'Status', 'Score', 'Winner', 'ID'];
var ACES_HEADERS  = ['Count'];
var OPSSTATUS_HEADERS = ['Name', 'Status'];
var ANNOUNCE_HEADERS = ['Id', 'Timestamp', 'Event', 'Category', 'Message'];
// PRIVATE — never added to READABLE. Holds check-in/payment/shirt state for
// the multi-device ops sync (see mode=opsdesk / writeOpsDesk_ below).
var OPSDESK_HEADERS = ['Name', 'CheckedIn', 'CheckedInAt', 'Paid', 'PayMethod', 'ShirtGiven', 'ShirtSize', 'UpdatedAt'];
var OPSWALKUP_HEADERS = ['Id', 'Name', 'ClassYear', 'Events', 'Partner'];

// --------------------------------------------------------------------------
// WHY SEEDS ARE SANITIZED HERE, NOT JUST CLIENT-SIDE
// --------------------------------------------------------------------------
// Prior audit finding: raw committee seed notes were flowing straight into a
// publicly-readable "Seeds" tab — a parent or player could read committee
// commentary about players right on the live site (or just by guessing the
// tab name in a gviz URL, since the whole spreadsheet is link-viewable).
//
// The fix is a hard sanitization boundary at the ONE place that actually
// writes into the public sheet: here. Even if a future client bug, a stale
// build, or a tampered request sent `result`/`utr`/`wtn`/`notes` alongside
// `name`, writeSeeds_ below physically cannot persist them — the row shape
// is fixed at three columns. Committee notes live and stay in each admin
// device's localStorage (src/admin/store.js) and nowhere else.
// --------------------------------------------------------------------------

// The admin sends its full seed list for one event on every change (add,
// remove, reorder, edit). The admin is the source of truth for order, so
// the simplest correct move is: drop that event's old rows, append the new
// ones — no row-by-row diffing that could drift out of sync.
function writeSeeds_(payload) {
  var sheet = sheetByName_('SeedBoardPublic', SEED_HEADERS);
  var rows = readRows_(sheet);
  var keep = rows.filter(function (r) {
    return String(r[1] || '').trim().toLowerCase() !== String(payload.event || '').toLowerCase();
  });
  // Position in the list IS the seed rank — the admin reorders by moving rows,
  // so derive Rank from index here rather than trusting a stored s.rank that
  // goes stale on reorder/remove. This keeps the public badges contiguous
  // (1..N) and in exactly the order staff set. Name + Event + Rank is ALL
  // that gets written — see SEED_HEADERS above for why that's enforced here.
  var fresh = (payload.list || []).map(function (s, i) {
    return [s.name || '', payload.event, i + 1];
  });
  writeRows_(sheet, keep.concat(fresh));
}

// The court board is always published as a full 9-court snapshot (see
// CourtBoardEditor's "Publish" button), so just overwrite the whole tab.
function writeCourtBoard_(payload) {
  var sheet = sheetByName_('Courts', COURT_HEADERS);
  var rows = (payload.courts || []).map(function (c) {
    return [c.court, c.now || '', c.next || ''];
  });
  writeRows_(sheet, rows);
}

// Matches arrive as incremental patches keyed by the admin's match `id`
// (round/court/score/status/winner can each change independently as a match
// is set up and then scored). Upsert on that id — stashed in a trailing "ID"
// column so editors can ignore it — rather than on Event/Round/Num, which
// can themselves be edited mid-setup.
function writeMatch_(patch) {
  var sheet = sheetByName_('Matches', MATCH_HEADERS);
  var rows = readRows_(sheet);
  var idCol = MATCH_HEADERS.length - 1;
  var idx = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][idCol] || '') === String(patch.id || '')) { idx = i; break; }
  }
  var next = idx >= 0 ? rows[idx].slice() : ['', '', '', '', '', '', 'scheduled', '', '', patch.id || ''];
  if ('event' in patch)  next[0] = patch.event;
  if ('round' in patch)  next[1] = patch.round;
  if ('num' in patch)    next[2] = patch.num;
  if ('a' in patch)      next[3] = patch.a;
  if ('b' in patch)      next[4] = patch.b;
  if ('court' in patch)  next[5] = patch.court;
  if ('status' in patch) next[6] = patch.status;
  if ('score' in patch)  next[7] = patch.score;
  if ('winner' in patch) next[8] = patch.winner;
  if (idx >= 0) rows[idx] = next; else rows.push(next);
  writeRows_(sheet, rows);
}

// One POST replaces ALL of one event's ENGINE rows (ids starting with the
// event's prefix, 'S-'/'D-') in a single atomic write — sent by the ops
// bracket sync (applyBracket) instead of the old burst of ~30 individual
// match/match-delete POSTs that could interleave and clobber themselves.
// Hand-added rows (non-prefix ids) and the other event's rows survive
// untouched. Single edits still use writeMatch_/deleteMatch_.
function replaceEngineMatches_(payload) {
  if (!payload || !payload.event || !payload.prefix) return;
  var sheet = sheetByName_('Matches', MATCH_HEADERS);
  var rows = readRows_(sheet);
  var ev = String(payload.event).trim().toLowerCase();
  var prefix = String(payload.prefix);
  var idCol = MATCH_HEADERS.length - 1;
  var keep = rows.filter(function (r) {
    var sameEvent = String(r[0] || '').trim().toLowerCase() === ev;
    var engineId = String(r[idCol] || '').indexOf(prefix) === 0;
    return !(sameEvent && engineId);
  });
  var fresh = (payload.list || []).map(function (m) {
    return [m.event || payload.event, m.round || '', m.num || '', m.a || '', m.b || '',
            m.court || '', m.status || 'scheduled', m.score || '', m.winner || '', m.id || ''];
  });
  writeRows_(sheet, keep.concat(fresh));
}

// The Live Ace Tracker sends its current absolute total on every +1/-1 tap
// (not a delta), so a duplicate/late no-cors POST can't double-count — just
// overwrite the single data row with whatever total the admin device has now.
function writeAces_(payload) {
  var sheet = sheetByName_('Aces', ACES_HEADERS);
  var n = parseInt(payload && payload.count, 10);
  if (isNaN(n) || n < 0) n = 0;
  writeRows_(sheet, [[n]]);
}

// Registration-status overlay. The admin's Confirmed/Pending chip
// pushes { name, status } here; we upsert a Name|Status row into a dedicated
// OpsStatus tab that App.jsx merges over the roster's Status column on read.
// This is the "separate Ops tab" the note at the bottom of this file calls for
// — we deliberately do NOT write into the raw Form-responses sheet (column
// drift + name-collision overwrites of PII rows). Only Verified/Pending is
// stored (display-safe confirmed-entry status); nothing payment/check-in related
// ever lands here.
function writeStatus_(payload) {
  var name = payload && payload.name ? String(payload.name).trim() : '';
  if (!name) return;
  if (name.indexOf('__') === 0) return;
  var status = /^verif/i.test(String(payload.status || '')) ? 'Verified' : 'Pending';
  var sheet = sheetByName_('OpsStatus', OPSSTATUS_HEADERS);
  var rows = readRows_(sheet);
  var key = name.toLowerCase();
  var idx = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim().toLowerCase() === key) { idx = i; break; }
  }
  if (idx >= 0) rows[idx] = [name, status]; else rows.push([name, status]);
  writeRows_(sheet, rows);
}

// --------------------------------------------------------------------------
// MULTI-DEVICE OPS SYNC — check-in / payment / shirt / walk-ups
// --------------------------------------------------------------------------
// The dedicated private tab the note below (and at the bottom of this file)
// calls for. OpsDesk holds ONE row per person; a device only ever sends the
// fields that actually changed (see setOverlay in src/admin/store.js), and
// this upsert only overwrites THOSE columns — so two devices editing
// different fields for the same person (one taps check-in, another marks
// paid) can't clobber each other. Last write wins PER FIELD, not per row.
function writeOpsDesk_(payload) {
  var name = payload && payload.name ? String(payload.name).trim() : '';
  var fields = (payload && payload.fields) || {};
  if (!name) return;
  var sheet = sheetByName_('OpsDesk', OPSDESK_HEADERS);
  var rows = readRows_(sheet);
  var key = name.toLowerCase();
  var idx = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim().toLowerCase() === key) { idx = i; break; }
  }
  var next = idx >= 0 ? rows[idx].slice() : [name, '', '', '', '', '', '', ''];
  next[0] = name;
  if ('checkedIn' in fields)    next[1] = fields.checkedIn ? 'Y' : '';
  if ('checkedInAt' in fields)  next[2] = fields.checkedInAt || '';
  if ('paid' in fields)         next[3] = fields.paid ? 'Y' : '';
  if ('paymentMethod' in fields) next[4] = fields.paymentMethod || '';
  if ('shirt' in fields)        next[5] = fields.shirt ? 'Y' : '';
  if ('shirtSize' in fields)    next[6] = fields.shirtSize || '';
  next[7] = new Date().toISOString();
  if (idx >= 0) rows[idx] = next; else rows.push(next);
  writeRows_(sheet, rows);
}

// Walk-ups (day-of entrants added at the desk) upsert by the admin's local
// id, same pattern as writeMatch_ — so a rename/event-change on one device
// updates the same row everywhere instead of creating a duplicate.
function writeWalkup_(payload) {
  var id = payload && payload.id ? String(payload.id) : '';
  if (!id) return;
  var sheet = sheetByName_('OpsWalkups', OPSWALKUP_HEADERS);
  var rows = readRows_(sheet);
  var idx = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '') === id) { idx = i; break; }
  }
  var next = [id, payload.name || '', payload.classYear || '', payload.events || '', payload.partner || ''];
  if (idx >= 0) rows[idx] = next; else rows.push(next);
  writeRows_(sheet, rows);
}

function deleteWalkup_(payload) {
  var id = payload && payload.id ? String(payload.id) : '';
  if (!id) return;
  var sheet = sheetByName_('OpsWalkups', OPSWALKUP_HEADERS);
  var rows = readRows_(sheet).filter(function (r) { return String(r[0] || '') !== id; });
  writeRows_(sheet, rows);
}

// The generated draw (seed order + bracket engine state) for one event —
// authored on the HQ device, read back by every other ops device so a phone
// or laptop opening /admin.html sees the SAME draw instead of an empty board.
// One row per event; Seeds/Bracket are JSON strings. Nothing here is more
// sensitive than the already-public seed board + Live Scores (display names,
// seed order, results) — committee `notes` are stripped client-side before
// the push, so they never reach this tab.
var OPSDRAW_HEADERS = ['Event', 'Seeds', 'Bracket', 'UpdatedAt'];

function writeOpsDraw_(payload) {
  var event = payload && payload.event ? String(payload.event).trim() : '';
  if (event !== 'Singles' && event !== 'Doubles') return;
  var sheet = sheetByName_('OpsDraw', OPSDRAW_HEADERS);
  var rows = readRows_(sheet);
  var idx = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim() === event) { idx = i; break; }
  }
  var next = [
    event,
    JSON.stringify(payload.seeds || []),
    payload.bracket ? JSON.stringify(payload.bracket) : '',
    new Date().toISOString(),
  ];
  if (idx >= 0) rows[idx] = next; else rows.push(next);
  writeRows_(sheet, rows);
}

// mode=opsdesk: JSON snapshot of the private ops tabs for the polling devices
// (desk overlay + walk-ups + the generated draw). Fail-closed on a bad/missing
// token; empty tabs return empty arrays (not an error) so a fresh deploy with
// no data yet doesn't look like a failure.
function opsDeskOut_(token) {
  if (token !== OPSDESK_TOKEN) return jsonOut_({ desk: [], walkups: [], draw: [] });
  var deskSheet = sheetByName_('OpsDesk', OPSDESK_HEADERS);
  var deskRows = readRows_(deskSheet).map(function (r) {
    return {
      name: r[0] || '', checkedIn: r[1] === 'Y', checkedInAt: r[2] || '',
      paid: r[3] === 'Y', paymentMethod: r[4] || '', shirt: r[5] === 'Y',
      shirtSize: r[6] || '', updatedAt: r[7] || '',
    };
  });
  var walkupSheet = sheetByName_('OpsWalkups', OPSWALKUP_HEADERS);
  var walkupRows = readRows_(walkupSheet).map(function (r) {
    return { id: r[0] || '', name: r[1] || '', classYear: r[2] || '', events: r[3] || '', partner: r[4] || '' };
  });
  var drawSheet = sheetByName_('OpsDraw', OPSDRAW_HEADERS);
  var drawRows = readRows_(drawSheet).map(function (r) {
    var seeds, bracket;
    try { seeds = r[1] ? JSON.parse(r[1]) : []; } catch (e1) { seeds = []; }
    try { bracket = r[2] ? JSON.parse(r[2]) : null; } catch (e2) { bracket = null; }
    return { event: r[0] || '', seeds: seeds, bracket: bracket, updatedAt: r[3] || '' };
  }).filter(function (d) { return d.event === 'Singles' || d.event === 'Doubles'; });
  return jsonOut_({ desk: deskRows, walkups: walkupRows, draw: drawRows });
}

// Staff-set scholarship meter — upserts raised/goal into the Config tab (Key |
// Value) that the public meter reads via mapConfig (lib/sheet.js). Lets the
// admin bump the public total from the ops console (phone-friendly, courtside)
// instead of hand-editing the sheet, and auto-creates a correctly-formatted
// Config tab so an empty/misnamed tab can't silently pin the meter to its
// hardcoded fallback. Matches existing rows by the SAME fuzzy keys mapConfig
// uses, so it won't create a duplicate next to a "Funding"/"Target" row.
function writeConfig_(payload) {
  if (!payload) return;
  var sheet = sheetByName_('Config', ['Key', 'Value']);
  var rows = readRows_(sheet);
  var upsert = function (re, canonical, val) {
    if (val === undefined || val === null || val === '') return;
    var n = parseInt(String(val).replace(/[^0-9]/g, ''), 10);
    if (isNaN(n) || n < 0) return;
    for (var i = 0; i < rows.length; i++) {
      if (re.test(String(rows[i][0] || '').trim().toLowerCase())) { rows[i] = [rows[i][0], n]; return; }
    }
    rows.push([canonical, n]);
  };
  upsert(/raised|funding|amount|current/, 'raised', payload.raised);
  upsert(/goal|target/, 'goal', payload.goal);
  // Schedule inputs for the public "when's my next match" estimate — same
  // fuzzy keys mapConfig reads (courts / doubles match min / singles match
  // min / warmup min).
  upsert(/court/, 'courts', payload.courts);
  upsert(/doub.*min/, 'doubles match min', payload.doublesMin);
  upsert(/sing.*min/, 'singles match min', payload.singlesMin);
  upsert(/(qf|quarter).*min/, 'qf match min', payload.qfMin);
  upsert(/warm/, 'warmup min', payload.warmupMin);
  // Yes/no flags get their own upsert (the numeric one above would mangle
  // them). "seeds final" flips the public board to Final Seeds and turns
  // open first-round bracket lines into BYEs — same fuzzy key mapConfig reads.
  var upsertFlag = function (re, canonical, val) {
    if (val === undefined || val === null || val === '') return;
    var v = (val === true || /^(y|yes|true|1|on)$/i.test(String(val))) ? 'yes' : 'no';
    for (var i = 0; i < rows.length; i++) {
      if (re.test(String(rows[i][0] || '').trim().toLowerCase())) { rows[i] = [rows[i][0], v]; return; }
    }
    rows.push([canonical, v]);
  };
  upsertFlag(/final|lock/, 'seeds final', payload.seedsFinal);
  writeRows_(sheet, rows);
}

// Drop a match by its admin id when it's removed from the draw, so it stops
// showing on the public Live Scores board. No-op if the id was never written
// (e.g. a blank match deleted before it was ever edited/pushed).
function deleteMatch_(payload) {
  var sheet = sheetByName_('Matches', MATCH_HEADERS);
  var rows = readRows_(sheet);
  var idCol = MATCH_HEADERS.length - 1;
  var kept = rows.filter(function (r) {
    return String(r[idCol] || '') !== String(payload.id || '');
  });
  if (kept.length !== rows.length) writeRows_(sheet, kept);
}

// Public announcements (weather delays, schedule changes, round calls, lost &
// found…) — staff-authored via the admin Announce tab, rendered on the public
// site's banner + Home feed. Upsert by the admin's id so a post can be
// corrected in place; message is length-capped server-side (the write token is
// only a deterrent, so don't let this become a free public billboard).
function writeAnnounce_(payload) {
  if (!payload || !payload.id) return;
  var sheet = sheetByName_('Announcements', ANNOUNCE_HEADERS);
  var rows = readRows_(sheet);
  var idx = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '') === String(payload.id)) { idx = i; break; }
  }
  var row = [
    String(payload.id),
    String(payload.ts || new Date().toISOString()).slice(0, 40),
    String(payload.event || 'Both').slice(0, 20),
    String(payload.category || 'general').slice(0, 20),
    String(payload.message || '').slice(0, 500).trim(),
  ];
  if (!row[4]) return; // no empty announcements
  if (idx >= 0) rows[idx] = row; else rows.push(row);
  writeRows_(sheet, rows);
}

function deleteAnnounce_(payload) {
  var sheet = sheetByName_('Announcements', ANNOUNCE_HEADERS);
  var rows = readRows_(sheet);
  var kept = rows.filter(function (r) {
    return String(r[0] || '') !== String((payload && payload.id) || '');
  });
  if (kept.length !== rows.length) writeRows_(sheet, kept);
}

// ---- sheet helpers --------------------------------------------------------

function sheetByName_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function readRows_(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
}

function writeRows_(sheet, rows) {
  var cols = Math.max(sheet.getLastColumn(), 1);
  var last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, cols).clearContent();
  if (rows.length) sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

// --------------------------------------------------------------------------
// WHY CHECK-IN / PAYMENT / WALK-UP STATE LIVES IN ITS OWN TABS, NOT THE ROSTER
// --------------------------------------------------------------------------
// Check-in/paid/shirt/walk-up state is per-player overlay data — operational
// and private, not public roster state — so it does NOT get written into the
// raw Form-responses roster tab. Writing into that tab from a script would be
// risky: Forms owns its shape (a new submission can append a column and
// silently shift "column N is Status" writes into the wrong cell), matching
// a write-back to "the same person" by name alone is fragile with duplicate/
// changed names, and the admin's overlay model doesn't map 1:1 onto the
// sheet's single free-text Status column anyway.
//
// Instead it lives in the dedicated PRIVATE "OpsDesk" / "OpsWalkups" tabs
// above (writeOpsDesk_ / writeWalkup_ / opsDeskOut_) — explicit columns, an
// upsert-by-name (or by walk-up id) contract, and per-field last-write-wins
// so two devices editing different fields for the same person never clobber
// each other. Neither tab is ever added to READABLE, so this state can't
// flow through the public Cloudflare read path even by mistake.

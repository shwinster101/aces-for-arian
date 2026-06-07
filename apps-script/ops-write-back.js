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
//   • Seeds          -> mirrors the admin's seed list into a "Seeds" tab,
//                       which the public "Projected Seeds" tab already reads
//                       live via SEEDS_CSV_URL + mapSeeds (see lib/sheet.js).
//   • Court board    -> mirrors the 9-court Now/Next grid into a "Courts"
//                       tab, which the public "Live Court Board" already
//                       reads live once COURT_BOARD_CSV_URL is set.
//   • Match scores   -> mirrors each match edit into a "Matches" tab, which
//                       the public "Live Scores" section reads live via
//                       MATCHES_CSV_URL + mapMatches.
//   • Registrations / check-ins / payments are intentionally NOT handled
//     here — see the note at the bottom of this file for why, and what it
//     would take to add them safely.
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
// ==========================================================================

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    switch (body.type) {
      case 'seeds':        writeSeeds_(body.payload); break;
      case 'court-board':  writeCourtBoard_(body.payload); break;
      case 'match':        writeMatch_(body.payload); break;
      case 'match-delete': deleteMatch_(body.payload); break;
      // 'participant' / 'walk-up': see the note at the bottom of this file.
    }
  } catch (err) {
    // Apps Script web apps can't hand a readable response back to a
    // mode:'no-cors' fetch anyway, so there's no one to tell — just don't
    // let a bad payload 500 the endpoint for the next request.
  }
  return ContentService.createTextOutput('ok');
}

var SEED_HEADERS  = ['Name', 'Event', 'Rank', 'Result', 'UTR', 'WTN', 'Note'];
var COURT_HEADERS = ['Court', 'Now', 'Next'];
var MATCH_HEADERS = ['Event', 'Round', 'Num', 'Player A', 'Player B', 'Court', 'Status', 'Score', 'Winner', 'ID'];

// The admin sends its full seed list for one event on every change (add,
// remove, reorder, edit). The admin is the source of truth for order, so
// the simplest correct move is: drop that event's old rows, append the new
// ones — no row-by-row diffing that could drift out of sync.
function writeSeeds_(payload) {
  var sheet = sheetByName_('Seeds', SEED_HEADERS);
  var rows = readRows_(sheet);
  var keep = rows.filter(function (r) {
    return String(r[1] || '').trim().toLowerCase() !== String(payload.event || '').toLowerCase();
  });
  // Position in the list IS the seed rank — the admin reorders by moving rows,
  // so derive Rank from index here rather than trusting a stored s.rank that
  // goes stale on reorder/remove. This keeps the public badges contiguous
  // (1..N) and in exactly the order staff set.
  var fresh = (payload.list || []).map(function (s, i) {
    return [s.name || '', payload.event, i + 1, '', '', '', s.notes || ''];
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
// WHY 'participant' / 'walk-up' AREN'T HANDLED HERE
// --------------------------------------------------------------------------
// Those events carry per-player overlay data — checked-in, paid, shirt size,
// registration status, walk-up entries — and on the public site that maps
// onto the live roster's "Status" column (see mapRoster in lib/sheet.js).
//
// That roster tab is the raw Google Form responses sheet. Writing into it
// from a script is riskier than the three tabs above:
//   • Forms own that sheet's shape — a new submission can append a column,
//     and a script that "knows" column N is Status can silently start
//     writing into the wrong cell after that happens.
//   • Matching a write back to "the same person" by name alone is fragile
//     with duplicate/changed names, and a bad match overwrites a stranger's
//     row.
//   • The admin's overlay model (regStatus/paid/shirt/checkedIn) doesn't
//     map 1:1 onto the sheet's single free-text Status column, so closing
//     this loop cleanly really wants either (a) dedicated columns added to
//     the form-responses sheet on purpose, or (b) the admin reading its
//     overlay back from a separate "Ops" tab instead of localStorage —
//     which is a real architecture change (shared state + conflict handling
//     across devices), not a quick write-back addition.
//
// Net effect: check-in / payment / regStatus changes stay local to each
// admin device for now (as they always have), and the roster's "Verified"
// badge on the public site keeps coming from whoever edits the sheet's
// Status column by hand. If you want this closed too, the safest path is to
// add explicit "Ops Status" / "Ops Paid" / "Ops Checked-in" columns to the
// roster sheet by hand, point this script at those by header name (the same
// flexible-header pattern mapRoster already uses), and have mapRoster read
// them — that's a contained follow-up, not a rewrite, but it's a deliberate
// decision about the sheet's shape that's best made with eyes open rather
// than baked in here silently.

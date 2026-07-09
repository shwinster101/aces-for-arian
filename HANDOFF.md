# Handoff — Aces for Arian site + tournament ops console

Purpose: give a fresh session the current shape of the project without
re-deriving it from memory. Memorial tennis tournament: **July 11-12, 2026**,
Dunlap HS, Peoria IL.

Last regenerated: 2026-07-07. Current implementation base: `d69aa58` on `main`
plus the 2026-07-07 audit-fix commit on `claude/aces-ariane-audit-nit795`.
Companion docs: `docs/audit-2026-07-07.md` (full three-persona audit +
go-live verdict) and `docs/next-audit-handoff.md` (tab-by-tab scrub
checklist for the next auditor).

---

## 0. Current State

- **Live site:** https://aces-for-arian.pages.dev/
- **Reliable hash route:** https://aces-for-arian.pages.dev/#home
  - `/home#home` did not fetch cleanly from Codex web access; prefer root + hash unless
    clean path fallback is deliberately configured.
- **Admin console:** `/admin.html`, PIN-gated. The PIN is a casual deterrent only because
  this is still a static client bundle.
- **Read path:** browser -> Cloudflare Pages Function `/api/sheet?tab=...` -> token-gated
  Apps Script `doGet` -> restricted/private Google Sheet.
- **Write path:** admin -> Apps Script `/exec` via fire-and-forget `no-cors` POST.
- **Core semantic decision:** public `Verified` means **confirmed entry**, not paid.
  Real payment confirmation lives only in the admin **Payments** tab.
- **Ace chip:** visible as a public teaser even at `0 Aces hit live`.
- **Scholarship meter:** staff-controlled by Config `raised` as the authoritative public
  total. Do **not** infer dollars from public `Verified` entries.
- **Latest deployed admin asset checked:** `/assets/admin-BaWGGEeq.js`.
- **Latest deployed OpsStatus check:** `/api/sheet?tab=OpsStatus` returns only
  `Chethan Manika,Pending`; the previous `__verify_test__` row is scrubbed from
  the public endpoint.

---

## 1. Session Summary — 2026-07-09 multi-device ops sync + volunteer PIN

Day-of ops runs on ~5 devices (volunteer phones, the owner's HQ phone, the
check-in laptop). Check-in/payment/shirt/walk-up state was device-local by
design (see the old "why check-in isn't handled" note in
`apps-script/ops-write-back.js`) — that note itself named the fix: "a
dedicated private Ops tab with explicit columns and conflict rules." Built
that.

- **Two-tier PIN** (`src/admin/auth.js`): `2311` → `'hq'` (all 7 tabs),
  `0526` → `'desk'` (Check-ins/Payments/Scores & Courts only — volunteer
  tier). Both remain client-side deterrents (static bundle, same trust model
  as before) — `role()` derives from the stored PIN so a rotated/removed PIN
  falls back to locked. `AdminApp.jsx` filters `TABS` and shows a
  "Volunteer" tag in the header for the desk role.
- **Private sync tabs** (`apps-script/ops-write-back.js`): NEW `OpsDesk`
  (Name | CheckedIn | CheckedInAt | Paid | PayMethod | ShirtGiven |
  ShirtSize | UpdatedAt) and `OpsWalkups` — **neither is ever added to
  `READABLE`**, so this state can't flow through the public Cloudflare read
  path even by mistake. `writeOpsDesk_` upserts by name and only overwrites
  the columns a device actually sent (`fields`), so two devices editing
  different fields for the same person can't clobber each other — per-field
  last-write-wins, not per-row. `writeWalkup_`/`deleteWalkup_` upsert/delete
  by the admin's local walk-up id. Read back via `mode=opsdesk` (own
  `OPSDESK_TOKEN`, JSON out via new `jsonOut_`).
  ⚠️ **Requires the Apps Script redeployed** (Manage deployments → New
  version) — same drill as the email-blast token two days ago.
- **Store** (`src/admin/store.js`): `setOverlay` now pushes ONLY the synced
  subset of a patch (`checkedIn/checkedInAt/paid/paymentMethod/shirt/
  shirtSize` — `SYNCED_OVERLAY_FIELDS`; `notes`/`regStatus`/`partner` stay
  local) as `{ type: 'opsdesk', payload: { name, fields } }`; `addWalkUp`/
  `removeWalkUp` push `walkup`/`walkup-delete`. A poll (`pullDesk`, every
  25 s while the tab is visible, plus on every return to foreground and on
  the header's manual Sync button) GETs `mode=opsdesk` and merges the result
  in. **Local-edit guard**: a name/walk-up id this device touched in the
  last 45 s is left alone for that poll tick, so a just-tapped toggle can't
  be flickered back by a GET that was already in flight — the next poll
  picks up the merged state once it's landed server-side. A failed/blocked
  fetch is a silent no-op; every device still works fully offline exactly
  like before.
- **Check-in page** (`src/admin/sections/CheckIns.jsx`): each row now shows
  a shirt-size badge (`overlay.shirtSize || registered shirtSize`) plus a
  synced "Shirt given" toggle using the SAME `overlay.shirt` field Payments
  already used — so the two tabs can never disagree about who's gotten
  their tee. New "Shirts given" stat. Amber "device-local, ONE phone" notes
  on Check-ins/Payments replaced with "Synced across devices (~30 s)";
  Merch's stays device-local by choice (inventory counts are a planning
  tool, not day-of desk state, per owner's scope call).
- ⚠️ Both `OPSDESK_TOKEN` and the two PINs ship in the admin bundle —
  deterrents only. Rotate all three after the event.
- ⚠️ The browser→script.google.com GET (`mode=opsdesk`) can't be exercised
  from this sandbox (network policy blocks it) — same caveat as
  `mode=emails` two days ago. Verify on a real phone once redeployed;
  everything gracefully degrades to local-only behavior if it fails.

---

## 1b. Session Summary — 2026-07-09 external-audit triage + release stabilization

An outside audit of the live site was fact-checked against this repo. Two of
its P0s were FALSE; the real items shipped:

- **"Live/local source mismatch" — FALSE.** Live bundle `main-7HZghj78.js`
  is byte-identical to a clean build of `main` @ 182b920 (Vite content-hashes
  filenames; same name = same bytes). Live == main. The auditor's own
  checkout was dirty (modified App.jsx/AdminApp.jsx, untracked AGENTS.md /
  index.html.bak). ⚠️ If that checkout still exists somewhere: never deploy
  from it; diff and discard its edits.
- **"Missing merch-tee.jpg" — FALSE.** All four merch images are in
  `public/`; referenced in the Merch tab.
- **Domain swap (real item, shipped):** OG/Twitter meta (`index.html`), the
  share URL, and the .ics DESCRIPTION/URL now point at
  **https://acesforarian.com/**. The .ics **UID intentionally keeps** the old
  pages.dev string — it's invisible, and changing a UID makes re-downloaded
  invites import as duplicate calendar events. pages.dev keeps serving as a
  fallback; the ONLY pages.dev reference left in the bundle is that UID.
- **Player checklist (shipped):** Home card under the announcements feed —
  arrive 15 early / gear / $40 Venmo / draws Thursday afternoon + Brackets
  tab day-of / late entry via text-or-email. Closed-reg CTA also gained the
  acesforarian@gmail.com mailto for late entries.
- **Device-local warnings (shipped):** amber one-liners on ops Check-ins,
  Payments, and Merch — run each from ONE phone (no cross-device sync).
  Seeds/draws/scores/announcements DO sync via the sheet; only those three
  tabs are local.

---

## 1a. Session Summary — 2026-07-08 leak fix + locked engine rows + email blast

**Why:** the owner's screenshot showed the PUBLIC Live Court Board + Live
Scores displaying real participant names pre-reveal. Root cause: ops draw
generation pushes real rows to the Matches tab (the `match` handler IS
deployed), and the match-derived public surfaces gated only on `matchesLive`
— `DRAWS_PUBLIC` covered the brackets, not the boards.

- **Gating fix (`src/App.jsx`)**: `useMatchBoard` (court board + find-my-match
  + Home live strip via `liveDay`) and the Live Scores card are now ALL behind
  `DRAWS_PUBLIC && matchesLive && matches.length`. Polling/write logic is
  untouched — data keeps flowing, display waits; on reveal everything lights
  at once. Verified: pre-reveal, a Matches fixture full of names renders NO
  name anywhere on any public tab (verify13); reveal build regression 8/8
  (verify12).
- **RUNBOOK — stale leaked rows**: the rows already in the Matches tab carry
  old test names. After this deploys: ops → Seeding → per event **Clear**
  (pushes match-delete) → **Regenerate**. Any stray row pushed from another
  device: hand-delete it in the Matches tab once.
- **Locked engine rows (Match Order)**: rows with ids `S-`/`D-` now render
  number/round/names as read-only text with a "Managed by Draw board" tag —
  no ↑↓ / delete / name inputs (they'd fight the numbering contract or get
  clobbered by re-sync). Court + status stay editable. `moveMatch` now swaps
  numbers between hand-added rows only and no-ops on engine rows; `addMatch`
  numbers new rows max(num)+1 so they can't collide with bracket numbers.
- **Email blast (ops Announce tab, bottom)**: Gmail-BCC list card —
  "Fetch from sheet" pulls the roster's email column via the Apps Script
  `?mode=emails&token=EMAILS_TOKEN` (NEW token, separate from read/write;
  requires redeploying the Apps Script — Manage deployments → New version),
  manual add (comma/space/newline, validated, case-insensitive dedupe),
  removable chips, **Copy BCC** (comma-separated, pastes straight into
  Gmail BCC). List is device-local (`store.emails`); emails still NEVER
  flow through the public endpoint (main bundle grep is clean).
  ⚠️ EMAILS_TOKEN ships in the admin bundle — deterrent only, accepted
  tradeoff; **rotate it after the event** (Announce.jsx + Apps Script).
  ⚠️ The cross-origin fetch couldn't be exercised from this sandbox —
  verify on the phone; manual add is the fallback either way.
- **Courts**: 9 everywhere (SCHEDULE_DEFAULTS, ops Schedule card, copy) —
  confirmed, no change needed.
- Scores-tab reminder (unchanged): mark winners on the Draw board, not the
  Scores tab — bracket re-sync overwrites winner/status on engine rows.

---

## 1b. Session Summary — 2026-07-07 FULL bracket engine (all rounds)

`src/lib/draw.js` now models the COMPLETE tournament as a static feeder
graph evaluated from R1 slots + a results map:

- **Doubles**: full compass — East R16→QF→SF→F; E R1 losers → West (cross-
  half), E QF losers → North, West R1 losers → South; West/North/South play
  to their finals.
- **Singles**: full 32 double elim — Winners W1..F; Comeback L1..L8 with
  reversed drop-ins (delays rematches); **Grand Final (M62) + bracket reset
  (M63)**, the reset appearing only if the Comeback champ takes the GF.
- **Byes cascade as walkovers**: a side whose source can never produce a
  player is "dead"; live-vs-dead auto-advances (a 4-player field walks the
  seeds to the semis correctly). Dead lines render "—", aren't posted.
- **Corrections are safe**: marking a winner twice un-marks it; ANY result
  change invalidates all downstream results (the engine clears them) so
  stale advancement can't survive; ops re-marks affected matches.
- **NUMBERING CONTRACT** (draw.js header): ops match numbers now mirror the
  public templates exactly for EVERY round (doubles East 1-15 / West 16-22 /
  North 23-25 / South 26-28; singles winners 1,25,41,53,59 / comeback
  17,33,45,49,55,57,60,61 / GF 62 / reset 63). Draws are always full size
  (32/16) for this reason. In App.jsx, `overlayRounds` + `engineRowsFor`
  (id-prefix S-/D-) fill EVERY public bracket line + estimate chips from
  posted rows — the public draw now updates live through the whole event,
  including the GF card (names at 62, reset note at 63).
- Match Order posts contested matches only (walkovers/byes never post);
  Scores-set 'live' status now survives bracket re-syncs.
- Verified 20/20 ops (compass chain E→W→N→S, backdraw chain W1→L1→L2
  reversed drop, un-mark downstream invalidation, bye cascade to the SFs,
  contested-only posting) + 8/8 public all-rounds overlay + 9/9 + 11/11
  regressions.

---

## 1-oa. Session Summary — 2026-07-07 ops-interface audit (draw → public)

Audited the ops→public seams and fixed three interface gaps so "save the
draw → reveal" displays correctly:

- **Public R1 now mirrors the ops draw** (`overlayR1` in `App.jsx`): the
  seed-derived first round is overlaid with the posted Matches rows (round
  `R1`, matched by num+event), so drag-balanced placements and pencil name
  fixes reach the public bracket. Unposted lines (byes) fall back to
  seed-derived labels.
- **One name format everywhere**: public bracket names (both events) now use
  the shared `shortLabel` ("First L. 'YY") — same as the ops draw, court
  board, and Live Scores. `shortTeamLabel` in App.jsx was removed.
- **Estimate chips are R1-only** (`r1RowsFor` filters round==='R1';
  `Bracket` passes `estFor` only to round 0; only East/Winners get it):
  fixes num collisions where ops R2/consolation numbering overlapped public
  Comeback/QF lines and would have cross-wired names/estimates.
- **Theme**: ops draw-board winners now read GOLD (public convention:
  gold = winner/final, emerald = live); match-card headers carry a maroon
  strip. Public unchanged (already maroon/gold).
- **Confirmed**: the `match`/`match-delete` write path is in the CURRENTLY
  deployed Apps Script (June dry run), so saving the draw feeds the public
  live board with NO redeploy. Redeploy still gates announce / `seeds
  final` / schedule-config persistence.
- Caveats (by design, documented): mark winners on the Draw board (a
  final set only in Scores is reset to scheduled if the bracket re-syncs);
  manual a/b edits to `S-`/`D-` Match Order rows are clobbered by the next
  bracket re-sync.
- Verified: 9/9 reveal simulation (DRAWS_PUBLIC temporarily true + ops-shaped
  fixtures: override visible publicly, decoy R2/Comeback rows produce zero
  chips, find-yourself works on short names), 6/6 ops regression, 11/11
  hidden-state. Shipped with DRAWS_PUBLIC back to false.

---

## 1-se. Session Summary — 2026-07-07 schedule estimates

New **"when's my next match"** estimate wired through seed → draw → schedule.

- `src/lib/schedule.js` (pure): `matchEstimate`/`estimateLabel` — "~N matches
  ahead · ~min · around H:MM" from the live match queue. Wave model: with C
  courts, matches clear ~C at a time each ~matchMin; +warmup before the first
  wave. Live → "On court N", final → "Final". All approximate.
- **Inputs** (`store.schedule`, defaults 9 courts / doubles 40 / singles 50 /
  warm-up 10): ops **Schedule card** in Seeding sets them (`setSchedule` →
  local + `pushConfig`); `mapConfig` parses `courts` / `doubles match min` /
  `singles match min` / `warmup min`; `writeConfig_` upserts them (**needs the
  Apps Script redeploy** to persist for the public; defaults apply until then).
- **Shown everywhere**: ops DrawBoard R1 match cards, public **Find my match**
  (label now carries ahead + time), and public **bracket R1** matches
  (`MatchCard` `estFor` chip, matched by num+event to the live row — visible
  once DRAWS_PUBLIC is revealed). R1 numbering agrees between the ops engine
  and the public bracket, so the interface is robust for R1; deeper rounds
  annotate only once posted.
- Verified 5/5 in-browser incl. courts 9→2 growing the max wait 10→160 min.

---

## 1-be. Session Summary — 2026-07-07 bracket engine (ops)

New **bracket engine** — `src/lib/draw.js` (pure) + `store.brackets` +
`DrawBoard` in `src/admin/sections/Seeding.jsx`. Ops-only.

- **Generate draw from seeds**: `buildDraw(event, seeds)` places entrants by
  standard `seedOrder` (mirrors the one in `App.jsx`), sizes to the **nearest
  power of 2** (`nextPow2`) with **byes to the top seeds**, and builds working
  feeders. Minimal state: R1 slot assignment + a `results` map; every
  downstream slot is derived by `resolve()` (so re-marking never leaves a
  stale advanced name).
- **This build = first round + next round**: winners advance to Winners R2;
  R1 losers drop to consolation (`Comeback` for singles double-elim, `West`
  for compass doubles, via `loserRoute` cross-half pairing). Deeper rounds
  (WB R3+, Comeback R2+, North/South) are the **Friday** build — the feeder
  model already carries what they need.
- **Drag-balance**: unseeded, non-bye R1 entrants are drag-swappable
  (`swapUnseeded`); seeds 1–8 and byes are locked.
- **Match Order sync**: generate / result / swap / clear RE-SYNC this event's
  flat `matches` rows (ids prefixed `S-`/`D-`) — contested R1 plus any
  next-round match whose both sides are known. Court/score entered on the
  Scores tab survive (merged by id); removed matches get `match-delete`.
  ⚠️ Those pushes hit the public board once **DRAWS_PUBLIC** is revealed AND
  the Apps Script is redeployed — inert until then.
- Verified 12/12 in-browser (seed placement, 12→16 byes+auto-advance, R1→R2
  advance, R1→Comeback drop, Match Order sync, compass East→West) + drag-swap.

---

## 1-ann. Session Summary — 2026-07-07 announcements pass

**Also 7/7: registration deadline extended to end of day July 8** (owner
decision). The `regClosed` date constant and every "July 6" copy mention in
`App.jsx` moved to July 8, so the Register widget is open again until then.
Note: the printed flyer image still says "Register by July 6th" — the site
copy supersedes it; swap `public/flyer.jpg` if an updated flyer exists.

**Public draws hidden behind `DRAWS_PUBLIC` (const in `App.jsx`, default
`false`, 7/7).** While false, the public Brackets tab hides BOTH draws (event
toggle + brackets + find-yourself search + the Rules "See the … bracket →"
links) behind a "draws post Wednesday, July 8" placeholder; SeedSuggestionBox
and the live boards stay. **Ops Seeding console is unaffected** — it still
shows/edits both events. **To reveal: set `DRAWS_PUBLIC = true`, ship.**

New **Announcements** system (weather emphasized), placed by first
principles: an announcement must reach people who aren't looking for it, so
it is NOT a tab —

- **Site-wide banner** under the sticky nav on every public tab: newest
  post, category icon + Doubles/Singles/Both chip + time-ago, per-post
  dismiss (localStorage), amber styling for weather. Tap → Home feed.
- **Home feed** (`#announcements` anchor) between the live strip and
  next-steps: full list, newest first, hidden when empty.
- **Admin "Announce" tab**: category pills (weather / schedule / round /
  courts / lost-found / food / awards / general), event pills, 400-char
  composer, posted-list with delete. `postAnnouncement`/`deleteAnnouncement`
  in `store.js` push `announce`/`announce-delete` (upsert/remove by id).
- **Data**: new public `Announcements` tab (`Id|Timestamp|Event|Category|
  Message`), allowlisted in `functions/api/sheet.js` + Apps Script
  `READABLE`; public site polls it every 60s (Matches-style backoff).
- **Fallback**: `FALLBACK_ANNOUNCEMENTS` in `App.jsx` shows until the live
  tab has rows — currently seeded with the real Dunlap weekend forecast
  (weather.com, pulled Tue 7/7): Sat sunny ~91°F SSW 5–10 mph; Sun ~86%
  thunderstorms, ~80°F, NE ~10 mph.
- **⚠️ Apps Script redeploy required** for live announcements (new
  `announce`/`announce-delete` handlers + `Announcements` in `READABLE`).
  Until then the site shows only the fallback post and admin posts are
  dropped upstream. This joins §9 item 1.
- Ops should refresh the weather post from the courts as the forecast
  firms up — the fallback is honest ("as of Tue 7/7") but static.
- **Weather corrected against Apple Weather (7/7):** earlier posts had it
  backwards. Apple shows **Saturday** = wet early morning (~25% at 6–7 AM)
  clearing to partly cloudy, high **83°F**; **Sunday** = sunny/hot, high
  **87°F**, hourly rain ~0% through play (40% daily headline only). Saturday
  now leads (banner) as the actionable day. Temps are Apple-exact; **wind is
  omitted** — no Apple wind panel was pulled. Add wind if a panel is provided.

---

## 1-prev. Session Summary — 2026-07-07 later pass (phase-aware ordering)

Tab-by-tab flow review from the same three roles, then a first-principles
pass: widget order now follows the tournament phase the app already tracks.

- **Brackets tab is live-aware** (`liveDay` = first match posted): draw week
  renders draws-first as before; once ops posts a match, the Live Court Board
  (with find-my-match) and Live Scores render ABOVE the brackets. Same cards,
  order only. Test both phases (next-audit doc has the fixture-route recipe).
- **Home live strip**: a "We're live — court board & scores" banner appears
  under the hero on live day, linking to Brackets.
- **Mobile Home reorder**: Coordinators / rules / Getting There stack before
  the roster on phones (CSS `order-*`; desktop unchanged).
- Brackets draft intro is now phase-aware (no more future-tense "until
  registration closes July 6" after the close).
- Singles tiebreak published: **7-point tiebreak at 6–6**. Awards wording
  stays intentionally vague (owner decision). Both name-search inputs on
  Brackets carry disambiguating captions; Home links to full Rules; Rules
  event cards link to their brackets.

---

## 1a. Session Summary — 2026-07-07 (deep audit, T-4 days)

Full three-persona audit (off-site ops manager / seed-focused varsity player /
casual fan) — findings, evidence, and the go-live verdict are in
`docs/audit-2026-07-07.md`. Material changes in the audit-fix commit:

- Public site now **re-polls Config / SeedBoardPublic / OpsStatus every ~2 min**
  (previously fetch-once-on-mount; only Matches/Aces polled). Admin "~1 min"
  copy corrected accordingly.
- **Hardcoded `topSeeds` fallback deleted** from `App.jsx` — it shipped
  committee-style joke notes about named players in the public bundle and
  rendered named seeds while the copy claimed placeholders. Seeds now come
  exclusively from `SeedBoardPublic`; brackets are honest TBD until published.
- **Closed-registration state**: past July 6 the countdown reads "sign-ups
  closed (July 6)" (was "close closed") and every Register CTA demotes to a
  "text a coordinator about late entry" note with the form still linked.
  (PR #14's revert to the original form was intentional — the form recovered.)
- **False-BYE guard**: admin field-lock now warns with per-event counts when
  registered entrants are missing from the seed list before locking.
- **Honest push indicator**: "last push attempted" (fire-and-forget no-cors
  can't confirm delivery); clearOps dialog now says pushed sheet data stays
  live; admin Seeding "View live" points at `#brackets` (Projected Seeds tab
  is gone).
- Rules: singles tiebreak line (interim wording pending committee rule),
  map/parking/spectator/rain-channel logistics, "How are seeds decided?" FAQ,
  Sunday 8 AM surfaced on Home + .ics, guarantee copy unified, 2026-scholars
  funding note.

Changes NOT yet reflected here from the 2026-06-17 → 2026-07-06 span (all on
`main`): home flyer-hero redesign, merch overhaul with real products/pricing,
ops seeding overhaul (`src/lib/entrants.js`, field picker, seed bands,
byes-on-lock, dnd-kit), public seed privacy (top-8 chips only, Projected
Seeds tab removed, `#seeding` → Brackets), public word-bank seed-suggestion
tool (token-less `idea` email pipeline), and the `seeds final` Config flag in
Apps Script (**redeploy required** — see §8).

Pre-Saturday manual checklist (owner): (1) redeploy Apps Script + end-to-end
dry run, (2) shuffle 9-16/17-32 seed order within bands before locking,
(3) one-authoritative-device-per-domain runbook (check-ins / payments / aces
/ scores+walk-ups), (4) confirm singles tiebreak + ace sponsor terms.
Venue naming is settled: "DHS Tennis" + maps search link, no street number.
Details: audit doc §4.

---

## 1b. Session Summary — 2026-06-16

Material changes now on `main` from Claude-assisted commits:

- `ec00e9b`
  - Open Graph/Twitter card image changed from the tiny logo to the real tournament photo
    `photo2.jpg`.
  - Added explicit social-image width/height and descriptive alt text.
- `2fae536`
  - Added `NotifyMeBox`, a public email capture surface under the Home hero and as a
    universal strip above the footer.
  - Apps Script now handles public `subscribe` posts by appending validated, length-capped,
    deduped emails to a private `Subscribers` tab.
  - `Subscribers` is intentionally absent from `functions/api/sheet.js` read allowlist, so
    captured emails are not served publicly.
  - Added Register CTAs off Home: Legacy primary `Register to Play — $40`, Scholarship
    `Fund it by playing`.
  - Reconciled Legacy copy: `5th Annual Aces for Arian` refers to the memorial event name;
    `7th straight summer` counts the Eagle Classic origin year in 2020.

Current Codex/local material changes:

- Public tab order is now visitor-first:
  `Home -> Rules -> Brackets -> Projected Seeds -> Scholarship -> Legacy -> Photos -> Merch`.
- `draws` remains the internal tab id for the public `#brackets` hash; no route/hash semantics changed.
- Draw copy is reframed away from visible `loser/losers` wording:
  - Compass draw uses `Championship path`, `Second path`, `Placement path`, and `Final placement path`.
  - Singles lower path is now `Comeback Bracket`, with `Comeback R1...` labels.
  - Rules says every player has a `two-match cushion`.

Verification completed for the local Codex changes:

- `npm run lint` passed.
- `npm run build` passed.
- Local browser check passed: desktop and mobile navigation order match the visitor-first order.
- Local browser check passed: `#brackets` still resolves to the Brackets tab.
- Local browser check passed: no visible `loser/losers` wording in Brackets/Rules views.

Current local-only/untracked files:

- `AGENTS.md`
- `CLAUDE.md`
- `index.html.bak`

---

## 2. Session Summary — 2026-06-15

Material changes now on `main`:

- `src/admin/sections/Registrations.jsx`
  - Registration status is now a two-state admin flow: `confirmed` or `pending`.
  - Waitlist was removed from filters, counts, copy, and active controls.
  - The status chip now displays the same effective status used by counts:
    sheet `Verified` rows display as `CONFIRMED` immediately, even before a local overlay exists.
  - Copy now says confirmation can take up to a day, so pending is expected.
- `src/admin/ui.jsx`
  - `StatusBadge` displays internal `Verified` as `Confirmed`.
  - `RegStatusChip` cycles only `confirmed <-> pending`.
  - Legacy/unknown local values fall back to `pending`.
- `src/admin/store.js`
  - Match write-back now sends the full public match payload on each update/reorder.
  - This prevents partial patch rows from losing `event`/`num` server-side and accidentally
    rendering a Doubles match as Singles.
- `functions/api/sheet.js`
  - `OpsStatus` CSV is scrubbed at the Cloudflare read boundary: sentinel/test rows whose
    names start with `__` are not returned publicly.
- `src/lib/sheet.js`
  - `mapOpsStatus` also ignores sentinel/test names that start with `__`.
- `apps-script/ops-write-back.js`
  - Added matching `OpsStatus` sentinel-row filtering and rejects future sentinel status writes.
  - This Apps Script logic is committed, but the script still needs a **New version -> Deploy**
    if the deployed Apps Script should enforce the same rule before Cloudflare receives data.
- `index.html`
  - Added Open Graph + Twitter social-share preview tags.

Verification completed:

- `npm run lint` passed.
- `npm run build` passed.
- Local admin browser check passed: no waitlist text, confirmed fallback rows show confirmed chips.
- Cloudflare function fixture test scrubbed `__verify_test__`.
- Live `/api/sheet?tab=OpsStatus` returned `Name,Status` and `Chethan Manika,Pending`.
- Live `/admin` served `admin-BaWGGEeq.js`.

Current local-only/untracked files:

- `AGENTS.md`
- `CLAUDE.md`
- `index.html.bak`

Run before handing off or committing:

```bash
npm run lint
npm run build
```

Both passed after the latest admin/status patch.

---

## 3. Architecture

Vite multi-page build:

```text
index.html  -> src/main.jsx       -> src/App.jsx
admin.html  -> src/admin/main.jsx -> src/admin/AdminApp.jsx
both import -> src/lib/sheet.js
public read -> functions/api/sheet.js
write-back  -> apps-script/ops-write-back.js
```

Important build detail: `src/lib/sheet.js` is shared by public and admin entries, so Vite
usually compiles it into the shared `jsx-runtime-*.js` chunk. If verifying constants in `dist`,
grep the shared chunk too, not only `main-*.js` or `admin-*.js`.

---

## 4. Data Model And Privacy Contract

### Public-safe roster fields

The public site may consume/display:

- Name, but rendered privacy-light as first name + last initial only when needed.
- Class/year.
- Event selection.
- Doubles partner.
- Public status: `Verified`/`Pending`, displayed as `Confirmed`/`Pending`.
- Bio/yearbook line if curated/acceptable.
- Hide flag.
- Shirt size, used for merch planning.

The public site must not expose:

- Email.
- Phone.
- Payment method.
- Payment confirmation.
- Check-in state.
- Raw comments/free text.
- Committee seed notes/votes/deliberation.

### Confirmed vs paid

- Public `Verified` == **confirmed entry**.
- Admin `overlay.paid` == **legit payment confirmation**.
- Public roster/funding language must not call `Verified` users "paid."
- If payment state ever needs multi-device sync, add a private backend/Ops tab with explicit
  fields and conflict rules. Do not write into raw Form Responses by name matching.

### Seed privacy

- Admin seed notes live in `localStorage` only.
- Client sends only display-safe seed names.
- Apps Script enforces `SeedBoardPublic` as `Name | Event | Rank`.
- Public site reads seeds from `SeedBoardPublic` only.

---

## 5. Sheet Tabs And URLs

All read URLs come from `sheetCsv(tab)` in `src/lib/sheet.js`.

Allowed/read tabs:

- `""` default roster/Form Responses tab, filtered at the Cloudflare and Apps Script boundary.
- `Config` -> `raised`, `goal`, `showBar`.
- `SeedBoardPublic` -> sanitized seed board.
- `Photos` -> gallery/photo URLs.
- `Courts` -> legacy/live board tab, still allowlisted.
- `Matches` -> live scores and queue-derived court board.
- `Aces` -> live ace count.
- `OpsStatus` -> display-safe public confirmed-entry overlay.
  - Rows with names beginning `__` are treated as test/sentinel rows and scrubbed.
- `Announcements` -> staff posts (Id | Timestamp | Event | Category | Message)
  for the public banner + Home feed. Polled every 60s.
- `Subscribers` is private and deliberately not allowlisted for public reads.

Write-back event types:

- `seeds` -> `SeedBoardPublic`.
- `match` / `match-delete` -> `Matches`.
- `aces` -> `Aces`.
- `status` -> `OpsStatus`.
- `announce` / `announce-delete` -> `Announcements`.
- `court-board` exists in Apps Script but the current public board is mostly match-derived.
- `participant`, `walk-up`, payment/check-in/shirt overlays are deliberately not sent.

Secrets/tokens are not real secrets if committed or bundled. They deter casual writes only.
Do not place read tokens in response bodies/headers.

---

## 6. Public Dashboard

Tabs:

- Home.
- Rules.
- Brackets (internal id `draws`; `#seeding` redirects here — the separate
  Projected Seeds tab was removed 2026-07-06).
- Scholarship.
- Legacy.
- Photos.
- Merch.

Key behavior:

- Header shows brand, five-year badge, ace teaser chip, scholarship meter, donate button.
- Ace teaser remains visible even at zero.
- Scholarship meter uses Config `raised` as the authoritative total; default is `$580`.
- `goal` default is `$1750`.
- Home roster displays confirmed entries and public-safe player info.
- Public status copy should say `Confirmed`, not `Verified`, and never `paid`.
- Brackets tab has:
  - Live Ace Tracker.
  - Match-derived court board / queue.
  - Find-my-match search.
  - Live scores.
  - Draft tournament draws.
- Photos use optimized local assets. Keep hero/gallery photos near the ~400-800 KB range.

---

## 7. Admin/Ops Console

Admin sections:

- Registrations.
- Check-ins.
- Payments.
- Seeding & Draws.
- Scores & Courts.
- Merch.

Important behavior:

- Registrations:
  - `confirmed` pushes public `Verified`/display `Confirmed` to `OpsStatus`.
  - `pending` pushes public `Pending`.
  - There is no active waitlist state.
  - Walk-ups stay local and do not appear on public roster.
- Payments:
  - Source of truth for whether a person has actually paid.
  - Current staff reference includes Venmo `@acesforarian` and admin-only Zelle.
  - Payment state stays local to device.
- Check-ins:
  - Local only.
- Scores & Courts:
  - Match scoring writes to `Matches`.
  - Ace tracker writes absolute count to `Aces`.
- Merch:
  - Shirt demand comes from roster shirt size.
  - Inventory/order counts are local to the gear-locker device.
- Footer has "Clear this device's ops data" for local cleanup.

UI principle: admin is a dense courtside tool. Prefer large tap targets, low decorative load,
and direct status feedback.

---

## 8. Deployment Notes

Cloudflare Pages:

- Push to `main` to deploy public/admin frontend and `functions/`.
- Verify live route at `https://aces-for-arian.pages.dev/#home`.
- Verify `/api/sheet?tab=` returns filtered public columns only.
- Verify unknown tabs return `400`.

Apps Script:

- For code changes, use **Deploy -> Manage deployments -> pencil -> New version -> Deploy**.
- Do not create a New deployment unless you also update `SHEET_WRITE_URL`.
- Comment-only changes do not require redeploy.
- Logic changes to `doPost`, `doGet`, `READABLE`, tokens, or Apps Script-side
  `OpsStatus` filtering require redeploy.
- Current note: `apps-script/ops-write-back.js` has new sentinel-row filtering and
  sentinel write rejection. Cloudflare already scrubs public `OpsStatus`, but redeploy
  Apps Script to keep the upstream boundary aligned.
- Current note: `apps-script/ops-write-back.js` also has the public `subscribe` handler
  for `NotifyMeBox`. Redeploy Apps Script as a new version before relying on live email
  captures; otherwise early subscribe POSTs can be dropped by the old token-gated script.
- Confirm `Subscribers` stays absent from `functions/api/sheet.js` allowlist.

Dry run checklist:

- Admin Registration `confirmed` -> public roster shows Confirmed after reload/read.
- Admin score edit -> public Live Scores updates.
- Admin ace `+1` -> public ace chip/tracker updates.
- Payment toggle remains admin-local.
- Check-in toggle remains admin-local.

---

## 9. Current Highest-Leverage Work

1. **Redeploy Apps Script as a new version** — now covers `subscribe`,
   `OpsStatus` sentinel filtering, the `seeds final` Config flag (field
   lock!), the `idea` pipeline the public seed-suggestion tool uses, AND the
   new `announce`/`announce-delete` handlers + `Announcements` in `READABLE`
   (live announcements are dead until this happens; the site shows only the
   fallback weather post). Then run the dry run in `docs/audit-2026-07-07.md`
   §4.1 plus: post a test announcement from admin → public banner/feed
   updates within ~1 min.
2. Merge the audit-fix branch to `main` and hard-reload the live site
   (go-live verdict: audit doc §5).
3. Day-of runbook: one authoritative device per ops domain (check-ins,
   payments, aces, scores/walk-ups).
4. Singles tiebreak is settled and published (7-point tiebreak at 6–6);
   ace sponsor terms ($5/ace, $500 cap) still unconfirmed for public copy.
   **When the draw locks: post real match times and update the Rules
   "Day-of Schedule" card** (still labeled tentative/2025 timeline).
5. Post-event: Cloudflare Access for `/admin`, token/PIN rotation, push
   delivery confirmation, admin Matches read-back, `App.jsx` split
   (backlog: audit doc §6).

---

## 10. Known Risks / Footguns

- Static admin PIN and write token are not real security.
- A public repo token is not secret; PII protection must happen by filtering at the data
  boundary.
- gviz historically returns the first sheet for missing tabs; keep missing-tab fallback
  detection in the Function.
- Cloudflare Pages Functions are still invoked per request; Cache API reduces upstream sheet
  load, not Function invocation count.
- Do not use cache-busting query params on sheet reads unless you intentionally want to bypass
  edge cache.
- Filename case matters on Cloudflare (`Bench1.jpg`, not `bench1.jpg`).
- `Config.raised` must be treated consistently as the public total. Do not put "external
  donations only" there unless the formula is changed again.
- `NotifyMeBox` uses `no-cors` and confirms optimistically; successful capture depends on
  the deployed Apps Script containing the `subscribe` handler.

---

## 11. Response Style Notes

User likes bullets and systems. Each response should include:

- One bullet for what changed materially.
- One bullet for the highest-leverage recommendation.
- Two high-leverage follow-up questions.
- A final estimated usage/cost line.

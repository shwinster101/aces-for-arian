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

## 1-cd9. Session Summary — 2026-07-10: singles pushed to 9 AM (rain) + best-of-3 finals knob + weather update

New Fri 7/10 forecast (Apple, Dunlap): rain moved back INTO both mornings —
wet overnight/early-AM each day, drying by ~9 AM. Owner call: **push Sunday
singles first serve from 8 AM to 9 AM** so courts dry + more sleep.

- **Singles anchor 8→9 AM** (`src/lib/schedule.js` `EVENT_START.Singles`). Every
  singles projection/label counts from 9:00 now. Updated all public "8 AM"
  singles references (checklist, ICS calendar, spectator info, schedule tiles,
  Sunday-singles card, planned-round-times banner first-serve).
- **`finalsMin` knob** (best-of-3 semis/finals): new Config key "Finals min" +
  Schedule-card field + `matchMinFor` branch. Applies ONLY to singles Winners
  SF, the Winners/Comeback finals, the Grand Final + reset (round tags in
  `SINGLES_FINALS`); QF (R3) stays a pro set; doubles unaffected. **Default 0**
  (pro sets — no public change) so best-of-3 is opt-in; set ~90 to model it.
  Wired through `sheet.js` mapConfig (`/final/ && /min/`), `store.js`
  `setSchedule`, and the "Planned round times" footnote (shows the best-of-3
  line only when finalsMin > 0).
- **Projected end times** (9-court sim, `scratchpad/verify/sim-src.mjs`,
  27-player field): the double-elim tail is long because the Comeback bracket
  is ~8 serial rounds. Grand Final ends **~7:50 PM** at 9 AM with pro-set
  finals; **~9:00 PM** with best-of-3 (finalsMin 90); a bracket reset adds one
  more finals-length match (→ ~8:50 PM pro / ~10:30 PM best-of-3). Flagged to
  owner as late; best-of-3 left opt-in for that reason.
- **Weather announcements** (`src/App.jsx` `FALLBACK_ANNOUNCEMENTS`): both
  Saturday + Sunday rewritten for the Fri 7/10 outlook (wet mornings drying by
  9 AM; Sunday explains the 9 AM push). New ids `-0710`, ts 2026-07-10.
- Verified: contract 75/75 (fixed the two 8:00→9:00 projection assertions the
  anchor change moved; added finalsMin unit checks + singles-only scoping),
  Scores flow 12/12, round-trip 15/15, doubles view 57/57, check-in 21/21, a
  weather-render probe (Sunday 9 AM message + Fri 7/10 stamp on Home),
  lint/build clean.

---

## 1-cd8. Session Summary — 2026-07-10: singles readiness audit + explicit "Save result" affordance

Owner: "is singles ready to flip? audit the logic and scores. make sure the ops
side has a way to edit score and match orders and results. intuitive 'button' to
save results so a volunteer knows it's saved."

**Audit verdict — singles logic & scores are correct and safe to reveal.** Byes
for the 27-in-32 field feed M1/M5/M7/M9/M13 (seeds 1–5 walk into R2);
`structuralSkips` = the right 11 nums; loser/comeback routing incl. reversed drops
(L of M54 → M57) matches `graphFor` on all 92 edges; scores ride the winner's
advancing line; the M63 bracket-reset conditional (active only if the comeback
player wins M62) is correct. **Gate stays `Singles: false`** — owner flips Sunday.

**One real bug found + fixed:**
- **Champion cell** (`src/lib/compass.js` `buildDoubleElimModel`): was derived
  from M62 alone, so on the reset branch it crowned the comeback player the
  instant they won M62 (before M63 was played) and showed the WRONG champion if
  the Winners player then won the M63 reset. Now: champion = M63 winner when the
  reset is final; else the M62 winner only if side 'a' (Winners player wins
  outright); a comeback win in M62 forces the reset and crowns nobody until M63.

**Explicit "Save result" affordance (the volunteer ask):**
- `src/admin/store.js`: new `matchSavedAt` state (per-match "sent" timestamps,
  stamped inside `flushMatchPush` and the bracket re-sync) + `flushMatch(id)` for
  the button. Debounced 400 ms auto-push kept as the safety net.
- `src/admin/sections/Scores.jsx`: each `ScoreRow` now has a **Save result**
  button that flips to green **"Saved ✓ · H:MM"** once the row's push lands (via
  the button OR the auto-flush). Dirty/saved derived without a clock in render
  (capture the saved-timestamp at edit time; a later push bumps it past the
  marker). Honest tooltip — no-cors = "sent", spot-check the public board.
- **Unified winner marking:** tapping a winner on a bracket (engine `S-`/`D-`) row
  on the Scores tab now routes through `markBracketWinner` — it ADVANCES the draw
  (populates the next round + re-syncs the flat row) exactly like the Draw board,
  instead of only flagging the flat row final. Closes the footgun where a "saved"
  result silently didn't advance. Hand-added rows keep the flat winner/final path.
  Draw-board helper copy relaxed accordingly.
- Match order + score/result editing already existed (Match-order card ↑/↓ +
  add/remove; Draw board "Won"); this adds the missing per-row save confirmation.
- Lint notes: React-compiler rules reject `Date.now()` and set-state-in-effect in
  render scope — hence the edit-marker approach. The pagehide flush effect got an
  `eslint-disable-next-line react-hooks/exhaustive-deps` (mount-only, reads live
  refs) once `flushMatchPush` began closing over a state setter.
- Verified: contract 71/71 (added the M63-reset-winner + comeback-forces-reset +
  Winners-outright champion cases; fixed the stale premature-crown assertion),
  new Scores flow 12/12 (Save→Saved✓, edit re-dirties, winner tap fires a
  matches-replace and propagates downstream), round-trip 15/15, doubles view
  57/57, check-in 21/21, lint/build clean.

---

## 1-cd7. Session Summary — 2026-07-10: unified check-in row + cash drawer

Owner-forwarded arrival-rush audit; directive: "implement the unified
check-in row and cash-float controls directly." Note for future auditors:
that audit's P0 "contradictory source of truth" came from a STALE checkout —
the OpsDesk multi-device sync (poll + per-field upsert + local-edit guard)
has been in store.js since 1-cd-era work; nothing to reconcile. What shipped:

- **Unified arrival row** (src/admin/sections/CheckIns.jsx rewrite): each
  player row now carries the WHOLE arrival — Unpaid/Paid·method chip on the
  name, `Collect $40` opens an inline method panel (Venmo / Zelle / Cash… /
  Comped-exception), Cash shows one-tap tendered shortcuts ($40/$50/$60/
  $100 + custom) labeled with the change due, `Give M` (shirt, size in the
  button), and `Finish check-in` which REFUSES until payment is resolved
  (tapping it unpaid opens the collect panel instead). Finishing clears and
  refocuses the search for the next player in line. Green chips/buttons tap
  to undo (payment unmark asks confirm). Payments tab is repositioned as
  the reconciliation view ('Comped' added to its method list so it
  round-trips).
- **Supporters split from players**: Supporter rows have no fee, no shirt,
  no Collect — just arrival — and are excluded from the checked-in/paid/
  shirts counts (a P1 from the audit that fell out of the fee gating).
- **Cash drawer** (src/admin/CashDrawer.jsx, new; store `cash` slice):
  starting float + volunteer/shift name, auto-ledger (a Cash collect on
  Check-ins logs name/tendered/change), quick-adjust row for merch cash /
  refunds, expected-in-drawer total (float + net cash in), close-out counted
  total with over/short variance, entry delete as the mistake-undo, and a
  "small bills running low" warning when change given ≥ 80% of the float.
  Mounted collapsed on Check-ins (working surface, banner always visible)
  and expanded on Payments (reconciliation). **DELIBERATELY LOCAL-ONLY**:
  one physical cash box = one device; syncing a drawer ledger is how two
  phones drift one count. Payment *status* still syncs like before.
- **Pinned volunteer script** (store `deskScript`, local): "Say this to
  every player" card at the top of Check-ins — Warm-up at / Report scores /
  Next matches (default "Website + court board"), editable blanks HQ fills
  each morning, big high-contrast text for outdoor phones.
- Store additions are all local-only (`cash`, `deskScript` + setCash/
  recordCash/removeCashEntry/setDeskScript); SYNCED_OVERLAY_FIELDS is
  unchanged, so the Apps Script needs NO redeploy.
- Verified: new admin flow suite 21/21 (payment gate, cash math incl.
  float/variance/low-bills, search refocus, supporter path, Payments
  round-trip), round-trip 15/15, doubles view 57/57, lint/build clean.

---

## 1-cd6. Session Summary — 2026-07-10: singles bridge — double-elim sheet canvas + bye-aware schedule

Owner ops-audit request: "audit the singles bracket on the ops end… make sure
the 27 person double elimination bracket and schedule are bridged with the
public view as well as possible. use the doubles compass ui as an example."

**Ops-side audit verdict (screenshots vs engine): routing is CORRECT.**
M57 = W of M55 + L of M54 (reversed drop-ins ✓), the call sheet is
contested-only and skips bye matches ✓, "27 entered · 5 byes" is consistent
with seedOrder(32) byes at draw slots feeding M1/M5/M7 etc. ✓. The real gaps
were bridge-side; all fixed behind the still-closed gate:

- **`estimateLabel` pre-day fix** (src/lib/schedule.js): wave-0 rows used to
  say "about now" even on Friday for a Sunday event. Now, if `startAt` is
  >15 min out it prints "around 8:00 AM" instead. Ops Draw Board/Call Sheet
  strips inherit the fix via the shared lib.
- **`structuralSkips(event, seedList)`** (src/lib/compass.js): runs the REAL
  engine client-side (`resolve(buildDraw(...))`) and returns the Set of
  never-played match nums. 27-player singles → {1,5,7,9,13, 17,21,23, 33,37,
  63} (R1 byes + dead-loser comeback drop-ins + inactive reset). Doubles
  19 teams → empty set, so live behavior is untouched.
- **`projectSchedule(..., skips)`**: skipped nums book no court and get no
  time (`finish = anchor − rest`, winner counts as long-rested), so the
  Sunday cascade isn't inflated by walkovers.
- **`buildDoubleElimModel`** (src/lib/compass.js) + **src/SinglesDraw.jsx**
  (new): the singles public view is now the same sheet-canvas grammar as the
  doubles compass — winners grid (6 cols, single-elim row math), comeback
  band (9 cols, alternating pair-up/drop-in with worked integer row
  formulas; drop lines read "L of M54"), Grand Final panel (M62 + reset
  note) + champion cell, Fit/100% zoom, jump chips (Winners · Comeback ·
  Grand Final), highlight auto-scroll, paper theme. Wiring is asserted
  against `graphFor('Singles')` by a 92-edge probe test — no hand tables.
  CompassDraw now exports LineCell/MetaCell/DirectionGrid/PairPanel/DirLabel;
  THEMES moved to lib/compass.js (react-refresh rule).
- **`firstMatchFor`** is bye-aware (fieldCount param): singles seed 1 in a
  27 field shows M25 · Round of 16 · "winner of M2", not the phantom bye.
- **Legacy deletion** (src/App.jsx): `Bracket`/`MatchCard`/`Slot`/
  `singleElim`/`losersBracket32`/`numberRounds`/`roundLabel`/`overlayRounds`/
  `estForEvent` are gone — singles was their last consumer.
- **Gate unchanged:** `DRAWS_PUBLIC = { Doubles: true, Singles: false }`.
  Sunday's reveal is still the one-line flip.
- Verified: contract 69/69 (skips set = engine truth, 92-edge model wiring,
  skips-aware projection math, bye-aware first match), singles view 13/13 on
  a TEST build (gate temporarily open, reverted), doubles view 57/57 and
  round-trip 15/15 on the REAL build, lint/build clean.

---

## 1-cd5. Session Summary — 2026-07-10: board names (first names) + elapsed-time proxy

Live-score scope review, owner-endorsed. Scores were ALWAYS optional here
(render only when the desk posts them) — so the "don't create a scoring
staffing dependency" recommendation was already true; what shipped:

- **Board names** (src/lib/entrants.js `boardTeam`/`boardName`/
  `dupFirstNames`): every LIVE surface (court board, up-next, find-my-match,
  Live Scores, tracker rows) shows FIRST names — "Greyson/Andy vs
  Alex/Ethan M". Class years and last initials are gone from the boards;
  a last initial survives only to split duplicate first names (people
  deduped before counting so a team appearing on many rows can't fake a
  dup). The compass draw sheet KEEPS "First L. 'YY" (that's its context).
  Placeholder sides ("W of M31", TBD) pass through untouched. Tracker
  dropdown keeps full labels (identity); its rows use board style via the
  `nameFor` prop.
- **Stack, never truncate**: on-court cards render partners on line 1,
  "vs opponents" on line 2; queue/search rows wrap instead of "…" —
  truncation broke the find-your-match scan.
- **Elapsed-time proxy** ("since 9:04 · ~24m" on on-court cards): the
  Matches poll records when THIS device first saw a row live
  (state + localStorage `a4a-live-since`; cleared on final). No schema or
  ops change; a page that loads mid-match just shows no chip. This is the
  cheap "close to done?" signal — no scorekeeper needed. Live Scores intro
  copy now says scores appear "when the desk has a moment".
- Lint's react-hooks/refs rule caught the first cut reading a ref during
  render — moved to state (also makes the chip paint on the poll that
  sees it).
- Verified: contract 47/47 (name formatter unit cases incl. the two-Ethan
  disambiguation + no self-dup from repeated team labels), view 57/57
  (first-name boards, year-free board containers while the sheet keeps
  years, elapsed chip after first live poll, no ellipsis), round-trip
  15/15, lint/build clean.
- OPEN QUESTION for the owner (from the review): is remote-spectator
  engagement a goal? If yes, scores stay worth entering when there's a
  marshal; if no, the elapsed timer alone carries the board. Nothing in
  the build forces either answer.

---

## 1-cd4. Session Summary — 2026-07-10: CALL ORDER ≠ match numbers (rest windows + backdraw priority)

Owner reviewed an external call-order proposal for the 19-team compass. The
architectural answer, implemented: **match numbers stay pure bracket
identity** (the num+event overlay contract between draw.js, the sheet, and
the public view is untouchable); the **call order is derived** by the
schedule simulation and surfaced through the projected times + the Up-next
queue. No renumbering, no schema change, no separate "Bracket ID" column
needed — `M#` IS the bracket id, `projectSchedule` IS the call order.

- **projectSchedule is now full list-scheduling** (src/lib/compass.js):
  honors (1) the feeder chain, (2) a **rest window** between a team's
  matches (`restMin`, default 10 — Config "Rest min"; feeders already final
  are assumed rested), and (3) the 9-court pool with the proposal's
  priorities under contention: **shorter backdraw matches first**
  (front-load West/North/South splits) with a **30-min aging guard** so a
  long championship QF/SF/F can never be starved into pushing the final
  late (both-aged → longest-waiting, then championship path first).
- **`backdrawMin`** (Config "Backdraw min"): shorter pro sets for
  West/North/South/comeback/consolation rounds; unset → event length.
  `matchMinFor` routes by round tag. Owner can hand-add "Rest min,10" /
  "Backdraw min,30" rows to the Config tab — no redeploy needed.
- **Up-next queue is ordered by the projection** (`callPos`), not raw match
  number — the desk can call straight off the public board and it matches
  the optimized order. Ready-only filter unchanged.
- Default-config cascade for the real 19-team field: play-ins + 5 open R1
  at 9:00 → hosts (M1/M5/M7) + consolation 9:50 → QFs/West from 10:40 →
  final ~1 PM. All chips re-anchor live during the day.
- **TDZ footgun fixed while wiring**: upNextQueue's sort used `callPos`
  before its `const` initialized — crashes only when the comparator RUNS
  (≥2 queue rows), so the empty-fixture scenario passed while the mid-day
  one white-screened. Queue derivation now sits below the projection block.
- Verified: contract 41/41 (rest shifts exact, restMin/backdrawMin knobs,
  1-court contention calls backdraw first, aging guard gets the QF on
  within ~40 min), view 51/51, round-trip 15/15, lint/build clean.

---

## 1-cd3. Session Summary — 2026-07-10 early: projected times for EVERY match + player-first flow

Owner: "put down est start times of every team's first match at least —
remember 9 courts", plus a player-perspective review he endorsed.

- **`projectSchedule` (src/lib/compass.js)** — greedy simulation over the
  engine's feeder graph honoring BOTH constraints: dependencies (M1 can't
  start before play-in M29 finishes) and the court pool (`sched.courts`, 9 —
  singles' 10th R1 match waits for a court, 8:50 not 8:00). Anchored at
  first serve until anything goes live/final, then re-projects from `now`
  (a live match holds a court for ~half a match). Every not-yet-final match
  — posted or NOT — gets a `~h:mm` start. One clock source per event in App
  (`clockByEvent`/`rowClock`): compass tokens, Live Scores badges, and
  Up-next chips all agree; off-graph hand rows fall back to the wave model.
  Compass tokens now show times on UNPOSTED matches too (M1 · ~9:40 AM,
  QFs ~10:20 AM …).
- **`firstMatchFor`** (same file): a team's first match from seed rank alone
  (host seeds → their play-in; overflow → theirs; else the R1 line, with the
  opponent as a rank or "winner of M29"). The tracker's empty state now
  shows "Your first match: M1 · Round of 16 · vs winner of M29 · ~9:40 AM"
  instead of a bare "nothing posted yet" — kills the populated-sheet /
  empty-tracker contradiction the review flagged.
- **Player-first order**: Follow-my-team is now the FIRST card on Brackets
  (personalized before aggregate), draw sheet second, boards third.
- **Mobile default**: phones now land at 100% zoom scrolled to the East R16
  block (readable first-round matchups) instead of the whole-sheet Fit
  overview; Fit remains one tap away. Desktop unchanged (Fit).
- Verified: view suite 51/51 (projected 9:00/9:40/10:20 tokens with ZERO
  posted rows, tracker first-match line, tracker→draw→boards order, mobile
  100%-default + Fit tap), engine contract 37/37 (projection math exact:
  deps, court cap, live re-anchor, firstMatchFor routing), round-trip 15/15.
- NOTE for Sunday: reveal singles → `DRAWS_PUBLIC.Singles = true`; the
  projection/tracker/singles brackets pick it up with zero extra work.

---

## 1-cd2. Session Summary — 2026-07-09 late: post-reveal polish (owner phone review)

Owner reviewed the live reveal on his phone; five fixes shipped in one pass:

- **Times, not "Scheduled"**: `matchEstimate` (src/lib/schedule.js) no longer
  adds warm-up — wave 0 anchors at FIRST SERVE, so times read 9:00 not 9:10
  (flyer language, owner call). New `startClockLabel` ("~9:00 AM") is the
  shared compact time: Live Scores' scheduled badge, Up-next rows, and the
  compass match tokens all use it. `warmupMin` still parsed, now unused.
- **Brackets tab is ONE fixed flow** (no more liveDay reorder): draw sheet at
  the very top (Tournament Draws card = title + event chips + canvas +
  compact legend BELOW the sheet; seeding blurb deleted) → Follow-my-team
  (the free-text highlight input now lives INSIDE the tracker card, BELOW
  the dropdown) → Live Court Board → Live Scores → round-times banner →
  suggest box → ace tracker → legacy link.
- **Up next = actually playable**: new `isReadyRow` (schedule.js) — a row
  with a placeholder side ("W of M31"/TBD) never takes a queue slot (M5
  waiting on M3 → M6 is next); a "waiting on earlier-round results" note
  counts the blocked ones. Live Scores now sorts live → queue(playPos) →
  finals instead of sheet order.
- **Compass canvas reworked from first principles** (CompassDraw.jsx): the
  estimate SENTENCES under lines are gone — each match carries ONE token
  hugging its connector ("M2 · ~9:00 AM" / "M1 · Ct 3 LIVE" / bare "M2").
  Band layout kills the dead zones: play-ins + consolation panels top-left
  with NORTH beside them (top-right), West|East main band, South tucked
  under West. ROW_H 26→22 (lib/compass.js), stronger ink/rules
  (#171310/#57534e) for sunlight + Fit legibility, seed badges moved to the
  line's RIGHT edge so names align flush-left, TBD lines render as blank
  rules (sheet-style), panels are two rules + one meta line.
- Singles chip text "posts Saturday" → "posts Sat" (was overflowing).
- Verified: compass suite grew to 45/45 (order, tracker-holds-search,
  9:00-AM badges, ready-queue skip + note, no blurb), engine contract 24/24,
  HQ round-trip 15/15, lint/build clean. Same reveal gates; no data-layer
  changes beyond schedule.js estimates.

---

## 1-cd. Session Summary — 2026-07-09 night: public compass canvas + team tracker + PER-EVENT reveal

Owner asked for the public doubles view to read like the **2025 printed
spreadsheet compass** and for a per-team schedule dropdown. Built as a
presentational/derived layer only — zero changes to the write path, ops
engine semantics, or the numbering contract.

- **⚠️ REVEAL CHANGE — deploying this reveals the doubles draw.**
  `DRAWS_PUBLIC` (App.jsx) is now PER EVENT: `{ Doubles: true, Singles:
  false }` (owner's call). Singles stays hidden — its event button reads
  "posts Saturday", and EVERY name-bearing surface (court board, Live
  Scores, find-my-match, tracker options) now reads from `publicMatches`
  (rows filtered to revealed events), so ops-pushed `S-` rows can't leak
  before the singles flip. To reveal singles: set `Singles: true`, ship.
- **Compass canvas** (`src/CompassDraw.jsx` + pure model in
  `src/lib/compass.js`): replaces the four stacked doubles bracket cards
  with ONE spatial paper-white canvas — East center→right into a gold
  champion cell, West mirrored right→left, North above, South below,
  play-in + consolation panels top-left, gold center banner. Sheet-style
  lines (names on underline rules), scores ride top-right of the advancing
  line once the feeder goes final, live lines tint emerald with court
  chips, estimate chips per posted match, find-yourself highlight + auto
  scroll-to-line. Connectors are border-only CSS-grid items on integer row
  math (East leaves 2i+1, QF 4j+2, SF 8j+4, F 16j+8 — midpoints land
  exactly), so the whole canvas zooms with one `transform: scale()`.
  Mobile: Fit (whole sheet on one phone screen) / 100% toggle + direction
  jump chips. `theme` prop has paper/dark token sets (paper default).
  Line resolution precedence: posted-row overlay (same engineRowsFor
  num-join as before) → derived winner/loser from a FINAL feeder row
  (fills champion/West/N/S winner cells) → template seed → dimmed "(bye)"
  walkover → "W/L of Mx" placeholder → TBD. Ops corrections self-heal
  (model recomputed from rows every render).
- **Follow-my-team tracker** (`src/TeamTracker.jsx`, Brackets tab under
  the intro card): dropdown of every entrant in PUBLIC events (seeds ∪
  posted-row names, deduped), persisted per device (`a4a-follow`).
  Shows played (stakes label + score + W/L), live court, next posted match
  with estimate, AND projected paths — "Win → M9 · Championship QF / Lose
  → M16 · West — placement" with `waitsOnLabel` times — derived by
  scanning the ops engine's own feeder graph (`graphFor`, now exported
  from draw.js — the ONLY draw.js diff) so routing can never drift from
  the ops bracket. Selecting also sets the draw highlight → compass lights
  up + scrolls to the line.
- App.jsx: doubles field sizing (`dTeams/dPIns/dEastNames`) hoisted to the
  draws-tab IIFE (shared by canvas + tracker); the old per-direction
  `Bracket` cards + `numberSeq` removed (singles still uses
  `Bracket`/`numberRounds`, pixel-unchanged). RoundTimesBanner still gets
  ALL matches by design (times only, no names — pre-reveal safe).
- **Verified** (Playwright fixture harness over `**/api/sheet*` against a
  prod preview build, scratchpad-only per repo convention): 38/38 —
  20-team pre-play (play-ins M29-32 + consolation M33-34, "W of M29" host
  lines, "L of Mx" West leaves, doubles-only tracker options, ZERO singles
  names), mid-day (live court meta, QF/West overlay, champion cell from
  M15, scores under advancing lines, tracker branches + persistence,
  singles `S-` live row renders NOWHERE), 14-team+seedsFinal (BYEs +
  "(bye)" walkover into QF, no panels), mobile 390px (fit-no-overflow,
  100% pans, jump chips). Screenshots eyeballed: connector elbows exact,
  no text collisions (a score/meta collision was found this way and
  fixed — scores pinned inside their own cell). Lint + build clean.
- Post-reveal runbook reminder: the sheet's Matches tab still carries any
  old test rows — before merging, Clear + Regenerate per event from ops
  (per the §1a runbook) so the revealed board opens clean.

---

## 1-wp. Session Summary — 2026-07-09 eve: write-path hardening (lock + atomic bulk replace)

The one remaining P0 before reveal night: every Apps Script handler is a
full read-modify-write of its tab, and the client fired bursts into it —
`applyBracket` pushed ~30 individual `match`/`match-delete` POSTs per
generate, and `updateMatch` POSTed on every keystroke. Concurrent
executions interleave and can silently drop rows; tonight's two generates
and Saturday's 5 synced devices are exactly that scenario. Fixed both ends:

- **Apps Script** (`apps-script/ops-write-back.js`): `withLock_` —
  `LockService.getScriptLock().waitLock(20000)` + try/finally release —
  wraps the entire doPost mutation switch and `writeSubscribe_`, so writes
  serialize instead of interleaving. New `matches-replace` handler
  (`replaceEngineMatches_`): payload `{event, prefix, list}` drops every row
  whose Event matches AND id starts with the engine prefix (`S-`/`D-`; hand
  rows survive), appends the fresh list, ONE `writeRows_`.
  ⚠️ **REQUIRES A REDEPLOY** (Manage deployments → pencil → New version) —
  and it MUST happen before generating draws: the currently-deployed script
  silently ignores the unknown `matches-replace` type, so a generate would
  never reach the sheet until the redeploy. Order: merge → redeploy → generate.
- **Client** (`src/admin/store.js`): `applyBracket` now sends ONE
  `matches-replace` (plus the existing `opsdraw` companion) instead of the
  per-row burst; `updateMatch` debounces the sheet push per match id
  (trailing 400 ms + pagehide flush via keepalive), so typing a score sends
  one POST per pause; `removeMatch` cancels any pending debounced push for
  the deleted id (resurrection hazard); `applyBracket` cancels pending
  pushes for engine ids it's about to replace (stale-clobber hazard).
- **React footgun found while verifying (do not reintroduce):** capturing a
  value by side effect inside a `setStore` updater only works on React's
  eager first-update path — rapid successive updates defer the updater, so
  the capture silently misses (typing "6-4" pushed just "6"; hand-row edits
  pushed nothing; a deferred capture in applyBracket would have pushed an
  EMPTY list and wiped the event's sheet rows). Both functions now compute
  payloads OUTSIDE the updater from the closure snapshot.
- Public Live Scores cards now keyed by `m.id` (stable identity), not index.
- Verified (Playwright POST interception, 19-team doubles): generate fires
  exactly ONE `matches-replace` (8 rows: 3 play-ins + 5 contested R1, all
  `D-` ids), zero `match`/`match-delete` bursts; typing "6-4" → ONE POST
  carrying "6-4"; hand-row edits still push; delete cancels the pending
  edit. Regressions all green: verify13 23/23, verify17 6/6, verify19 7/7,
  verify21 6/6, verify22 6/6, schedule units 16/16.
- Triage context: this closed out the third external agent report. Its code
  lives ONLY in its own stale checkout — do NOT merge that checkout; its
  other findings were already built or already false (see session notes
  below and docs/next-audit-handoff.md).

---

## 1. Session Summary — 2026-07-09 PM: multi-device DRAW sync (seed order + bracket)

Owner opened /admin on a second device (2311) and the draw HQ generated
wasn't there — Seed Order + Draw Board were empty. Cause: the earlier
multi-device sync covered only check-in/payment/shirt/walk-ups; seeds and
the bracket engine state live in localStorage and were never pulled back.

Fix — extend the SAME private opsdesk channel to carry the draw:
- Apps Script: new private `OpsDraw` tab (`Event | Seeds | Bracket |
  UpdatedAt`, JSON), `opsdraw` doPost upsert-by-event, and the
  `mode=opsdesk` GET now also returns `draw: [{event, seeds, bracket,
  updatedAt}]`. ⚠️ REQUIRES A REDEPLOY (Manage deployments → New version).
- store.js: `pushDraw(event, seeds, bracket)` fires from `applyBracket`
  (generate/mark/swap/rename/clear — so winner marks sync too) and the
  debounced seeds effect. Committee `notes` are STRIPPED before the push
  (`seedsForSync`); only display-safe seed order + bracket (names/results/
  overrides, already public via SeedBoardPublic/Matches) cross the wire.
  `pullDesk` hydrates seeds + bracket + re-derives the flat Match Order rows
  for any event this device hasn't edited within the 45 s guard.
- SAFETY (verified): a device only pushes on a real user action, so a fresh
  pull-only device fires ZERO opsdraw pushes and can never clobber HQ's draw
  with empty state; hydration also updates `pushedSeeds.current` so it can't
  trigger a re-push. Conflict model is last-write-wins by whoever POSTed most
  recently — so DRIVE THE DRAW FROM ONE DEVICE (HQ); other devices are
  read/score. The bracket blob is JSON-safe (results/overrides are plain
  objects, graph is re-derived at render).
- Verified via Playwright two-device round-trip: device A generates → its
  opsdraw push is captured → fed to a fresh device B, whose Seed Order +
  Draw Board populate; plus a clobber-safety test (0 pushes from B) and the
  full 23-check pre-reveal + 6-check play-in-band regressions.
- Court/score typed on the SCORES tab (not the Draw board) are match-row
  fields not in the bracket blob — those still don't cross devices; winner
  marks (made on the Draw board) DO, since they're in the bracket `results`.

---

## 1-cf. Session Summary — 2026-07-09 PM: announcements were blanked by the CF roster guard

Owner posted two announcements from ops; public feed kept showing fallbacks.
Diagnosis (via the check-deploy CI probe, since the sandbox can't reach the
live site): writes were FINE — both posts were in the sheet's Announcements
tab — but `/api/sheet?tab=Announcements` returned 0 bytes. Root cause:
`looksLikeRoster` in `functions/api/sheet.js` fingerprinted any response
whose header contains "timestamp" as a gviz missing-tab roster leak and
failed closed — and the Announcements schema (Id|Timestamp|…) legitimately
carries one. Fix: drop "timestamp" from ROSTER_MARKERS (email / phone
number / payment method remain — distinctive to the Form-responses roster).
Verified by node-invoking the function with stubbed fetch/caches (pass-
through, roster-fallback still blanked, OpsStatus scrub + roster PII strip
unaffected). Lesson recorded: every Playwright run stubs `/api/sheet`, so
the CF function is the ONE hop the suites never exercise — the check-deploy
workflow now probes the real data endpoints (+ an Apps Script announce
write/delete round-trip) on demand via workflow_dispatch.

---

## 1-pin. Session Summary — 2026-07-09 multi-device ops sync + volunteer PIN

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

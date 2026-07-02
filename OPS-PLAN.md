# OPS-PLAN — Final-week work order (executable)

**Audience:** a coding agent executing this file top to bottom, plus the site owner for the two human steps at the end.
**Dates:** today ≈ July 2, 2026. Sign-ups close **July 6, 23:59**. Tournament **July 11–12** at Dunlap HS.
**Repo:** this repository. Branch: work on the current feature branch; run `npm run lint` and `npm run build` after every priority block.

## Why this order (first principles)

For a one-shot, volunteer-run memorial event the value hierarchy is:

1. **P0 — Don't corrupt live data day-of.** A lost or ghosted match on the public board while 50+ phones watch is unrecoverable trust damage. The write path has a real race today.
2. **P1 — Maximize signups before July 6.** Every entry is $40 toward the scholarship. The deadline is currently one muted line of text on Home — nearly invisible.
3. **P2 — Day-of ops speed.** Courtside staff taps must be few and safe: winners currently have to be re-typed into next-round matches by hand, and if the ops phone dies, all check-in/payment state dies with it.
4. **P3 — Public live-viewing quality.** Freshness of confirmations/meter/seeds, and a bracket that shows the *real* draw instead of placeholders.

Each item below is independently shippable. If time runs out, ship in order — P0 alone is worth a deploy.

---

## Ground rules — do NOT touch

- Do NOT add tabs to `ALLOWED` in `functions/api/sheet.js` or `READABLE` in `apps-script/ops-write-back.js`; do NOT weaken roster column filtering, the OpsStatus `__`-sentinel scrubbing, or the seeds `Name|Event|Rank` sanitization (see "PUBLIC / COMMITTEE DATA SEPARATION" in `src/lib/sheet.js`).
- Do NOT change `WRITE_TOKEN`/`READ_TOKEN`, the `no-cors` fire-and-forget write pattern in `src/admin/store.js`, or the field list of `publicMatchPayload` — in particular the new local-only `bpos` field (P2d) must **never** be added to it. No new columns in the Matches sheet.
- Do NOT touch: `mapCourtBoard` in `src/lib/sheet.js` (dead code, leave as-is), the compass West/North/South brackets or the Comeback bracket structures in `src/App.jsx`, `moveMatch` semantics, the roster once-on-mount fetch, the Photos fetch, or the "check-ins/payments stay local to the device" policy.
- Explicitly deferred — do not attempt in this pass: multi-device ops sync, rate-limiting the token-less `idea`/`subscribe` endpoints, name-keyed overlay collisions, localStorage schema migrations, shirt-size vocabulary reconciliation between Payments/Merch, merch sold-count inference.

**Deployment sequencing (critical):** the Apps Script changes in P0 require the owner to redeploy the script (human step, end of this file) **before or together with** the site deploy. The currently-deployed script silently ignores the new `matches-replace` event type (unknown types fall through), so if the site ships first, any draw rebuilt in that window never reaches the sheet.

---

## P0 — Write-path correctness

**Problem:** `setEventMatches` in `src/admin/store.js` (used by Seeding's "Build R1 from seeds") fires N `match-delete` + M `match` POSTs as a burst. In `apps-script/ops-write-back.js`, `writeMatch_`/`deleteMatch_` each do a full read-modify-write of the whole Matches tab with **no locking** — concurrent executions clobber each other, producing silently missing or ghost matches on the public Live Scores board.

### P0a — Atomic bulk replace: new `matches-replace` event

**`apps-script/ops-write-back.js`:**

1. In the `doPost` switch (the `case 'match':` block is around line 110), add:

   ```js
   case 'matches-replace': replaceEventMatches_(body.payload); break;
   ```

2. Add next to `writeMatch_`, matching the file's `var`/function style. Column order verified against `MATCH_HEADERS = ['Event','Round','Num','Player A','Player B','Court','Status','Score','Winner','ID']`:

   ```js
   // One POST replaces ALL of one event's rows (admin "Build R1 from seeds"),
   // preserving the other event's rows — replaces the old N-delete + M-write
   // burst of individual POSTs that could interleave and clobber itself.
   function replaceEventMatches_(payload) {
     if (!payload || !payload.event) return;
     var sheet = sheetByName_('Matches', MATCH_HEADERS);
     var rows = readRows_(sheet);
     var ev = String(payload.event).trim().toLowerCase();
     var keep = rows.filter(function (r) {
       return String(r[0] || '').trim().toLowerCase() !== ev;
     });
     var fresh = (payload.list || []).map(function (m) {
       return [m.event || payload.event, m.round || '', m.num || '', m.a || '', m.b || '',
               m.court || '', m.status || 'scheduled', m.score || '', m.winner || '', m.id || ''];
     });
     writeRows_(sheet, keep.concat(fresh));
   }
   ```

   Keep the individual `match` / `match-delete` handlers unchanged — single edits (score, court, status, one-off delete) still use them. Payload size (≤ ~31 matches + bye rows) is far below Apps Script POST limits.

**`src/admin/store.js`** — in `setEventMatches`: keep the local setStore logic exactly as is, but delete the two push loops (`removedIds.forEach(... 'match-delete' ...)` and `created.forEach(... 'match' ...)`) and the now-unused `removedIds` plumbing, replacing them with a single:

```js
pushToSheet('matches-replace', { event, list: created.map(publicMatchPayload) });
```

### P0b — LockService around all sheet mutations

In `doPost`, after the token check passes, wrap the mutation switch:

```js
var lock = LockService.getScriptLock();
lock.waitLock(20000);
try {
  switch (body.type) { /* existing cases + matches-replace */ }
} finally {
  lock.releaseLock();
}
```

Also wrap the `writeSubscribe_` call (it mutates the Subscribers tab) in the same acquire/try/finally pattern. Do NOT lock `handleIdea_` (email only) or `doGet` (reads). A `waitLock` timeout throws and is swallowed by the existing outer try/catch — acceptable; it matches the fire-and-forget contract.

---

## P1 — Deadline urgency (Config-driven, sign-ups close July 6)

**Problem:** the deadline lives in exactly one muted line (`App.jsx` hero, ~line 1219) driven by a hardcoded `new Date('2026-07-06T23:59:59')` (~line 945). No banner, no OG mention, and extending the deadline would need a code deploy.

### P1c1 — `mapConfig` learns `deadline` (`src/lib/sheet.js`, else-if chain in `mapConfig` ~line 211)

Add a branch (no overlap with the existing `raised|goal|bar` regexes):

```js
} else if (/deadline|cutoff|close/.test(key)) {
  // ISO-ish string ("2026-07-06T23:59:59") or a gviz date cell ("Date(2026,6,6)").
  const m = val.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/);
  const t = m
    ? new Date(+m[1], +m[2], +m[3], +(m[4] || 23), +(m[5] || 59), +(m[6] || 59)).getTime()
    : Date.parse(val);
  if (!isNaN(t)) out.deadline = t;
}
```

Update the `mapConfig` header comment: recognized key `deadline` → optional Config row `deadline | 2026-07-06T23:59:59` (owner should paste as plain text and include a time — a bare `2026-07-06` parses as UTC midnight).

### P1c2 — `DeadlineBanner` in `src/App.jsx`

1. Replace the hardcoded date (~line 945):

   ```js
   const DEADLINE_FALLBACK = new Date('2026-07-06T23:59:59').getTime(); // module-level const
   // inside the component:
   const deadlineMs = config.deadline ?? DEADLINE_FALLBACK;
   const daysLeft = Math.ceil((deadlineMs - now) / 86400000);
   ```

   Keep `closeText`'s shape. Replace the literal "(July 6)" in the hero line (~1219) with a derived label: `new Date(deadlineMs).toLocaleDateString([], { month: 'long', day: 'numeric' })`.

2. New component `DeadlineBanner({ deadlineMs, now })`, rendered **once, site-wide, directly below the sticky nav** (before the mobile Explore menu block, ~line 1140). Slim single-row strip in the site's amber accent (`bg-[#fbbf24]` text-black, or an amber-tinted dark variant consistent with the header chips). States:
   - **> 48h left:** "Sign-ups close in {N} days — {deadlineLabel}" + a compact `Register` CTA (`<a href={REGISTER_FORM_URL} target="_blank" rel="noopener noreferrer">`).
   - **≤ 48h left:** "Sign-ups close in {H}h {M}m" + the CTA. Compute from `deadlineMs - now`; the existing 30s `now` heartbeat re-renders it — do NOT add a new timer.
   - **Past deadline, before July 12 23:59:** "Sign-ups are closed — draws drop soon. Come watch July 11–12." No CTA.
   - **After July 12:** render `null`.

3. Mobile Explore menu home blurb (`TABS` array, ~line 648): mention the deadline, e.g. `'Register by July 6 — roster & day-of basics'`.

### P1c3 — `index.html` meta

Add "Register by July 6." to the `meta name="description"`, `og:description`, and `twitter:description` content strings. (Static — an extended deadline won't update OG; acceptable, note it in the commit message.)

---

## P2 — Day-of ops speed

### P2d — "Send winner → next round"

**Problem:** Scores.jsx can mark `{ winner, status: 'final' }` but nothing creates the next-round matchup — staff re-type every winner by hand mid-event.

**Design:** deterministic slotting keyed on **`bpos`** — the match's 1-based bracket-pair position within its round. `bpos` is a **local-only** field on match objects (persists in localStorage, rides through `load()` untouched); it must NOT be added to `publicMatchPayload` (no new sheet columns).

**`src/admin/store.js`:**

1. Exported pure helpers (top of file, near `nextId`):

   ```js
   // Smallest power of two >= n (n >= 1). Byes leave gaps in bpos, so round
   // sizing must round UP: 12 entries in a 16-draw still has an 8-pair R1.
   export const nextPow2 = (n) => { let p = 1; while (p < n) p *= 2; return p; };

   // Next round's label given the current label and the next round's pair count.
   export const nextRoundLabel = (current, nextCount) =>
     nextCount === 1 ? 'F' : nextCount === 2 ? 'SF' : nextCount === 4 ? 'QF'
     : ({ R1: 'R2', R2: 'R3', R3: 'R4' }[current] || '');
   ```

   (16-draw: R1→QF→SF→F. 32-draw: R1→R2→QF→SF→F — matches the public bracket columns in P3h.)

2. New store method `advanceWinner(id, { force = false } = {})`, returned from `useOpsStore`:
   - Look up match `m`. Require `m.status === 'final'`, `m.winner` in `{'a','b'}`, and non-empty `m[m.winner]` → otherwise return `{ status: 'invalid' }`.
   - Siblings = matches with same `event` + same `round`. `pos = m.bpos ?? (1-based rank of m among siblings ordered by Number(num))`. `pairCount = nextPow2(max over siblings of (bpos ?? ordinal rank))`. `nextCount = pairCount / 2` (min 1). `round2 = nextRoundLabel(m.round, nextCount)`; if falsy → `{ status: 'invalid' }`.
   - `targetPos = Math.ceil(pos / 2)`; `side = pos % 2 === 1 ? 'a' : 'b'`; `winnerName = m[m.winner]`.
   - Find target among `event` + `round2` matches: first by `t.bpos === targetPos`; fallback for hand-built rounds without `bpos`: the `targetPos`-th match of that round ordered by num, only if the round has ≥ `targetPos` matches.
   - **Target exists:** `target[side] === winnerName` → `{ status: 'noop' }`. `target[side]` non-empty and different and `!force` → `{ status: 'conflict', existing: target[side] }`. Otherwise patch the slot via the same setStore-then-`pushToSheet('match', publicMatchPayload(next))` pattern `updateMatch` uses.
   - **No target:** create `{ id: nextId(), event, round: round2, num: String(max num in event + 1), a/b: winnerName per side (other side ''), court: '', status: 'scheduled', score: '', winner: '', bpos: targetPos }` — build the row BEFORE `setStore` (StrictMode-safe, same as `setEventMatches`), append, push `'match'`.
   - Return `{ status: 'ok', round: round2, name: winnerName }`.

**`src/admin/sections/Scores.jsx`** — in `ScoreRow`: when `m.status === 'final' && m.winner && m[m.winner]` and `nextRoundLabel` yields a label (hide for round `''`, `'F'`, and `'L1'..'L3'`), render a full-width button under the score row: `Send {winnerName} → {round2}`. onClick:

```js
const r = ops.advanceWinner(m.id);
if (r.status === 'conflict' &&
    window.confirm(`${r.existing} is already in that ${r.round ?? 'next-round'} slot — replace with ${winnerName}?`)) {
  ops.advanceWinner(m.id, { force: true });
}
```

Re-taps are no-ops. Edge cases to honor: winner toggled to the other player → re-advance hits the conflict flow; doubles team names contain `&` — copy verbatim, never parse; blank names never advance.

**Byes pre-filled from seeds** — `src/admin/sections/Seeding.jsx`, `buildR1`:

- While walking `slots` pairwise, track `pairIndex = i / 2 + 1`. Real matches: `rows.push({ round: 'R1', num: rows.length + 1, a, b, bpos: pairIndex })`.
- Byes: collect `{ targetPos: Math.ceil(pairIndex / 2), side: pairIndex % 2 === 1 ? 'a' : 'b', name: a || b }`. After the loop, group by `targetPos` — two byes feeding the same slot merge into one immediately-playable match — and append rows `{ round: nextRoundLabel('R1', size / 4 || 1), num: <continuing sequence>, a/b per side (missing side ''), bpos: targetPos }`.
- `setEventMatches`'s `created` mapping in `store.js` must carry `bpos: r.bpos` through.
- Update the confirm text: byes are now "pre-filled into {round2}: {names}". Public effect (intended): bye rows appear on Live Scores as "Name vs —" scheduled matches, so players see their bye.

### P2e — Export / Import ops data (device-death recovery)

**`src/admin/store.js`:** extract `load()`'s normalization object into `const normalizeStore = (parsed) => ({ ...initialStore(), ...parsed, /* the existing field-by-field guards, unchanged */ })`; `load()` uses it. Add to the store API:

```js
const importJSON = (text) => {
  const parsed = JSON.parse(text); // throws on bad JSON — caller catches
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('bad shape');
  // Local restore ONLY — deliberately no sheet push. The sheet already holds
  // the last-pushed state; subsequent edits re-sync row by row as usual.
  setStore(normalizeStore(parsed));
};
```

**`src/admin/AdminApp.jsx`** footer, beside "Clear this device's ops data":

- **Export ops data** — `ops.exportJSON()` → Blob download named `a4a-ops-backup-YYYY-MM-DD-HHmm.json` (this finally wires the currently-unused `exportJSON`).
- **Import ops data** — hidden `<input type="file" accept=".json,application/json">`; on select read the text, `window.confirm('Replace ALL ops data on THIS device with the backup file? Current check-ins, payments, seeds, matches & merch on this device will be overwritten.')`, then `try { ops.importJSON(text) } catch { window.alert('That file is not a valid ops backup.') }`.

---

## P3 — Public live-viewing quality

### P3f — Poll OpsStatus + Config + SeedBoardPublic (`src/App.jsx`, once-on-mount effect ~lines 814–845)

Restructure that effect: Photos stays fetch-once; move the Config, SeedBoardPublic, and OpsStatus fetches into a local `tick()` invoked immediately and then on `setInterval(tick, 120000)`; cleanup clears the interval. Keep each fetch's `.catch(() => {})` and the existing success guards (config-keys check, seeds-length check). No backoff needed at 3 requests / 2 min — the edge cache absorbs it. Do NOT touch the Matches/Aces 60s pollers.

Day-of payoff: roster confirmations flip, the scholarship meter moves, and seed updates land without anyone reloading.

### P3g — Per-tab cache TTL (`functions/api/sheet.js`)

Replace the single `TTL` const and the `Cache-Control` header:

```js
const TTLS = { Matches: [10, 15], Aces: [10, 15] };   // [max-age, s-maxage] — live tabs
const ttlFor = (tab) => TTLS[tab] || [20, 30];        // default for everything else
```

In `onRequestGet`, compute `const [maxAge, sMaxAge] = ttlFor(tab)` and emit `` `public, max-age=${maxAge}, s-maxage=${sMaxAge}` ``. The Cache API honors the stored response's `s-maxage`; both success and gviz-fallback paths already flow through the shared response builder, so no other change is needed.

### P3h — Real draw in the public bracket diagrams (`src/App.jsx`)

**Problem:** the Brackets tab's diagrams are 100% placeholder structures built from the local `topSeeds` const (`singleElim`/`seedOrder`, ~lines 398–446; rendered by `<Bracket>`/`<Slot>`); admin-written Matches rows render only in the Live Scores list — the diagrams never show the real draw.

**Minimal overlay — no rewrite of `<Bracket>`:**

1. New pure functions near `singleElim`:

   ```js
   // Column labels the admin console writes: R1, R2, …, then QF/SF/F.
   const columnRoundLabels = (rounds) => rounds.map((ms, i) =>
     ms.length === 1 ? ['F'] : ms.length === 2 ? ['SF'] : ms.length === 4 ? ['QF', `R${i + 1}`] : [`R${i + 1}`]);

   // Overlay live admin-written Matches rows onto a placeholder bracket
   // structure. Active only when the event has R1 rows (a real draw exists).
   function overlayBracket(rounds, eventMatches, seeds) {
     const labels = columnRoundLabels(rounds);
     return rounds.map((ms, ci) => {
       const real = eventMatches
         .filter(m => labels[ci].includes((m.round || '').toUpperCase()))
         .sort((a, b) => (Number(a.num) || 0) - (Number(b.num) || 0));
       return ms.map((placeholder, mi) => {
         const r = real[mi];
         if (!r) return { a: {}, b: {} }; // TBD — never fake names once live
         const slot = (name, isWinner) => ({ name: name || null, win: isWinner, seed: seedRankFor(name, seeds) });
         return { a: slot(r.a, r.winner === 'a' && r.status === 'final'),
                  b: slot(r.b, r.winner === 'b' && r.status === 'final') };
       });
     });
   }
   ```

   `seedRankFor(name, seeds)`: exact case-insensitive trimmed full-string match against `seeds` rows of the matching `type` → `rank`, else `null`. Doubles team strings match whole-team only — no `&`-splitting.

2. `<Slot>`: when `slot.win`, add a winner accent (e.g. `text-[#fbbf24] font-bold` on the name) — a one-line class change.

3. Render sites — hoist near the draws section:

   ```js
   const doublesRows = matches.filter(m => m.event === 'Doubles');
   const singlesRows = matches.filter(m => m.event === 'Singles');
   const doublesLive = doublesRows.some(m => (m.round || '').toUpperCase() === 'R1');
   const singlesLive = singlesRows.some(m => (m.round || '').toUpperCase() === 'R1');
   ```

   - Doubles East 16 (~line 1673): `doublesLive ? overlayBracket(singleElim(16, false), doublesRows, seeds) : singleElim(16, true, seededNames('Doubles'))`.
   - Singles winners 32 (~line 1705): same pattern with `singleElim(32, false)` and `singlesRows`.
   - West/North/South compass paths and the Comeback bracket stay placeholders (admin `L1–L3` rounds intentionally unwired — leave a comment).

4. Draws-section copy (~lines 1635–1637): conditional — when either event is live, "Live draw — updates as matches are posted courtside" instead of "Draft brackets… placeholders until registration closes July 6".

5. Accepted limitations (comment them in code): match order within a column follows `num` (queue order), so an admin queue reorder can shift which diagram line a match sits on — connector lines aren't drawn, so this costs nothing. Advancement-created rows (P2d) appear in later columns automatically because they're real Matches rows with the right round label.

**Fallback only if the overlay genuinely fails review:** keep placeholder brackets and add a banner over the draws section — "Draft bracket — the real draw is on Live Scores above." Attempt the overlay first; it's ~60 new lines + two call sites.

---

## Verification checklist (run everything)

1. `npm run lint` and `npm run build` after each priority block — both must pass. Keep new Apps Script code in that file's `var`/function style.
2. Throwaway node logic tests in the session scratchpad (do NOT commit):
   - `nextRoundLabel`: (R1,8)→R2, (R2,4)→QF, (R1,4)→QF, (QF,2)→SF, (SF,1)→F, ('',n)→''. `nextPow2`: 1→1, 5→8, 8→8.
   - `buildR1` bye math: 12 entrants in a 16-draw → 4 real R1 rows with correct `bpos` per `bracketSlots(16)` + 4 bye rows in QF with correct sides; 3 entrants in a 4-draw → bye-merge check.
   - `advanceWinner`: pos 1/2 → target bpos 1 sides a/b; ok / noop / conflict / force paths; invalid on non-final.
   - `mapConfig` deadline: `2026-07-06T23:59:59`, `Date(2026,6,6)`, garbage → ignored. (`sheet.js` uses `import.meta.env` — extract-and-eval the function in the scratchpad, as prior sessions did.)
   - `overlayBracket`: fixture rows incl. a final with winner and a hand-labeled `R2` in a 16-draw (QF/R-alias hit).
3. Playwright against `npm run build && npx vite preview` (PROD mode so reads hit `/api/sheet`), stubbing with `page.route('**/api/sheet?tab=*', …)` CSV fixtures. Chromium at `/opt/pw-browsers/chromium` via `executablePath`:
   - Config fixture with `deadline` → banner counts down correctly; without → falls back to July 6; past-deadline fixture → closed state, no Register CTA.
   - Matches fixture with Doubles R1 rows + one final → Brackets tab shows real pairings with the winner accented, and no placeholder `topSeeds` names in the East draw; Singles bracket unaffected.
   - Admin flow (`/admin.html`, PIN in `src/admin/auth.js`): seed 5 names → Build R1 → confirm mentions bye pre-fill → matches + bye row appear; mark a winner final → "Send winner → …" → next-round match holds the name in the right slot; tap again → no duplicate; Export downloads; Clear ops data; Import restores everything.
4. `functions/api/sheet.js`: node-invoke `onRequestGet` with stubbed `fetch`/`caches` and assert the `Cache-Control` header differs for `Matches` vs `Config`.

## Human steps (owner — include these in the PR/commit message)

1. **Apps Script redeploy (required for P0):** open the sheet's Apps Script, paste the updated `apps-script/ops-write-back.js`, then **Deploy → Manage deployments → pencil → New version → Deploy**. Do NOT create a *new* deployment (that changes the URL and breaks `SHEET_WRITE_URL`). Must land before relying on "Build R1 from seeds" reaching the sheet.
2. **Optional:** add Config row `deadline | 2026-07-06T23:59:59` (paste as plain text) — only needed if the deadline ever moves; the site falls back to July 6 without it.
3. **Post-deploy smoke:** admin Build R1 → `/api/sheet?tab=Matches` shows exactly the new event's rows with the other event's rows intact → public `#brackets` shows the real draw and the deadline banner is visible on every tab.

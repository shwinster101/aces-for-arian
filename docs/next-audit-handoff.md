# Next-Audit Handoff — tab-by-tab scrub checklist

For the next auditor sweeping the site in the same three roles:

- **OPS** — off-site Operations Manager running `/admin.html`, coordinating
  on-court volunteers on other devices.
- **PLAYER** — varsity-level player who wants a high seed and reads every
  word of rules/brackets/format.
- **FAN** — casual player/fan here for community, scholarship, donating, and
  logistics.

Baseline: this file accompanies `docs/audit-2026-07-07.md` (read it first —
severity, evidence, and the go-live verdict live there). "Carried forward" =
known, accepted, and should be re-checked, not re-discovered.

## Global checks (run before the tab sweep)

```bash
npm run lint && npm run build
# Privacy grep — committee-side strings must never reach the public bundle:
grep -rE "backhand|second serve|Does he still play|notes:" dist/assets/ && echo LEAK || echo clean
# No public "loser" wording (function names in source are fine; rendered copy is not):
grep -riE "loser" dist/assets/ | grep -v losersBracket
```

- Verify `/api/sheet?tab=Subscribers` and any unknown tab return 400.
- Verify the deployed Apps Script version matches `apps-script/ops-write-back.js`
  (no in-app indicator — check in the Apps Script editor). If unsure, redeploy.
- Confirm `REGISTER_FORM_URL` (`src/App.jsx`) opens a working form from a
  normal network — it broke once this season (see PR #13/#14 saga).
- Dates/counters: `daysLeft` target date, "5th Annual"/"7 straight summers"
  math, `.ics` DTSTART/DTEND, and the anniversary badge all need hand-bumping
  next year. Grep `2026` in `src/App.jsx`.

## Public tabs

### Home
- **FAN**: Register CTA state matches the calendar (open → gold button;
  past close → "Sign-ups closed" note with the form still linked). Momentum
  row reads grammatically in all states ("close in N days" / "closed").
  Getting There card: maps link opens the right place, parking/spectator
  lines still true, start times match Rules. Coordinator numbers current.
  On phones, the logistics column (Coordinators / rules / Getting There)
  stacks BEFORE the roster (CSS `order-*`); desktop keeps roster left. On
  live day a "We're live" strip appears under the hero and must land on the
  Brackets tab with the court board up top.
- **PLAYER**: format-reassurance pill guarantee matches Rules and Brackets
  wording ("at least 3 matches (up to 5)").
- **OPS**: roster "Live" badge appears; confirmed counts match the sheet;
  a Registrations status flip in admin reaches an open Home tab within ~2 min
  (OpsStatus poll) — no reload.
- Carried forward: venue is deliberately "DHS Tennis" (maps search link, no
  street number — owner decision 2026-07-07, don't re-flag it); no
  social/after-event info.

### Rules
- **PLAYER**: BOTH events fully scored — doubles Fast-4 + tiebreak line, and
  singles "6-game no-ad sets; 7-point tiebreak at 6–6" (published
  2026-07-07). Sunday 8 AM visible. "How are seeds decided?" FAQ present and
  still accurate. **Event-week to-do: when the draw locks, post real match
  times and update the "Day-of Schedule" card** (still labeled
  tentative/2025 timeline).
- **FAN**: check-in bullets (map, parking), rain FAQ names a channel
  (coordinator texts + live board), spectator FAQ, refund/transfer policy.
- **OPS**: default rule (15 min late) matches what staff actually enforce.

### Brackets (`#brackets`, internal id `draws`; `#seeding` must redirect here)
- **ALL ROLES — test both phases.** The tab is live-aware (`liveDay` flips
  when ops posts the first match): draw week = intro/draws first; live day =
  Court Board + Live Scores ABOVE the brackets, and Home shows a "We're
  live" strip under the hero. In a sandbox, flip the live phase by
  intercepting `**/api/sheet**` with fixture CSV for the Matches tab
  (Playwright `page.route`) — the real feeds won't resolve.
- **PLAYER**: pre-publish = every slot TBD, zero named seeds (the hardcoded
  fallback was deleted 2026-07-07 — it must never come back; seeds load only
  from `SeedBoardPublic`). Post-lock = "Final Seeds", top-8 badges only,
  nothing rendered for 9+, byes on open lines opposite named entrants.
  Find-yourself-in-the-draw highlights correctly. Suggest-the-seeds box
  visible until lock, gone after.
- **PLAYER (privacy)**: 9+ bracket *position* still reflects seed-list order
  — confirm the committee shuffled 9-16 / 17-32 within bands before lock.
- **FAN**: on event day — court board, live scores, ace tracker appear once
  ops posts data; "reconnecting…" shows when a feed goes stale.
- **OPS**: draw lock flip reaches an open public tab within ~2 min; false-BYE
  warning fires in admin if entrants are missing from the seed list.

### Scholarship
- **FAN**: meter (header) matches Config; scholars list explains that this
  summer funds the newest class (no "already awarded vs. help us raise it"
  whiplash); essay/eligibility current; application link works.
- **OPS**: admin meter save reaches an open public tab within ~2 min.

### Legacy
- **FAN**: Arian's story, PJStar link, Hall of Fame per-year PDFs all load
  (`public/archive/*` — filename case matters on Cloudflare). Register CTA
  obeys the closed state. Anniversary copy self-reconciles (5th Annual /
  7th summer, Eagle Classic 2020–21).

### Photos
- **FAN**: slideshow images load; per-year Google Photos album links work;
  photos stay in the ~400–800 KB range if new ones are added.

### Merch
- **FAN**: prices match what's actually charged; bundle math (save $6)
  correct; "tee included with entry" true; Venmo link works.
- **OPS**: admin Merch shirt-demand counts match roster shirt sizes.

## Admin sections (`/admin.html`, PIN-gated — PIN is a deterrent, not security)

### Registrations
- **OPS**: confirmed/pending flip pushes OpsStatus (verify on public roster);
  walk-ups are THIS-DEVICE-ONLY — confirm the runbook still assigns one
  device for them. Sync button refreshes roster (no auto-refresh).

### Check-ins
- **OPS**: localStorage-only, by design. Confirm the designated check-in
  device policy is in the day-of plan. Off-site manager cannot see these.

### Payments
- **OPS**: local-only payment truth; Venmo/Zelle reconciliation is manual.
  Meter save is the one synced write here. Note the Zelle email ships in the
  bundle — rotate/remove post-event if that changes.

### Seeding & Draws
- **OPS**: field picker dedupes reciprocal doubles regs; partner flags
  sensible; drag-rank works on a phone; lock toggle warns when entrants are
  missing (false-BYE guard); seed pushes send NAMES ONLY (notes stay local —
  verify with devtools/network or the sheet). Two devices editing seeds =
  last-writer-wins; keep seeding on one device.

### Scores & Courts
- **OPS**: score edit reaches public Live Scores within ~1 min (Matches
  polls 60s); matches created on another device DO NOT appear in this
  device's admin (no read-back) — one scores device only. Ace +1 reaches the
  public chip within ~1 min; ace dollars are NOT auto-added to the meter.

### Merch (admin)
- **OPS**: inventory is the gear-locker device's alone.

### Footer / infrastructure
- **OPS**: "last push attempted" honesty — it proves the request left the
  device, nothing more; the receipt is the public page updating.
  "Clear this device's ops data" leaves pushed sheet data live (dialog says
  so). After clearing, confirm public SeedBoardPublic was NOT blanked.

## Carried-forward backlog (see audit §6)

Multi-device sync for check-ins/payments/walk-ups · push delivery
confirmation/retry · admin Matches read-back · Apps Script version indicator
· Cloudflare Access for /admin · App.jsx split · token/PIN rotation
post-event.

# Handoff — Aces for Arian site + tournament ops console

Purpose: give a fresh session the current shape of the project without
re-deriving it from memory. Memorial tennis tournament: **July 11-12, 2026**,
Dunlap HS, Peoria IL.

Last regenerated: 2026-06-16 23:51 PDT. Current implementation base: `2fae536` on `main`,
in sync with `origin/main` before the visitor-first tab/copy handoff commit.

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

## 1. Session Summary — 2026-06-16

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
- `Subscribers` is private and deliberately not allowlisted for public reads.

Write-back event types:

- `seeds` -> `SeedBoardPublic`.
- `match` / `match-delete` -> `Matches`.
- `aces` -> `Aces`.
- `status` -> `OpsStatus`.
- `court-board` exists in Apps Script but the current public board is mostly match-derived.
- `participant`, `walk-up`, payment/check-in/shirt overlays are deliberately not sent.

Secrets/tokens are not real secrets if committed or bundled. They deter casual writes only.
Do not place read tokens in response bodies/headers.

---

## 6. Public Dashboard

Tabs:

- Home.
- Rules.
- Brackets.
- Projected Seeds.
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

1. Redeploy Apps Script as a new version so `subscribe` and `OpsStatus` sentinel filtering are enforced upstream.
2. Do a phone dry-run on `/admin.html` and `/#home`.
3. Decide whether `OpsStatus` should poll periodically or remain reload-based.
4. Consider Cloudflare Access for `/admin`; current PIN/token are deterrents only.
5. Keep `App.jsx` refactor on the radar: it is ~2k lines and should eventually split into
   public sections/components the way admin already is.

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

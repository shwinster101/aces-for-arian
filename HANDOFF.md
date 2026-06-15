# Handoff — Aces for Arian site + tournament ops console

Purpose: give a fresh session the current shape of the project without
re-deriving it from memory. Memorial tennis tournament: **July 11-12, 2026**,
Dunlap HS, Peoria IL.

Last regenerated: 2026-06-14 PDT. Current HEAD: `a80243a` on `main`, in sync
with `origin/main` before the local edits listed below.

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

---

## 1. Local Working Tree Notes

Current meaningful local edits at handoff time:

- `src/App.jsx`
  - Public roster count says `confirmed`, not `paid`.
  - Roster badge renders `Confirmed` for internal `Verified`.
  - Entry copy says staff confirms entry and payment is checked separately.
  - Scholarship total is `config.raised ?? 580`, goal defaults to `1750`.
  - Live ace chip remains visible/count-only.
- `src/lib/sheet.js`
  - Comments updated: `Status`/`Verified` means confirmed public roster entry.
  - Config `raised` documented as authoritative public scholarship total.
- `src/admin/AdminApp.jsx`
  - Header date corrected to `July 11-12`.
- `apps-script/ops-write-back.js`
  - Comment-only cleanup: `OpsStatus` is the one shared registration field;
    payment/check-in/walk-up details stay local/private.
- `src/admin/sections/Payments.jsx`
  - Staff reference copy added: Venmo `@acesforarian`, Zelle admin-only.
- `public/photo6.jpg`
  - Compressed current image from `3024x4032`, ~5.1 MB to `1200x1600`, ~672 KB.
- `AGENTS.md`, `CLAUDE.md`, `HANDOFF.md`
  - Untracked local guidance/handoff files.

Run before handing off or committing:

```bash
npm run lint
npm run build
```

Both passed after the semantic/status patch.

---

## 2. Architecture

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

## 3. Data Model And Privacy Contract

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

## 4. Sheet Tabs And URLs

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

## 5. Public Dashboard

Tabs:

- Home.
- Brackets.
- Projected Seeds.
- Rules.
- Photos.
- Scholarship.
- Legacy.
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

## 6. Admin/Ops Console

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
  - `pending` / `waitlist` push public `Pending`.
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

## 7. Deployment Notes

Cloudflare Pages:

- Push to `main` to deploy public/admin frontend and `functions/`.
- Verify live route at `https://aces-for-arian.pages.dev/#home`.
- Verify `/api/sheet?tab=` returns filtered public columns only.
- Verify unknown tabs return `400`.

Apps Script:

- For code changes, use **Deploy -> Manage deployments -> pencil -> New version -> Deploy**.
- Do not create a New deployment unless you also update `SHEET_WRITE_URL`.
- Comment-only changes do not require redeploy.
- Logic changes to `doPost`, `doGet`, `READABLE`, or tokens require redeploy.

Dry run checklist:

- Admin Registration `confirmed` -> public roster shows Confirmed after reload/read.
- Admin score edit -> public Live Scores updates.
- Admin ace `+1` -> public ace chip/tracker updates.
- Payment toggle remains admin-local.
- Check-in toggle remains admin-local.

---

## 8. Current Highest-Leverage Work

1. Commit the current semantic cleanup once reviewed.
2. Refresh/deploy Apps Script only if logic changed since the currently deployed version.
3. Do a phone dry-run on `/admin.html` and `/#home`.
4. Decide whether `OpsStatus` should poll periodically or remain reload-based.
5. Keep `App.jsx` refactor on the radar: it is ~2k lines and should eventually split into
   public sections/components the way admin already is.

---

## 9. Known Risks / Footguns

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

---

## 10. Response Style Notes

User likes bullets and systems. Each response should include:

- One bullet for what changed materially.
- One bullet for the highest-leverage recommendation.
- Two high-leverage follow-up questions.
- A final estimated usage/cost line.

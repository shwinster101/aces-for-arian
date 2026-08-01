# Aces for Arian — Channel & Source-of-Truth Contract

*One page. Which system owns which record, what the site is (and is not), and
the money math — so no two channels ever claim the same fact. Keep this current
when a flow changes.*

## Ownership map

| Record | Canonical owner | The site's role | Notes |
|---|---|---|---|
| **Registration** | Google Form → the Sheet's first tab (raw responses) | Presents a PII-stripped roster (name/class/events/partner only) | Both read boundaries (Cloudflare Function + Apps Script doGet) strip email/phone/payment before anything leaves Google. |
| **Payment (entry, merch, donations)** | **Venmo activity** (@acesforarian) + the day-of cash drawer ledger (device-local) | Links out to Venmo; never processes money | The drawer ledger lives in one device's localStorage by design — reconcile it against Venmo the same day. |
| **Draws & seeds** | Ops console → `SeedBoardPublic` / engine `Matches` rows in the Sheet | **The canonical PUBLIC record** — the draw sheets are the permanent, published result of record | Committee-internal seed notes never enter the Sheet (see the separation note in `src/lib/sheet.js`). |
| **Scores & results** | Desk entry in the ops console → `Matches` tab | Canonical public record. A final without a desk-entered score is labeled "score not recorded" on the Results tab | Winner (gold) is authoritative even when the score line is absent. |
| **Urgent day-of alerts** | `Announcements` tab → site-wide banner | Canonical broadcast surface | Coordinator SMS/calls are the *personal* push channel; they deep-link here, never restate mutable schedules. |
| **Donation accounting** | Venmo (transactions) + the staff-set `Config.raised` number | Publishes the meter | See "money math" below. |
| **Scholarship applications** | Google Doc (prompt) + email/transcript submission, reviewed off-site | Publishes eligibility, prompt, criteria, recipients | Owner TODO each spring: publish the application window + submission path when it opens. |
| **Merch orders** | `MerchOrders` tab + email per order (after the Apps Script redeploy) | Captures the order, hands off to Venmo | Buyer name/contact is PII: `MerchOrders` is excluded from every public read allowlist. |
| **Code & version history** | Git (`main` = deployed) | Both HTML entries carry `<meta name="build-sha">` = the deploying commit; `check-deploy` asserts live == expected | Apps Script deploys are manual ("New version") and can lag the repo — the workflow's probes detect the lag. |

**In one sentence:** the **site is the canonical public record and the live
participant experience**; the **Sheet is the canonical operational store**;
**Venmo is the canonical financial record**; **email/SMS is urgent, personal
push that links into the site**.

## Money math (what "raised" means)

- `Config.raised` is **staff-set and gross-of-nothing**: "100% of every $40
  entry and every donation goes to the scholarship — no overhead" (as published
  on the Scholarship tab). There are no platform fees taken out of it.
- **Merch** counts toward the fund at **price minus cost** (see the admin Merch
  tab's per-product break-even math) — staff add merch net to `raised`
  manually.
- **Ace Pledges** are displayed as "+$X pledged" beside the meter and are added
  to `raised` only as the Venmo payments actually clear.
- Direct gifts (cash/check) are added by staff when received.

## Funding cohort (already published on the Scholarship tab)

Scholars are selected **each spring**; the **newest class's awards are funded
by that summer's tournament**. So the 2026 tournament's proceeds back the
already-named 2026 scholars (Noelle Daccache & Anton Dahlin); the 2027
tournament will fund the class announced in spring 2027.

## Site phase modes (all code-gated in `src/App.jsx`)

| Phase | Trigger | What shows |
|---|---|---|
| **Pre-event** | default | Register hero, roster momentum, checklist |
| **Event window** | Fri before → Sun of the tournament | Game Day card |
| **Live** | first match posted (`boardLive`) | Court board, queue, live scores lead |
| **Wrap / Results** | ~midnight after singles day, or `Config` `wrap` override | Thanks, champions, permanent record; registration surfaces retire |
| *Scholarship-open (spring)* | *manual today* | *Owner TODO: promote the apply link + window when applications open* |

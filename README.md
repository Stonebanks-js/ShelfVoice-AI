# Shelf Voice

A voice-first assistant for kirana shop owners: speak your shop online, know what to restock, and hear every customer, without typing. Built for the Meta Global AI Developer Hackathon (Oct 26 to Nov 4, 2026).

**Live app:** https://shelfvoice.vercel.app. Tap **Try the demo shop** for a sample kirana shop with 90 days of history, no sign-up needed.

## The problem

A kirana owner runs the shop from the counter, often in Hindi, with no time to type product lists into an app. Most never get a shop page online, find out an item ran out only when a customer asks for it, and never hear the customers who just walk away.

Shelf Voice lets the owner do all three by speaking:

- **Speak your shop online.** "Maggi 14 rupaye, Parle-G 10 rupaye" becomes a product list and a public shop page with hours, a call button and a QR code for the counter.
- **Know what to restock.** Sales are logged by voice ("do Maggi bike") or from a photo of the supplier's bill. The Orders tab says what to reorder and how much, and why.
- **Hear every customer.** Customers scan the QR and leave a 15-second voice review. The owner sees what was said, whether they were happy, and which items they asked for. An item a customer wanted but couldn't get raises its restock forecast.

Every change the AI suggests is shown to the owner on a check screen first. Nothing changes until they confirm, and any change can be undone for 10 seconds.

## Meta models

Every AI feature runs on Meta models through the Meta Model API. No other AI provider is used anywhere, including in tests.

| Model | Used for |
|---|---|
| Muse Spark 1.3 | Reading a spoken shop description into a product list, turning commands into tool calls (sell, add stock, change price), reading supplier bills from photos, analysing customer reviews, wording restock reasons |
| Muse Voice Transcribe 1.0 | Turning owner voice notes and customer reviews (Hindi, English or a mix) into text |
| SAM 3.1 | Planned for product cut-outs from shelf photos (W-18); not called yet |

Model output is always parsed and checked against a schema before it is used. Prices, stock counts and reorder quantities are computed in code, never by a model.

## Architecture

```
Phone browser ──► Next.js 16 on Vercel (Mumbai, bom1)
                    │  server routes, proxy (sessions, request IDs), cron
                    ├──► Supabase (Seoul): Postgres with row-level security, Storage, Auth (Google + anonymous demo)
                    ├──► Meta Model API: Muse Spark, Voice Transcribe
                    ├──► Cloudflare Turnstile (review page bot check)
                    └──► Axiom logs, Better Stack heartbeats, Discord alerts
```

- **App:** Next.js 16 (App Router, cache components, partial prerendering), React 19, Tailwind 4. Hindi and English throughout; light and dark follow the phone.
- **Audio:** the browser records 16 kHz mono WAV with an AudioWorklet and uploads it straight to Storage with a signed URL. Photos are resized and re-encoded on the phone, which removes location data.
- **Data:** every table has row-level security; owners only ever see their own shop. Confirming a proposal runs in one database transaction, and repeating the same request changes nothing.
- **AI client** (`src/server/ai`): spending caps ($100 total, $15 a day, $2 per shop a day), a circuit breaker with a manual pause switch on the admin page, timeouts and one retry, and a ledger of every call's cost and latency.
- **Security:** Content Security Policy and security headers, same-origin checks on every write, rate limits per IP, per owner and per shop, Turnstile on customer reviews.

The design documents (01 to 09) are the source of truth; [ERRATA.md](ERRATA.md) records where they disagree and how each conflict is resolved, and [ACTION_PLAN.md](ACTION_PLAN.md) is the task list.

## How the numbers are computed

Restock suggestions come from a small, checkable formula in [`src/server/forecast/formula.ts`](src/server/forecast/formula.ts), not from a model:

1. **Daily demand** is the exponentially smoothed daily sales (α = 0.2), multiplied by 1.2 for 14 days when a customer review says the item was out of stock (that demand was never recorded as sales).
2. **Safety stock** = 1.28 × σ × √L, where σ is the standard deviation of the last 28 days of sales and L is the supplier lead time in days (90% service level).
3. **Reorder point** = demand × L + safety stock. An item at or below it goes on the order list.
4. **Order quantity** = demand × (L + R) + safety stock − current stock, rounded up to the pack size, where R is the days between orders.
5. **Cold start:** with under 14 days of history there is no quantity yet; the item is flagged at the owner's own low-stock level instead.

Muse Spark only writes the one-line reason shown next to each suggestion, from these numbers.

## Privacy and data location

Data is stored with **Supabase in Seoul, South Korea** (ap-northeast-2), not in India. The app runs on Vercel functions in Mumbai, which pass data to and from Seoul ([E-28](ERRATA.md#e-28-staging-database-is-in-seoul-not-mumbai)).

| Data | Kept for |
|---|---|
| Owner's account, shop, products, stock and sales | Until the owner deletes the shop (immediately, from My shop) |
| Owner voice notes | 7 days; the understood words stay with each confirmed change for 90 days |
| Bill and shelf photos | 30 days |
| Customer review audio | 30 days; the words, sentiment and items stay until the shop is deleted |
| Hashed IP address on a review | 7 days (the hash's salt changes daily; raw IPs are never stored) |
| Demo shops | 24 hours |
| Logs (Axiom) | Up to 30 days; never voice, transcripts, names or phone numbers |

The full policy, in Hindi and English, is at [/privacy](https://shelfvoice.vercel.app/privacy).

## Local setup

Requirements: Node 24 (pinned in `.nvmrc`; `fnm use` picks it up), pnpm, Docker Desktop running, Git.

```bash
pnpm install
cp .env.example .env.local
pnpm exec supabase start
pnpm dev
```

`supabase start` prints the local API URL and keys; copy them into `.env.local`. The app checks every variable at startup and names any that are missing. The app runs at http://localhost:3000.

Local AI calls use recorded responses by default (`META_MODE=recorded`). Set `META_MODE=live` and `META_API_KEY` in `.env.local` to call the real API.

## Commands

| Command | Does |
|---|---|
| `pnpm dev` | Run the app locally |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generate route types, then strict TypeScript check |
| `pnpm test` | Unit and integration tests with coverage (integration tests need `supabase start`) |
| `pnpm e2e` | Playwright journeys with accessibility checks at 360 px and 1280 px, light and dark; never calls the live Meta API |
| `pnpm check:bundle` | Fails if a server secret could reach the browser bundle |
| `pnpm db:types` | Regenerate `src/types/database.ts` from the local database |

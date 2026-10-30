# Shelf Voice: phase-wise action plan

Built Oct 27, 2026 from documents 01 to 09, the Key Screens mockups and [ERRATA.md](ERRATA.md). It follows doc 09's phases, owners and gates, and adds the workflow each document sets out (testing from 04, release from 08, design acceptance from 06 and so on). Every errata fix is placed in the task that applies it; the [coverage table](#errata-coverage) at the end shows where each one lands.

Where this plan and a PDF disagree, the errata entry wins (see ERRATA.md). The task IDs `W-01` to `W-26` and spike checks `S0` to `S6` are doc 09's; IDs with a letter suffix (`W-01b`) or a `D-` or `J-` prefix are added here, and doc 09's W-02 is split into W-02a to W-02c so each migration batch is its own PR.

## Ground rules for building

1. **Meta models only.** Every AI capability runs on the Meta Model API: `muse-spark-1.3` (extraction, tool calls, vision, explanations, translation), `muse-voice-transcribe-1.0` (speech) and `sam-3.1` (segmentation). Never use another provider's model anywhere, including SDK defaults and eval graders: promptfoo's model-graded assertions default to OpenAI, so their grader is set to Muse Spark. The OpenAI SDK is used only as a client pointed at Meta's endpoint. OpenRouter is allowed only as a route to the same Meta models, and only if the owner approves it (E-03).
2. **No hollow integrations.** Integration code is never marked Complete until it has run against the real service. When a task needs access we don't have (a Supabase project, a key, an account, an MCP connection), it is marked Blocked and the request goes to the owner using the checkpoint list below. Work continues only after the owner provides the access.
3. **Secrets never go through chat.** The owner puts keys into `.env.local`, the Vercel and Supabase dashboards or GitHub secrets. Chat only says that a key is in place.

## Inputs needed from you (manual checkpoints)

These are the points where the build stops and waits for the owner. Each one lists what to provide and which tasks it unblocks.

| # | When | What you provide | Unblocks |
|---|---|---|---|
| C-00 | Phase 0 (done Oct 28) | Install the missing local tools: Node 24 alongside Node 26 (Vercel runs 24.x), pnpm, GitHub CLI. The Supabase CLI goes into the repo as a dev dependency, so no global install is needed | W-01, W-01b, D-06 |
| C-01 | Phase 0, now | The four decisions in D-01: credit-expiry plan and OpenRouter use, $100 cap, approving 09 (track rules come in C-03) | D-01, W-03, W-04 |
| C-02 | Phase 0 | Names for teammates A, B, C, the backup for each account, and the portal submitter (done Oct 29: solo builder, A.S Chaudhary holds every role) | D-03, D-05, J-01 |
| C-03 | Phase 0 | The official rules text on tracks and team size, and the submission form link | D-04, W-26 |
| C-04 | Phase 0 (done Oct 28, except the `project` scope for the issues board) | Confirm `Stonebanks-js/ShelfVoice-AI` is the project repo; authorise GitHub access for me (`gh auth login` in a terminal, or the GitHub MCP via `/mcp`); turn on secret scanning, push protection and branch protection yourself | D-06, D-07, W-01b |
| C-05 | Phase 1, before S0 (done Oct 29; credit end date assumed, see spike/README.md) | Claim the $150 Meta credit, create the API key, put it in `.env.local` as `META_API_KEY`, and tell me the credit end date | S0 to S5, W-04 |
| C-06 | Phase 1, before W-02 (in progress: staging is `shelfvoice-staging`, ref `idrhitepkksjgwqauael`, in Seoul by owner decision E-28; linked with the CLI Oct 28; still needed: anonymous sign-ins switched on, the database password in `.env.local`, and later a production project in ap-south-1 connected only as a read-only MCP `supabase-prod`) | Install Docker Desktop and the Supabase CLI if missing; create Supabase projects `shelfvoice-staging` and `shelfvoice-prod` in ap-south-1 (Mumbai); connect me to the Supabase MCP; turn on anonymous sign-ins | S6, W-02a to W-02d |
| C-07 | Phase 1, before W-03 | Create the Vercel project linked to the repo; set the env vars I list in the dashboard; add `VERCEL_TOKEN` and the Supabase access token as GitHub Actions secrets (or connect a Vercel MCP) | W-03, S1 (bom1 check), S6 |
| C-08 | Phase 1, before W-03b | Create Axiom (dataset `shelfvoice`), Better Stack (4 monitors, 2 heartbeats, status page) and a Discord alert webhook; put their tokens and URLs in Vercel env | W-03b |
| C-09 | Phase 1, during spike | Record 20 Hinglish clips across all 3 teammates (10 owner commands, 10 reviews) and take 1 shelf photo | S4, S5 |
| C-10 | Phase 2, before W-07 | (done Oct 29: client created, app published, live sign-in verified) Create the Google Cloud OAuth client with the redirect URI I give you; enter its ID and secret in the Supabase dashboard; set the consent screen to production before real owners | W-07 |
| C-11 | Phase 2, before W-08 | A mid-range Android phone on hand for mic and upload tests | W-08, W-24 |
| C-12 | Phase 3, before W-14 | Create the Cloudflare Turnstile site; put the site key and secret in Vercel env | W-14 |
| C-13 | Phase 3 | Record the audio fixtures (6 setup, 12 command, 10 review, 6 edge-case clips) and photo fixtures (5 shelf, 10 printed bills, 5 handwritten bills, 1 with GPS EXIF) | W-09, W-11, W-15, W-16, W-22 |
| C-14 | Phase 4 | Line up 3 real shop owners for Nov 2–3 with signed consent | W-23 |
| C-15 | Every production release | Approve the production deploy when `release.yml` asks (from the freeze onward) and every push to GitHub | W-24, J-03 |
| C-16 | Phase 5 | Record the demo video and submit on the portal | W-25, W-26 |

## Roles (doc 09, I1)

| Role | Owns | Reviews |
|---|---|---|
| **A** Frontend and design | App shell, mic and WAV encoder, confirm screens, storefront, review page, PWA, accessibility, demo video | C's prompts as they show on screen |
| **B** Backend and data | Supabase schema, RLS, auth, storage, forecast, CI/CD, deploys, backups, seeded demo shop | A's PRs |
| **C** AI and quality | Meta API client, prompts, transcription, evals, observability, spend caps, security checks | B's PRs |

Names for A, B, C and the portal submitter are set in task D-03.

## Timeline at a glance

| Phase | Dates (IST) | Goal | Ends with |
|---|---|---|---|
| [0. Decisions and setup](#phase-0-decisions-and-setup) | Oct 27–28 | Settle open decisions, accounts, tracker | Decisions recorded in ERRATA.md |
| [1. Spike and foundations](#phase-1-spike-and-foundations) | Oct 27–28 | Prove the Meta path; repo, database, deploys, AI client | **G0** go/no-go, Oct 28, 9 PM |
| [2. Thin slice](#phase-2-thin-slice) | Oct 29–30 | Speak → confirm → live storefront | **G1**, Oct 30, 10 PM |
| [3. Core loop](#phase-3-core-loop) | Oct 31–Nov 1 | Every Must requirement works | **G2**, Nov 1, 10 PM |
| [4. Shoulds and hardening](#phase-4-shoulds-and-hardening) | Nov 2–3 | Shoulds, demo shop, evals, security, real owners | Release checklist ready |
| [5. Freeze and submit](#phase-5-freeze-release-and-submit) | Nov 4 | Release, video, submission | Freeze 12:00 PM; submit by 11:00 PM |
| [6. Judging week](#phase-6-judging-week-and-after) | Nov 5–9 | Keep the judged build working | Closing ceremony Nov 9, 10:30 PM |

Hard deadline: **Thu Nov 5, 7:30 AM IST** (Nov 4, 9:00 PM ET).

---

## Standard task workflow

Every build task (W-xx) runs through the same loop. Each step comes from the document that owns it.

1. **Open the issue** (09, I6). One GitHub issue per task on the Projects board, with its FR, owner and "Done when". Status is Not started, In progress, Blocked (with reason) or Complete.
2. **Check the requirement** (01). Read the FR and its story's acceptance criteria. Anything not in them is out of scope (01 exclusions).
3. **Design first, for UI** (06). Use only Signboard tokens; build loading, empty, error, success and offline states; Hindi and English strings; 48 px targets; primary action in the thumb zone.
4. **Schema in its own PR** (07, 08, E-09). A new table or column goes in a migration PR that merges before the code that uses it. RLS and policies go in the same migration file; types are regenerated with `pnpm db:types`.
5. **Test first** (04). Write the failing test before the code. Unit tests with Vitest, RLS tests with pgTAP, Meta calls through recorded responses only, and a new eval case for any new prompt. For a bug, write a failing test that reproduces it first.
6. **Build to the architecture rules** (02). Keep route handlers thin (validate, check ownership, call one service in `src/server/services`), validate everything with Zod, and follow propose-then-confirm for every AI write. Code computes every number; the model never does.
7. **Security pass** (03). RLS on the new table, server ownership check, Zod at the boundary, no `dangerouslySetInnerHTML`, no secret in code or logs, text length limits.
8. **Observability pass** (05). Request ID on every log line, event names as `area.action`, redaction before every log write, and one `ai_calls` row per Meta call with a spend cap.
9. **PR and CI** (08, 04). Branch from `main`, open a PR, get the reviewer from the Roles table, and pass the 5 blocking gates: lint and typecheck, Vitest with the 80% coverage gate, pgTAP, security scans, and Playwright with axe on recorded AI.
10. **Merge and release** (08, E-07). Merging to `main` runs `release.yml`: migrate staging, migrate production, deploy, smoke test, post the SHA to Discord. From the freeze, production needs manual approval.
11. **Evidence and close** (09). Link the PASS evidence (CI run, test output, screenshot or recording) in the PR, confirm it runs on staging (or production after G2), and mark the task Complete. Nothing unrun is marked PASS.

---

## Phase 0: Decisions and setup

**Dates:** Oct 27–28 · **Workflow:** errata decision log; 08 accounts and environments; 09 tracking (I6)

| ID | Task | Owner | Sources | Fixes | Done when | Status |
|---|---|---|---|---|---|---|
| D-01 | Owner decides the four open errata items: credit-expiry plan and OpenRouter fallback budget, track eligibility, $100 spend cap, approving 09 | Owner | ERRATA | E-03, E-04, E-06, E-25 | Each entry in ERRATA.md set to `Decided` with the choice written down | In progress: E-06 and E-25 decided Oct 27; E-03 waits for S0; E-04 waits for C-03 |
| D-02 | Apply the agreed wording fixes to the PDFs, or mark them `Decided` so the log overrides the PDFs | Owner + C | ERRATA, 01, 02, 05, 06, 09 | E-05, E-07, E-11 to E-18, E-20 to E-24, E-26, E-27 | Every errata entry is `Decided` or `Applied` | Not started |
| D-03 | Name teammates A, B, C, the backup for each account, and the portal submitter | Owner | 08 p2–3, 09 p3 | — | Names filled in for 08's account table and 09's role table | Not started |
| D-04 | Read the official rules on tracks and the Cerebral Valley submission form; copy the form fields into 09 | Submitter | 01 D1, 09 K9 | E-04 | Rule text quoted in 01 D1; form fields listed in 09 | Not started |
| D-05 | Create accounts with two people each: Vercel, Supabase org (2FA), Meta team, Google Cloud OAuth, Cloudflare Turnstile, Axiom, Better Stack, Discord alert channel, shared password vault | B | 08 p2–3, R6; 03 secrets | — | Every account has a primary and a backup with 2FA; vault shared | Not started |
| D-06 | Set up GitHub Issues and a Projects board with one issue per task in this plan, labelled by phase and owner | B | 09 I6 | — | Board shows every task below | Not started |
| D-07 | Turn on GitHub secret scanning, push protection and branch protection on `main` (PR and green CI required) | B | 03 p10, 08 p2 | — | Settings screenshot saved in the vault | Complete: secret scanning and push protection on; branch protection applied Oct 28 (PR required, the five CI checks required, applies to admins) |

---

## Phase 1: Spike and foundations

**Dates:** Oct 27–28 · **Workflow:** 09 day-1 spike (PASS / FAIL / BLOCKED with evidence in `spike/`); 07 migration plan; 08 local setup and provisioning

### Spike (must finish by Oct 28, 9 PM IST)

| ID | Check | Owner | PASS means | If it fails | Fixes | Status |
|---|---|---|---|---|---|---|
| S0 | Claim the $150 credit and create the API key | C | Key works; credit end date recorded in `META_CREDIT_ENDS_AT`; key stored only in Vercel and the vault | Ask organisers on day 1 | E-03 | PASS Oct 29: key works; end date assumed 2026-11-05 07:30 IST until confirmed (spike/README.md) |
| S1 | Meta API reachable from India | C | `muse-spark-1.3` Responses call returns 200 from a laptop in India and from a Vercel function in bom1 | Switch `META_BASE_URL` to OpenRouter; note it in the README | — | PASS from India Oct 29; Vercel bom1 half waits for W-03 |
| S2 | Structured output | C | 10 sample owner transcripts return JSON that passes our Zod schemas via `text.format` | Add one repair retry, then fall back to tool calling | — | PASS Oct 29: 10/10 schema, 0 invented values |
| S3 | Transcribe request and response shape | C | Multipart field names, `keywords`, `languageBias` and `mode` confirmed; one response saved as a fixture | Keep Musts moving with typed input | — | PASS for request and response format Oct 29; keywords and languageBias effect to confirm in S4 |
| S4 | Hinglish accuracy | C + all | 20 clips (10 commands, 10 reviews) from all 3 teammates meet 04's product-name and quantity thresholds | Catalog keywords; every number editable on confirm | — | Not started: needs the 20 team clips (C-09) |
| S5 | SAM 3.1 masks | C | One shelf photo returns masks we decode and crop into a product image | Drop FR-10; Musts unaffected | — | Not started: needs one shelf photo (C-09) |
| S6 | Region latency | B | Vercel bom1 to the production Supabase project (ap-south-1) under 50 ms at p95 over 100 calls; staging is in Seoul (E-28) | Check regions in both dashboards | — | Not started |

**Gate G0, Oct 28 at 9 PM IST.** S0 to S3 are PASS or have a working fallback. If not, the team spends the morning of Oct 29 on them before starting the thin slice. S4 and S5 change scope only.

### Foundations

| ID | Task | Owner | FR | Sources | Fixes | Done when | Status |
|---|---|---|---|---|---|---|---|
| W-01 | Repo scaffold: Next.js App Router, strict TypeScript, pnpm, Node 24 (`engines` and `.nvmrc`), Tailwind (shadcn/ui is set up with the theme in W-06), ESLint rule banning `dangerouslySetInnerHTML`, Zod env schema, `.env.example`, `.gitignore` for `.env*` and `*.pem` | B | — | 02 p3–4, 03 p7, 08 p4–6 | — | `pnpm dev` runs; a missing env var stops startup with a clear message | Complete: PR #1 merged Oct 28 with all CI checks green |
| W-01b | `ci.yml` with the 5 blocking gates: lint and typecheck; Vitest with an 80% line-coverage gate on `src/server/**` and the forecast module; `supabase test db`; security (`pnpm audit --prod`, Semgrep, secret scan, bundle check for server keys); Playwright with axe on recorded AI. Add Dependabot weekly | B | — | 04 p10–11, 03 p10, 08 p7 | E-01 | CI green on an empty app; the audit step runs against `pnpm-lock.yaml` | Complete: PR #1 merged Oct 28; Semgrep findings in the CI files fixed (actions pinned to SHAs, Dependabot cooldown) |
| W-02a | Supabase staging and production projects in ap-south-1 (free plan): "Enable RLS on new tables" on; `pgcrypto`, `pg_trgm`, `pg_cron` confirmed; Google provider; anonymous sign-ins; site and redirect URLs | B | — | 08 p6, 07 p8 | — | Both projects reachable; `supabase link` works for each | In progress: staging (Seoul, E-28) created, linked and checked Oct 28; production not created yet |
| W-02b | Migrations 1–4: enums, `shops`, `products`, `stock_movements` with the stock trigger, `proposals`, `reviews`, `product_forecasts`, `ai_calls`, each with RLS, policies and indexes; revoke EXECUTE on `public.rls_auto_enable()` from `anon` and `authenticated` (Security Advisor 0028 and 0029, found on staging Oct 28). Include `proposals.status` `UNDONE`, `stock_movements.source` `UNDO`, before and after values in `confirmed_changes`, nullable `reviews.ip_hash`, and the `ai_calls.outcome` enum from 05 (add `REPLAYED` if E-03 is approved) | B | — | 07 p3–6, 03 p6 | E-02, E-08, E-10, E-03 | `supabase db reset` builds locally; pgTAP: owner A reaches none of owner B's rows; stock can't go negative | In progress: migrations 1–4 and 7 written, 42 pgTAP tests pass locally and on staging (applied Oct 28); waits for PR (E-29) |
| W-02c | Migrations 5–7: `festival_calendar` seed (15 rows), `rate_limits`, `ai_breaker`; views `public_storefront` (published, non-archived products with an in-stock flag, no counts) and `ai_spend_daily`; storage buckets `voice`, `photos`, `catalog-images` with `{shop_id}/` path policies; pg_cron schedules | B | — | 07 p5–8, 03 p6 | E-05 | pgTAP: anonymous sees out-of-stock items with `in_stock = false` and no counts; base tables return 0 rows; storage denies cross-shop paths | In progress: migrations 5–6 on staging Oct 28; festival seed moved to W-19, pg_cron schedules to W-13 and W-17b (E-29); waits for PR |
| W-02d | CI migration check: fails if any public table lacks RLS; fails if `src/types/database.ts` is stale | B | — | 03 p4, 07 p8 | — | Check fails on a test table without RLS | In progress: RLS-everywhere test and stale-types CI check written; waits for PR |
| W-03 | Vercel project: functions pinned to bom1; env vars from 08 including `AI_TOTAL_BUDGET_USD=100`, `AI_DAILY_BUDGET_USD` (global), `AI_SHOP_DAILY_BUDGET_USD`, `META_CREDIT_ENDS_AT`; automatic production deploy turned off; `release.yml` (migrate staging → migrate production → `vercel deploy --prod` → smoke test → Discord), automatic on green merge and manual approval from the freeze; `nightly.yml` (live evals, encrypted `pg_dump` kept 7 days, its own heartbeat) | B | — | 08 p5–8, p10 | E-06, E-07, E-14 | Preview and production URLs load; a merge to `main` deploys through `release.yml` only | In progress: health checks, nightly cron and vercel.json done Oct 29; deploy and release workflows wait for Vercel (C-07) |
| W-03b | Observability: next-axiom logging; request-ID middleware returning `x-request-id`; redaction helper; `onRequestError`; client errors to `/api/v1/client-errors` (rate-limited); Web Vitals; `/api/health` and `/api/health/ready`; Better Stack 4 monitors and 2 heartbeats (daily cron and nightly backup); status page; Discord webhook alerts | C | — | 05 p3–8, 07 p11 | E-14 | Logs reach Axiom; one forced error and one forced downtime alert in Discord | In progress: logger with redaction, request IDs, health endpoints, Axiom shipping, Discord alerts (errors, breaker, budget), onRequestError and nightly heartbeat done Oct 29 (E-31 item 10); Better Stack monitors set up by the team; client errors and Web Vitals come with the frontend |
| W-03c | Security headers on every response: CSP (self, Supabase, Turnstile; Next.js nonces), HSTS, nosniff, Referrer-Policy, `frame-ancestors 'none'`, Permissions-Policy allowing mic and camera only on owner and review pages. CSRF: JSON-only, same-origin check | C | — | 03 p7 | — | Header test passes; DevTools check on all three surfaces | Not started |
| W-04 | Meta client `src/server/ai/meta.ts`: OpenAI SDK at `META_BASE_URL`; Responses, transcribe and SAM; timeouts 30 s (Spark) and 20 s (Transcribe, SAM); one retry with jitter on 429 and 5xx; circuit breaker in `ai_breaker`; one `ai_calls` row per call (outcomes `OK`, `SCHEMA_REJECTED`, `TIMEOUT`, `RATE_LIMITED`, `ERROR`); spend caps (global, per shop, $100 total, off at 95%); `META_MODE` `recorded`, `live` and `replay-demo`; `pnpm record:meta` | C | — | 02 p7–9, 05 p4–8, 07 p9–10, 04 p9–10 | E-03, E-06, E-10, E-13 | Unit tests pass with recorded responses; each failure in 07's contract maps to the right outcome | Complete in code Oct 29: Meta client with caps, breaker, retry, ai_calls ledger, recorded mode; 17 unit + 14 AI job tests (E-30, E-31) |
| W-06 | (Replaced by F-01, E-32) Design system: Signboard tokens, Baloo 2 and Mukta via `next/font`, shadcn theme, app shell with four tabs (Today, Stock, Orders, Reviews) and centre "Bolo" mic, Hindi/English dictionary, `lang` attributes, focus ring, dark-mode tokens | A | NFR | 06 p1–7, Key Screens | E-11, E-18, E-21 | Shell matches the mockups at 360 px; axe clean; no stray token values | Not started |
| W-05 | Day-1 spike S0 to S6 recorded | C | — | 09 p4–5 | — | All seven checks have a status and evidence in `spike/` | Not started |

---

## Phase 2: Thin slice

**Dates:** Oct 29–30 · **Workflow:** standard task workflow; 04 E2E-1; 06 Check and confirm pattern; 09 build order I2 (thin slice first)

| ID | Task | Owner | FR | Sources | Fixes | Done when | Status |
|---|---|---|---|---|---|---|---|
| W-07 | Google sign-in (OAuth PKCE, httpOnly cookies, `SameSite=Lax`) and "Try the demo shop" (anonymous sign-in to a fresh copy that expires after 24 h; 10 per IP per hour). Screen O-1. Google consent screen in production mode before real owners | B | FR-01 | 03 p5–6, 07 p11, 06 p3 | — | Sign-in works; demo copy isolated (pgTAP) and deleted after 24 h | In progress: demo sign-in done and tested Oct 29; Google sign-in written, waits for the OAuth client (C-10); sign-in screen waits for the frontend |
| W-08 | MicButton (all states, tap to start and stop, limits 2:00 / 0:30 / 0:15, ring, haptics, screen-reader labels); browser WAV encoder (16 kHz mono 16-bit); signed single-use upload URL (2 min, one path); IndexedDB offline queue with stable keys; server WAV header and magic-byte checks; size caps 4 MB / 1 MB / 3 MB | A (+B for upload endpoint) | FR-02 | 02 p5, 03 p7, 06 p4–5, 07 p12 | — | A 60 s clip uploads from a mid-range Android; encoder unit test checks the 44-byte header and rate; offline clip sends on reconnect | In progress: signed uploads and server WAV check done Oct 29; mic and encoder wait for the frontend |
| W-09 | Voice setup: `POST /api/v1/proposals/voice` (transcribe with product keywords and language bias, then extraction with nulls for anything unspoken); screens O-2 language, O-3 setup, O-4 Check and confirm (transcript on top, change cards, amber "Please check", confirm count); idempotent confirm | C, A | FR-02, FR-03 | 01 p6–9, 02 p6–10, 06 p5, Key Screens p1–2 | E-20 | From a 60 s clip naming 15 products, at least 14 are correct on review; unspoken hours, phone and address stay blank; setup eval recall ≥ 90%, precision ≥ 95%, invented values 0 | In progress: setup extraction API done and tested live Oct 29; screens wait for the frontend |
| W-10 | Public storefront `/s/[shopSlug]`: server-rendered and cached, revalidated by tag; reads `public_storefront`; out-of-stock items greyed but listed; OpenNowBadge from hours in the shop's time zone; address only; tick items and "Order on WhatsApp" (`wa.me` link with item list); call button; QR download; Open Graph image; 404 page without a shop-finder link; publish and unpublish endpoint | A | FR-04 | 02 p5, 06 p9–10, 07 p6, p11, Key Screens p5 | E-05, E-15, E-16 | LCP under 2.5 s on throttled 4G; JS under 100 KB; E2E-2 passes (prefilled WhatsApp link) | Not started |

**Gate G1, Oct 30 at 10 PM IST.** On staging, a new owner can sign in, speak, confirm and see a live storefront (E2E-1 passes with recorded AI and once with live AI).

---

## Phase 3: Core loop

**Dates:** Oct 31–Nov 1 · **Workflow:** standard task workflow; 04 AI evaluation (two-stage scoring) and forecast backtest; 03 tool permissions; 07 data lifecycle

| ID | Task | Owner | FR | Sources | Fixes | Done when | Status |
|---|---|---|---|---|---|---|---|
| W-11 | Voice catalog edits: tool calling with the six tools and 03's limits (max 50 products per proposal; price above 0 and under 10× the old one; counts 0–10,000); ask for clarification on ambiguous items; **undo**: `POST /api/v1/proposals/{id}/undo` within 60 s (UI shows 10 s), offsetting `CORRECTION` movements, restore `before` values, archive added products, status `UNDONE`, idempotent | C (+A for UI) | FR-05 | 01 p9, 02 p7, 03 p8, 06 p5 | E-02 | Command eval and ambiguous-command eval meet 04's thresholds; "Maggi ka price 15 kar do" changes only Maggi; undo restores price and stock; undo after 60 s returns 409 | In progress: command tools, confirm and undo API done and tested live Oct 29; UI waits for the frontend |
| W-12 | Voice sales and stock logging: `record_sale`, `record_delivery`, `set_stock`; the stock trigger keeps `stock_qty`; a negative result asks the owner to correct the count; tap-to-log with a client UUID idempotency key; nightly recompute check | B | FR-06 | 01 p9, 07 p5, p12 | — | Movements logged; `stock_qty` matches the trigger; a double tap logs once | In progress: voice and tap stock logging API done Oct 29; UI waits for the frontend |
| W-13 | Forecast and order list: exponential smoothing (0.3), festival and stock-out factors, safety stock, reorder point and quantity rounded to pack size, days left; cold start under 14 days uses the low-stock level (default 5); refresh after each sale and nightly via pg_cron (this task adds the pg_cron extension and schedule, E-29); `GET /api/v1/restock`; explanations cached per item per day with a template fallback; screen O-7 | B (+C for explanation eval) | FR-07 | 02 p11–12, 04 p6, 06 p8, Key Screens p4 | E-17 | Forecast unit tests pass on the 02 formula; backtest (`tests/forecast/backtest.test.ts`) meets 04's gates (≥ 80% of stock-outs warned 2 days ahead, ≥ 50% fewer stock-out days); explanation eval quotes numbers exactly | In progress: forecast, refresh and restock API done Oct 29; backtest passes all gates with alpha 0.2 (E-31); order list screen waits for the frontend |
| W-14 | Customer review page `/r/[shopSlug]` (P-2): consent notice then "I agree, record"; invisible Turnstile verified on the server; rate limits (3 per IP per shop per hour, 200 per shop per day); 15 s and 1 MB caps; client UUID per submit; analysis runs after the response; thank-you within 5 s | A (+B for endpoint) | FR-08 | 03 p1, p7–8, p11, 06 p10, Key Screens p6 | — | E2E-3 passes; Turnstile and rate-limit tests return 403 and 429 | In progress: public review API (Turnstile, limits, consent, WAV check) done Oct 29; review page waits for the frontend |
| W-15 | Review insight: analysis job with no tools, transcript passed as quoted data; sentiment, mentioned items, stock-out flags; flagged items get the 1.2 factor for 14 days and rise in the order list within 1 minute; nightly retry of `PENDING`; screen O-8 with hide and audio playback for 30 days | C | FR-09 | 02 p7–8, p12, 03 p8, 06 p4 | — | Review eval ≥ 85% with stock-out recall ≥ 90%; injection set of 20 gives 0 unexpected changes; E2E-3 rise check passes | In progress: review analysis and stock-out boost done and tested live Oct 29; reviews screen waits for the frontend |
| W-16 | Supplier bill photo: camera screen O-10 (file input with rear camera), resize to 1600 px JPEG, EXIF location stripped; `POST /api/v1/proposals/bill` returns delivery lines with matched product IDs or null | C (+A for camera) | FR-11 | 02 p5–8, 03 p7, 04 p5 | — | Bill eval ≥ 85% on printed bills; GPS fixture comes back without location; E2E-4 passes | In progress: bill reading API done and tested live on a printed bill Oct 29; camera screen waits for the frontend |
| W-17 | Delete my shop: settings O-9 with confirm; one server function deletes the shop row (cascades), storage folders, then the auth user; retries storage removal; done within 24 h | B | FR-16 | 03 p11, 07 p7 | — | E2E-5 passes (signed out; storefront 404); pgTAP: other shops untouched | Done Oct 30: DELETE /api/v1/shops/me removes files (retried once), the shop row and its cascade, then the account, and signs out; integration test checks another shop keeps its rows and files. Storefront 404 check waits for F-11 |
| W-17b | Daily cleanup job (Vercel cron with `CRON_SECRET`; pg_cron schedule for proposal expiry added here, E-29): owner voice notes after 7 days, review audio after 30 (sets `audio_deleted_at`), photos after 30, `reviews.ip_hash` cleared after 7, proposals expire after 24 h and are deleted after 90 days, `ai_calls` after 90, rate-limit counters after 2, demo copies after 24 h, unconfirmed uploads after 24 h; keep-alive; heartbeat ping | B | FR-16, P1 | 03 p11, 07 p7, 05 p7 | E-08, E-12, E-14 | Frozen-time tests show each item deleted on the right day | Not started |

**Gate G2, Nov 1 at 10 PM IST.** Every Must (FR-01 to FR-09, FR-11, FR-16) passes on staging against its tests in 04's traceability table. If not, Nov 2 goes to fixing Musts before any Should (09, I3).

---

## Phase 4: Shoulds and hardening

**Dates:** Nov 2–3 · **Workflow:** 04 release verification steps; 03 pre-production checklist; 06 design acceptance criteria; 05 alert tests; 08 restore drill

| ID | Task | Owner | FR | Sources | Fixes | Done when | Status |
|---|---|---|---|---|---|---|---|
| W-18 | Shelf photo with SAM 3.1 (only if G2 and S5 passed): masks, cut-outs as `.webp` in `catalog-images`, named by Muse Spark | C | FR-10 | 02 p7–8, 07 p7 | — | Cut-outs appear as storefront images; mask decoding tested on a recorded response | Not started |
| W-19 | Festival bump: seed `festival_calendar` with 2026–27 dates checked against a source (moved from W-02c, E-29), then apply the factor when a festival is within 7 days | B | FR-12 | 02 p12, 07 p5 | — | Forecast rises before a calendar festival in a unit test | Not started |
| W-20 | Today screen O-5 summary: sales total, items running low, new reviews; empty and error states | A | FR-13 | 06 p3, p8, Key Screens p3 | — | Today shows sales, low stock and new reviews | Not started |
| W-20b | Admin page `/admin` (allow-list in `ADMIN_EMAILS`): credit used against the $100 budget, AI success and p95 by job, confirm-unedited rate, product and review counts, demo sign-ins, breaker state with a manual OPEN switch | C | — | 05 p6, 06 p4, 08 p9 | E-06 | Non-team account gets 404; breaker switch pauses AI | Not started |
| W-21 | Seeded demo shop: `scripts/seed.ts` (fixed seed: 2 owners, 40 products, 90 days of sales, 10 reviews) and `scripts/demo-shop.ts` for production; nightly reset at 3 AM IST; demo order list numbers recomputed by the 02 formula; three sample clips (setup, command, review) with live responses recorded for replay | B (+C for replay recordings) | — | 04 p10, 08 p6, p11, Key Screens p4 | E-19, E-03 | Order list shows believable numbers that match the formula on camera; demo replay works with `META_CREDIT_ENDS_AT` set to the past | Not started |
| W-22 | Full evaluation and hardening: every 04 eval set at threshold (live); failure scenarios from 04 p9; Lighthouse CI (storefront score ≥ 90, LCP < 2.5 s; dashboard LCP < 3 s); k6 on the review endpoint (20 users, 2 min, p95 < 1 s, 429 at limits, no 5xx); axe zero serious issues; manual keyboard and screen-reader pass | C (+A for a11y) | — | 04 p4–9 | E-10 | Results recorded with one status each in 09 | Not started |
| W-22b | Security pre-production checklist from 03 p13, all with evidence: RLS on the production schema, Security Advisor clean, no service-role key in the bundle, headers, Turnstile, 429 thresholds, budget caps and alerts at $50 and $80, upload rejection, retention jobs, consent notice, delete-my-shop, backup and one restore | C | — | 03 p13 | E-06 | Every line PASS with evidence | Not started |
| W-22c | Restore drill on staging before the freeze: download and decrypt the latest artifact, `supabase db reset --linked`, load data, `supabase test db`, open the demo storefront; record the time taken | B | — | 08 p10, 03 p12 | — | Drill time recorded in 09 | Not started |
| W-22d | Design acceptance per screen (06 p11–12): tokens only, all states, 48 px controls, thumb-zone actions, no horizontal scroll at 320/360/768/1280, both languages fit, reduced motion, a teammate who didn't build it completes the task first time | A | — | 06 p11–12 | — | Checklist ticked for all 13 screens | Not started |
| W-23 | Real-owner sessions with 3 shop owners, Nov 2–3: signed consent, a timed first-voice-note-to-storefront run (target under 3 minutes), quotes for the video, feedback on setup and confirm screens | A | — | 01 p5, 04 p12, 06 p12, 09 I4 | — | Signed consent and recordings saved for each owner | Not started |
| D-08 | Video script and shot list, following 09's beats (Impact, Meta tooling, Technical depth, Demo); re-read the submission form on Nov 2 | A, Submitter | — | 09 p10–11 | — | Script and shot list ready by Nov 3 | Not started |

---

## Frontend build (from Oct 29, E-32)

**Why this section:** the backend for W-04 to W-16 is live at https://shelfvoice.vercel.app; these tasks build the screens on it. Apple-style look with accent `#0A66D8`, dark mode following the phone, and a live `/design` style guide instead of mockups (E-32). Screen tasks finish the UI half of the W tasks they name. Solo builder: every row is the owner's to approve.

**Review gate (R) after every F task, before it counts as done.** This is the "code review while connecting frontend and backend" step:

1. Code review of the diff: correctness, security (no service key or secrets in client code, `check:bundle` passes), accessibility, and reuse of the design-system components.
2. Contract check: the screen calls the real endpoint, handles every error code the route can return (400, 401, 403, 404, 409, 422, 429, 503) with the copy from doc 06, and shows loading, empty, error and offline states.
3. Tests: Playwright flow for the screen with axe clean, at 360 px in light and dark; unit tests for any client logic (WAV encoder, timers).
4. Live check: deployed to https://shelfvoice.vercel.app, the flow run once by hand with no console errors and no 5xx in Axiom.

| ID | Task | Owner | Finishes | Done when | Status |
|---|---|---|---|---|---|
| F-01 | Design system and `/design` style guide: colour tokens (light and dark), system font plus Noto Sans Devanagari, type scale 14–40, spacing 4–48, radii; components Button, IconButton, List group and row, Input, Search, Switch, Segmented control, Chip, Badge, Sheet, Dialog, Toast, Skeleton, Empty state; Lucide icons with labels; Hindi/English dictionary with `lang`; app shell with frosted tab bar (Today, Stock, Orders, Reviews) and centre mic | Owner | W-06 | Owner approves `/design` on their phone; axe clean; no horizontal scroll at 320–430 px | Built Oct 29: review gate passed (axe clean in both themes and languages, no sideways scroll at 320/360/430, 30 Playwright checks); waiting for the owner's approval on a phone |
| F-02 | Landing and sign-in O-1 (Continue with Google, Try the demo shop, language switch) and language choice O-2 | Owner | W-07 | Google and demo sign-in reach the app shell on the live site | Built Oct 29: sign-in O-1 and language choice O-2, route guards in the proxy, tab placeholders until F-05 to F-08; review gate: 52 Playwright checks (error codes 429/503/500/offline, signed-out redirect, demo and new-owner flows on local Supabase) |
| F-03 | MicButton (all states, tap to start and stop, 2:00 / 0:30 / 0:15 limits, ring, haptics, screen-reader labels), browser WAV encoder (16 kHz mono 16-bit), signed upload | Owner | W-08 | A recorded clip uploads and its WAV passes the server check | Built Oct 29: doc 06 mic states (72 px, ring fills toward the limit, live level bars, timer, sending and understanding), first-tap tip and mic reason, haptics, 16 kHz WAV encoder tested against the server's check, signed upload with retry and a 30 s timeout; live recorder on `/design`; review gate: 62 Playwright checks incl. upload to local Storage |
| F-03b | Offline: slim "Offline. Recordings will send when you're back online." bar, clips queued in the browser with a clock icon until sent (doc 06 p8) | Owner | W-08 | A clip recorded offline uploads when the phone reconnects | Not started |
| F-04 | Voice setup O-3, Check and confirm O-4 (what we heard, change cards with edit and remove, Confirm all), undo toast (10 s) | Owner | W-09, W-11 | Speak a shop setup, confirm, undo; products appear and disappear | Built Oct 29: O-3 setup (2 min, three prompts, skip), O-4 with transcript, plain-sentence cards, Please check unselected, edit sheet per change, remove, live count, Confirm and 10 s Undo; mic to Check and confirm with Understanding state and Try again; review gate: 74 Playwright checks (confirm and undo verified in the local database, voice errors, axe); journeys run with recorded AI so they never spend credit. Live speech-to-proposal not yet tried by the owner |
| F-05 | Today O-5: sales total, items running low, new reviews | Owner | W-20 | Demo shop shows real numbers | Built Oct 29: sales so far today vs the same time last week, running low (same rule as Orders, customer-flagged first), reviews this week, shop name opens My shop, setup invitation for an empty shop, error screen with Retry; review gate: integration tests (totals checked against the database, RLS), 8 Playwright journeys incl. Hindi, dark and 320 px |
| F-06 | Stock O-6: search, category chips, rows with price, stock and in/out switch; tap edits | Owner | W-12 | Stock edits by tap and by voice update the row | Built Oct 30: search by name or alias, category and Out of stock chips, rows grouped by category with price, unit, count or badge and an in/out switch, product sheet (name, price, unit, category, count stepper saved as a correction, warn level, remove = archive), add by tap; review gate: 13 Playwright journeys against the local database (tap edit, correction movement, price guard, add and remove, voice confirm reflected on the row, empty shop, axe light and dark) |
| F-07 | Orders O-7: rows sorted by days left, order quantity, reason line, review flag, model explanation | Owner | W-13 | Demo shop's atta shows the review flag and a quantity | Built Oct 30: reorder cards with days left as the biggest text, quantity, reason sentence (Muse Spark wording cached per day, template fallback with the same numbers), Customers asked flag, two-week cold-start note, Share the list as a message, Delivery arrived logs a DELIVERY; new products get a forecast row at once; review gate: integration tests and 8 Playwright journeys; full suite 104/104 |
| F-08 | Reviews O-8: sentiment, transcript, item chips, play audio, hide | Owner | W-15 | Demo reviews render; hide works | Built Oct 30: review cards with sentiment icon and word, time, summary, the customer's words, item chips (wanted and out of stock in red), play and pause while the audio exists, removed-after-30-days note, Hide and Show, All / Unhappy / Hidden filters, Show more; light secondary text darkened to #636368 for contrast margin; review gate: integration tests and 8 Playwright journeys incl. real audio playback |
| F-09 | My shop O-9: live preview, publish switch, QR download, share link, hours; delete shop with confirm (needs the W-17 endpoint) | Owner | W-17 | Publish and unpublish change the storefront; delete removes the shop | Built Oct 30: preview card with open-now badge, view and share links, publish switch, printable review QR (PNG card), details and hours editing (one opening per day in the editor), language, sign out, delete my shop; review gate: 12 Playwright journeys and integration tests. The View shop page link works once F-11 builds the storefront |
| F-10 | Camera O-10: bill photo (rear camera, resize to 1600 px JPEG, strip EXIF) into Check and confirm | Owner | W-16 | A printed bill photo becomes change cards | Not started |
| F-11 | Public storefront P-1 `/s/[slug]` and voice review page P-2 `/r/[slug]` with invisible Turnstile | Owner | W-10, W-14 | A phone with no account can browse and leave a review | Not started |
| F-12 | Admin A-1 `/admin` for `ADMIN_EMAILS`: credit used, AI success and p95, counts | Owner | W-20b | Shows today's numbers | Not started |
| F-13 | Browser error reports to `/api/v1/client-errors`, Web Vitals, security headers and CSP | Owner | W-03b, W-03c | Errors reach Axiom; securityheaders.com grade A | Not started |
| F-14 | Privacy page and README: data stored in Seoul, South Korea (E-28); what is recorded and for how long | Owner | E-28 | Linked from the storefront and the review page | Not started |
| R-final | Whole-app review before the freeze: full code review, all Playwright flows, Lighthouse, a 360 px pass in both themes, then the C-09 clips reminder | Owner | W-22, W-22d | No open high findings | Not started |

---

## Phase 5: Freeze, release and submit

**Dates:** Nov 4 · **Workflow:** 08 release checklist and freeze rules; 04 release verification; 09 submission checklist

| ID | Task | Owner | Sources | Done when | Status |
|---|---|---|---|---|---|
| W-24 | Freeze at 12:00 PM IST: only fixes, every production run needs manual approval. Release from 08's checklist (CI green; nightly evals at threshold; 03 checklist; migrations and types; env vars validated; Google consent in production; demo shop reset; real-phone check; alerts tested; credit recorded; backup in last 24 h; Lighthouse and k6; previous release SHA noted). Then 04 release verification steps 1–6, with E2E on production with live AI and one real Android phone | B | 08 p8–9, 04 p12 | Every checklist line is PASS or NOT APPLICABLE, recorded in 09 | Not started |
| W-25 | Demo video, 2 to 3 minutes, recorded from the exact release commit, starting 1 PM IST | A | 09 p10–11 | Uploaded and plays without sign-in | Not started |
| W-26 | Submit on the Cerebral Valley portal by **11:00 PM IST**: track per D-04, teammates listed, live link with working "Try the demo shop", public repo with README (problem, setup, architecture, Meta models, how numbers are computed), video, the three problem statements, nothing secret or private | Submitter | 09 p10 | Confirmation email received and saved in the vault | Not started |
| W-24b | Meta spend check: total from `ai_spend_daily` is under $100 | C | 01 p10, 09 p3 | Figure recorded in 09 | Not started |

---

## Phase 6: Judging week and after

**Dates:** Nov 5 7:30 AM IST to Nov 9 10:30 PM IST · **Workflow:** 05 on-call and alerting; 08 daily operations and rollback; 03 incident response

| ID | Task | Owner | Sources | Fixes | Done when | Status |
|---|---|---|---|---|---|---|
| J-01 | On-call rota: three 8-hour shifts covering 24 hours; acknowledge alerts within 15 minutes; handover note in Discord at each change | All | 05 p8, 08 p10 | — | Rota posted with names | Solo builder: Better Stack push alerts on the owner's phone replace the 3-person rota |
| J-02 | Morning check each day: overnight alerts, Better Stack monitors and both heartbeats, admin page (budget, success, p95), nightly evals, demo shop run in a private window, last night's backup | On-call | 08 p10 | E-14 | Logged in Discord daily | Not started |
| J-03 | Change policy: only security fixes, each approved by a second teammate, released through manual promotion with the previous SHA ready for instant rollback | All | 08 p9, p11 | E-07 | — | Not started |
| J-04 | Credit watch: compare credit left with `META_CREDIT_ENDS_AT`; when it ends, switch to demo replay and check it works; use the OpenRouter fallback only if D-01 approved a budget | C | 09 K4 | E-03 | Demo works after the credit ends | Not started |
| J-05 | If in the top 10: scripted 3-minute live run for Nov 8–9, backup recording, two charged phones signed in | A | 09 p11 | — | Rehearsed once | Not started |
| J-06 | After Nov 9: one call to decide keep, archive or delete stored customer audio early; rotate Meta and Supabase keys; note that commercial use needs Vercel Pro and Supabase Pro | All | 03 p9, 07 p13, 09 p11 | — | Decision written in 09 | Not started |

Rollback triggers the on-call person acts on without a vote: readiness failing, 5xx above 5% for 10 minutes, sign-in broken, or any cross-shop data leak (08 p10; incident steps in 03 p12).

---

## Errata coverage

Where each ERRATA.md fix is applied in this plan.

| Errata | Applied in |
|---|---|
| E-01 pnpm audit | W-01b |
| E-02 Undo design | W-02b (schema), W-11 (endpoint and tests) |
| E-03 Credit expiry and demo replay | D-01, S0, W-02b, W-04, W-21, J-04 |
| E-04 Track eligibility | D-01, D-04, W-26 |
| E-05 Public view includes out-of-stock | D-02, W-02c, W-10 |
| E-06 $100 budget and per-shop cap | D-01, W-03, W-04, W-20b, W-22b, W-24b |
| E-07 Production migrations on green merge | D-02, W-03, J-03 |
| E-08 IP hash cleared after 7 days | W-02b, W-17b |
| E-09 Migration PRs merge first | Standard workflow step 4 |
| E-10 AI outcome names | W-02b, W-04, W-22 |
| E-11 Baloo 2 and Mukta | W-06 |
| E-12 Owner voice notes kept 7 days | W-17b |
| E-13 Meta timeouts 30 s / 20 s | W-04 |
| E-14 Backup runs in GitHub Actions with its own heartbeat | W-03, W-03b, W-17b, J-02 |
| E-15 No distance on storefront | W-10 |
| E-16 No shop-finder link | W-10 |
| E-17 Forecast tests reference 02 and 04 | W-13 |
| E-18 360 px | W-06 |
| E-19 Order-list mockup numbers | W-21 |
| E-20 14 of 15 products | W-09 |
| E-21 Hindi or English interface | W-06 |
| E-22, E-23, E-24, E-26, E-27 Document wording | D-02 |
| E-25 Approve 09 | D-01 |

## Must requirement coverage

| Must | Task | Proven by (04) |
|---|---|---|
| FR-01 Sign-in and demo sign-in | W-07 | E2E-1; demo-copy RLS test |
| FR-02, FR-03 Voice setup and review | W-08, W-09 | E2E-1; setup extraction eval |
| FR-04 Storefront | W-10 | E2E-1, E2E-2; Lighthouse |
| FR-05 Voice catalog edits | W-11 | Command and ambiguous-command evals; undo tests |
| FR-06 Voice sales and stock | W-12 | Command eval; stock constraint test; E2E-4 |
| FR-07 Restock list | W-13 | Forecast backtest; explanation eval |
| FR-08 Customer voice review | W-14 | E2E-3; Turnstile and rate-limit tests; k6 |
| FR-09 Review insight | W-15 | Review analysis eval; injection eval; E2E-3 rise check |
| FR-11 Bill photo | W-16 | Bill eval; E2E-4 |
| FR-16 Delete shop | W-17, W-17b | E2E-5; delete-shop RLS test |

# Shelf Voice: cross-document errata and decision log

Started Oct 27, 2026, from a compatibility check of documents 01 to 09 and the Key Screens mockups.

Each entry is one conflict between documents. It lists every place that has to change and the recommended resolution. Page numbers are the "Page X of Y" footers in each PDF.

**How to use this log**

- **Status:** `Open` (not decided), `Decided` (resolution agreed, documents not yet updated) or `Applied` (documents updated; note the new version).
- **Owner decision:** `Yes` means the recommendation is a choice the owner has to make. `No` means it is a correction that follows from a decision already taken.
- Until a document is updated, **this log wins over the PDFs** for any entry marked `Decided`.
- New conflicts go at the bottom with the next E- number. Numbers are never reused.

**Severity**

- **High:** blocks CI, a Must requirement, the judged demo or eligibility.
- **Medium:** two documents would lead to different code, or a promise (privacy or budget) is broken.
- **Low:** wording, stale text or a mockup detail; nothing breaks, but someone could build the wrong thing.

## Index

| ID | Conflict | Severity | Owner decision | Status |
|---|---|---|---|---|
| [E-01](#e-01-ci-audit-step-uses-npm-in-a-pnpm-project) | CI audit step uses npm in a pnpm project | High | No | Open |
| [E-02](#e-02-undo-after-confirm-has-no-backend-design) | Undo after confirm has no backend design | High | No | Open |
| [E-03](#e-03-meta-credit-may-expire-before-judging-ends) | Meta credit may expire before judging ends | High | Yes | Open |
| [E-04](#e-04-indie-track-chosen-with-a-team-of-3) | Indie track chosen with a team of 3 | High | Yes | Open |
| [E-05](#e-05-public-view-described-as-in-stock-products-only) | Public view described as "in-stock products" only | Medium | No | Open |
| [E-06](#e-06-ai-spend-cap-is-150-target-is-under-100) | AI spend cap is $150; target is under $100 | Medium | Yes | Decided |
| [E-07](#e-07-when-production-migrations-run) | When production migrations run | Medium | No | Open |
| [E-08](#e-08-ip-hash-kept-longer-than-promised) | IP hash kept longer than promised | Medium | No | Open |
| [E-09](#e-09-preview-deploys-can-run-new-code-on-an-old-schema) | Preview deploys can run new code on an old schema | Medium | No | Open |
| [E-10](#e-10-ai-call-outcome-names-do-not-match) | AI call outcome names do not match | Medium | No | Open |
| [E-11](#e-11-devanagari-font) | Devanagari font | Low | No | Open |
| [E-12](#e-12-owner-voice-note-retention) | Owner voice note retention | Low | No | Open |
| [E-13](#e-13-meta-api-timeouts) | Meta API timeouts | Low | No | Open |
| [E-14](#e-14-what-triggers-the-nightly-backup) | What triggers the nightly backup | Low | No | Open |
| [E-15](#e-15-storefront-wireframe-shows-distance) | Storefront wireframe shows distance | Low | No | Open |
| [E-16](#e-16-404-page-links-to-a-shop-finder-that-does-not-exist) | 404 page links to a shop-finder that does not exist | Low | No | Open |
| [E-17](#e-17-forecast-task-points-to-the-wrong-document) | Forecast task points to the wrong document | Low | No | Open |
| [E-18](#e-18-mockup-width-390-px-vs-360-px) | Mockup width 390 px vs 360 px | Low | No | Open |
| [E-19](#e-19-order-list-mockup-breaks-the-reorder-rule) | Order-list mockup breaks the reorder rule | Low | No | Open |
| [E-20](#e-20-story-1-acceptance-is-below-the-90-target) | Story 1 acceptance is below the 90% target | Low | No | Open |
| [E-21](#e-21-hinglish-owner-interface) | Hinglish owner interface | Low | No | Open |
| [E-22](#e-22-prd-dependency-table-says-not-chosen) | PRD dependency table says "Not chosen" | Low | No | Open |
| [E-23](#e-23-prd-counts-ten-must-requirements) | PRD counts ten Must requirements | Low | No | Open |
| [E-24](#e-24-doc-02-still-mentions-phone-otp-follow-ups) | Doc 02 still mentions phone OTP follow-ups | Low | No | Open |
| [E-25](#e-25-doc-09-is-still-a-draft) | Doc 09 is still a draft | Low | Yes | Decided |
| [E-26](#e-26-uptime-objective-window) | Uptime objective window | Low | No | Open |
| [E-27](#e-27-k--ids-collide-between-07-and-09) | K- IDs collide between 07 and 09 | Low | No | Open |
| [E-28](#e-28-staging-database-is-in-seoul-not-mumbai) | Staging database is in Seoul, not Mumbai | Medium | Yes | Decided |
| [E-29](#e-29-schema-decisions-made-while-building-w-02) | Schema decisions made while building W-02 | Medium | No | Applied |
| [E-30](#e-30-meta-api-details-confirmed-by-the-spike) | Meta API details confirmed by the spike | Medium | No | Decided |
| [E-31](#e-31-decisions-made-while-building-the-backend) | Decisions made while building the backend | Medium | No | Applied |

---

## High

### E-01 CI audit step uses npm in a pnpm project

**Severity:** High · **Owner decision:** No · **Status:** Open

**Conflict.** 08 R1 picks pnpm, and 04 and 08 use `pnpm` commands throughout. But the dependency check is written as `npm audit` in 03, 04 and 08's `ci.yml`. `npm audit` needs a `package-lock.json`, so with only `pnpm-lock.yaml` it exits with an error, and the required security gate fails on every pull request.

**Resolution.** Use `pnpm audit --prod --audit-level high` everywhere `npm audit` appears. The rule stays the same: no high or critical issues in production dependencies. Dependabot already supports pnpm, so nothing else changes.

| Doc | Page | Section | Change |
|---|---|---|---|
| 03 | 1 | P5 decision | "Dependabot + npm audit + Semgrep" → "Dependabot + pnpm audit + Semgrep" |
| 03 | 10 | Secrets, encryption and supply chain | "npm audit (no high or critical…)" → "pnpm audit --prod (no high or critical…)" |
| 03 | 13 | Automated in CI | "npm audit, Semgrep, secret scan…" → "pnpm audit, Semgrep, secret scan…" |
| 04 | 11 | CI quality gates | "npm audit with no high or critical…" → "pnpm audit --prod with no high or critical…" |
| 08 | 7 | CI/CD, `ci.yml` steps | "npm audit, Semgrep…" → "pnpm audit --prod, Semgrep…" |

**Verify by.** On the W-01 CI skeleton, the audit step runs and passes against `pnpm-lock.yaml`.

---

### E-02 Undo after confirm has no backend design

**Severity:** High · **Owner decision:** No · **Status:** Open

**Conflict.** 01 story 2 (a Must) says a voice edit "shows a confirmation the owner can undo". 06 specifies a "N changes saved" toast with Undo for 10 seconds. But:

- 02 has no undo endpoint.
- In 07, owners can only insert stock movements, never update or delete them, and proposals can change status only while `PENDING`.
- `confirmed_changes` does not store the values from before the change, so there is nothing to restore.

As written, the Must cannot pass its acceptance check.

**Resolution.** Undo is a server action that writes compensating changes. Nothing is ever deleted.

1. Add `POST /api/v1/proposals/{id}/undo`. It is allowed only on a `CONFIRMED` proposal owned by the caller, within 60 s of `decided_at`. The UI shows 10 s; the extra server time covers slow networks. After that it returns `409`. It is idempotent: a second undo returns the stored result.
2. On confirm, `confirmed_changes` stores each change with both `before` and `after` values.
3. Undo runs in one transaction:
   - Each stock movement gets a `CORRECTION` movement with the opposite signed amount (`source = UNDO`).
   - Each price, name or stock-flag change is restored to its `before` value.
   - Each product added by the proposal is archived (`archived_at = now()`).
   - The proposal status becomes `UNDONE`.
4. If a product was edited again after the confirm, undo skips that card and reports it, the same "Please check" rule 07 already uses at confirm time.

| Doc | Page | Section | Change |
|---|---|---|---|
| 02 | 6–7 | Backend and API, endpoint table | Add `POST /proposals/{id}/undo`: "Reverse a confirmed proposal within 60 s; idempotent; Calls Meta? No" |
| 07 | 4 | `proposals` table | Status enum: add `UNDONE`. `confirmed_changes`: "each change with before and after values" |
| 07 | 4 | `stock_movements` table | `source` enum: add `UNDO` |
| 07 | 6 | RLS summary | No change: undo runs as a server function after its own ownership check |
| 07 | 12 | Idempotency table | Add row "Undo proposal: proposal ID; a second undo returns the stored result" |
| 04 | 8 | E2E-1 or E2E-4 | Add step "Undo within 10 s restores price and stock"; add API test "undo after 60 s returns 409; double undo is a no-op" |
| 09 | 6 | W-11 Voice catalog edits | Done when: add "Undo restores the previous state (01 story 2)" |

**Verify by.** API and E2E tests above pass, and stock after confirm then undo equals stock before.

---

### E-03 Meta credit may expire before judging ends

**Severity:** High · **Owner decision:** Yes · **Status:** Open

**Conflict.** 01 and 09 describe the $150 credit as "valid for the 10-day window". From Oct 26, that likely ends around Nov 5. But:

- 05 sets an AI success objective and on-call cover to Nov 9.
- 08 runs a judging-week routine to Nov 9 that assumes live AI.
- 09 risk K4 says "the demo shop replays saved AI results", but no document designs replay. `META_MODE=recorded` in 04 and 08 only matches identical requests in tests, so it cannot answer a judge's new recording.

**Decision (Oct 27, owner):** deferred until spike S0 records the credit's exact end date. Choose then between demo replay only and replay plus an OpenRouter fallback (same Meta models).

**Resolution (recommended, needs owner OK).**

1. **Record the end date on day 1 (spike S0)** in a new env var `META_CREDIT_ENDS_AT`.
2. **Demo-shop replay.** The demo shop's mic screen offers 3 sample clips: setup, a command and a review. At release, their live responses are recorded in production storage. When the credit has ended or calls return 401, 402 or 403, demo-shop requests for a sample clip are served from those recordings and logged in `ai_calls` with `outcome = REPLAYED`. Free-form recordings get the existing "Voice is resting" banner (06 p9). Every non-AI feature keeps working.
3. **Optional paid fallback.** The owner decides whether to fund an OpenRouter key (cap it, for example $20) so real owners keep live AI after the credit ends. 08 already documents the `META_BASE_URL` switch.

| Doc | Page | Section | Change |
|---|---|---|---|
| 02 | 8 | AI layer, Integration details | Add "Demo-shop replay mode" paragraph as above |
| 05 | 2 | Reliability objectives | AI call success: "measured until `META_CREDIT_ENDS_AT`; after that, replay success for demo clips" |
| 06 | 4–5 | Voice interaction design | Demo shop shows "Try a sample recording" chips beside the mic |
| 07 | 5 | `ai_calls.outcome` | Add `REPLAYED` |
| 08 | 6 | Environment variables | Add `META_CREDIT_ENDS_AT` (not secret; Vercel) and `META_MODE` value `replay-demo` |
| 08 | 10–11 | Judging-week routine | Add "If the credit has ended, check that demo replay works" |
| 09 | 4 | Spike S0 | "exact end date is recorded (K4)" → "…recorded in `META_CREDIT_ENDS_AT` (RK4, see E-27)" |
| 09 | 9 | Risk K4 mitigation | Point to the replay design in 02 instead of describing it |

**Verify by.** On staging, setting `META_CREDIT_ENDS_AT` to the past makes the demo shop's sample clips still produce proposals, and a live clip shows the banner.

---

### E-04 Indie track chosen with a team of 3

**Severity:** High · **Owner decision:** Yes · **Status:** Open

**Conflict.** 01 D1 lists the options as "Indie solo" and "Startup track (needs an existing team of 2–4)". The recorded choice is "Indie track, team of 3", and 09 plans to select Indie with all 3 teammates listed. If the official rules define Indie as solo, the submission is ineligible.

**Resolution.** On Oct 28, read the rules' track definitions together with the submission form (09 K9) and record the exact wording in 01 D1.

- **If Indie allows teams:** fix the option wording in 01. Nothing else changes.
- **If Indie is solo-only, the owner chooses:** either the Startup track (if the team qualifies), or one teammate submits as Indie and the others are credited as the rules allow.

| Doc | Page | Section | Change |
|---|---|---|---|
| 01 | 2 | D1 | Quote the rule text for team size. Correct "Indie solo" or change the choice |
| 09 | 10 | Submission checklist | "Indie track selected; all 3 teammates listed" → match the D1 outcome |
| 09 | 9 | Risk K9 | Add "track eligibility for a team of 3" to what is checked on Oct 28 |

**Verify by.** The rule text is quoted in 01 D1 with the date it was checked.

---

## Medium

### E-05 Public view described as "in-stock products" only

**Severity:** Medium · **Owner decision:** No · **Status:** Open

**Conflict.** 02 and 03 say public pages read "published shops and in-stock products". 06 (p10), 07 (`public_storefront`) and the Key Screens storefront keep out-of-stock items visible but greyed. If the view follows 02 and 03, out-of-stock items vanish and the "Out of stock" row in the mockup can never appear. 07 is the schema of record and is right.

**Resolution.** Reword 02 and 03 to match 07: published, non-archived products, with an in/out-of-stock flag and no counts.

| Doc | Page | Section | Change |
|---|---|---|---|
| 02 | 11 | Access rules | "a narrow view of published shops and in-stock products" → "the `public_storefront` view: published shops and their published, non-archived products, with an in-stock flag but no counts (doc 07)" |
| 03 | 6 | Authorization rules, Public visitor | "Published shops and their in-stock products, through a view" → "Published shops and their published products with an in/out-of-stock flag, through `public_storefront`" |

**Verify by.** The pgTAP test "Anonymous visitor reads the public storefront view" (04 p4) asserts that an out-of-stock product appears with `in_stock = false` and no `stock_qty`.

---

### E-06 AI spend cap is $150; target is under $100

**Severity:** Medium · **Owner decision:** Yes · **Status:** Decided

**Decision (Oct 27, owner):** $100 cap, as recommended: alerts at $50 and $80, AI off at $95, plus a per-shop daily cap.

**Conflict.** 01 and 09 require total Meta spend under $100 of the $150 credit. But:

- 08 sets `AI_TOTAL_BUDGET_USD=150`.
- 05 alerts at 50% and 80% and switches AI off at 95%, which is about $142.
- 03 sets alerts at 50% and 80% of $150.

Nothing enforces $100. Also, 03 calls for a per-shop daily cap and 08 says to "raise the per-shop daily cap", but 08 defines only one daily variable.

**Resolution.**

- Set the budget to the target: `AI_TOTAL_BUDGET_USD=100`, with alerts at 50% ($50) and 80% ($80) and switch-off at 95% ($95).
- Split the daily cap: `AI_DAILY_BUDGET_USD` (global, 15) and a new `AI_SHOP_DAILY_BUDGET_USD` (per shop, suggest 2).
- If the owner wants headroom for the live final, raise the total by a written decision here, not by editing env vars quietly.

| Doc | Page | Section | Change |
|---|---|---|---|
| 03 | 8 | Rate limits, "All AI calls" | "alerts at 50% and 80% of the $150 credit" → "of the $100 budget (`AI_TOTAL_BUDGET_USD`)" |
| 03 | 13 | Pre-production checklist | "50% / 80% credit alerts" → "50% / 80% budget alerts" |
| 05 | 5 | Credit budget | "against the $150 credit" → "against the $100 budget (`AI_TOTAL_BUDGET_USD`)" |
| 05 | 8 | Alerts table | "50% and 80% of $150 used" → "of the $100 budget"; "95% used" → "95% of budget used" |
| 08 | 6 | Environment variables | `AI_TOTAL_BUDGET_USD` example 150 → 100; add `AI_SHOP_DAILY_BUDGET_USD` (2) and state that `AI_DAILY_BUDGET_USD` is global |
| 08 | 9 | Release checklist | "alerts at 50% and 80% configured" → "of the $100 budget" |
| 08 | 11 | Judging week, Credit | "raise the per-shop daily cap" → "raise `AI_SHOP_DAILY_BUDGET_USD`" |
| 09 | 9 | Risk K3 | "alerts at 50% and 80% of the credit" → "of the $100 budget" |

**Verify by.** A test that seeds `ai_calls` to $95 makes AI features pause (04 p9 "Daily AI budget reached").

---

### E-07 When production migrations run

**Severity:** Medium · **Owner decision:** No · **Status:** Open

**Conflict.** 07 says production gets migrations "only after the release checklist". 08 R3 and `release.yml` migrate staging and then production automatically on every green merge to main. Manual approval starts only at the freeze.

**Resolution.** Follow 08, the operating document: automatic on green merge during build week, manual approval on the production environment from the freeze onward. Update 07.

| Doc | Page | Section | Change |
|---|---|---|---|
| 07 | 8 | Migration strategy, Order | "production gets the same migrations only after the release checklist (document 08)" → "production gets the same migrations through `release.yml` after staging succeeds; from the R4 freeze, each production run needs manual approval (document 08)" |

---

### E-08 IP hash kept longer than promised

**Severity:** Medium · **Owner decision:** No · **Status:** Open

**Conflict.** 03's data inventory promises that IP addresses and device hashes are "hashed with a rotating salt; 7 days". 07 stores `reviews.ip_hash` on the review row, and reviews are kept until the shop is deleted, so the hash outlives its promise.

**Resolution.** The daily cleanup job sets `reviews.ip_hash = null` once a review is 7 days old. Rate-limit counters already expire in 2 days. Drop "device hash" from 03 unless a column is added for it; 07 has none.

| Doc | Page | Section | Change |
|---|---|---|---|
| 07 | 4 | `reviews` table | `ip_hash text` → "`ip_hash text` or null; cleared after 7 days" |
| 07 | 7 | Data lifecycle | Add row "Review IP hash, `reviews.ip_hash`, Server, 7 days, Daily job sets null" |
| 03 | 11 | Data inventory | "IP address, device hash" → "IP address (hashed)" unless a device-hash column is added |
| 04 | 9 | Mocking rules / retention tests | Add "IP hash cleared after 7 days" to the frozen-time retention tests |

---

### E-09 Preview deploys can run new code on an old schema

**Severity:** Medium · **Owner decision:** No · **Status:** Open

**Conflict.** 08 says the release order means "a deploy can never run new code against an old schema". But preview deploys run against the staging database, and staging is migrated only after merge. A pull request that adds a migration and code using it produces a broken preview. 07 also says "preview branch runs against staging".

**Resolution.** Use expand-then-use. A migration ships in its own pull request and merges first, which migrates staging. The code that depends on it comes in a later pull request, so its preview sees the new schema. Migrations are already additive, so old code keeps working. Supabase branching would also solve this but needs the Pro plan.

| Doc | Page | Section | Change |
|---|---|---|---|
| 08 | 7 | CI/CD intro | "a deploy can never run new code against an old schema" → "a production deploy can never run new code against an old schema; previews stay safe because migrations merge in their own PR before the code that uses them" |
| 07 | 8 | Migration strategy, "Additive first" | Add "A migration merges in its own PR before any code that depends on it" |
| 09 | 8 | Definition of done, item 5 | Add "schema changes land in a separate, earlier PR" |

---

### E-10 AI call outcome names do not match

**Severity:** Medium · **Owner decision:** No · **Status:** Open

**Conflict.**

- 04's failure tests expect the `ai_calls` row "marked FAILED". 05 and 07 define `OK`, `SCHEMA_REJECTED`, `TIMEOUT`, `RATE_LIMITED` and `ERROR`, so those tests would assert a value that cannot exist.
- 07's failure contract maps a timeout to `ERROR`, while 05 has a separate `TIMEOUT`.

**Resolution.** Keep 05's enum. A timeout gives `TIMEOUT`, a 429 gives `RATE_LIMITED`, a 5xx gives `ERROR`, and invalid output gives `SCHEMA_REJECTED`. `REPLAYED` is added if E-03 is accepted.

| Doc | Page | Section | Change |
|---|---|---|---|
| 04 | 9 | Failure scenarios | "ai_calls row marked FAILED" → "ai_calls row outcome `TIMEOUT` (timeout) or `RATE_LIMITED` / `ERROR` (429 / 5xx)" |
| 07 | 10 | Failure contract | Split "5xx or timeout … then ERROR" into "Timeout: one retry, then `TIMEOUT`" and "5xx: one retry, then `ERROR`". Both count toward the breaker |

---

## Low

### E-11 Devanagari font

**Severity:** Low · **Owner decision:** No · **Status:** Open

**Conflict.** 02 says "Devanagari renders with Noto Sans Devanagari". 06 sets the type tokens to Baloo 2 (display) and Mukta (interface), which both cover Devanagari. Noto Sans Devanagari belongs to the rejected Clean utility option.

**Resolution.** 06 is the design source of truth. Load Baloo 2 and Mukta through `next/font`, and fall back to the system font.

| Doc | Page | Section | Change |
|---|---|---|---|
| 02 | 5 | State and data | "Devanagari renders with Noto Sans Devanagari" → "Devanagari and Latin render with Baloo 2 (display) and Mukta (interface), per doc 06 tokens" |

---

### E-12 Owner voice note retention

**Severity:** Low · **Owner decision:** No · **Status:** Open

**Conflict.** 02 says "Clips older than 30 days are deleted" for the voice bucket. 03 and 07 delete owner voice notes after 7 days and customer review audio after 30.

**Resolution.** Follow 03 and 07.

| Doc | Page | Section | Change |
|---|---|---|---|
| 02 | 11 | Storage buckets | "Clips older than 30 days are deleted" → "Owner voice notes are deleted after 7 days, customer review audio and photos after 30 days (lifecycle in doc 07)" |

---

### E-13 Meta API timeouts

**Severity:** Low · **Owner decision:** No · **Status:** Open

**Conflict.** 02 says "Timeouts of 30 s per call". 05 and 07 use 30 s for Muse Spark and 20 s for Voice Transcribe and SAM 3.1.

**Resolution.** Follow 05 and 07.

| Doc | Page | Section | Change |
|---|---|---|---|
| 02 | 9 | Integration details | "Timeouts of 30 s per call" → "Timeouts of 30 s for Muse Spark and 20 s for Voice Transcribe and SAM 3.1" |

---

### E-14 What triggers the nightly backup

**Severity:** Low · **Owner decision:** No · **Status:** Open

**Conflict.** 07 lists "backup trigger" under Vercel cron, and 05 lists one daily-cron heartbeat for "keep-alive, cleanup, backup". 03 and 08 run the backup as `pg_dump` in GitHub Actions `nightly.yml`, which a Vercel function cannot do.

**Resolution.** The backup runs only in `nightly.yml`. It pings its own Better Stack heartbeat, separate from the Vercel cron heartbeat, so a missed backup alerts on its own.

| Doc | Page | Section | Change |
|---|---|---|---|
| 07 | 11 | Other integrations, Vercel cron row | "Daily cleanup, keep-alive, backup trigger" → "Daily cleanup and keep-alive"; add a GitHub Actions `nightly.yml` row: "Backup and live evals; heartbeat ping" |
| 05 | 7 | Health checks table | Split "Daily cron (keep-alive, cleanup, backup)" into "Daily Vercel cron (keep-alive, cleanup)" and "Nightly backup (GitHub Actions)", each with its own heartbeat |
| 05 | 9 | Monitoring cost controls | Better Stack "4 monitors + 1 heartbeat" → "4 monitors + 2 heartbeats" |
| 08 | 6 | Environment variables | `BETTERSTACK_HEARTBEAT_URL` → add `BETTERSTACK_BACKUP_HEARTBEAT_URL` (GitHub Actions secret) |

---

### E-15 Storefront wireframe shows distance

**Severity:** Low · **Owner decision:** No · **Status:** Open

**Conflict.** 06's storefront wireframe shows "Shastri Nagar - 1.2 km". Distance needs the customer's location, which 03 says is never collected. The Key Screens storefront shows only the address.

**Resolution.** Show the address only, as the mockup does.

| Doc | Page | Section | Change |
|---|---|---|---|
| 06 | 10 | Storefront layout at 360 px | "Shastri Nagar - 1.2 km" → "Shastri Nagar" |

---

### E-16 404 page links to a shop-finder that does not exist

**Severity:** Low · **Owner decision:** No · **Status:** Open

**Conflict.** 06's storefront error state is a "404 page with shop-finder link if unpublished". 01 lists neighbourhood discovery as a future opportunity with "none are built now".

**Resolution.** The 404 page says the shop isn't online right now and offers no link (or links to the Shelf Voice home page).

| Doc | Page | Section | Change |
|---|---|---|---|
| 06 | 9 | Interaction states, Storefront error | "404 page with shop-finder link if unpublished" → "404 page: 'This shop isn't online right now', no shop-finder (post-hackathon)" |

---

### E-17 Forecast task points to the wrong document

**Severity:** Low · **Owner decision:** No · **Status:** Open

**Conflict.** 09 W-13's done check is "Forecast unit tests PASS on the document 07 cases". The forecast formula is in 02 and its backtest gates are in 04; 07 has no forecast cases.

| Doc | Page | Section | Change |
|---|---|---|---|
| 09 | 7 | W-13 Forecast and order list | Done when → "Forecast unit tests PASS on the doc 02 formula; backtest gates in doc 04 met" |

---

### E-18 Mockup width 390 px vs 360 px

**Severity:** Low · **Owner decision:** No · **Status:** Open

**Conflict.** 09 W-06's done check is "Shell matches the mockups at 390 px". 01, 04 and 06 design and test at 360 px.

| Doc | Page | Section | Change |
|---|---|---|---|
| 09 | 6 | W-06 Design tokens and app shell | "at 390 px" → "at 360 px" |

---

### E-19 Order-list mockup breaks the reorder rule

**Severity:** Low · **Owner decision:** No · **Status:** Open

**Conflict.** 01 story 4 says suggested quantities match the 02 formula exactly. In Key Screens p4, Surf Excel shows 1 sold a day, 5 left and an order of 6, with lead time 2 and review period 7:

- Order = 1 × (2 + 7) + safety stock − 5 = 6, so safety stock is 2.
- Reorder point = 1 × 2 + 2 = 4.
- Stock (5) is above the reorder point, so the item should not be on the list.

The subtitle "From your last 30 days of sales" also describes a moving average. 02 uses exponential smoothing over the full history.

**Resolution.**

- Change the Surf Excel row to 3 left: 3 days left, order 8 packs. With safety stock 2, the reorder point is 4, which is at least 3, and the order is 1 × 9 + 2 − 3 = 8.
- Change the subtitle to "From your sales and customer reviews. Supplier takes 2 days."
- W-21's seeded demo shop must reproduce whatever numbers appear on camera.

| Doc | Page | Section | Change |
|---|---|---|---|
| Key Screens | 4 | Order list | Surf Excel: "5 days left · Order 6 packs · Sells about 1 a day; 5 left" → "3 days left · Order 8 packs · Sells about 1 a day; 3 left"; subtitle as above |
| 09 | 7 | W-21 Seeded demo shop | Done when: add "order-list numbers recomputed by the doc 02 formula match the screen" |

---

### E-20 Story 1 acceptance is below the 90% target

**Severity:** Low · **Owner decision:** No · **Status:** Open

**Conflict.** 01 story 1 accepts "at least 13" of 15 products (87%). The 01 success metric and the 04 extraction threshold are 90%.

| Doc | Page | Section | Change |
|---|---|---|---|
| 01 | 9 | Story 1 | "at least 13 appear correctly" → "at least 14 appear correctly" (93%, at or above the 90% target) |

---

### E-21 Hinglish owner interface

**Severity:** Low · **Owner decision:** No · **Status:** Open

**Conflict.** 01's non-functional requirements say "Owner interface and AI replies in Hindi, English or Hinglish". 06 U2 offers a Hindi or English interface, and 07 limits `shops.language` to `hi` and `en`. Hinglish exists only in AI replies and explanations.

**Resolution.** The interface is Hindi or English; AI replies may be Hinglish.

| Doc | Page | Section | Change |
|---|---|---|---|
| 01 | 10 | Non-functional requirements, Language | → "Owner interface in Hindi or English (doc 06 U2); AI replies and restock explanations in Hindi, English or Hinglish; speech in any mix" |

---

### E-22 PRD dependency table says "Not chosen"

**Severity:** Low · **Owner decision:** No · **Status:** Open

| Doc | Page | Section | Change |
|---|---|---|---|
| 01 | 12 | Dependencies | "Database, auth, hosting — Chosen in document 02 — Not chosen" → "Supabase (T1), Supabase Auth (T4), Vercel (T3) — Chosen Oct 27" |

---

### E-23 PRD counts ten Must requirements

**Severity:** Low · **Owner decision:** No · **Status:** Open

**Conflict.** FR-16 (Must) was added on Oct 27, which makes eleven: FR-01 to FR-09, FR-11 and FR-16. 09 already lists all eleven.

| Doc | Page | Section | Change |
|---|---|---|---|
| 01 | 7 | Functional requirements intro | "Ten Must requirements" → "Eleven Must requirements" |
| 01 | 11 | MVP scope, In scope | "FR-01 to FR-09, plus FR-11 (bill photo)" → "FR-01 to FR-09, FR-11 (bill photo) and FR-16 (delete shop)" |

---

### E-24 Doc 02 still mentions phone OTP follow-ups

**Severity:** Low · **Owner decision:** No · **Status:** Open

| Doc | Page | Section | Change |
|---|---|---|---|
| 02 | 2 | T4 owner's choice | "(PRD FR-01 to be updated)" → "(PRD FR-01 updated Oct 27)" |
| 02 | 7 | Contract rules | "The Meta API key, Supabase service key and any SMS keys" → "The Meta API key, Supabase service-role key and Turnstile secret" |

---

### E-25 Doc 09 is still a draft

**Severity:** Low · **Owner decision:** Yes · **Status:** Decided

**Decision (Oct 27, owner):** approve 09 as v1.0 with the errata fixes applied through this log and ACTION_PLAN.md.

**Conflict.** 09 is "Draft v0.2 … waiting for the owner's approval", while 04 and 08 depend on it to record release results, and documents 01 to 08 are v1.0 approved.

**Resolution.** Apply E-03, E-04, E-17, E-18, E-19 and E-27 to 09, then have the owner approve it as v1.0.

| Doc | Page | Section | Change |
|---|---|---|---|
| 09 | 1 | Status line | "Draft v0.2 … waiting for the owner's approval" → "Version 1.0, approved by the owner on <date>" |

---

### E-26 Uptime objective window

**Severity:** Low · **Owner decision:** No · **Status:** Open

**Conflict.** 05's objective column is headed "Nov 1 to 9", but the text and the downtime maths ("about 36 minutes … over 5 days") cover judging week, Nov 5 to 9.

| Doc | Page | Section | Change |
|---|---|---|---|
| 05 | 2 | Reliability objectives, column header | "Objective (Nov 1 to 9)" → "Objective (Nov 5 to 9)" |

---

### E-27 K- IDs collide between 07 and 09

**Severity:** Low · **Owner decision:** No · **Status:** Open

**Conflict.** 07 uses K1 to K6 for data-model decisions; 09 uses K1 to K11 for risks. 09's spike S0 cites "(K4)", which in 07 means product names.

**Resolution.** Rename 09's risks RK1 to RK11. 09 is still a draft, so this is the cheaper change.

| Doc | Page | Section | Change |
|---|---|---|---|
| 09 | 9 | Risks and blockers | K1 to K11 → RK1 to RK11 |
| 09 | 4 | Spike S0 | "(K4)" → "(RK4)" |
| 09 | 11 | Judging week and after | "(K4)" → "(RK4)" |

---

## Found during the build

### E-28 Staging database is in Seoul, not Mumbai

**Severity:** Medium · **Owner decision:** Yes · **Status:** Decided

**Conflict.** 02 (T1, T3) and 08 (provisioning step 1) put both Supabase projects in ap-south-1 (Mumbai), next to the Vercel functions in bom1. The staging project `shelfvoice-staging` (ref `idrhitepkksjgwqauael`, created Oct 28) was created in **ap-northeast-2 (Seoul)**; a project's region cannot be changed afterwards. An earlier attempt landed in eu-west-1 (Ireland) and was deleted.

**Decision (Oct 28, owner):** keep Seoul for staging. This is acceptable because staging holds only test and seed data, never real shop owners' data, so doc 03's data-location promise is not affected.

**Conditions.**

1. **Production must be in ap-south-1.** When creating it, pick the specific region "South Asia (Mumbai)" rather than a broad area, and check the summary says `ap-south-1` before clicking Create.
2. **Spike S6 is measured against production**, not staging, since Vercel bom1 to Seoul adds roughly 100 ms per query.
3. Preview deploys (bom1 functions, Seoul database) will be slower than production. Performance targets (Lighthouse, k6, voice-to-proposal p95) are checked on production or with functions in the database's region, not on previews.

| Doc | Page | Section | Change |
|---|---|---|---|
| 02 | 14 | Environments table, Preview row | Add "staging database in ap-northeast-2 (Seoul); see E-28" |
| 08 | 2 | Environments table, Preview row | "Staging Supabase project (Mumbai)" → "Staging Supabase project (Seoul, ap-northeast-2; see E-28)" |
| 08 | 6 | One-time provisioning, step 1 | Add "Staging is in ap-northeast-2 (E-28); production must be ap-south-1, chosen explicitly" |
| 09 | 5 | Spike S6 | "Vercel bom1 to Supabase ap-south-1" → "…to the production project in ap-south-1" |

---

### E-29 Schema decisions made while building W-02

**Severity:** Medium · **Owner decision:** No · **Status:** Applied (migrations `20261028120000` to `20261028120600`, on staging Oct 28)

Building the schema exposed places where the documents can't all hold at once, or leave a detail open. Each choice below follows the documents' intent and is covered by a pgTAP test.

1. **Public reads use the base tables, limited by column grants.** 03 asks for views with `security_invoker = true`; 02 says public pages never read base tables; 04 expects anonymous reads of base tables to return 0 rows. A `security_invoker` view runs with the reader's own rights, so anon must be able to read the published rows underneath it. A security-definer view would avoid that, but the Security Advisor flags it as an error, which 03's release checklist forbids. **Resolution:** anon gets a policy for published rows plus column grants for safe columns only (no `owner_id`, no `stock_qty`, no lead times). Anon sees exactly what `public_storefront` shows, and reading a hidden column fails with a permission error. Signed-in users don't get the public policy, because column grants can't vary per row.
2. **Anonymous demo users can't create shops.** Supabase's advisor warns (lint 0012) on every policy that anonymous sign-ins can reach. These warnings are expected, because "Try the demo shop" users must work inside their own demo copy (03). Migration `…600` closes the one real gap: anonymous sessions can no longer create shops; only the server makes demo copies.
3. **Owners can't delete their shop row directly.** FR-16's delete goes through a server function that also removes storage and the auth user (07). A direct delete would leave files behind, so owners get no delete policy on `shops`.
4. **Owners only read `product_forecasts`.** 07's RLS summary lists it as "read and write own". Forecasts are computed by code (02, ADR-002), so writes come only from the server.
5. **Owners change proposals only while pending, and only `status`, `confirmed_changes` and `decided_at`** (column grants). Undo (E-02) runs as a server function.
6. **Explicit grants.** Every table revokes Supabase's default grants to `anon` and `authenticated` and grants only what each role needs.
7. **Deferred, not dropped:**
   - The festival seed rows (07 migration 5) move to W-19, after each 2026–27 date is checked against a source.
   - The pg_cron schedules (07 migration 7) move to W-13 and W-17b, which create the functions they call.
8. **Test helpers.** 04 names the Basejump helpers. The tests set the session role and JWT claims directly instead, which needs no extra extension in production.
9. **`shops.description`** (500 characters) is added: 03 sets its length limit, but 07's column list omits it.
10. **Local password trap.** The Supabase CLI reads `SUPABASE_DB_PASSWORD` from `.env.local` automatically and then uses it for the local database as well. The staging password is stored as `STAGING_DB_PASSWORD` and passed explicitly only when pushing to staging (see `.env.example`).

| Doc | Page | Section | Change |
|---|---|---|---|
| 02 | 11 | Access rules | "never the base tables" → "anon reads published rows through RLS and safe-column grants (E-29)" |
| 03 | 6 | RLS conventions, public reads | Add the column-grant approach (E-29 item 1) |
| 04 | 4 | Database tests, "Anonymous visitor reads base tables" | "0 rows" → "only published rows; hidden columns fail with a permission error" |
| 07 | 3–4 | `shops` columns | Add `description text` (max 500) |
| 07 | 6 | RLS summary | `shops`: no owner delete; `product_forecasts`: owner read only |
| 07 | 8 | Planned first migrations, items 5 and 7 | Festival seed moves to W-19; pg_cron schedules move to W-13 and W-17b |

---

### E-30 Meta API details confirmed by the spike

**Severity:** Medium · **Owner decision:** No · **Status:** Decided (from spike S1 to S3, Oct 29; evidence in `spike/`)

**Conflict.** 07 lists the transcription request as "Mono 16-bit PCM WAV at 16 or 24 kHz; mode PUSH_TO_TALK; keywords; languageBias" and leaves "the exact multipart field names and response shape" to day 1. 02 says to set "low reasoning" but doesn't say Muse Spark defaults to high.

**What the API actually does.**

1. **Transcription** takes two multipart parts: `request` (JSON) and `audio` (the WAV). `audioEncoding` is required inside `request`, with value `"WAV"`. The response is `{ sessionId, transcript, audioDurationMs, turns }`.
2. The API **ignores unknown fields silently**. Only `mode` is validated. Whether `keywords` and `languageBias` take effect must be measured in S4 with real speech, comparing results with and without keywords.
3. **Muse Spark reasoning defaults to `high`.** Every job must set `reasoning.effort` explicitly ("low" for extraction), or responses can stop as `incomplete` while the model is still reasoning.
4. The raw Responses API body has **no `output_text` field**. The client module reads the `message` item's `output_text` part.
5. **`tool_choice` accepts only `"auto"`** (found Oct 29 while building W-11): `"required"` and named tools return 400. The model may answer a command in words instead of calling `ask_clarification`; that reply is shown to the owner as the clarifying question.

| Doc | Page | Section | Change |
|---|---|---|---|
| 07 | 9 | Meta Model API integration, transcription row | Request: multipart `request` (JSON with `model`, `audioEncoding: "WAV"`, `mode`, `keywords`, `languageBias`) and `audio`. Response: `{ sessionId, transcript, audioDurationMs, turns }` |
| 07 | 10 | "Still to confirm on day 1" | Field names and response shape confirmed (spike S3); keyword effect confirmed in S4 |
| 02 | 8 | Integration details | Add "set `reasoning.effort` on every call; the default is high" |

---

### E-31 Decisions made while building the backend

**Severity:** Medium · **Owner decision:** No · **Status:** Applied (Oct 29)

Building W-03, W-04, W-07 to W-15 surfaced these choices. Each follows the documents' intent and is covered by a test.

1. **Forecast smoothing factor is 0.2, not 0.3.** Doc 02 starts at 0.3 and says the factors are "tuned in the backtest defined in document 04". At 0.3 the policy held 11.3% more stock than a 4-week moving average (gate: at most 10%). At 0.2 it passes every gate on four seeds:

   | Seed | Warned 2+ days ahead (≥80%) | Fewer stock-out days than "reorder when empty" (≥50%) | Stock vs moving average (≤110%) |
   |---|---|---|---|
   | 404 | 86.0% | 78.8% | 107.2% |
   | 1 | 82.0% | 77.2% | 104.1% |
   | 77 | 82.8% | 78.9% | 106.0% |
   | 2026 | 83.5% | 79.9% | 105.8% |

   z stays 1.28 (90% service level).
2. **The Meta client uses `fetch`, not the OpenAI SDK.** Doc 02 suggests wrapping the OpenAI SDK, but the spike (E-30) showed transcription and response shapes that SDK doesn't model. One small module (`src/server/ai/meta.ts`) does timeouts, one retry, the breaker, budget caps and `ai_calls` logging.
3. **The forecast runs in TypeScript** and is refreshed after each sale, confirm or undo, and by the nightly Vercel cron (`/api/cron/nightly`, 02:00 IST). pg_cron isn't needed for it, so W-13 no longer adds pg_cron.
4. **Customer reviews upload through the server** as one multipart request. A 15-second review is under 1 MB, well inside Vercel's 4.5 MB body limit; owner clips and photos still use signed upload URLs (doc 02).
5. **Turnstile is checked before the review rate limits**, so bots without a token can't use up a shop's 200-per-day quota.
6. **The circuit breaker opens after 5 consecutive failures** rather than "5 in 2 minutes", because `ai_breaker` has no per-failure timestamps. Recovery is as doc 05 says: one probe after 60 s.
7. **Liveness (`/api/health`) runs on every request** instead of being prerendered, so the uptime monitor really checks the running app.
8. **The demo shop template lives in code** (`src/server/demo/template.ts`): 15 products, 90 days of seeded history and two analysed reviews. W-21 builds on it.
9. **Readiness times the faster of two database reads** against the 500 ms limit, and reports it as `databaseMs`. From Vercel `bom1` to Seoul staging (E-28), a read takes about 190 ms, but 3 of 10 single reads spiked to 530–770 ms, which would page on a healthy database.

| Doc | Page | Section | Change |
|---|---|---|---|
| 02 | 11–12 | Restock forecasting method | Smoothing factor 0.2 (tuned, see table) |
| 02 | 8 | Integration details | One `fetch`-based module instead of the OpenAI SDK |
| 02 | 12 | Background jobs | Forecast refresh: TypeScript after each sale and nightly Vercel cron; no pg_cron |
| 02 | 6 | Endpoints, public review | Multipart upload through the server for reviews |
| 05 | 7 | Reliability patterns | Breaker opens after 5 consecutive failures |
| 05 | — | Health checks | Readiness: Postgres check uses the faster of two reads under 500 ms |

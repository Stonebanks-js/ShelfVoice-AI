# Shelf Voice

A voice-first assistant for kirana shop owners: speak your shop online, know what to restock, and hear every customer, without typing. Built for the Meta Global AI Developer Hackathon (Oct 26 to Nov 4, 2026).

Every AI feature runs on Meta models through the Meta Model API: Muse Spark 1.3 for extraction, tool calls, vision and explanations; Muse Voice Transcribe 1.0 for speech; SAM 3.1 for product cut-outs. Stock counts, prices and reorder quantities are computed in code, never by a model.

## Documents

| Doc | Topic |
|---|---|
| 01 | Product requirements |
| 02 | Technical requirements and architecture |
| 03 | Security and privacy |
| 04 | Testing and verification |
| 05 | Observability and reliability |
| 06 | UI/UX and design (plus the Key Screens mockups) |
| 07 | Data model and integrations |
| 08 | Deployment and operations runbook |
| 09 | Implementation and release plan |

[ERRATA.md](ERRATA.md) records conflicts between the documents and how each is resolved; it overrides the PDFs where they disagree. [ACTION_PLAN.md](ACTION_PLAN.md) is the phase-by-phase task list.

## Local setup

Requirements: Node 24 (pinned in `.nvmrc`; `fnm use` picks it up), pnpm, Docker Desktop running, Git.

```bash
pnpm install
cp .env.example .env.local
pnpm exec supabase start
pnpm dev
```

`supabase start` prints the local API URL and keys; copy them into `.env.local`. The app checks every variable at startup and names any that are missing. The app runs at http://localhost:3000.

## Commands

| Command | Does |
|---|---|
| `pnpm dev` | Run the app locally |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generate route types, then strict TypeScript check |
| `pnpm db:types` | Regenerate `src/types/database.ts` from the local database |

Local AI calls use recorded responses by default (`META_MODE=recorded`). Set `META_MODE=live` and `META_API_KEY` in `.env.local` to call the real API.

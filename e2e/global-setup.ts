import { execSync } from "node:child_process";

import { localSupabase } from "./support";

// Every journey makes a demo shop (about 1,400 rows). On the local stack they
// pile up across runs and slow everything down, so each run starts by
// clearing shops and accounts older than ten minutes. Local only: the check
// in support.ts refuses anything that isn't 127.0.0.1, and CI has no stack.
export default function globalSetup() {
  if (!localSupabase) return;
  execSync(
    // One statement: the CLI runs a single command per call.
    `pnpm exec supabase db query "with old_shops as (delete from public.shops where created_at < now() - interval '10 minutes') delete from auth.users where created_at < now() - interval '10 minutes'"`,
    { stdio: "ignore", timeout: 300_000 },
  );
}

import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { env } from "@/env/server";
import type { Database } from "@/types/database";

export type Db = SupabaseClient<Database>;

// The signed-in owner's client: every query runs under their RLS policies.
// Create one per request, never share it.
export async function ownerClient(): Promise<Db> {
  const cookieStore = await cookies();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
      },
    },
  });
}

// Bypasses RLS. Only for work doc 03 assigns to the server: public review
// inserts, background jobs, demo copies, rate limits, AI call logging, undo.
let admin: Db | undefined;
export function adminClient(): Db {
  admin ??= createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

// Integration test helpers: real local Supabase (doc 04: Supabase is never
// mocked), test owners signed in with their own RLS-bound clients.
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import type { Shop } from "@/server/owner";
import type { Db } from "@/server/supabase";
import type { Database } from "@/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const admin = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export async function testOwner(withShop = true) {
  const email = `owner-${randomUUID()}@test.local`;
  const password = `pw-${randomUUID()}`;
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const db = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } }) as Db;
  const { error: signInError } = await db.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  let shop: Shop | null = null;
  if (withShop) {
    const { data, error: shopError } = await db
      .from("shops")
      .insert({ owner_id: created.user.id, name: "Test Kirana", slug: `test-${randomUUID().slice(0, 8)}`, is_published: true })
      .select("*")
      .single();
    if (shopError) throw shopError;
    shop = data;
  }
  return { db, user: created.user, shop: shop!, requestId: `req-${randomUUID().slice(0, 8)}` };
}

export function toneWav(seconds = 2, rate = 16000): Uint8Array {
  const n = seconds * rate;
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000), 44 + i * 2);
  return new Uint8Array(b);
}

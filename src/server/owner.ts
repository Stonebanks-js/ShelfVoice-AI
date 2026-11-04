import "server-only";

import type { User } from "@supabase/supabase-js";
import { connection } from "next/server";

import type { Database } from "@/types/database";

import { ApiError } from "./http";
import { ownerClient, type Db } from "./supabase";

export type Shop = Database["public"]["Tables"]["shops"]["Row"];

export interface Owner {
  db: Db;
  user: User;
}

// The signed-in owner (Google sign-in), with a client
// that runs under their RLS policies.
export async function requireOwner(): Promise<Owner> {
  const db = await ownerClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in");
  return { db, user: data.user };
}

// Whoever is signed in, or null: for pages and routes anyone may use, which
// do a little more for a signed-in customer. Per request: the Supabase
// client reads the clock as it starts, which Next would otherwise flag while
// prerendering a page shell (as in ownerState).
export async function currentUser(): Promise<Owner | null> {
  await connection();
  const db = await ownerClient();
  const { data } = await db.auth.getUser();
  return data.user ? { db, user: data.user } : null;
}

// One owner account owns one shop; RLS returns only theirs.
export async function requireShop(): Promise<Owner & { shop: Shop }> {
  const owner = await requireOwner();
  const { data: shop, error } = await owner.db.from("shops").select("*").maybeSingle();
  if (error) throw new ApiError(500, "DATABASE", "Something went wrong");
  if (!shop) throw new ApiError(404, "NO_SHOP", "Set up your shop first");
  return { ...owner, shop };
}

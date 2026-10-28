import "server-only";

import type { User } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { ApiError } from "./http";
import { ownerClient, type Db } from "./supabase";

export type Shop = Database["public"]["Tables"]["shops"]["Row"];

export interface Owner {
  db: Db;
  user: User;
}

// The signed-in owner (Google or anonymous demo sign-in), with a client
// that runs under their RLS policies.
export async function requireOwner(): Promise<Owner> {
  const db = await ownerClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in");
  return { db, user: data.user };
}

// One owner account owns one shop (doc 01 FR-01); RLS returns only theirs.
export async function requireShop(): Promise<Owner & { shop: Shop }> {
  const owner = await requireOwner();
  const { data: shop, error } = await owner.db.from("shops").select("*").maybeSingle();
  if (error) throw new ApiError(500, "DATABASE", "Something went wrong");
  if (!shop) throw new ApiError(404, "NO_SHOP", "Set up your shop first");
  return { ...owner, shop };
}

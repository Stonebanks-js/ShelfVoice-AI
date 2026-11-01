import { NextResponse } from "next/server";

import { cookies } from "next/headers";

import { log } from "@/server/log";
import { NEXT_COOKIE, safeNext } from "@/server/next-path";
import { ownerClient } from "@/server/supabase";

// Google returns here with a one-time code; exchanging it sets the session
// cookie (PKCE verifier is read from the cookie the sign-in step set).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const db = await ownerClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) {
      // Back to where the person started: the owner app, their Account, or a shop.
      const next = safeNext((await cookies()).get(NEXT_COOKIE)?.value);
      const response = NextResponse.redirect(new URL(next, url.origin), 303);
      response.cookies.delete(NEXT_COOKIE);
      return response;
    }
    log("warn", "auth.callback.failed", { error: error.message });
  }
  return NextResponse.redirect(new URL("/owner?signin=failed", url.origin), 303);
}

import { NextResponse } from "next/server";

import { log } from "@/server/log";
import { ownerClient } from "@/server/supabase";

// Google returns here with a one-time code; exchanging it sets the session
// cookie (PKCE verifier is read from the cookie the sign-in step set).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const db = await ownerClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/app", url.origin), 303);
    log("warn", "auth.callback.failed", { error: error.message });
  }
  return NextResponse.redirect(new URL("/?signin=failed", url.origin), 303);
}

import { NextResponse } from "next/server";

import { ApiError, route } from "@/server/http";
import { ownerClient } from "@/server/supabase";

// Owner sign-in with Google through Supabase Auth, OAuth with PKCE (doc 03).
// Needs the Google provider configured in Supabase (checkpoint C-10).
export const GET = route(async (request) => {
  const origin = new URL(request.url).origin;
  const db = await ownerClient();
  const { data, error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback`, scopes: "openid email profile" },
  });
  if (error || !data.url) throw new ApiError(503, "SIGN_IN_UNAVAILABLE", "Google sign-in isn't available right now");
  return NextResponse.redirect(data.url, 303);
});

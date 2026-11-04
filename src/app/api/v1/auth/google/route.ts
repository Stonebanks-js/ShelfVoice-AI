import { NextResponse } from "next/server";

import { ApiError, route } from "@/server/http";
import { NEXT_COOKIE, safeNext } from "@/server/next-path";
import { ownerClient } from "@/server/supabase";

// Sign-in with Google through Supabase Auth, OAuth with PKCE, for
// shop owners and customers. `?next=` says where to land after
// (kept in a short-lived cookie, so the return address Supabase allows stays
// the same). Needs the Google provider configured in Supabase.
export const GET = route(async (request) => {
  const url = new URL(request.url);
  const origin = url.origin;
  const db = await ownerClient();
  const { data, error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback`, scopes: "openid email profile" },
  });
  if (error || !data.url) throw new ApiError(503, "SIGN_IN_UNAVAILABLE", "Google sign-in isn't available right now");
  const response = NextResponse.redirect(data.url, 303);
  response.cookies.set(NEXT_COOKIE, safeNext(url.searchParams.get("next")), {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    maxAge: 600,
    path: "/",
  });
  return response;
});

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isAdminEmail } from "@/server/admin";

// Runs before every page and API route (Next 16 "proxy", formerly
// middleware): stamps a request ID for log correlation (doc 05) and refreshes
// the Supabase session cookie once per request.
export async function proxy(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const forwarded = () => {
    const headers = new Headers(request.headers);
    headers.set("x-request-id", requestId);
    return headers;
  };
  let headers = forwarded();

  // Customer pages and the privacy page never use a session: skip the auth
  // round trip (doc 06: the storefront and review page load in 15 seconds or
  // less on a phone).
  const path = request.nextUrl.pathname;
  if (path.startsWith("/s/") || path.startsWith("/r/") || path === "/privacy") {
    const response = NextResponse.next({ request: { headers } });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  let response = NextResponse.next({ request: { headers } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          // Pages and routes must see the refreshed cookies, not the ones
          // the browser sent, or they'd refresh the session a second time.
          for (const { name, value } of toSet) request.cookies.set(name, value);
          headers = forwarded();
          response = NextResponse.next({ request: { headers } });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        },
      },
    },
  );
  // Validates the session and refreshes it if needed; must not be skipped.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-in owners skip the sign-in page; the owner app needs a session.
  const isApp = path === "/app" || path.startsWith("/app/");
  if ((user && path === "/") || (!user && isApp)) {
    const redirect = NextResponse.redirect(new URL(user ? "/app" : "/", request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    redirect.headers.set("x-request-id", requestId);
    return redirect;
  }

  // The admin page is a plain 404 to anyone not on ADMIN_EMAILS (W-20b);
  // checked here so the status is a real 404, not a streamed one.
  if ((path === "/admin" || path.startsWith("/admin/")) && !isAdminEmail(user?.email)) {
    const hidden = NextResponse.rewrite(new URL("/_admin-hidden", request.url), { request: { headers } });
    for (const cookie of response.cookies.getAll()) hidden.cookies.set(cookie);
    hidden.headers.set("x-request-id", requestId);
    return hidden;
  }

  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};

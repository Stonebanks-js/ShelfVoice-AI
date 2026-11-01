// Where to land after Google sign-in (V-05): the owner app, a customer's
// Account, or the shop page they came from. Only these, so the sign-in can't
// be used to send someone to another site.
export const NEXT_COOKIE = "sv_next";

export function safeNext(value: string | null | undefined): string {
  if (!value) return "/app";
  if (value === "/app" || value === "/me" || value === "/shops") return value;
  if (/^\/s\/[a-z0-9-]{3,48}$/.test(value)) return value;
  return "/app";
}

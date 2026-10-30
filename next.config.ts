import type { NextConfig } from "next";

// Security headers on every response (doc 03, W-03c; errata E-33). Partial
// prerendering can't carry per-request nonces, so scripts are limited to our
// own origin (inline allowed, for Next's bootstrap) and Turnstile; network,
// images and audio only to Supabase; nothing may frame the app or load
// plugins, and forms post only to us.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const deployed = supabase.startsWith("https://");
const dev = process.env.NODE_ENV === "development";
const turnstile = "https://challenges.cloudflare.com";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${turnstile}${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${supabase}`,
  "font-src 'self'",
  `connect-src 'self' ${supabase}`,
  `media-src 'self' blob: ${supabase}`,
  `frame-src ${turnstile}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(deployed ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The owner app needs the mic and camera; nothing needs anything else.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Browser error reports carry the deploy they came from (doc 05).
  env: { NEXT_PUBLIC_RELEASE: process.env.RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev" },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

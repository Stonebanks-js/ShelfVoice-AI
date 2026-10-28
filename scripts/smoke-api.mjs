// End-to-end check of the backend API against a running app and Supabase,
// the way the frontend will call it. Usage:
//   node scripts/smoke-api.mjs [baseUrl]        (default http://localhost:3000)
// Needs .env.local (service key and CRON_SECRET) and a Supabase stack with
// migrations applied. Uses the live Meta API only where META_MODE=live.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

const BASE = process.argv[2] ?? "http://localhost:3000";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l.trim()))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let failures = 0;
const results = [];
function check(name, ok, detail = "") {
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` | ${detail}` : ""}`);
  if (!ok) failures += 1;
  console.log(results.at(-1));
}

const jar = new Map();
async function api(method, path, { json, form, headers = {}, cookies = true } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    redirect: "manual",
    headers: {
      ...(json ? { "content-type": "application/json" } : {}),
      ...(cookies && jar.size ? { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
      ...headers,
    },
    body: json ? JSON.stringify(json) : form,
  });
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    const value = pair.slice(i + 1);
    if (value) jar.set(pair.slice(0, i), value);
    else jar.delete(pair.slice(0, i));
  }
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body, headers: res.headers };
}

function toneWav(seconds = 2, rate = 16000) {
  const n = seconds * rate;
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000), 44 + i * 2);
  return b;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ health
let r = await api("GET", "/api/health");
check("liveness", r.status === 200, JSON.stringify(r.body));
r = await api("GET", "/api/health/ready");
check("readiness", r.status === 200, JSON.stringify(r.body.checks));

// ------------------------------------------------------------------- auth
r = await api("GET", "/api/v1/shops/me");
check("signed out gets 401 with the error shape", r.status === 401 && r.body.error?.code === "UNAUTHENTICATED");
r = await api("POST", "/api/v1/auth/demo");
check("demo sign-in creates a demo copy", r.status === 201 && r.body.shopId, `status ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
r = await api("GET", "/api/v1/shops/me");
const shop = r.body.shop;
check("demo user owns a demo shop", r.status === 200 && shop?.is_demo === true && r.body.user.isAnonymous === true, shop?.slug);
r = await api("POST", "/api/v1/shops", { json: { name: "Spam" } });
check("anonymous demo user cannot create another shop", r.status === 404 || r.status === 409 || r.status === 403, `status ${r.status}`);

// --------------------------------------------------------------- catalog
r = await api("GET", "/api/v1/products");
const products = r.body.products ?? [];
const byName = (n) => products.find((p) => p.name.startsWith(n));
check("demo catalog has 15 products", products.length === 15);
check("stock ends where the template says (Atta 3, Surf 3, Maggi 18)",
  byName("Aashirvaad")?.stock_qty === 3 && byName("Surf")?.stock_qty === 3 && byName("Maggi")?.stock_qty === 18);
check("forecasts were computed for every product", products.every((p) => p.product_forecasts));

r = await api("GET", "/api/v1/restock");
const items = r.body.items ?? [];
check("order list has items", r.status === 200 && items.length > 0,
  items.map((i) => `${i.name}: ${i.stock} left, ${i.daysLeft} days, order ${i.orderQty}${i.customerFlagged ? ", flagged" : ""}`).join(" / "));
check("customer-flagged atta is first", items[0]?.name.startsWith("Aashirvaad") && items[0]?.customerFlagged);
check("every item has a reason sentence", items.every((i) => typeof i.reason === "string" && i.reason.length > 10), items[0]?.reason);

// ---------------------------------------------------------- stock logging
const maggi = byName("Maggi");
const key = randomUUID();
r = await api("POST", "/api/v1/stock-movements", { json: { product_id: maggi.id, kind: "SALE", qty: 2, idempotency_key: key } });
check("tap sale logged", r.status === 201);
const movementId = r.body.movement?.id;
r = await api("POST", "/api/v1/stock-movements", { json: { product_id: maggi.id, kind: "SALE", qty: 2, idempotency_key: key } });
check("double tap logs once", r.status === 200 && r.body.movement?.id === movementId);
r = await api("POST", "/api/v1/stock-movements", { json: { product_id: maggi.id, kind: "SALE", qty: 5000, idempotency_key: randomUUID() } });
check("overselling is refused with 409", r.status === 409 && r.body.error?.code === "STOCK_NEGATIVE");
r = await api("GET", "/api/v1/products");
check("stock after the sale is 16", r.body.products.find((p) => p.id === maggi.id)?.stock_qty === 16);

// ------------------------------------------------------------ voice upload
const clientId = randomUUID();
r = await api("POST", "/api/v1/uploads", { json: { kind: "voice", clientId } });
check("signed upload URL for the owner's folder", r.status === 201 && r.body.path === `${shop.id}/owner/${clientId}.wav`);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const up = await anon.storage.from("voice").uploadToSignedUrl(r.body.path, r.body.token, toneWav(), { contentType: "audio/wav" });
check("clip uploads through the signed URL", !up.error, up.error?.message);
r = await api("POST", "/api/v1/proposals/voice", { json: { path: `${shop.id}/owner/${clientId}.wav`, kind: "COMMAND" } });
check("a tone with no speech is reported as nothing heard", r.status === 422 && r.body.error?.code === "NOTHING_HEARD", `${r.status} ${r.body.error?.code}`);
r = await api("POST", "/api/v1/proposals/voice", { json: { path: `${randomUUID()}/owner/${clientId}.wav`, kind: "COMMAND" } });
check("another shop's path is refused", r.status === 422 && r.body.error?.code === "BAD_PATH");

// ---------------------------------------------------- confirm and undo API
const { data: proposal } = await admin
  .from("proposals")
  .insert({
    shop_id: shop.id,
    kind: "COMMAND",
    transcript: "Maggi ka price 15 kar do",
    changes: [{ op: "update_price", product_id: maggi.id, price_paise: 1500 }],
  })
  .select("id")
  .single();
r = await api("POST", `/api/v1/proposals/${proposal.id}/confirm`, { json: {} });
check("confirm applies the price change", r.status === 200 && r.body.applied?.[0]?.after?.price_paise === 1500);
r = await api("POST", `/api/v1/proposals/${proposal.id}/confirm`, { json: {} });
check("confirm is idempotent", r.status === 200);
r = await api("POST", `/api/v1/proposals/${proposal.id}/undo`, { json: {} });
check("undo restores the old price", r.status === 200 && r.body.reverted?.[0]?.undo === "reverted");
r = await api("GET", "/api/v1/products");
check("Maggi is back to Rs 14", r.body.products.find((p) => p.id === maggi.id)?.price_paise === 1400);
const { data: bad } = await admin.from("proposals").insert({ shop_id: shop.id, kind: "COMMAND", changes: [] }).select("id").single();
r = await api("POST", `/api/v1/proposals/${bad.id}/confirm`, { json: { changes: [{ op: "update_price", product_id: maggi.id, price_paise: 50000 }] } });
check("a 10x price jump is refused", r.status === 422 && r.body.error?.code === "PRICE_OUT_OF_RANGE");

// ---------------------------------------------------------- public review
async function review(id, token = "XXXX.DUMMY.TOKEN.XXXX") {
  const form = new FormData();
  form.set("reviewId", id);
  form.set("consent", "true");
  form.set("turnstileToken", token);
  form.set("audio", new Blob([toneWav(3)], { type: "audio/wav" }), "review.wav");
  return api("POST", `/api/v1/public/shops/${shop.slug}/reviews`, { form, cookies: false });
}
const reviewId = randomUUID();
r = await review(reviewId);
check("customer review accepted with a thank-you", r.status === 201, `${r.status} ${JSON.stringify(r.body).slice(0, 150)}`);
r = await review(reviewId);
check("resubmitting the same review is a no-op", r.status === 200);
r = await review(randomUUID());
check("third review from this IP this hour is allowed", r.status === 201);
r = await review(randomUUID());
check("fourth is rate-limited", r.status === 429 && r.body.error?.code === "RATE_LIMITED");
await sleep(12_000);
r = await api("GET", "/api/v1/reviews");
const mine = r.body.reviews?.find((x) => x.id === reviewId);
check("review was analysed after the response", mine?.status === "ANALYZED", `${mine?.status} ${mine?.summary}`);
check("owner gets a playable audio link", typeof mine?.audioUrl === "string");

// --------------------------------------------------------------- security
r = await api("POST", "/api/v1/stock-movements", {
  json: { product_id: maggi.id, kind: "SALE", qty: 1, idempotency_key: randomUUID() },
  headers: { origin: "https://evil.example" },
});
check("cross-origin writes are refused", r.status === 403 && r.body.error?.code === "CROSS_ORIGIN");
r = await api("GET", "/api/cron/nightly", { headers: { authorization: "Bearer wrong" }, cookies: false });
check("nightly job refuses a wrong secret", r.status === 401);
r = await api("GET", "/api/cron/nightly", { headers: { authorization: `Bearer ${env.CRON_SECRET}` }, cookies: false });
check("nightly job runs", r.status === 200, JSON.stringify(r.body));

r = await api("POST", "/api/v1/auth/signout", { json: {} });
r = await api("GET", "/api/v1/shops/me");
check("signed out after sign-out", r.status === 401);

console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures ? 1 : 0);

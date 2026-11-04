// Clean product images for every ready-made product (V-12), with Meta's
// muse-image-1.0 (Meta models only). Testers found the Open Food Facts
// photos too rough (hands, shelves, an opened bottle) and most products had
// none. For a product with a checked OFF photo, the image endpoint redraws
// that same pack as a clean packshot, keeping its real label (a derivative,
// still credited CC BY-SA); every other product gets a packshot drawn from
// its name and pack size, credited as an illustration. A person looks at
// every result before src/lib/catalog/photos.ts is committed.
//
// Usage: node --experimental-strip-types scripts/catalog-images.mjs <work-dir> [--only key,key]
// Reads META_API_KEY from .env.local; never prints it. About 20-30k tokens
// an image, one call per product; a rerun skips products already done.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { STARTER_ITEMS } from "../src/lib/catalog/starter.ts";
import { CATALOG_PHOTOS } from "../src/lib/catalog/photos.ts";
import { DEMO_PRODUCTS } from "../src/server/sample-shop/template.ts";

const require = createRequire(import.meta.url);
const sharp = require(require.resolve("sharp", { paths: [path.dirname(require.resolve("next/package.json"))] }));

function env(name) {
  if (process.env[name]) return process.env[name];
  const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") || undefined;
}
const KEY = env("META_API_KEY");
const BASE = (env("META_BASE_URL") ?? "https://api.meta.ai/v1").replace(/\/$/, "");
if (!KEY) throw new Error("META_API_KEY is not set");

const work = process.argv[2];
if (!work) throw new Error("Usage: catalog-images.mjs <work-dir> [--only key,key]");
const onlyArg = process.argv.indexOf("--only");
const only = onlyArg > 0 ? new Set(process.argv[onlyArg + 1].split(",")) : null;
const OUT = path.join("public", "catalog");
mkdirSync(OUT, { recursive: true });
mkdirSync(work, { recursive: true });

const keyOf = (name, unit) => `${name.trim()}|${(unit ?? "").trim()}`.toLowerCase();
const fileOf = (name, unit) => `${`${name}-${unit}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.webp`;

// Sold loose or under no brand: drawn plainly, never with a made-up label.
const LOOSE = /^(loose |sugar|jaggery|maida|sooji|poha|toor dal|moong dal|chana dal|masoor dal|urad dal|rajma|kabuli chana|jeera|eggs|pav|bun|burger bun|pizza base|cream roll|khari biscuit|nankhatai|atta cookies|muffin|veg puff|saunf|sona masoori)/i;

const items = [];
const seen = new Set();
for (const p of [...STARTER_ITEMS, ...DEMO_PRODUCTS]) {
  const key = keyOf(p.name, p.unit);
  if (seen.has(key) || (only && !only.has(key))) continue;
  seen.add(key);
  items.push({ key, name: p.name, unit: p.unit, category: p.category, loose: LOOSE.test(p.name) });
}

const STYLE = "centred on a plain pure-white background, soft even studio light, sharp focus, square frame with some space around it, no hands, no shelf, no price sticker, no watermark";
function prompt(item) {
  if (item.loose) {
    return `E-commerce product photo for an Indian grocery app: ${item.name.replace(/\(.*?\)/g, "").trim()}, ${item.unit}, as a kirana shop sells it loose or in a plain pack, with no brand and no printed text, ${STYLE}.`;
  }
  return `E-commerce product photo for an Indian grocery app: one ${item.name} pack, ${item.unit}, the real retail packaging as sold in India, front facing and upright, sealed and new, ${STYLE}.`;
}
const EDIT = (item) =>
  `Turn this photo into a clean e-commerce packshot of the very same product (${item.name}, ${item.unit}): keep its real packaging, label, brand and colours exactly as they are, sealed and new, upright and front facing, ${STYLE}.`;

const resultsFile = path.join(work, "images.json");
const results = existsSync(resultsFile) ? JSON.parse(readFileSync(resultsFile, "utf8")) : {};
let tokens = 0;

async function call(item) {
  const existing = CATALOG_PHOTOS[item.key];
  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    if (existing) {
      const bytes = readFileSync(path.join(OUT, existing.file));
      const form = new FormData();
      form.append("model", "muse-image-1.0");
      form.append("prompt", EDIT(item));
      form.append("image", new Blob([bytes], { type: "image/webp" }), "photo.webp");
      form.append("size", "1024x1024");
      res = await fetch(`${BASE}/images/edits`, { method: "POST", headers: { Authorization: `Bearer ${KEY}` }, body: form, signal: AbortSignal.timeout(240_000) });
    } else {
      res = await fetch(`${BASE}/images/generations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "muse-image-1.0", prompt: prompt(item), n: 1, size: "1024x1024" }),
        signal: AbortSignal.timeout(240_000),
      });
    }
    const json = await res.json().catch(() => null);
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 4000 * 2 ** attempt + Math.random() * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json?.error ?? json).slice(0, 200)}`);
    tokens += json?.usage?.total_tokens ?? 0;
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new Error("no image in the answer");
    return { bytes: Buffer.from(b64, "base64"), source: existing ? "off" : "generated", code: existing?.code ?? null };
  }
  throw new Error("busy after 3 tries");
}

async function one(item) {
  if (results[item.key]?.file) return;
  try {
    const { bytes, source, code } = await call(item);
    const file = fileOf(item.name, item.unit);
    // Keep the raw answer for review; ship a small WebP.
    writeFileSync(path.join(work, file.replace(/\.webp$/, ".png")), bytes);
    await sharp(bytes).resize(512, 512, { fit: "inside" }).webp({ quality: 80 }).toFile(path.join(OUT, file));
    results[item.key] = { name: item.name, unit: item.unit, file, source, code };
    console.log(`${source === "off" ? "CLEANED " : "DRAWN   "} ${item.name} ${item.unit}`);
  } catch (failure) {
    console.log(`  ${item.name} ${item.unit}: ${failure.message}`);
  }
  writeFileSync(resultsFile, JSON.stringify(results, null, 2));
}

// Three at a time.
const queue = [...items];
await Promise.all(
  Array.from({ length: 3 }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) await one(item);
  }),
);
console.log(`\n${Object.values(results).filter((r) => r.file).length} of ${items.length} products have an image; about ${Math.round(tokens / 1000)}k tokens this run`);

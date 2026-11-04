// Finds a packshot for each ready-made product on Open Food Facts (V-11) and
// keeps it only when it is the same product in the same pack: the rules in
// src/lib/catalog/match.ts, then a person looking at every kept photo (the
// review sheet this writes) before src/lib/catalog/photos.ts is committed.
// Photos are CC BY-SA: they are copied into public/catalog as small WebP files
// and credited to Open Food Facts contributors wherever they show.
//
// Usage: node --experimental-strip-types scripts/catalog-photos.mjs <review-dir>
// No key needed. Searches are paced under OFF's limit (about 10 a minute),
// so a full run takes about 15 minutes; a rerun skips products already done.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { STARTER_ITEMS } from "../src/lib/catalog/starter.ts";
import { confident, rank } from "../src/lib/catalog/match.ts";
import { candidatesFromSearch, getJson, isOffImageUrl, OFF_USER_AGENT, searchUrl } from "../src/lib/catalog/off.ts";
import { DEMO_PRODUCTS } from "../src/server/sample-shop/template.ts";

const require = createRequire(import.meta.url);
const sharp = require(require.resolve("sharp", { paths: [path.dirname(require.resolve("next/package.json"))] }));

const BASE = "https://world.openfoodfacts.org";
const OUT = path.join("public", "catalog");
const review = process.argv[2];
if (!review) throw new Error("Usage: catalog-photos.mjs <review-dir>");
mkdirSync(OUT, { recursive: true });
mkdirSync(review, { recursive: true });

// No brand on the pack, so any brand's photo would be a guess.
const UNBRANDED = new Set([
  "Loose Atta", "Loose Rice", "Sona Masoori Rice", "Maida", "Sooji (Rava)", "Poha", "Sugar", "Jaggery", "Toor Dal",
  "Moong Dal", "Chana Dal", "Masoor Dal", "Urad Dal", "Rajma", "Kabuli Chana", "Jeera", "Eggs", "Pav", "Bun",
  "Cream Roll", "Khari Biscuit", "Nankhatai", "Atta Cookies", "Muffin", "Veg Puff", "Burger Bun", "Pizza Base",
  "Saunf Mouth Freshener",
]);

const keyOf = (name, unit) => `${name}|${unit}`.toLowerCase();
const fileOf = (name, unit) => `${`${name}-${unit}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.webp`;

const items = [];
const seen = new Set();
for (const p of [...STARTER_ITEMS, ...DEMO_PRODUCTS]) {
  const key = keyOf(p.name, p.unit);
  if (seen.has(key) || UNBRANDED.has(p.name)) continue;
  seen.add(key);
  items.push({ name: p.name, unit: p.unit });
}

const resultsFile = path.join(review, "results.json");
const results = existsSync(resultsFile) ? JSON.parse(readFileSync(resultsFile, "utf8")) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function savePhoto(url, file) {
  if (!isOffImageUrl(url)) throw new Error("not an OFF photo");
  const res = await fetch(url, { headers: { "User-Agent": OFF_USER_AGENT }, signal: AbortSignal.timeout(10_000), redirect: "error" });
  if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) throw new Error(`photo HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > 3_000_000) throw new Error("photo too large");
  await sharp(bytes).rotate().resize(480, 480, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toFile(file);
}

let searched = 0;
for (const item of items) {
  const key = keyOf(item.name, item.unit);
  if (results[key]?.done) continue;
  if (searched++ > 0) await sleep(6500);
  const query = item.name.replace(/\(.*?\)/g, " ").trim();
  let candidates = [];
  try {
    candidates = candidatesFromSearch(await getJson(searchUrl(BASE, query), { tries: 3, timeoutMs: 15_000 }));
  } catch (failure) {
    console.log(`  ${item.name} ${item.unit}: search failed (${failure.message}), will retry on the next run`);
    continue;
  }
  const ranked = rank(item, candidates);
  const pick = confident(ranked);
  const entry = {
    done: true,
    name: item.name,
    unit: item.unit,
    file: null,
    pick: pick && { code: pick.candidate.code, name: pick.candidate.name, quantity: pick.candidate.quantity, status: pick.status, reason: pick.reason },
    top: ranked.slice(0, 3).map((m) => ({ code: m.candidate.code, name: m.candidate.name, quantity: m.candidate.quantity, status: m.status, score: m.score, imageUrl: m.candidate.imageUrl })),
  };
  if (pick) {
    try {
      const file = fileOf(item.name, item.unit);
      await savePhoto(pick.candidate.imageUrl, path.join(OUT, file));
      entry.file = file;
    } catch (failure) {
      entry.error = failure.message;
    }
  }
  results[key] = entry;
  writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`${entry.file ? "PHOTO" : "none "}  ${item.name} ${item.unit}${pick ? ` <- ${pick.candidate.name} ${pick.candidate.quantity ?? ""} (${pick.status})` : ranked.length ? ` (${ranked.length} unsure)` : ""}`);
}

const kept = Object.values(results).filter((r) => r.file).length;
console.log(`\n${kept} photos of ${items.length} branded products; results in ${resultsFile}`);

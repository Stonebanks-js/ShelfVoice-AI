// Is this photo the same product? (V-11) A product database entry is the
// same as one of ours only when its name holds every word of ours, it adds no
// word that marks another variant ("Multigrain", "Select", "Masala"), and its
// pack is the same size. No photo is better than the wrong one: an uncertain
// match is never shown without the owner confirming it.

export type Dimension = "g" | "ml" | "pc";
export interface Amount {
  value: number;
  dim: Dimension;
}

const UNITS: Record<string, { dim: Dimension; factor: number }> = {
  g: { dim: "g", factor: 1 },
  gm: { dim: "g", factor: 1 },
  gms: { dim: "g", factor: 1 },
  gram: { dim: "g", factor: 1 },
  grams: { dim: "g", factor: 1 },
  kg: { dim: "g", factor: 1000 },
  kgs: { dim: "g", factor: 1000 },
  ml: { dim: "ml", factor: 1 },
  l: { dim: "ml", factor: 1000 },
  ltr: { dim: "ml", factor: 1000 },
  litre: { dim: "ml", factor: 1000 },
  liter: { dim: "ml", factor: 1000 },
  pc: { dim: "pc", factor: 1 },
  pcs: { dim: "pc", factor: 1 },
  piece: { dim: "pc", factor: 1 },
  pieces: { dim: "pc", factor: 1 },
};

// "5 kg" → 5000 g, "1L" → 1000 ml, "10 pcs" → 10 pc. A multipack ("2 x 100 g")
// or anything unreadable is null: it can't prove the pack is the same.
export function parseAmount(text: string | null | undefined): Amount | null {
  if (!text) return null;
  const clean = text.toLowerCase().replace(/,/g, ".").trim();
  if (/\d\s*[x×*]\s*\d/.test(clean)) return null;
  const m = /(\d+(?:\.\d+)?)\s*([a-z]+)\b/.exec(clean);
  if (!m) return null;
  const unit = UNITS[m[2]];
  if (!unit) return null;
  return { value: Math.round(Number(m[1]) * unit.factor * 1000) / 1000, dim: unit.dim };
}

export function sameAmount(a: Amount | null, b: Amount | null): boolean {
  if (!a || !b || a.dim !== b.dim) return false;
  return Math.abs(a.value - b.value) <= a.value * 0.02;
}

// Words that make a different product of the same brand.
const VARIANTS = new Set([
  "multigrain", "select", "organic", "lite", "light", "diet", "zero", "sugarfree", "gold", "premium", "royale",
  "masala", "chicken", "oats", "atta", "veg", "tomato", "chilli", "chili", "chocolate", "choco", "elaichi", "kesar",
  "strawberry", "mango", "lemon", "orange", "vanilla", "cream", "butter", "cashew", "badam", "almond", "honey",
  "herbal", "neem", "aloe", "lime", "rose", "sandal", "jasmine", "mint", "active", "sensitive", "kids", "junior",
  "rock", "himalayan", "pink", "iodised", "low", "sodium", "double", "toned", "skimmed", "slim", "full",
  "brown", "basmati", "sona", "mogra", "lavender", "matic", "liquid", "bar", "powder", "gel", "spray", "refill",
]);

// Words that don't change what the product is.
const NEUTRAL = new Set([
  "the", "and", "of", "with", "new", "pack", "pouch", "pkt", "packet", "box", "bottle", "jar", "tin", "india",
  "indian", "original", "classic", "regular", "superior", "mp", "whole", "wheat", "chakki", "fresh", "ltd",
  "limited", "pvt", "private", "itc", "hul", "foods", "food", "products", "co", "company", "brand",
]);

const singular = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

// Lowercase words without accents, punctuation or pack sizes.
export function words(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0 && !/^\d+(\.\d+)?$/.test(w) && !UNITS[w])
    .map(singular);
}

export interface Candidate {
  code: string; // barcode in the source database
  name: string;
  brands?: string | null;
  quantity?: string | null;
}

export type MatchStatus = "exact" | "likely" | "uncertain" | "no";

export interface Match<C extends Candidate = Candidate> {
  candidate: C;
  status: MatchStatus;
  score: number;
  reason: string;
}

// One candidate against our product. Our name must be wholly inside the
// candidate's name and brands; a variant word we don't have rules it out; a
// different pack size rules it out; a missing size leaves it uncertain.
export function judge<C extends Candidate>(ours: { name: string; unit?: string | null; barcode?: string | null }, candidate: C): Match<C> {
  if (ours.barcode && candidate.code && ours.barcode === candidate.code) {
    return { candidate, status: "exact", score: 100, reason: "same barcode" };
  }
  const mine = new Set(words(ours.name));
  const theirName = words(candidate.name);
  const theirs = new Set([...theirName, ...words(candidate.brands ?? "")]);
  const missing = [...mine].filter((w) => !theirs.has(w));
  if (missing.length) return { candidate, status: "no", score: 0, reason: `missing ${missing.join(", ")}` };
  const extra = theirName.filter((w) => !mine.has(w) && !NEUTRAL.has(w));
  const variant = extra.find((w) => VARIANTS.has(w));
  if (variant) return { candidate, status: "no", score: 0, reason: `another variant (${variant})` };

  const want = parseAmount(ours.unit);
  const have = parseAmount(candidate.quantity) ?? parseAmount(candidate.name);
  if (want && have && !sameAmount(want, have)) return { candidate, status: "no", score: 0, reason: "another pack size" };
  const sized = Boolean(want && have);
  const score = Math.max(1, 90 - extra.length * 8 - (sized ? 0 : 35));
  const status: MatchStatus = !sized ? "uncertain" : extra.length === 0 ? "exact" : extra.length <= 2 ? "likely" : "uncertain";
  return { candidate, status, score, reason: sized ? (extra.length ? `extra words: ${extra.join(", ")}` : "same name and size") : "pack size unknown" };
}

// Every candidate judged, best first; the ones ruled out are dropped.
export function rank<C extends Candidate>(ours: { name: string; unit?: string | null; barcode?: string | null }, candidates: C[]): Match<C>[] {
  const seen = new Set<string>();
  return candidates
    .filter((c) => (seen.has(c.code) ? false : (seen.add(c.code), true)))
    .map((c) => judge(ours, c))
    .filter((m) => m.status !== "no")
    .sort((a, b) => b.score - a.score);
}

// The one candidate safe to use without asking: exact or likely, and clearly
// ahead of the next one. Two close candidates mean the owner should choose.
export function confident<C extends Candidate>(ranked: Match<C>[]): Match<C> | null {
  const [best, next] = ranked;
  if (!best || (best.status !== "exact" && best.status !== "likely")) return null;
  if (next && next.status !== "uncertain" && best.score - next.score < 8 && best.status !== "exact") return null;
  return best;
}

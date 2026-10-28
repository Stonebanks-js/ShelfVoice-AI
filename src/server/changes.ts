// The change contract between proposals and public.confirm_proposal().
// Every AI result becomes a list of these, validated here before it is
// stored or shown, and again by the database when the owner confirms.
import { z } from "zod";

const id = z.uuid();
const name = z.string().trim().min(1).max(80);
const paise = z.number().int().positive().max(10_000_000);
const count = z.number().int().min(0).max(10_000);
const qty = z.number().int().min(1).max(10_000);

export const Change = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("update_shop"),
    name: name.optional(),
    category: z.string().trim().max(80).nullable().optional(),
    phone: z.string().regex(/^\+[1-9][0-9]{6,14}$/).nullable().optional(),
    address: z.string().trim().max(300).nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    hours: z.record(z.string(), z.unknown()).nullable().optional(),
  }).strict(),
  z.object({
    op: z.literal("add_product"),
    name,
    unit: z.string().trim().max(40).nullable().optional(),
    category: z.string().trim().max(80).nullable().optional(),
    price_paise: paise.nullable().optional(),
    aliases: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
    stock_qty: count.nullable().optional(),
  }).strict(),
  z.object({ op: z.literal("update_price"), product_id: id, price_paise: paise }).strict(),
  z.object({ op: z.literal("set_in_stock"), product_id: id, in_stock: z.boolean() }).strict(),
  z.object({ op: z.literal("set_stock_count"), product_id: id, count }).strict(),
  z.object({ op: z.literal("record_sale"), product_id: id, qty, unit_price_paise: paise.nullable().optional() }).strict(),
  z.object({ op: z.literal("record_delivery"), product_id: id, qty }).strict(),
]);
export type Change = z.infer<typeof Change>;

// Doc 03 "Tool permissions": at most 50 changes per proposal.
export const Changes = z.array(Change).max(50);

export const rupeesToPaise = (rupees: number) => Math.round(rupees * 100);

// Doc 03: a new price must be above 0 and under 10x the old one.
export function priceChangeAllowed(oldPaise: number | null, newPaise: number): boolean {
  return newPaise > 0 && (oldPaise === null || newPaise < oldPaise * 10);
}

// Indian mobile numbers as spoken ("98765 43210", "+91 98765-43210") to E.164.
export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return null;
}

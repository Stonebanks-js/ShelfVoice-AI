import { randomBytes } from "node:crypto";

// Storefront address from the shop name plus 4 random characters (decision
// K5): "Sharma Kirana Store" -> "sharma-kirana-store-k3f9". Non-Latin names
// fall back to "shop".
export function slugFor(name: string, random = () => randomBytes(2).toString("hex")): string {
  const base =
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/g, "") || "shop";
  return `${base}-${random()}`;
}

// The Stock tab's view of a product, shared by the server page and the
// client screen (a "use client" module can't export plain values to the server).
export const PRODUCT_COLUMNS =
  "id, name, unit, category, aliases, price_paise, stock_qty, is_in_stock, low_stock_level, product_forecasts(days_left, order_qty, reorder_point)";

export interface StockProduct {
  id: string;
  name: string;
  unit: string | null;
  category: string | null;
  aliases: string[];
  price_paise: number | null;
  stock_qty: number | null;
  is_in_stock: boolean;
  low_stock_level: number;
  product_forecasts: { days_left: number | null; order_qty: number | null; reorder_point: number | null } | null;
}

// Search by name or any spoken alias, ignoring case and spacing.
export function matches(product: StockProduct, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return true;
  return [product.name, ...product.aliases].some((text) => text.toLowerCase().includes(q));
}

// Categories in the order the chips show them: most products first.
export function categories(products: StockProduct[], other: string): string[] {
  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.category ?? other, (counts.get(p.category ?? other) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
}

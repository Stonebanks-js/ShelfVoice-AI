import type { Lang, MessageKey } from "@/i18n/dictionary";
import { translate } from "@/i18n/dictionary";
import type { Change } from "@/server/changes";

// How the owner sees a proposed change (doc 06 O-4): one plain sentence per
// card, like "Maggi: price ₹14 → ₹15", never system terms.

export interface CatalogEntry {
  id: string;
  name: string;
  price_paise: number | null;
}

export function formatRupees(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function formatPhone(e164: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}

// Doc 06: anything unclear is marked "Please check" in amber and is never
// pre-selected. A new product with no price heard is the unclear case the
// AI can produce; its other outputs are already checked against the catalog.
export function needsCheck(change: Change): boolean {
  return change.op === "add_product" && (change.price_paise === null || change.price_paise === undefined);
}

export interface ChangeView {
  title: string;
  details: string[];
}

export function describeChange(change: Change, catalog: CatalogEntry[], lang: Lang): ChangeView {
  const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const product = "product_id" in change ? catalog.find((p) => p.id === change.product_id) : undefined;
  const name = product?.name ?? t("change.someItem");
  switch (change.op) {
    case "update_shop": {
      const details: string[] = [];
      if (change.name) details.push(t("change.shop.name", { value: change.name }));
      if (change.category) details.push(t("change.shop.category", { value: change.category }));
      if (change.phone) details.push(t("change.shop.phone", { value: formatPhone(change.phone) }));
      if (change.address) details.push(t("change.shop.address", { value: change.address }));
      if (change.description) details.push(t("change.shop.description", { value: change.description }));
      if (change.hours) details.push(t("change.shop.hours"));
      return { title: t("change.shop"), details };
    }
    case "add_product": {
      const details = [
        change.price_paise ? formatRupees(change.price_paise) : t("change.add.noPrice"),
        change.unit,
        change.category,
      ].filter((d): d is string => Boolean(d));
      return { title: t("change.add", { name: change.name }), details };
    }
    case "update_price":
      return {
        title: t("change.price", {
          name,
          from: product?.price_paise ? formatRupees(product.price_paise) : "—",
          to: formatRupees(change.price_paise),
        }),
        details: [],
      };
    case "set_in_stock":
      return { title: t(change.in_stock ? "change.inStock" : "change.outOfStock", { name }), details: [] };
    case "set_stock_count":
      return { title: t("change.count", { name, count: change.count }), details: [] };
    case "record_sale":
      return {
        title: t("change.sale", { name, qty: change.qty }),
        details: change.unit_price_paise ? [t("change.saleAt", { price: formatRupees(change.unit_price_paise) })] : [],
      };
    case "record_delivery":
      return { title: t("change.delivery", { name, qty: change.qty }), details: [] };
  }
}

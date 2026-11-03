import type { MessageKey } from "@/i18n/dictionary";

// The starter catalog's categories and the shop types in the customer's
// language (testers, Nov 3). A name an owner wrote themself stays as written.
const KEYS: Record<string, MessageKey> = {
  "Atta and rice": "cat.atta",
  "Bakery": "cat.bakery",
  "Beverages": "cat.beverages",
  "Biscuits": "cat.biscuits",
  "Chocolates": "cat.chocolates",
  "Dairy": "cat.dairy",
  "Household": "cat.household",
  "Instant food": "cat.instant",
  "Personal care": "cat.personal",
  "Snacks": "cat.snacks",
  "Staples": "cat.staples",
  "Kirana": "cat.kirana",
  "Departmental store": "cat.departmental",
};

export function categoryLabel(name: string, t: (key: MessageKey) => string): string {
  const key = KEYS[name];
  return key ? t(key) : name;
}

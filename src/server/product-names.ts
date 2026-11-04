import "server-only";

import bn from "@/i18n/product-names/bn";
import gu from "@/i18n/product-names/gu";
import hi from "@/i18n/product-names/hi";
import kn from "@/i18n/product-names/kn";
import ml from "@/i18n/product-names/ml";
import mr from "@/i18n/product-names/mr";
import or from "@/i18n/product-names/or";
import pa from "@/i18n/product-names/pa";
import ta from "@/i18n/product-names/ta";
import te from "@/i18n/product-names/te";

// A product name an owner spoke or typed in an Indian script, back to the
// ready-made list's English name ("आशीर्वाद आटा" → "Aashirvaad Atta"), so it
// finds its image. Names not on the list come back unchanged.
const back = new Map<string, string>();
for (const names of [hi, bn, gu, kn, ml, mr, or, pa, ta, te]) {
  for (const [english, local] of Object.entries(names)) back.set(local.trim().toLowerCase(), english);
}

export const englishName = (name: string) => back.get(name.trim().toLowerCase()) ?? name;

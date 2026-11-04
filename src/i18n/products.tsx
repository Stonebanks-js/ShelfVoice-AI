"use client";

import { useEffect, useState } from "react";

import type { Lang } from "./dictionary";
import { useLang } from "./lang";

type Names = Record<string, string>;

// The ready-made products' names in each language, one chunk per
// language, fetched only when a page shows that language. A name that isn't
// in the list (one the owner typed) shows as written.
const load: Record<Exclude<Lang, "en">, () => Promise<{ default: Names }>> = {
  hi: () => import("./product-names/hi"),
  kn: () => import("./product-names/kn"),
  ta: () => import("./product-names/ta"),
  te: () => import("./product-names/te"),
  ml: () => import("./product-names/ml"),
  mr: () => import("./product-names/mr"),
  gu: () => import("./product-names/gu"),
  bn: () => import("./product-names/bn"),
  or: () => import("./product-names/or"),
  pa: () => import("./product-names/pa"),
};

const loaded = new Map<Lang, Names>();

export function useProductName(): (name: string) => string {
  const { lang } = useLang();
  // Bumped when a language's chunk arrives, so the names re-render.
  const [, setArrived] = useState(0);
  useEffect(() => {
    if (lang === "en" || loaded.has(lang)) return;
    let live = true;
    load[lang]()
      .then((chunk) => {
        loaded.set(lang, chunk.default);
        if (live) setArrived((n) => n + 1);
      })
      .catch(() => undefined); // offline: the names stay as written
    return () => {
      live = false;
    };
  }, [lang]);
  const names = lang === "en" ? null : loaded.get(lang);
  return (name) => names?.[name.trim()] ?? name;
}

// The same, as an element: for lists, including server-rendered ones.
export function ProductName({ name }: { name: string }) {
  return <>{useProductName()(name)}</>;
}

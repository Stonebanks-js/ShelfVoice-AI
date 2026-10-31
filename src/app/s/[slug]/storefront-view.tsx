"use client";

import { Check, ChevronRight, MapPin, Mic, Phone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { OpenBadge } from "@/components/shell/open-badge";
import { buttonClass } from "@/components/ui/button";
import { Badge, Chip } from "@/components/ui/controls";
import { useLang } from "@/i18n/lang";
import { formatRupees } from "@/lib/changes-view";
import { cn } from "@/lib/cn";
import type { Storefront } from "@/server/storefront";

export function StorefrontView({ shop }: { shop: Storefront }) {
  const { lang, t } = useLang();
  const [category, setCategory] = useState<string | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  const other = t("stock.other");
  const categories = [...new Set(shop.products.map((p) => p.category ?? other))].sort();
  const shown = shop.products.filter((p) => category === null || (p.category ?? other) === category);
  const phoneDigits = shop.phone?.replace(/\D/g, "") ?? null;

  // Doc 06: "Order on WhatsApp" opens a prefilled message with the shop
  // name, the ticked items and "Is this available?". No cart, no payment.
  const picked = shop.products.filter((p) => ticked.has(p.id));
  const message = [t("store.waHello", { shop: shop.name }), ...picked.map((p) => `• ${p.name}${p.unit ? ` (${p.unit})` : ""}`)].join("\n");
  const whatsapp = phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}` : null;

  const toggle = (id: string) =>
    setTicked((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      {/* The signboard: shop name, open now, where, and two ways to reach it. */}
      <header className="flex flex-col gap-3 px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-large-title font-bold tracking-tight">{shop.name}</h1>
          {shop.category && <p className="text-body text-ink-2">{shop.category}</p>}
        </div>
        <div>
          <OpenBadge hours={shop.hours} timeZone={shop.timezone} />
        </div>
        {shop.address && (
          <p className="flex items-start gap-2 text-body text-ink-2">
            <MapPin aria-hidden className="mt-0.5 size-5 shrink-0" />
            {shop.address}
          </p>
        )}
        {shop.description && <p className="text-body">{shop.description}</p>}
        {shop.phone && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <a href={`tel:${shop.phone}`} className={buttonClass("tinted", "md")}>
              <Phone aria-hidden className="size-5" />
              {t("store.call")}
            </a>
            <a href={whatsapp!} target="_blank" rel="noopener" className={buttonClass("filled", "md", "text-center leading-tight")}>
              {picked.length ? t("store.whatsappN", { n: picked.length }) : t("store.whatsapp")}
            </a>
          </div>
        )}
      </header>

      {shop.products.length === 0 ? (
        <p className="mx-4 rounded-lg bg-surface p-6 text-center text-body text-ink-2 shadow-card">{t("store.empty")}</p>
      ) : (
        <section aria-label={t("store.products")} className="flex flex-col gap-3">
          {/* Doc 06: category chips stay at the top while scrolling. */}
          {categories.length > 1 && (
            <div className="sticky top-0 z-10 -mb-1 flex gap-2 overflow-x-auto border-b border-separator bg-chrome px-4 py-3 backdrop-blur-xl [scrollbar-width:none]">
              <Chip selected={category === null} onClick={() => setCategory(null)}>
                {t("stock.all")}
              </Chip>
              {categories.map((c) => (
                <Chip key={c} selected={category === c} onClick={() => setCategory(category === c ? null : c)}>
                  {c}
                </Chip>
              ))}
            </div>
          )}
          <ul className="mx-4 overflow-hidden rounded-md bg-surface shadow-card">
            {shown.map((p) => {
              const on = ticked.has(p.id);
              return (
                <li key={p.id} className="flex items-center gap-3 border-separator px-4 py-3 not-first:border-t">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className={cn("text-body", !p.inStock && "text-ink-2")}>
                      {p.name}
                      {p.unit && <span className="text-ink-2"> · {p.unit}</span>}
                    </span>
                    {/* Prices only if the owner set them; never a stock count. */}
                    <span className="flex items-center gap-2 text-footnote">
                      {p.pricePaise ? <span className="font-semibold tabular-nums">{formatRupees(p.pricePaise)}</span> : null}
                      {p.inStock ? (
                        <span className="text-success">{t("status.inStock")}</span>
                      ) : (
                        <Badge>{t("status.outOfStock")}</Badge>
                      )}
                    </span>
                  </div>
                  {whatsapp && p.inStock && (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      aria-label={t("store.tick", { name: p.name })}
                      onClick={() => toggle(p.id)}
                      className="grid size-12 shrink-0 place-items-center"
                    >
                      <span
                        className={cn(
                          "grid size-7 place-items-center rounded-full border-2",
                          on ? "border-accent-fill bg-accent-fill text-on-accent" : "border-ink-3",
                        )}
                      >
                        {on && <Check aria-hidden className="size-4" strokeWidth={3} />}
                      </span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <footer className="mt-auto flex flex-col gap-4 px-4 pt-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Link href={`/r/${shop.slug}`} className="flex items-center gap-3 rounded-lg bg-surface p-4 shadow-card active:bg-fill">
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-fill text-on-accent">
            <Mic className="size-6" />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="text-body font-semibold">{t("store.review")}</span>
            <span className="text-footnote text-ink-2">{t("store.reviewBody")}</span>
          </span>
          <ChevronRight aria-hidden className="size-5 text-ink-3" />
        </Link>
        <p className="flex items-center justify-center gap-2 text-footnote text-ink-2">
          <Link href="/" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            {t("store.madeWith")}
          </Link>
          <span aria-hidden>·</span>
          <Link href={`/privacy?lang=${lang}#customers`} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            {t("privacy.link")}
          </Link>
        </p>
      </footer>
    </main>
  );
}

"use client";

import { CircleAlert, Info, SearchX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/feedback";
import { ProductThumb } from "@/components/ui/product-thumb";
import { SearchField } from "@/components/ui/field";
import { AddToggle, PriceInput, paiseText, rupeesInput } from "@/components/ui/quantity";
import { useToast } from "@/components/ui/toast";
import type { MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { api } from "@/lib/api";
import { productPhoto } from "@/lib/catalog/photo-url";
import { haveKey, SHOP_TYPES, STARTER_ITEMS, starterFor, type ShopType, type StarterItem } from "@/lib/catalog/starter";
import { errorKey } from "@/lib/errors";
import { ProductName } from "@/i18n/products";

// Pick the shop type, tick what the shop sells (ADD,
// as on Instamart), fix any price, add them all in one go. Ticks and prices
// survive switching type, so a kirana can also take from the pan list.
export function ListPicker({ initialType, have }: { initialType: ShopType; have: string[] }) {
  const { t } = useLang();
  const router = useRouter();
  const toast = useToast();
  const owned = useMemo(() => new Set(have), [have]);
  const [type, setType] = useState(initialType);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  const items = useMemo(() => starterFor(type), [type]);
  const byKey = useMemo(() => new Map(STARTER_ITEMS.map((i) => [i.key, i])), []);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q) || i.aliases.some((a) => a.toLowerCase().includes(q))) : items;
  }, [items, query]);
  const groups = useMemo(() => {
    const map = new Map<string, StarterItem[]>();
    for (const item of shown) map.set(item.category, [...(map.get(item.category) ?? []), item]);
    return [...map.entries()];
  }, [shown]);

  const priceOf = (item: StarterItem) => prices[item.key] ?? paiseText(item.pricePaise);
  const isOwned = (item: StarterItem) => owned.has(haveKey(item.name, item.unit));
  const toggle = (key: string, on?: boolean) =>
    setPicked((set) => {
      const next = new Set(set);
      if (on ?? !next.has(key)) next.add(key);
      else next.delete(key);
      return next;
    });

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const products = [...picked].map((key) => {
        const item = byKey.get(key)!;
        return { name: item.name, unit: item.unit, category: item.category, aliases: item.aliases, price_paise: rupeesInput(priceOf(item)) };
      });
      const result = await api<{ added: number; skipped: number }>("/api/v1/products/bulk", { json: { products } });
      toast.show({
        message: result.skipped ? t("list.savedSkipped", { n: result.added, skipped: result.skipped }) : t("list.saved", { n: result.added }),
      });
      router.replace("/app/stock");
      router.refresh();
    } catch (failure) {
      setError(errorKey(failure));
      setBusy(false);
    }
  }

  const count = picked.size;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-48">
      <header className="flex flex-col gap-3 px-4 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <h1 className="font-display text-large-title font-bold tracking-tight">{t("add.list.title")}</h1>
        <div role="group" aria-label={t("type.label")} className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1">
          {SHOP_TYPES.map((option) => (
            <Chip key={option} selected={option === type} onClick={() => setType(option)}>
              {t(`type.${option}` as MessageKey)}
            </Chip>
          ))}
        </div>
        <SearchField label={t("search.placeholder")} clearLabel={t("search.clear")} value={query} onValueChange={setQuery} />
        <p className="flex gap-2 rounded-md bg-check-soft px-3 py-2.5 text-footnote text-check">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t("list.checkPrices")}
        </p>
      </header>

      {groups.length === 0 ? (
        <div className="px-4">
          <EmptyState icon={<SearchX />} title={t("list.empty")} />
        </div>
      ) : (
        groups.map(([category, group]) => {
          const addable = group.filter((i) => !isOwned(i));
          const allIn = addable.length > 0 && addable.every((i) => picked.has(i.key));
          return (
            <section key={category} aria-labelledby={`cat-${category}`} className="flex flex-col gap-1.5 px-4">
              <div className="flex items-center justify-between gap-2 px-1">
                <h2 id={`cat-${category}`} className="text-footnote font-semibold text-ink-2">
                  {category}
                </h2>
                {addable.length > 1 && !allIn && (
                  <button
                    type="button"
                    onClick={() => addable.forEach((i) => toggle(i.key, true))}
                    className="min-h-10 px-1 text-footnote font-semibold text-accent"
                  >
                    {t("list.selectAll", { n: addable.length })}
                  </button>
                )}
              </div>
              <ul className="overflow-hidden rounded-md bg-surface shadow-card">
                {group.map((item) => {
                  const ownedHere = isOwned(item);
                  const price = priceOf(item);
                  return (
                    <li key={item.key} className="flex items-center gap-3 border-separator py-2.5 pr-3 pl-4 not-first:border-t">
                      {/* The checked packshot, so the owner ticks the right pack. */}
                      <ProductThumb name={item.name} category={item.category} imageUrl={productPhoto(item, "")?.url} size="sm" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-body text-ink"><ProductName name={item.name} /></span>
                        <span className="text-footnote text-ink-2">{ownedHere ? `${item.unit} · ${t("list.have")}` : item.unit}</span>
                      </div>
                      {!ownedHere && (
                        <>
                          <PriceInput
                            className="w-20"
                            aria-label={t("list.price", { name: `${item.name} ${item.unit}` })}
                            aria-invalid={price !== "" && rupeesInput(price) === null ? true : undefined}
                            value={price}
                            onChange={(event) => {
                              setPrices({ ...prices, [item.key]: event.target.value });
                              toggle(item.key, true);
                            }}
                          />
                          <AddToggle
                            added={picked.has(item.key)}
                            onToggle={() => toggle(item.key)}
                            name={`${item.name} ${item.unit}`}
                            addText={t("list.add")}
                            addedText={t("list.added")}
                          />
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-chrome backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t(error)}
            </p>
          )}
          <p className="text-center text-footnote text-ink-2">{t("list.later")}</p>
          <Button size="lg" loading={busy} disabled={count === 0} onClick={save}>
            {count === 0 ? t("list.save0") : count === 1 ? t("list.save1") : t("list.saveN", { n: count })}
          </Button>
          <Button variant="plain" onClick={() => router.back()}>
            {t("action.cancel")}
          </Button>
        </div>
      </div>
    </main>
  );
}

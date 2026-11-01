"use client";

import { ChevronRight, CircleAlert, MapPin, Phone, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";

import { LogoMark } from "@/components/brand/logo";
import { VoiceBars } from "@/components/shell/mic-button";
import { OpenBadge } from "@/components/shell/open-badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge, Chip, Segmented } from "@/components/ui/controls";
import { TextField } from "@/components/ui/field";
import { Sheet } from "@/components/ui/overlay";
import { Stepper } from "@/components/ui/quantity";
import type { MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { api } from "@/lib/api";
import { cartSnapshot, parseCart, rememberOrder, setCart, subscribeCart } from "@/lib/cart";
import { formatRupees } from "@/lib/changes-view";
import { cn } from "@/lib/cn";
import { errorKey } from "@/lib/errors";
import { useTurnstile } from "@/lib/turnstile";
import type { Storefront, StorefrontProduct } from "@/server/storefront";

const serverCart = () => "{}";

export function StorefrontView({ shop, siteKey }: { shop: Storefront; siteKey: string }) {
  const { lang, t } = useLang();
  const [category, setCategory] = useState<string | null>(null);
  const [checkout, setCheckout] = useState(false);
  const raw = useSyncExternalStore(subscribeCart, () => cartSnapshot(shop.slug), serverCart);
  const cart = useMemo(() => parseCart(raw), [raw]);

  const other = t("stock.other");
  const categories = [...new Set(shop.products.map((p) => p.category ?? other))].sort();
  const shown = shop.products.filter((p) => category === null || (p.category ?? other) === category);
  const phoneDigits = shop.phone?.replace(/\D/g, "") ?? null;

  // Only products still in stock count; a cart can outlive a stock change.
  const lines = shop.products.filter((p) => p.inStock && cart[p.id]).map((p) => ({ product: p, qty: cart[p.id] }));
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const total = lines.reduce((sum, l) => sum + (l.product.pricePaise ?? 0) * l.qty, 0);

  const setQty = (id: string, qty: number) => setCart(shop.slug, { ...cart, [id]: qty });

  // Doc 06: WhatsApp still works, now with quantities: the cart as a message.
  const message = [t("store.waHello", { shop: shop.name }), ...lines.map((l) => `• ${l.product.name}${l.product.unit ? ` (${l.product.unit})` : ""} × ${l.qty}`)].join("\n");
  const whatsapp = phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}` : null;

  return (
    <main className={cn("mx-auto flex min-h-dvh w-full max-w-2xl flex-col", count > 0 && "pb-24")}>
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
            <a href={whatsapp!} target="_blank" rel="noopener" className={buttonClass("tinted", "md", "text-center leading-tight")}>
              {t("store.whatsapp")}
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
            {shown.map((p) => (
              <ProductRow key={p.id} product={p} qty={cart[p.id] ?? 0} onQty={(qty) => setQty(p.id, qty)} />
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-auto flex flex-col gap-4 px-4 pt-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Link href={`/r/${shop.slug}`} className="flex items-center gap-3 rounded-lg bg-surface p-4 shadow-card active:bg-fill">
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-voice text-on-voice">
            <VoiceBars className="size-6" />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="text-body font-semibold">{t("store.review")}</span>
            <span className="text-footnote text-ink-2">{t("store.reviewBody")}</span>
          </span>
          <ChevronRight aria-hidden className="size-5 text-ink-3" />
        </Link>
        <p className="flex items-center justify-center gap-2 text-footnote text-ink-2">
          <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 underline-offset-4 hover:underline">
            <LogoMark orbit={false} className="h-4 w-auto text-ink-2" />
            {t("store.madeWith")}
          </Link>
          <span aria-hidden>·</span>
          <Link href={`/privacy?lang=${lang}#customers`} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            {t("privacy.link")}
          </Link>
        </p>
      </footer>

      {/* The cart bar, as on Instamart: what's in it and the way to order. */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setCheckout(true)}
            className="mx-auto flex min-h-14 w-full max-w-2xl items-center gap-3 rounded-lg bg-accent-fill px-4 text-left text-on-accent shadow-float active:scale-[0.99]"
          >
            <ShoppingBag aria-hidden className="size-6 shrink-0" />
            <span className="flex flex-1 flex-col leading-tight">
              <span className="text-footnote">{count === 1 ? t("cart.item1") : t("cart.items", { n: count })}</span>
              {total > 0 && <span className="text-body font-semibold tabular-nums">{t("cart.total", { total: formatRupees(total) })}</span>}
            </span>
            <span className="text-body font-semibold">{t("cart.view")}</span>
            <ChevronRight aria-hidden className="size-5 shrink-0" />
          </button>
        </div>
      )}

      {checkout && (
        <CheckoutSheet
          shop={shop}
          siteKey={siteKey}
          lines={lines}
          total={total}
          whatsapp={whatsapp}
          onQty={setQty}
          onClose={() => setCheckout(false)}
          onPlaced={() => setCart(shop.slug, {})}
        />
      )}
    </main>
  );
}

// One product, with ADD and then − n +, as on Instamart. Out-of-stock items
// can't be added; prices only if the owner set them; never a stock count.
function ProductRow({ product: p, qty, onQty }: { product: StorefrontProduct; qty: number; onQty: (qty: number) => void }) {
  const { t } = useLang();
  return (
    <li className="flex items-center gap-3 border-separator px-4 py-3 not-first:border-t">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn("text-body", !p.inStock && "text-ink-2")}>
          {p.name}
          {p.unit && <span className="text-ink-2"> · {p.unit}</span>}
        </span>
        <span className="flex items-center gap-2 text-footnote">
          {p.pricePaise ? <span className="font-semibold tabular-nums">{formatRupees(p.pricePaise)}</span> : null}
          {p.inStock ? <span className="text-success">{t("status.inStock")}</span> : <Badge>{t("status.outOfStock")}</Badge>}
        </span>
      </div>
      {p.inStock &&
        (qty === 0 ? (
          <button
            type="button"
            onClick={() => onQty(1)}
            className="inline-flex h-11 min-w-24 shrink-0 items-center justify-center rounded-md border border-fill-strong bg-surface px-3 text-footnote font-bold tracking-wide text-ink uppercase active:scale-[0.98]"
          >
            {t("list.add")}
            <span className="sr-only"> {p.name}</span>
          </button>
        ) : (
          <Stepper
            value={qty}
            min={1}
            max={99}
            clearable
            onChange={(next) => onQty(next ?? 0)}
            lessLabel={t("stock.less", { name: p.name })}
            moreLabel={t("stock.more", { name: p.name })}
          />
        ))}
    </li>
  );
}

type Line = { product: StorefrontProduct; qty: number };

// Checkout (V-04): the cart, pickup or delivery, name and number, then Place
// order. No account and no payment: the customer pays the shop.
function CheckoutSheet({
  shop,
  siteKey,
  lines,
  total,
  whatsapp,
  onQty,
  onClose,
  onPlaced,
}: {
  shop: Storefront;
  siteKey: string;
  lines: Line[];
  total: number;
  whatsapp: string | null;
  onQty: (id: string, qty: number) => void;
  onClose: () => void;
  onPlaced: () => void;
}) {
  const { t } = useLang();
  const router = useRouter();
  const { containerRef, token: turnstileToken } = useTurnstile(siteKey);
  const [fulfilment, setFulfilment] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [form, setForm] = useState({ name: "", phone: "", address: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const set = (field: keyof typeof form) => (event: { target: { value: string } }) => setForm({ ...form, [field]: event.target.value });

  const ready = lines.length > 0 && form.name.trim() && form.phone.trim() && (fulfilment === "PICKUP" || form.address.trim());

  async function place() {
    setBusy(true);
    setError(null);
    try {
      const token = await turnstileToken();
      const placed = await api<{ id: string; code: string; token: string }>(`/api/v1/public/shops/${shop.slug}/orders`, {
        json: {
          turnstileToken: token,
          order: {
            name: form.name.trim(),
            phone: form.phone.trim(),
            fulfilment,
            address: fulfilment === "DELIVERY" ? form.address.trim() : null,
            note: form.note.trim() || null,
            items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
          },
        },
      });
      rememberOrder({ id: placed.id, token: placed.token, code: placed.code, shop: shop.name, slug: shop.slug, at: new Date().toISOString() });
      onPlaced();
      router.push(`/o/${placed.id}?t=${placed.token}`);
    } catch (failure) {
      setError(errorKey(failure) === "error.generic" ? "cart.error.check" : errorKey(failure));
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("cart.title")}
      doneLabel={t("action.cancel")}
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t(error)}
            </p>
          )}
          <Button size="lg" loading={busy} disabled={!ready} onClick={place}>
            {t("cart.place")}
            {total > 0 && <span className="font-normal tabular-nums"> · {formatRupees(total)}</span>}
          </Button>
          {whatsapp && (
            <a href={whatsapp} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center justify-center text-footnote font-semibold text-accent">
              {t("cart.orWhatsapp")}
            </a>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <ul aria-label={t("cart.title")} className="overflow-hidden rounded-md bg-surface shadow-card">
          {lines.map(({ product, qty }) => (
            <li key={product.id} className="flex items-center gap-3 border-separator px-4 py-2.5 not-first:border-t">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-body">{product.name}</span>
                <span className="text-footnote text-ink-2 tabular-nums">
                  {product.pricePaise ? formatRupees(product.pricePaise * qty) : t("cart.priceAtShop")}
                  {product.unit && ` · ${product.unit}`}
                </span>
              </div>
              <Stepper
                value={qty}
                min={1}
                max={99}
                clearable
                onChange={(next) => onQty(product.id, next ?? 0)}
                lessLabel={t("stock.less", { name: product.name })}
                moreLabel={t("stock.more", { name: product.name })}
              />
            </li>
          ))}
        </ul>
        <p className="-mt-3 px-1 text-footnote text-ink-2">{t("cart.pay")}</p>

        <div className="flex flex-col gap-2">
          <span className="px-1 text-footnote font-medium text-ink-2">
            {t("cart.how")}
          </span>
          {shop.delivers ? (
            <Segmented<"PICKUP" | "DELIVERY">
              label={t("cart.how")}
              value={fulfilment}
              onValueChange={setFulfilment}
              options={[
                { value: "PICKUP", label: t("cart.pickup") },
                { value: "DELIVERY", label: t("cart.delivery") },
              ]}
            />
          ) : (
            <p className="rounded-md bg-fill px-4 py-3 text-footnote text-ink">{t("cart.noDelivery")}</p>
          )}
        </div>

        <TextField label={t("cart.name")} value={form.name} onChange={set("name")} autoComplete="name" maxLength={60} />
        <TextField label={t("cart.phone")} value={form.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" maxLength={20} />
        {fulfilment === "DELIVERY" && <TextField label={t("cart.address")} value={form.address} onChange={set("address")} autoComplete="street-address" maxLength={300} />}
        <TextField label={t("cart.note")} value={form.note} onChange={set("note")} maxLength={300} />
        <p className="px-1 text-footnote text-ink-2">{t("cart.privacy", { shop: shop.name })}</p>
        {/* Turnstile shows itself here only if Cloudflare needs a tap. */}
        <div ref={containerRef} />
      </div>
    </Sheet>
  );
}


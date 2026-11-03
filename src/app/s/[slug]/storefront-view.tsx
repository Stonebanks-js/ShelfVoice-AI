"use client";

import { ChevronRight, CircleAlert, Heart, MapPin, Phone, ShoppingBag, Truck, UserRound, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { LogoMark } from "@/components/brand/logo";
import { VoiceBars } from "@/components/shell/mic-button";
import { OpenBadge } from "@/components/shell/open-badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge, Chip, Segmented } from "@/components/ui/controls";
import { TextField } from "@/components/ui/field";
import { Sheet } from "@/components/ui/overlay";
import { ProductThumb } from "@/components/ui/product-thumb";
import { Stepper } from "@/components/ui/quantity";
import type { MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { api } from "@/lib/api";
import { cartSnapshot, parseCart, rememberOrder, setCart, subscribeCart } from "@/lib/cart";
import { formatRupees } from "@/lib/changes-view";
import { cn } from "@/lib/cn";
import { deliveryFee } from "@/lib/delivery";
import { errorKey } from "@/lib/errors";
import { useTurnstile } from "@/lib/turnstile";
import type { Account } from "@/server/customer";
import type { Storefront, StorefrontProduct } from "@/server/storefront";

const serverCart = () => "{}";

// The signed-in customer's account, or null when signed out (V-05). The shop
// page itself is cached for everyone, so this is read in the browser.
function useAccount() {
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    api<Account>("/api/v1/me")
      .then((a) => live && setAccount(a))
      .catch(() => live && setAccount(null));
    return () => {
      live = false;
    };
  }, []);
  return [account, setAccount] as const;
}

export function StorefrontView({ shop, siteKey }: { shop: Storefront; siteKey: string }) {
  const { lang, t } = useLang();
  const router = useRouter();
  const [category, setCategory] = useState<string | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [account, setAccount] = useAccount();
  const signIn = `/me?next=${encodeURIComponent(`/s/${shop.slug}`)}`;
  const wished = new Set(account?.wishlist.map((w) => w.productId));
  const favourite = Boolean(account?.favourites.some((f) => f.slug === shop.slug));

  // Hearts save to the account; signed out, they lead to sign-in first.
  async function wish(product: StorefrontProduct) {
    if (account === undefined) return; // still checking who is signed in
    if (account === null) return router.push(signIn);
    const on = !wished.has(product.id);
    const item = { productId: product.id, name: product.name, unit: product.unit, pricePaise: product.pricePaise, inStock: product.inStock, shop: shop.name, slug: shop.slug };
    setAccount({ ...account, wishlist: on ? [item, ...account.wishlist] : account.wishlist.filter((w) => w.productId !== product.id) });
    await api(`/api/v1/me/wishlist/${product.id}`, { method: on ? "PUT" : "DELETE" }).catch(() => setAccount(account));
  }
  async function favouriteShop() {
    if (account === undefined) return;
    if (account === null) return router.push(signIn);
    const on = !favourite;
    setAccount({ ...account, favourites: on ? [{ shopId: "", name: shop.name, slug: shop.slug, category: shop.category }, ...account.favourites] : account.favourites.filter((f) => f.slug !== shop.slug) });
    await api(`/api/v1/me/favourites/${shop.slug}`, { method: on ? "PUT" : "DELETE" }).catch(() => setAccount(account));
  }

  const modes = [shop.acceptsCash && t("pay.CASH"), shop.upiId && t("pay.UPI"), shop.delivers && shop.payOnDelivery && t("pay.cod")].filter(Boolean).join(" · ");
  const rules = shop.delivery;
  const deliveryNote = shop.delivers
    ? [
        rules.radiusKm ? t("deliv.within", { km: rules.radiusKm }) : t("cart.delivery"),
        rules.feePaise ? t("deliv.fee", { fee: formatRupees(rules.feePaise) }) : t("deliv.free"),
        rules.feePaise && rules.freeAbovePaise ? t("deliv.freeAbove", { amount: formatRupees(rules.freeAbovePaise) }) : null,
        rules.minPaise ? t("deliv.min", { amount: formatRupees(rules.minPaise) }) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
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
    // E-37: the signboard as a card, then the shelf as a grid of product
    // cards (two across on a phone, up to five on a desktop), as in the big
    // quick-commerce apps.
    <main className={cn("mx-auto flex min-h-dvh w-full max-w-2xl flex-col md:max-w-4xl lg:max-w-6xl lg:px-4", count > 0 && "pb-24")}>
      {/* The signboard: shop name, open now, where, and two ways to reach it. */}
      <header className="flex flex-col gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <div className="flex justify-end">
          <Link href="/me" className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-footnote font-semibold text-accent">
            <UserRound aria-hidden className="size-5" />
            {t("store.account")}
          </Link>
        </div>
        <div className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-card lg:flex-row lg:items-start lg:gap-6 lg:p-6">
          <div className="flex items-start gap-3 lg:min-w-0 lg:flex-1">
            <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-lg bg-accent-soft font-display text-large-title font-bold text-accent-fill lg:size-16">
              {shop.name.trim().charAt(0).toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h1 className="font-display text-title font-bold tracking-tight lg:text-large-title">{shop.name}</h1>
              {shop.category && <p className="text-footnote text-ink-2">{shop.category}</p>}
              <div className="pt-1">
                <OpenBadge hours={shop.hours} timeZone={shop.timezone} />
              </div>
            </div>
            <HeartButton on={favourite} label={t("store.favourite")} onClick={favouriteShop} disabled={account === undefined} />
          </div>
          <div className="flex flex-col gap-3 lg:w-[26rem] lg:shrink-0">
        {shop.address && (
          <p className="flex items-start gap-2 text-body text-ink-2">
            <MapPin aria-hidden className="mt-0.5 size-5 shrink-0" />
            {shop.address}
          </p>
        )}
        {shop.description && <p className="text-body">{shop.description}</p>}
        {deliveryNote && (
          <p className="flex items-start gap-2 text-footnote text-ink-2">
            <Truck aria-hidden className="mt-0.5 size-4 shrink-0" />
            {deliveryNote}
          </p>
        )}
        {modes && (
          <p className="flex items-start gap-2 text-footnote text-ink-2">
            <Wallet aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t("store.payModes", { modes })}
          </p>
        )}
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
          </div>
        </div>
      </header>

      {shop.products.length === 0 ? (
        <p className="mx-4 rounded-lg bg-surface p-6 text-center text-body text-ink-2 shadow-card">{t("store.empty")}</p>
      ) : (
        <section aria-label={t("store.products")} className="flex flex-col gap-3">
          {/* Doc 06: category chips stay at the top while scrolling. */}
          {categories.length > 1 && (
            <div className="sticky top-0 z-10 -mb-1 flex gap-2 overflow-x-auto bg-chrome px-4 py-3 backdrop-blur-xl [scrollbar-width:none] lg:rounded-b-lg">
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
          <ul className="mx-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {shown.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                qty={cart[p.id] ?? 0}
                onQty={(qty) => setQty(p.id, qty)}
                wished={wished.has(p.id)}
                onWish={() => wish(p)}
                wishReady={account !== undefined}
              />
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
            className="mx-auto flex min-h-14 w-full max-w-lg animate-rise-in items-center gap-3 rounded-xl bg-accent-fill px-4 text-left text-on-accent shadow-float active:scale-[0.99]"
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
          account={account ?? null}
          onQty={setQty}
          onClose={() => setCheckout(false)}
          onPlaced={() => setCart(shop.slug, {})}
        />
      )}
    </main>
  );
}

// One product as a card, with ADD and then the stepper, as on Instamart
// (E-37: its face on top, the heart on the picture, the price in the display
// face). Out-of-stock items cannot be added; prices only if the owner set
// them; never a stock count.
function ProductCard({
  product: p,
  qty,
  onQty,
  wished,
  onWish,
  wishReady,
}: {
  product: StorefrontProduct;
  qty: number;
  onQty: (qty: number) => void;
  wished: boolean;
  onWish: () => void;
  wishReady: boolean;
}) {
  const { t } = useLang();
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-xl bg-surface p-2.5 shadow-card">
      <div className="relative">
        <ProductThumb name={p.name} category={p.category} size="lg" className={cn(!p.inStock && "opacity-45 grayscale")} />
        <div className="absolute top-1 right-1 rounded-full bg-surface/90">
          <HeartButton on={wished} label={t("store.wish", { name: p.name })} onClick={onWish} small disabled={!wishReady} />
        </div>
        {!p.inStock && (
          <span className="absolute bottom-2 left-2">
            <Badge>{t("status.outOfStock")}</Badge>
          </span>
        )}
      </div>
      <span className={cn("line-clamp-2 min-h-10 text-footnote font-medium", !p.inStock && "text-ink-2")}>
        {p.name}
        {p.unit && <span className="font-normal text-ink-2"> · {p.unit}</span>}
      </span>
      <span className="flex min-h-6 items-center gap-2">
        {p.pricePaise ? <span className="font-display text-body font-bold tabular-nums">{formatRupees(p.pricePaise)}</span> : null}
        {p.inStock && <span className="sr-only">{t("status.inStock")}</span>}
      </span>
      {p.inStock &&
        (qty === 0 ? (
          <button
            type="button"
            onClick={() => onQty(1)}
            className="inline-flex h-11 w-full items-center justify-center rounded-md border-2 border-voice bg-surface px-3 text-footnote font-bold tracking-wide text-voice uppercase transition-[background-color,transform] active:scale-[0.97] [@media(hover:hover)]:hover:bg-accent-soft"
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
            filled
            className="w-full"
            onChange={(next) => onQty(next ?? 0)}
            lessLabel={t("stock.less", { name: p.name })}
            moreLabel={t("stock.more", { name: p.name })}
          />
        ))}
    </li>
  );
}

// Disabled for the moment it takes to learn who is signed in.
function HeartButton({ on, label, onClick, small = false, disabled = false }: { on: boolean; label: string; onClick: () => void; small?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn("grid shrink-0 place-items-center rounded-full active:bg-fill disabled:opacity-40", small ? "size-11" : "size-12")}
    >
      <Heart aria-hidden className={cn(small ? "size-5" : "size-6", on ? "fill-voice text-voice" : "text-ink-2")} />
    </button>
  );
}

type Line = { product: StorefrontProduct; qty: number };

// Checkout (V-04, V-05): the cart, pickup or delivery, name and number, then
// Place order. A signed-in customer's details and saved addresses fill in;
// the shop's delivery rules apply (minimum, charge, distance). No payment
// here: the customer pays the shop, in cash or by UPI.
function CheckoutSheet({
  shop,
  siteKey,
  lines,
  total,
  whatsapp,
  account,
  onQty,
  onClose,
  onPlaced,
}: {
  shop: Storefront;
  siteKey: string;
  lines: Line[];
  total: number;
  whatsapp: string | null;
  account: Account | null;
  onQty: (id: string, qty: number) => void;
  onClose: () => void;
  onPlaced: () => void;
}) {
  const { t } = useLang();
  const router = useRouter();
  const { containerRef, token: turnstileToken } = useTurnstile(siteKey);
  const saved = account?.addresses ?? [];
  const [fulfilment, setFulfilment] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [form, setForm] = useState({ name: account?.profile?.name ?? "", phone: account?.profile?.phone?.replace(/^\+91/, "") ?? "", address: "", note: "" });
  // A saved address by id, or "new" for one typed here.
  const [addressId, setAddressId] = useState<string>(saved.find((a) => a.is_default)?.id ?? saved[0]?.id ?? "new");
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const set = (field: keyof typeof form) => (event: { target: { value: string } }) => setForm({ ...form, [field]: event.target.value });

  const chosen = saved.find((a) => a.id === addressId) ?? null;
  const delivering = fulfilment === "DELIVERY";
  const address = delivering ? (chosen?.address ?? form.address).trim() : "";
  const point = chosen && chosen.lat !== null && chosen.lng !== null ? { lat: chosen.lat, lng: chosen.lng } : here;
  const fee = delivering ? deliveryFee(shop.delivery, total) : 0;
  const needsPoint = delivering && Boolean(shop.delivery.radiusKm) && !point;
  const ready = lines.length > 0 && form.name.trim() && form.phone.trim() && (!delivering || (address && fee !== "BELOW_MINIMUM" && !needsPoint));

  function locate() {
    setError(null);
    if (!navigator.geolocation) return setError("cart.error.location");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setHere({ lat: Math.round(position.coords.latitude * 10_000) / 10_000, lng: Math.round(position.coords.longitude * 10_000) / 10_000 });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError("cart.error.location");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

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
            address: delivering ? address : null,
            note: form.note.trim() || null,
            ...(delivering && point ? point : {}),
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

  const grand = total + (typeof fee === "number" ? fee : 0);
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
            {grand > 0 && <span className="font-normal tabular-nums"> · {formatRupees(grand)}</span>}
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

        <div className="flex flex-col gap-2">
          <span className="px-1 text-footnote font-medium text-ink-2">{t("cart.how")}</span>
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

        {delivering && (
          <div className="flex flex-col gap-2">
            {saved.length > 0 && (
              <div role="radiogroup" aria-label={t("cart.deliverTo")} className="flex flex-col gap-2">
                <span className="px-1 text-footnote font-medium text-ink-2">{t("cart.deliverTo")}</span>
                {[...saved.map((a) => ({ id: a.id, title: a.label, body: a.address })), { id: "new", title: t("cart.newAddress"), body: "" }].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={addressId === option.id}
                    onClick={() => setAddressId(option.id)}
                    className={cn("flex min-h-12 flex-col justify-center rounded-md bg-surface px-4 py-2 text-left shadow-card", addressId === option.id && "ring-2 ring-accent")}
                  >
                    <span className="text-body font-semibold">{option.title}</span>
                    {option.body && <span className="text-footnote text-ink-2">{option.body}</span>}
                  </button>
                ))}
              </div>
            )}
            {addressId === "new" && <TextField label={t("cart.address")} value={form.address} onChange={set("address")} autoComplete="street-address" maxLength={300} />}
            {shop.delivery.radiusKm && !(chosen && chosen.lat !== null) && (
              <>
                <p className="px-1 text-footnote text-ink-2">{t("cart.shareLocation")}</p>
                <Button variant={here ? "gray" : "tinted"} loading={locating} icon={<MapPin aria-hidden className="size-5" />} onClick={locate}>
                  {here ? t("setup.where.located") : t("shops.locate")}
                </Button>
              </>
            )}
          </div>
        )}

        <TextField label={t("cart.note")} value={form.note} onChange={set("note")} maxLength={300} />

        <div className="flex flex-col gap-1 px-1 text-body tabular-nums">
          <p className="flex justify-between text-footnote text-ink-2">
            <span>{t("cart.subtotal")}</span>
            <span>{formatRupees(total)}</span>
          </p>
          {delivering && typeof fee === "number" && (
            <p className="flex justify-between text-footnote text-ink-2">
              <span>{t("cart.deliveryFee")}</span>
              <span>{fee ? formatRupees(fee) : t("deliv.free")}</span>
            </p>
          )}
          {fee === "BELOW_MINIMUM" ? (
            <p role="status" className="text-footnote font-semibold text-danger">
              {t("cart.belowMin", { amount: formatRupees(shop.delivery.minPaise! - total) })}
            </p>
          ) : (
            <p className="flex justify-between font-semibold">
              <span>{t("cart.totalLine")}</span>
              <span>{formatRupees(grand)}</span>
            </p>
          )}
        </div>
        <p className="-mt-3 px-1 text-footnote text-ink-2">{t("cart.pay")}</p>
        <p className="px-1 text-footnote text-ink-2">{t("cart.privacy", { shop: shop.name })}</p>
        {/* Turnstile shows itself here only if Cloudflare needs a tap. */}
        <div ref={containerRef} />
      </div>
    </Sheet>
  );
}

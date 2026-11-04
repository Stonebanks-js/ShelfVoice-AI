"use client";

import { Check, ChevronLeft, CircleAlert, Heart, Home, LogOut, MapPin, Pencil, Plus, RotateCcw, ShieldCheck, Store, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { GoogleMark } from "@/components/brand/google-mark";
import { buttonClass, Button } from "@/components/ui/button";
import { Badge, Segmented, Switch } from "@/components/ui/controls";
import { TextField } from "@/components/ui/field";
import { ListGroup, ListRow } from "@/components/ui/list";
import { AlertDialog, Sheet } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { localeFor, type MessageKey } from "@/i18n/dictionary";
import { InstallAppRow } from "@/components/shell/app-install";
import { LanguagePicker } from "@/components/shell/language-picker";
import { useLang } from "@/i18n/lang";
import { api } from "@/lib/api";
import { setCart } from "@/lib/cart";
import { formatPhone, formatRupees } from "@/lib/changes-view";
import { errorKey } from "@/lib/errors";
import { placeFor } from "@/lib/place";
import type { Account } from "@/server/customer";
import { CurrentOrders } from "@/components/shell/current-orders";


function Header({ title }: { title: string }) {
  const { t } = useLang();
  return (
    <>
      <Link href="/shops" className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start px-2 text-body font-semibold text-accent">
        <ChevronLeft aria-hidden className="size-5" />
        {t("shops.title")}
      </Link>
      <h1 className="font-display text-large-title font-bold tracking-tight">{title}</h1>
    </>
  );
}

// Signed out: what an account gives, and Continue with Google.
export function SignInToAccount({ next }: { next: string }) {
  const { lang, t } = useLang();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:my-16 lg:min-h-0 lg:rounded-xl lg:bg-surface lg:p-10 lg:shadow-float">
      <Header title={t("acct.title")} />
      <CurrentOrders />
      <section className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-card">
        <UserRound aria-hidden className="size-8" />
        <h2 className="text-headline font-semibold">{t("acct.signin.title")}</h2>
        <p className="text-body text-ink-2">{t("acct.signin.body")}</p>
      </section>
      <a href={`/api/v1/auth/google?next=${encodeURIComponent(next)}`} className={buttonClass("ink", "lg", "mt-auto")}>
        <GoogleMark />
        {t("signin.google")}
      </a>
      <Link href={`/privacy?lang=${lang}#customers`} className="inline-flex min-h-11 items-center self-center text-footnote text-ink-2 underline-offset-4 hover:underline">
        {t("privacy.link")}
      </Link>
    </main>
  );
}

type Address = Account["addresses"][number];

export function AccountScreen({ account }: { account: Account }) {
  const { lang, t } = useLang();
  const router = useRouter();
  const toast = useToast();
  const [sheet, setSheet] = useState<"profile" | Address | "new" | null>(null);
  const [payWith, setPayWith] = useState(account.profile?.pay_with ?? "CASH");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const refunds = account.orders.flatMap((o) => o.refunds.map((r) => ({ ...r, code: o.code, shop: o.shop })));
  const date = (iso: string) => new Intl.DateTimeFormat(localeFor(lang), { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));

  async function savePayWith(value: "CASH" | "UPI") {
    setPayWith(value);
    try {
      await api("/api/v1/me/profile", { method: "PUT", json: { name: account.profile?.name ?? null, phone: account.profile?.phone ?? null, pay_with: value } });
    } catch (failure) {
      toast.show({ message: t(errorKey(failure)) });
    }
  }

  // Order again: the same items, in the shop's cart, then to the shop.
  function orderAgain(order: Account["orders"][number]) {
    const cart: Record<string, number> = {};
    for (const item of order.items) if (item.productId && item.status !== "UNAVAILABLE") cart[item.productId] = item.qty;
    setCart(order.slug, cart);
    router.push(`/s/${order.slug}`);
  }

  async function remove(kind: "wishlist" | "favourites", id: string) {
    try {
      await api(`/api/v1/me/${kind}/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (failure) {
      toast.show({ message: t(errorKey(failure)) });
    }
  }

  async function signOut() {
    await api("/api/v1/auth/signout", { method: "POST" }).catch(() => undefined);
    router.replace("/");
    router.refresh();
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await api("/api/v1/me", { method: "DELETE" });
      await api("/api/v1/auth/signout", { method: "POST" }).catch(() => undefined);
      router.replace("/");
      router.refresh();
    } catch (failure) {
      setDeleting(false);
      setConfirmDelete(false);
      toast.show({ message: t(errorKey(failure)) });
    }
  }

  return (
    // Two columns of groups from 1024 px.
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:grid lg:max-w-6xl lg:grid-cols-2 lg:items-start lg:px-8">
      <div className="flex flex-col gap-1 lg:col-span-2">
        <Header title={t("acct.title")} />
        {account.email && <p className="text-footnote text-ink-2">{account.email}</p>}
      </div>
      <CurrentOrders className="lg:col-span-2" />

      <ListGroup header={t("acct.profile")}>
        <ListRow
          icon={<UserRound />}
          title={account.profile?.name ?? t("shop.notSet")}
          subtitle={account.profile?.phone ? formatPhone(account.profile.phone) : t("cart.phone")}
          value={<Pencil aria-hidden className="size-4" />}
          onClick={() => setSheet("profile")}
        />
        <li className="flex items-center gap-3 px-4 py-2.5">
          <span id="pay-with" className="flex-1 text-body">
            {t("acct.pay")}
          </span>
          <Segmented<"CASH" | "UPI">
            label={t("acct.pay")}
            value={payWith}
            onValueChange={savePayWith}
            className="w-40"
            options={[
              { value: "CASH", label: t("pay.CASH") },
              { value: "UPI", label: t("pay.UPI") },
            ]}
          />
        </li>
      </ListGroup>

      <ListGroup header={t("acct.addresses")}>
        {account.addresses.map((a) => (
          <ListRow
            key={a.id}
            icon={a.is_default ? <Home /> : <MapPin />}
            title={a.label}
            subtitle={a.address}
            wrap
            value={a.is_default ? <Badge>{t("acct.default")}</Badge> : undefined}
            onClick={() => setSheet(a)}
          />
        ))}
        {account.addresses.length < 10 && <ListRow icon={<Plus />} title={t("acct.addAddress")} onClick={() => setSheet("new")} />}
      </ListGroup>

      <Section title={t("acct.orders")} empty={account.orders.length === 0 ? t("acct.ordersNone") : null} emptyHref="/shops">
        {account.orders.map((o) => {
          const total = o.items.filter((i) => i.status !== "UNAVAILABLE").reduce((sum, i) => sum + (i.pricePaise ?? 0) * i.qty, 0) + o.deliveryFeePaise;
          return (
            <li key={o.id} className="flex flex-col gap-2 border-separator px-4 py-3 not-first:border-t">
              <Link href={`/o/${o.id}`} className="flex items-start justify-between gap-3">
                <span className="flex min-w-0 flex-col">
                  <span className="text-body font-semibold">{o.shop}</span>
                  <span className="text-footnote text-ink-2 tabular-nums">
                    {o.code} · {date(o.createdAt)} · {o.items.reduce((n, i) => n + i.qty, 0)} · {formatRupees(total)}
                  </span>
                </span>
                <Badge tone={o.status === "CANCELLED" ? "danger" : o.status === "COMPLETED" ? "success" : "check"}>{t(`orders.status.${o.status}` as MessageKey)}</Badge>
              </Link>
              {o.slug && o.items.some((i) => i.productId) && (
                <Button variant="tinted" icon={<RotateCcw aria-hidden className="size-4" />} onClick={() => orderAgain(o)} className="self-start">
                  {t("acct.orderAgain")}
                </Button>
              )}
            </li>
          );
        })}
      </Section>

      {refunds.length > 0 && (
        <Section title={t("acct.refunds")} empty={null}>
          {refunds.map((r, i) => (
            <ListRow key={i} icon={<RotateCcw />} iconTone="success" title={`${formatRupees(r.amountPaise)} · ${r.shop}`} subtitle={`${r.code} · ${r.reason}`} wrap />
          ))}
        </Section>
      )}

      <Section title={t("acct.wishlist")} empty={account.wishlist.length === 0 ? t("acct.wishlistNone") : null}>
        {account.wishlist.map((w) => (
          <li key={w.productId} className="flex items-center gap-2 border-separator py-1 pr-1 pl-4 not-first:border-t">
            <Link href={`/s/${w.slug}`} className="flex min-h-12 min-w-0 flex-1 flex-col justify-center">
              <span className="text-body">{w.name}</span>
              <span className="text-footnote text-ink-2">{[w.unit, w.pricePaise ? formatRupees(w.pricePaise) : null, w.shop].filter(Boolean).join(" · ")}</span>
            </Link>
            <button type="button" aria-label={t("acct.remove", { name: w.name })} onClick={() => remove("wishlist", w.productId)} className="grid size-11 place-items-center rounded-full active:bg-fill">
              <Heart aria-hidden className="size-5 fill-voice text-voice" />
            </button>
          </li>
        ))}
      </Section>

      <Section title={t("acct.favourites")} empty={account.favourites.length === 0 ? t("acct.favouritesNone") : null}>
        {account.favourites.map((f) => (
          <li key={f.slug} className="flex items-center gap-2 border-separator py-1 pr-1 pl-4 not-first:border-t">
            <Link href={`/s/${f.slug}`} className="flex min-h-12 min-w-0 flex-1 flex-col justify-center">
              <span className="text-body">{f.name}</span>
              {f.category && <span className="text-footnote text-ink-2">{f.category}</span>}
            </Link>
            <button type="button" aria-label={t("acct.remove", { name: f.name })} onClick={() => remove("favourites", f.slug)} className="grid size-11 place-items-center rounded-full active:bg-fill">
              <Heart aria-hidden className="size-5 fill-voice text-voice" />
            </button>
          </li>
        ))}
      </Section>

      <ListGroup header={t("lang.label")}>
        <li>
          <LanguagePicker variant="row" />
        </li>
      </ListGroup>

      <ListGroup>
        <ListRow icon={<Store />} title={t("acct.ownShop")} href="/owner" />
        <InstallAppRow />
        <ListRow icon={<ShieldCheck />} iconTone="gray" title={t("privacy.link")} href={`/privacy?lang=${lang}#customers`} />
        <ListRow icon={<LogOut />} iconTone="gray" title={t("shop.signOut")} onClick={signOut} />
        <ListRow icon={<Trash2 />} iconTone="danger" title={<span className="text-danger">{t("acct.delete")}</span>} onClick={() => setConfirmDelete(true)} />
      </ListGroup>

      {sheet === "profile" && <ProfileSheet account={account} payWith={payWith} onClose={() => setSheet(null)} />}
      {sheet && sheet !== "profile" && <AddressSheet address={sheet === "new" ? null : sheet} onClose={() => setSheet(null)} />}
      <AlertDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("acct.delete.title")}
        message={t("acct.delete.body")}
        cancelLabel={t("action.cancel")}
        confirmLabel={t("action.delete")}
        destructive
        busy={deleting}
        onConfirm={deleteAccount}
      />
    </main>
  );
}

// A list group with a plain line when it's empty.
function Section({ title, empty, emptyHref, children }: { title: string; empty: string | null; emptyHref?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-1.5">
      <h2 className="px-4 text-footnote font-medium text-ink-2">{title}</h2>
      {empty ? (
        <p className="rounded-md bg-surface px-4 py-3 text-footnote text-ink-2 shadow-card">
          {emptyHref ? (
            <Link href={emptyHref} className="text-accent underline-offset-4 hover:underline">
              {empty}
            </Link>
          ) : (
            empty
          )}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-md bg-surface shadow-card">{children}</ul>
      )}
    </section>
  );
}

function ProfileSheet({ account, payWith, onClose }: { account: Account; payWith: "CASH" | "UPI"; onClose: () => void }) {
  const { t } = useLang();
  const router = useRouter();
  const [name, setName] = useState(account.profile?.name ?? "");
  const [phone, setPhone] = useState(account.profile?.phone?.replace(/^\+91/, "") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/me/profile", { method: "PUT", json: { name: name.trim() || null, phone: phone.trim() || null, pay_with: payWith } });
      onClose();
      router.refresh();
    } catch (failure) {
      setError(errorKey(failure));
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={t("acct.profile")} doneLabel={t("action.cancel")} footer={<Footer error={error} busy={busy} onSave={save} />}>
      <div className="flex flex-col gap-4">
        <TextField label={t("cart.name")} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} />
        <TextField label={t("cart.phone")} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" maxLength={20} />
      </div>
    </Sheet>
  );
}

function AddressSheet({ address, onClose }: { address: Address | null; onClose: () => void }) {
  const { t } = useLang();
  const router = useRouter();
  const [form, setForm] = useState({ label: address?.label ?? "Home", address: address?.address ?? "", pincode: address?.pincode ?? "" });
  const [where, setWhere] = useState(address && address.lat !== null && address.lng !== null ? { lat: address.lat, lng: address.lng } : null);
  const [isDefault, setIsDefault] = useState(address?.is_default ?? false);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const pincodeBad = form.pincode.trim() !== "" && !/^[1-9][0-9]{5}$/.test(form.pincode.trim());

  function locate() {
    setError(null);
    if (!navigator.geolocation) return setError("cart.error.location");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const here = { lat: Math.round(position.coords.latitude * 10_000) / 10_000, lng: Math.round(position.coords.longitude * 10_000) / 10_000 };
        setWhere(here);
        // The address and pincode there fill whatever is still empty.
        void placeFor(here).then((place) => {
          setLocating(false);
          if (!place) return;
          setForm((now) => ({
            ...now,
            address: now.address.trim() ? now.address : (place.address ?? now.address),
            pincode: now.pincode.trim() ? now.pincode : (place.pincode ?? now.pincode),
          }));
        });
      },
      (failure) => {
        setLocating(false);
        setError(failure.code === failure.PERMISSION_DENIED ? "cart.error.locationBlocked" : "cart.error.location");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  async function save() {
    if (!form.address.trim()) return setError("error.invalidChange");
    if (pincodeBad) return setError("setup.where.badPincode");
    setBusy(true);
    setError(null);
    const json = {
      label: form.label.trim() || "Home",
      address: form.address.trim(),
      pincode: form.pincode.trim() || null,
      lat: where?.lat ?? null,
      lng: where?.lng ?? null,
      // A new address left unticked lets the server decide: the first one
      // becomes the default.
      ...(address || isDefault ? { is_default: isDefault } : {}),
    };
    try {
      await api(address ? `/api/v1/me/addresses/${address.id}` : "/api/v1/me/addresses", { method: address ? "PUT" : "POST", json });
      onClose();
      router.refresh();
    } catch (failure) {
      setError(errorKey(failure));
      setBusy(false);
    }
  }

  async function remove() {
    if (!address) return;
    setBusy(true);
    try {
      await api(`/api/v1/me/addresses/${address.id}`, { method: "DELETE" });
      onClose();
      router.refresh();
    } catch (failure) {
      setError(errorKey(failure));
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={address ? t("acct.editAddress") : t("acct.addAddress")}
      doneLabel={t("action.cancel")}
      footer={<Footer error={error} busy={busy} onSave={save} onRemove={address ? remove : undefined} />}
    >
      <div className="flex flex-col gap-4">
        <TextField label={t("acct.addressLabel")} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} maxLength={30} />
        <TextField label={t("field.address")} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} autoComplete="street-address" maxLength={300} />
        <TextField
          label={t("field.pincode")}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          value={form.pincode}
          onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, "") })}
          error={pincodeBad ? t("setup.where.badPincode") : undefined}
        />
        <Button variant={where ? "gray" : "tinted"} loading={locating} icon={where ? <Check aria-hidden className="size-5" /> : <MapPin aria-hidden className="size-5" />} onClick={locate}>
          {where ? t("setup.where.located") : t("setup.where.locate")}
        </Button>
        <div className="flex items-center justify-between gap-3 rounded-md bg-surface px-4 py-1 shadow-card">
          <span id="address-default" className="text-body">
            {t("acct.makeDefault")}
          </span>
          <Switch checked={isDefault} onCheckedChange={setIsDefault} labelledBy="address-default" />
        </div>
      </div>
    </Sheet>
  );
}

function Footer({ error, busy, onSave, onRemove }: { error: MessageKey | null; busy: boolean; onSave: () => void; onRemove?: () => void }) {
  const { t } = useLang();
  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t(error)}
        </p>
      )}
      <Button size="lg" loading={busy} onClick={onSave}>
        {t("action.save")}
      </Button>
      {onRemove && (
        <Button variant="plain" disabled={busy} onClick={onRemove} className="text-danger">
          {t("action.delete")}
        </Button>
      )}
    </div>
  );
}


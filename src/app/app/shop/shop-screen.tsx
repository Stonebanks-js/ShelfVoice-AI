"use client";

import { Banknote, Check, Clock, Download, ExternalLink, IndianRupee, LifeBuoy, ListPlus, LogOut, MapPin, Package, Phone, QrCode, Settings2, Share, ShieldCheck, ShoppingBag, Store, Tag, Trash2, Truck, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import qrcode from "qrcode-generator";
import { useMemo, useState } from "react";

import { drawLogo, LOGO } from "@/components/brand/logo";
import { OrderAlerts } from "@/components/shell/order-alerts";
import { Button, buttonClass } from "@/components/ui/button";
import { OpenBadge } from "@/components/shell/open-badge";
import { Switch } from "@/components/ui/controls";
import { PageHeader } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/field";
import { ListGroup, ListRow } from "@/components/ui/list";
import { AlertDialog, Sheet } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import type { Lang, MessageKey } from "@/i18n/dictionary";
import { LanguagePicker } from "@/components/shell/language-picker";
import { useLang } from "@/i18n/lang";
import { UPI_ID } from "@/lib/delivery";
import { api } from "@/lib/api";
import { formatPhone, formatRupees } from "@/lib/changes-view";
import { errorKey } from "@/lib/errors";
import { dayName, DAYS, formatTime, hasHours, hourRuns, type Day, type Hours } from "@/lib/hours";
import { toE164 } from "@/server/changes";

export interface OwnerShop {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  phone: string | null;
  address: string | null;
  description: string | null;
  hours: Hours;
  timezone: string;
  is_published: boolean;
  pincode: string | null;
  lat: number | null;
  lng: number | null;
  delivers: boolean;
  upi_id: string | null;
  accepts_cash: boolean;
  pay_on_delivery: boolean;
  delivery_min_paise: number | null;
  delivery_fee_paise: number | null;
  free_delivery_above_paise: number | null;
  delivery_radius_km: number | null;
}

export function ShopScreen({
  shop,
  origin,
  productCount,
  email,
  vapidKey,
}: {
  shop: OwnerShop;
  origin: string;
  productCount: number;
  email: string | null;
  vapidKey: string | null;
}) {
  const { lang, t } = useLang();
  const router = useRouter();
  const toast = useToast();
  const [published, setPublished] = useState(shop.is_published);
  const [sheet, setSheet] = useState<"qr" | "qrShop" | "details" | "hours" | "upi" | "delivery" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const shopUrl = `${origin}/s/${shop.slug}`;
  const reviewUrl = `${origin}/r/${shop.slug}`;

  async function togglePublished(on: boolean) {
    setPublished(on);
    try {
      await api(`/api/v1/shops/${shop.id}/publish`, { json: { published: on } });
      toast.show({ message: t(on ? "shop.publishedOn" : "shop.publishedOff") });
    } catch (failure) {
      setPublished(!on);
      toast.show({ message: t(errorKey(failure)) });
    }
  }

  // V-05 payment switches, saved as they flip.
  const [settings, setSettings] = useState({ accepts_cash: shop.accepts_cash, pay_on_delivery: shop.pay_on_delivery });
  async function saveSetting(patch: Partial<typeof settings>) {
    const before = settings;
    setSettings({ ...settings, ...patch });
    try {
      await api("/api/v1/shops/me", { method: "PATCH", json: patch });
      router.refresh();
    } catch (failure) {
      setSettings(before);
      toast.show({ message: t(errorKey(failure)) });
    }
  }
  const deliverySummary =
    [
      shop.delivery_radius_km ? t("deliv.within", { km: shop.delivery_radius_km }) : null,
      shop.delivery_fee_paise ? t("deliv.fee", { fee: formatRupees(shop.delivery_fee_paise) }) : t("deliv.free"),
      shop.delivery_fee_paise && shop.free_delivery_above_paise ? t("deliv.freeAbove", { amount: formatRupees(shop.free_delivery_above_paise) }) : null,
      shop.delivery_min_paise ? t("deliv.min", { amount: formatRupees(shop.delivery_min_paise) }) : null,
    ]
      .filter(Boolean)
      .join(" · ") || undefined;

  // V-04: customers can choose home delivery only when the shop delivers.
  const [delivers, setDelivers] = useState(shop.delivers);
  async function toggleDelivers(on: boolean) {
    setDelivers(on);
    try {
      await api("/api/v1/shops/me", { method: "PATCH", json: { delivers: on } });
      router.refresh();
    } catch (failure) {
      setDelivers(!on);
      toast.show({ message: t(errorKey(failure)) });
    }
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({ title: shop.name, url: shopUrl });
        return;
      } catch (error) {
        // The owner closed the share sheet: do nothing more.
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Share unavailable here: copy instead.
      }
    }
    try {
      await navigator.clipboard.writeText(shopUrl);
      toast.show({ message: t("shop.linkCopied") });
    } catch {
      window.prompt(t("shop.shareLink"), shopUrl);
    }
  }

  // The picker has already switched the screens; this saves it for the shop.
  async function saveLanguage(next: Lang) {
    try {
      await api("/api/v1/shops/me", { method: "PATCH", json: { language: next } });
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

  async function deleteShop() {
    setDeleting(true);
    try {
      await api("/api/v1/shops/me", { method: "DELETE" });
      router.replace("/");
      router.refresh();
    } catch (failure) {
      setDeleting(false);
      setConfirmDelete(false);
      toast.show({ message: t(errorKey(failure)) });
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-6">
      <PageHeader title={t("tab.shop")} />


      {/* Doc 06: a live preview of what customers see. */}
      <section aria-label={t("shop.page")} className="mx-4 flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
        {/* The badge drops below a long name or a long regional label (V-06). */}
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <h2 className="font-display text-title font-bold tracking-tight">{shop.name}</h2>
            {shop.category && <p className="text-footnote text-ink-2">{shop.category}</p>}
          </div>
          <OpenBadge hours={shop.hours} timeZone={shop.timezone} />
        </div>
        {shop.address && (
          <p className="flex items-start gap-2 text-footnote text-ink-2">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
            {shop.address}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <a href={shopUrl} target="_blank" rel="noopener" className={buttonClass("tinted", "md")}>
            <ExternalLink aria-hidden className="size-5" />
            {t("shop.view")}
          </a>
          <Button variant="gray" icon={<Share aria-hidden className="size-5" />} onClick={shareLink}>
            {t("shop.shareLink")}
          </Button>
        </div>
      </section>

      <div className="flex flex-col gap-6 px-4">
        {/* V-02: products and their stock live under My shop. */}
        <ListGroup header={t("shop.products")}>
          <ListRow icon={<Package />} title={t("shop.allProducts")} value={<span className="tabular-nums">{productCount}</span>} href="/app/stock" />
          <ListRow icon={<ListPlus />} title={t("add.title")} href="/app/add" />
          <ListRow icon={<Truck />} title={t("shop.restock")} href="/app/restock" />
        </ListGroup>

        <ListGroup header={t("shop.page")} footer={t("shop.publishedNote")}>
          <ListRow
            icon={<Store />}
            title={t("shop.published")}
            titleId="published-title"
            accessory={<Switch checked={published} onCheckedChange={togglePublished} labelledBy="published-title" />}
          />
          <ListRow icon={<QrCode />} title={t("shop.qr")} onClick={() => setSheet("qr")} />
          <ListRow icon={<QrCode />} title={t("shop.qrShop")} onClick={() => setSheet("qrShop")} />
        </ListGroup>

        {/* V-05: how customers pay. Money goes straight to the shop. */}
        <ListGroup header={t("shop.payments")}>
          <ListRow icon={<IndianRupee />} title={t("shop.upi")} value={<span className="line-clamp-1 max-w-44">{shop.upi_id ?? t("shop.notSet")}</span>} onClick={() => setSheet("upi")} />
          <ListRow
            icon={<Banknote />}
            title={t("pay.CASH")}
            titleId="cash-title"
            accessory={<Switch checked={settings.accepts_cash} onCheckedChange={(on) => saveSetting({ accepts_cash: on })} labelledBy="cash-title" />}
          />
          <ListRow
            icon={<Wallet />}
            title={t("pay.cod")}
            titleId="cod-title"
            accessory={<Switch checked={settings.pay_on_delivery} onCheckedChange={(on) => saveSetting({ pay_on_delivery: on })} labelledBy="cod-title" />}
          />
        </ListGroup>

        <ListGroup header={t("shop.delivery")}>
          <ListRow
            icon={<Truck />}
            title={t("shop.delivers")}
            titleId="delivers-title"
            accessory={<Switch checked={delivers} onCheckedChange={toggleDelivers} labelledBy="delivers-title" />}
          />
          {delivers && <ListRow icon={<Settings2 />} title={t("shop.deliverySettings")} subtitle={deliverySummary} wrap onClick={() => setSheet("delivery")} />}
        </ListGroup>

        <ListGroup header={t("shop.details")}>
          <ListRow icon={<Store />} title={t("field.name")} value={<span className="line-clamp-1 max-w-40">{shop.name}</span>} onClick={() => setSheet("details")} />
          <ListRow icon={<Tag />} title={t("shop.type")} value={shop.category ?? t("shop.notSet")} onClick={() => setSheet("details")} />
          <ListRow
            icon={<Phone />}
            title={t("shop.phone")}
            value={shop.phone ? formatPhone(shop.phone) : t("shop.notSet")}
            onClick={() => setSheet("details")}
          />
          <ListRow icon={<MapPin />} title={t("field.address")} subtitle={shop.address ?? t("shop.notSet")} wrap onClick={() => setSheet("details")} />
        </ListGroup>

        <ListGroup header={t("shop.hours")}>
          {hasHours(shop.hours) ? (
            hourRuns(shop.hours).map((run) => (
              <ListRow
                key={run.from}
                icon={<Clock />}
                iconTone={run.slots.length ? "accent" : "gray"}
                title={run.from === run.to ? dayName(run.from, lang) : `${dayName(run.from, lang)} – ${dayName(run.to, lang)}`}
                value={
                  run.slots.length
                    ? run.slots.map(([o, c]) => `${formatTime(o, lang)} – ${formatTime(c, lang)}`).join(", ")
                    : t("shop.closed")
                }
                onClick={() => setSheet("hours")}
              />
            ))
          ) : (
            <ListRow icon={<Clock />} title={t("shop.noHours")} onClick={() => setSheet("hours")} />
          )}
        </ListGroup>

        <ListGroup header={t("lang.label")}>
          <li>
            <LanguagePicker variant="row" onChange={saveLanguage} />
          </li>
        </ListGroup>

        {vapidKey && (
          <ListGroup header={t("shop.notifications")}>
            <li>
              <OrderAlerts vapidKey={vapidKey} plain />
            </li>
          </ListGroup>
        )}

        <ListGroup header={t("shop.account")} footer={email ? t("shop.signedInAs", { email }) : undefined}>
          <ListRow icon={<ShoppingBag />} title={t("shop.customerView")} href="/me" />
          <ListRow icon={<LifeBuoy />} title={t("shop.help")} href="/help" />
          <ListRow icon={<ShieldCheck />} iconTone="gray" title={t("privacy.link")} href={`/privacy?lang=${lang}`} />
          <ListRow icon={<LogOut />} iconTone="gray" title={t("shop.signOut")} onClick={signOut} />
          <ListRow icon={<Trash2 />} iconTone="danger" title={<span className="text-danger">{t("shop.delete")}</span>} onClick={() => setConfirmDelete(true)} />
        </ListGroup>
      </div>

      {sheet === "qr" && <QrSheet url={reviewUrl} shopName={shop.name} kind="review" onClose={() => setSheet(null)} />}
      {sheet === "qrShop" && <QrSheet url={shopUrl} shopName={shop.name} kind="shop" onClose={() => setSheet(null)} />}
      {sheet === "upi" && <UpiSheet upiId={shop.upi_id} onClose={() => setSheet(null)} />}
      {sheet === "delivery" && <DeliverySheet shop={shop} onClose={() => setSheet(null)} />}
      {sheet === "details" && <DetailsSheet shop={shop} onClose={() => setSheet(null)} />}
      {sheet === "hours" && <HoursSheet hours={shop.hours} onClose={() => setSheet(null)} />}
      <AlertDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("shop.delete.title")}
        message={t("shop.delete.body")}
        cancelLabel={t("action.cancel")}
        confirmLabel={t("action.delete")}
        destructive
        busy={deleting}
        onConfirm={deleteShop}
      />
    </main>
  );
}

// The counter QR (doc 06 O-9): opens the customer review page.
function QrSheet({ url, shopName, kind, onClose }: { url: string; shopName: string; kind: "review" | "shop"; onClose: () => void }) {
  const { t } = useLang();
  const title = t(kind === "review" ? "shop.qrTitle" : "shop.qrShopTitle");
  const qr = useMemo(() => {
    const code = qrcode(0, "M");
    code.addData(url);
    code.make();
    return code;
  }, [url]);
  const size = qr.getModuleCount();
  // One path of dark squares, drawn as plain SVG (no injected markup).
  const path = useMemo(() => {
    let d = "";
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (qr.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
    return d;
  }, [qr, size]);

  // A printable card: shop name, the QR and what to do, as a PNG, signed with
  // the logo so customers know what they are scanning.
  function download() {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1600;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1200, 1600);
    ctx.fillStyle = LOGO.ink;
    ctx.textAlign = "center";
    ctx.font = "bold 72px system-ui, sans-serif";
    ctx.fillText(shopName, 600, 170, 1080);
    ctx.font = "56px system-ui, sans-serif";
    ctx.fillText(title, 600, 270, 1080);
    const cell = Math.floor(880 / (size + 8));
    const offset = (1200 - cell * size) / 2;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (qr.isDark(r, c)) ctx.fillRect(offset + c * cell, 360 + r * cell, cell, cell);
    ctx.font = "36px system-ui, sans-serif";
    ctx.fillStyle = "#5f5f5f";
    ctx.fillText(url.replace(/^https?:\/\//, ""), 600, 360 + size * cell + 110, 1080);
    signCard(ctx);
    const link = document.createElement("a");
    link.download = kind === "review" ? "shelf-voice-review-qr.png" : "shelf-voice-shop-qr.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      doneLabel={t("action.done")}
      footer={
        <Button size="lg" icon={<Download aria-hidden className="size-5" />} onClick={download}>
          {t("shop.qrDownload")}
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <p className="text-center text-body text-ink-2">{t(kind === "review" ? "shop.qrBody" : "shop.qrShopBody")}</p>
        <div className="rounded-lg bg-white p-4">
          <svg role="img" aria-label={`QR: ${url}`} viewBox={`-2 -2 ${size + 4} ${size + 4}`} className="size-56" shapeRendering="crispEdges">
            <path d={path} fill="#101010" />
          </svg>
        </div>
        <p className="text-footnote break-all text-ink-2">{url}</p>
      </div>
    </Sheet>
  );
}

// The logo and "Shelf Voice" centred along the bottom of the QR card.
function signCard(ctx: CanvasRenderingContext2D) {
  const mark = 96;
  const name = "Shelf Voice";
  ctx.font = "bold 48px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const markWidth = (mark * LOGO.full.width) / LOGO.full.height;
  const left = (1200 - (markWidth + 20 + ctx.measureText(name).width)) / 2;
  const top = 1450;
  const used = drawLogo(ctx, left, top, mark);
  ctx.fillStyle = LOGO.ink;
  ctx.fillText(name, left + used + 20, top + mark / 2 + 4);
}

function DetailsSheet({ shop, onClose }: { shop: OwnerShop; onClose: () => void }) {
  const { t } = useLang();
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    name: shop.name,
    category: shop.category ?? "",
    phone: shop.phone?.replace(/^\+91/, "") ?? "",
    address: shop.address ?? "",
    description: shop.description ?? "",
    pincode: shop.pincode ?? "",
  });
  // Where the shop is, for customers nearby (V-03).
  const [where, setWhere] = useState(shop.lat !== null && shop.lng !== null ? { lat: shop.lat, lng: shop.lng } : null);
  const [locating, setLocating] = useState(false);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value });

  async function save() {
    setInvalid(null);
    if (!form.name.trim()) return setInvalid("name");
    const phone = form.phone.trim() ? toE164(form.phone) : null;
    if (form.phone.trim() && !phone) return setInvalid("phone");
    if (form.pincode.trim() && !/^[1-9][0-9]{5}$/.test(form.pincode.trim())) return setInvalid("pincode");
    setBusy(true);
    try {
      await api("/api/v1/shops/me", {
        method: "PATCH",
        json: {
          name: form.name.trim(),
          category: form.category.trim() || null,
          phone,
          address: form.address.trim() || null,
          description: form.description.trim() || null,
          pincode: form.pincode.trim() || null,
          lat: where?.lat ?? null,
          lng: where?.lng ?? null,
        },
      });
      toast.show({ message: t("stock.saved") });
      onClose();
      router.refresh();
    } catch (failure) {
      setError(errorKey(failure));
      setBusy(false);
    }
  }

  function locate() {
    setError(null);
    if (!navigator.geolocation) return setError("setup.where.denied");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const round = (n: number) => Math.round(n * 100_000) / 100_000;
        setWhere({ lat: round(position.coords.latitude), lng: round(position.coords.longitude) });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError("setup.where.denied");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  const field = (key: keyof typeof form, label: MessageKey, inputMode?: "tel" | "text" | "numeric") => (
    <TextField label={t(label)} value={form[key]} onChange={set(key)} inputMode={inputMode} error={invalid === key ? t("error.invalidChange") : undefined} />
  );

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("shop.editDetails")}
      doneLabel={t("action.cancel")}
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
              {t(error)}
            </p>
          )}
          <Button size="lg" loading={busy} onClick={save}>
            {t("action.save")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {field("name", "field.name")}
        {field("category", "shop.type")}
        {field("phone", "field.phone", "tel")}
        {field("address", "field.address")}
        {field("pincode", "field.pincode", "numeric")}
        <Button
          variant={where ? "gray" : "tinted"}
          loading={locating}
          icon={where ? <Check aria-hidden className="size-5" /> : <MapPin aria-hidden className="size-5" />}
          onClick={locate}
        >
          {where ? t("setup.where.located") : t("setup.where.locate")}
        </Button>
        {field("description", "shop.about")}
      </div>
    </Sheet>
  );
}

// One opening and closing time per day; a switch marks the day closed.
function HoursSheet({ hours, onClose }: { hours: Hours; onClose: () => void }) {
  const { lang, t } = useLang();
  const router = useRouter();
  const toast = useToast();
  const [week, setWeek] = useState<Record<Day, { open: boolean; from: string; to: string }>>(() =>
    Object.fromEntries(
      DAYS.map((d) => {
        const first = hours[d][0];
        const last = hours[d].at(-1);
        return [d, { open: Boolean(first), from: first?.[0] ?? "07:00", to: last?.[1] ?? "22:00" }];
      }),
    ) as Record<Day, { open: boolean; from: string; to: string }>,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  // Days the owner changed here. The rest are saved exactly as they were,
  // so a lunch break (two time ranges, from voice setup) isn't lost.
  const [touched, setTouched] = useState<Set<Day>>(() => new Set());
  const update = (day: Day, patch: Partial<{ open: boolean; from: string; to: string }>) => {
    setWeek({ ...week, [day]: { ...week[day], ...patch } });
    setTouched(new Set(touched).add(day));
  };

  async function save() {
    if (DAYS.some((d) => week[d].open && week[d].from >= week[d].to)) return setError("error.invalidChange");
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/shops/me", {
        method: "PATCH",
        json: {
          hours: Object.fromEntries(DAYS.map((d) => [d, !touched.has(d) ? hours[d] : week[d].open ? [[week[d].from, week[d].to]] : []])),
        },
      });
      toast.show({ message: t("stock.saved") });
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
      title={t("shop.editHours")}
      doneLabel={t("action.cancel")}
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
              {t(error)}
            </p>
          )}
          <Button size="lg" loading={busy} onClick={save}>
            {t("action.save")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <Button variant="tinted" onClick={() => setWeek(Object.fromEntries(DAYS.map((d) => [d, { ...week.mon }])) as typeof week)}>
          {t("shop.copyMonday")}
        </Button>
        <ul className="overflow-hidden rounded-md bg-surface shadow-card">
          {DAYS.map((day) => (
            <li key={day} className="flex flex-col gap-2 border-separator px-4 py-3 not-first:border-t">
              <div className="flex items-center justify-between">
                <span id={`day-${day}`} className="text-body font-semibold">
                  {dayName(day, lang, "long")}
                </span>
                <span className="flex items-center gap-2 text-footnote text-ink-2">
                  {week[day].open ? t("shop.open") : t("shop.closed")}
                  <Switch checked={week[day].open} onCheckedChange={(open) => update(day, { open })} labelledBy={`day-${day}`} />
                </span>
              </div>
              {week[day].open && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-footnote text-ink-2">
                    {t("shop.opens")}
                    <input type="time" value={week[day].from} onChange={(e) => update(day, { from: e.target.value })} className="min-h-12 rounded-md bg-fill px-3 text-body text-ink" />
                  </label>
                  <label className="flex flex-col gap-1 text-footnote text-ink-2">
                    {t("shop.closes")}
                    <input type="time" value={week[day].to} onChange={(e) => update(day, { to: e.target.value })} className="min-h-12 rounded-md bg-fill px-3 text-body text-ink" />
                  </label>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}

const rupeesText = (paise: number | null) => (paise ? String(paise / 100) : "");
const toPaise = (text: string) => {
  const n = Number.parseFloat(text.replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};

// The shop's UPI ID (V-05): customers pay straight from their UPI app.
function UpiSheet({ upiId, onClose }: { upiId: string | null; onClose: () => void }) {
  const { t } = useLang();
  const router = useRouter();
  const [value, setValue] = useState(upiId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const trimmed = value.trim();
    if (trimmed && !UPI_ID.test(trimmed)) return setError(t("shop.upiBad"));
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/shops/me", { method: "PATCH", json: { upi_id: trimmed || null } });
      onClose();
      router.refresh();
    } catch (failure) {
      setError(t(errorKey(failure)));
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("shop.upi")}
      doneLabel={t("action.cancel")}
      footer={
        <Button size="lg" loading={busy} onClick={save}>
          {t("action.save")}
        </Button>
      }
    >
      <TextField
        label={t("shop.upi")}
        hint={t("shop.upiHint")}
        error={error ?? undefined}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={320}
      />
    </Sheet>
  );
}

// Delivery rules (V-05): minimum order, charge, free above, distance.
function DeliverySheet({ shop, onClose }: { shop: OwnerShop; onClose: () => void }) {
  const { t } = useLang();
  const router = useRouter();
  const [form, setForm] = useState({
    min: rupeesText(shop.delivery_min_paise),
    fee: rupeesText(shop.delivery_fee_paise),
    freeAbove: rupeesText(shop.free_delivery_above_paise),
    radius: shop.delivery_radius_km ? String(shop.delivery_radius_km) : "",
  });
  const [invalid, setInvalid] = useState<keyof typeof form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const hasLocation = shop.lat !== null && shop.lng !== null;
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value });

  async function save() {
    setInvalid(null);
    setError(null);
    const money = (key: "min" | "fee" | "freeAbove") => (form[key].trim() ? toPaise(form[key]) : null);
    for (const key of ["min", "fee", "freeAbove"] as const) if (form[key].trim() && money(key) === null) return setInvalid(key);
    const radius = form.radius.trim() ? Number.parseFloat(form.radius) : null;
    if (radius !== null && !(radius >= 0.5 && radius <= 50)) return setInvalid("radius");
    setBusy(true);
    try {
      await api("/api/v1/shops/me", {
        method: "PATCH",
        json: {
          delivery_min_paise: money("min") || null,
          delivery_fee_paise: money("fee") || null,
          free_delivery_above_paise: money("freeAbove") || null,
          delivery_radius_km: radius === null ? null : Math.round(radius * 10) / 10,
        },
      });
      onClose();
      router.refresh();
    } catch (failure) {
      setError(errorKey(failure));
      setBusy(false);
    }
  }

  const field = (key: keyof typeof form, label: MessageKey, inputMode: "decimal" | "numeric" = "decimal", hint?: string) => (
    <TextField label={t(label)} value={form[key]} onChange={set(key)} inputMode={inputMode} placeholder={t("shop.none")} hint={hint} error={invalid === key ? t("error.invalidChange") : undefined} />
  );

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("shop.deliverySettings")}
      doneLabel={t("action.cancel")}
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
              {t(error)}
            </p>
          )}
          <Button size="lg" loading={busy} onClick={save}>
            {t("action.save")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {field("min", "shop.deliveryMin")}
        {field("fee", "shop.deliveryFee")}
        {field("freeAbove", "shop.freeAbove")}
        {field("radius", "shop.radius", "decimal", hasLocation ? undefined : t("shop.radiusNeedsLocation"))}
      </div>
    </Sheet>
  );
}

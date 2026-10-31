"use client";

import { Clock, Download, ExternalLink, Info, Languages, LogOut, MapPin, Phone, QrCode, Share, ShieldCheck, Store, Tag, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import qrcode from "qrcode-generator";
import { useMemo, useState } from "react";

import { Button, buttonClass } from "@/components/ui/button";
import { OpenBadge } from "@/components/shell/open-badge";
import { Segmented, Switch } from "@/components/ui/controls";
import { PageHeader } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/field";
import { ListGroup, ListRow } from "@/components/ui/list";
import { AlertDialog, Sheet } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import type { Lang, MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { api } from "@/lib/api";
import { formatPhone } from "@/lib/changes-view";
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
  is_demo: boolean;
}

export function ShopScreen({ shop, origin }: { shop: OwnerShop; origin: string }) {
  const { lang, setLang, t } = useLang();
  const router = useRouter();
  const toast = useToast();
  const [published, setPublished] = useState(shop.is_published);
  const [sheet, setSheet] = useState<"qr" | "details" | "hours" | null>(null);
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

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({ title: shop.name, url: shopUrl });
        return;
      } catch {
        // Cancelled or unavailable: copy instead.
      }
    }
    try {
      await navigator.clipboard.writeText(shopUrl);
      toast.show({ message: t("shop.linkCopied") });
    } catch {
      window.prompt(t("shop.shareLink"), shopUrl);
    }
  }

  async function changeLanguage(next: Lang) {
    setLang(next);
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

      {shop.is_demo && (
        <p className="mx-4 -mt-2 flex gap-2 rounded-lg bg-accent-soft p-4 text-footnote text-accent">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t("shop.demo")}
        </p>
      )}

      {/* Doc 06: a live preview of what customers see. */}
      <section aria-label={t("shop.page")} className="mx-4 flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
        <div className="flex items-start justify-between gap-3">
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
        <ListGroup header={t("shop.page")} footer={t("shop.publishedNote")}>
          <ListRow
            icon={<Store />}
            title={t("shop.published")}
            titleId="published-title"
            accessory={<Switch checked={published} onCheckedChange={togglePublished} labelledBy="published-title" />}
          />
          <ListRow icon={<QrCode />} title={t("shop.qr")} onClick={() => setSheet("qr")} />
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
          <li className="flex items-center gap-3 px-4 py-2.5">
            <Languages aria-hidden className="size-5 shrink-0 text-ink-2" />
            <Segmented<Lang>
              label={t("lang.label")}
              value={lang}
              onValueChange={changeLanguage}
              className="flex-1"
              options={[
                { value: "hi", label: <span lang="hi">हिन्दी</span> },
                { value: "en", label: "English" },
              ]}
            />
          </li>
        </ListGroup>

        <ListGroup header={t("shop.account")}>
          <ListRow icon={<ShieldCheck />} iconTone="gray" title={t("privacy.link")} href={`/privacy?lang=${lang}`} />
          <ListRow icon={<LogOut />} iconTone="gray" title={t("shop.signOut")} onClick={signOut} />
          <ListRow icon={<Trash2 />} iconTone="danger" title={<span className="text-danger">{t("shop.delete")}</span>} onClick={() => setConfirmDelete(true)} />
        </ListGroup>
      </div>

      {sheet === "qr" && <QrSheet url={reviewUrl} shopName={shop.name} onClose={() => setSheet(null)} />}
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
function QrSheet({ url, shopName, onClose }: { url: string; shopName: string; onClose: () => void }) {
  const { t } = useLang();
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

  // A printable card: shop name, the QR and what to do, as a PNG.
  function download() {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1600;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1200, 1600);
    ctx.fillStyle = "#1d1d1f";
    ctx.textAlign = "center";
    ctx.font = "bold 72px system-ui, sans-serif";
    ctx.fillText(shopName, 600, 170, 1080);
    ctx.font = "56px system-ui, sans-serif";
    ctx.fillText(t("shop.qrTitle"), 600, 270, 1080);
    const cell = Math.floor(880 / (size + 8));
    const offset = (1200 - cell * size) / 2;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (qr.isDark(r, c)) ctx.fillRect(offset + c * cell, 360 + r * cell, cell, cell);
    ctx.font = "36px system-ui, sans-serif";
    ctx.fillStyle = "#636368";
    ctx.fillText(url.replace(/^https?:\/\//, ""), 600, 360 + size * cell + 110, 1080);
    const link = document.createElement("a");
    link.download = "shelf-voice-review-qr.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("shop.qrTitle")}
      doneLabel={t("action.done")}
      footer={
        <Button size="lg" icon={<Download aria-hidden className="size-5" />} onClick={download}>
          {t("shop.qrDownload")}
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <p className="text-center text-body text-ink-2">{t("shop.qrBody")}</p>
        <div className="rounded-lg bg-white p-4">
          <svg role="img" aria-label={`QR: ${url}`} viewBox={`-2 -2 ${size + 4} ${size + 4}`} className="size-56" shapeRendering="crispEdges">
            <path d={path} fill="#1d1d1f" />
          </svg>
        </div>
        <p className="text-footnote break-all text-ink-2">{url}</p>
      </div>
    </Sheet>
  );
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
  });
  const [invalid, setInvalid] = useState<string | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value });

  async function save() {
    setInvalid(null);
    if (!form.name.trim()) return setInvalid("name");
    const phone = form.phone.trim() ? toE164(form.phone) : null;
    if (form.phone.trim() && !phone) return setInvalid("phone");
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

  const field = (key: keyof typeof form, label: MessageKey, inputMode?: "tel" | "text") => (
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
  const update = (day: Day, patch: Partial<{ open: boolean; from: string; to: string }>) => setWeek({ ...week, [day]: { ...week[day], ...patch } });

  async function save() {
    if (DAYS.some((d) => week[d].open && week[d].from >= week[d].to)) return setError("error.invalidChange");
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/shops/me", {
        method: "PATCH",
        json: { hours: Object.fromEntries(DAYS.map((d) => [d, week[d].open ? [[week[d].from, week[d].to]] : []])) },
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

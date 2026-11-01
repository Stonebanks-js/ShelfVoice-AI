"use client";

import { Bell, BellOff, Check, CircleAlert, Inbox, MapPin, MessageCircle, Phone, Store, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/controls";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { AlertDialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import type { MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { api } from "@/lib/api";
import { formatPhone, formatRupees } from "@/lib/changes-view";
import { cn } from "@/lib/cn";
import { errorKey } from "@/lib/errors";

type Status = "NEW" | "ACCEPTED" | "READY" | "COMPLETED" | "CANCELLED";

export interface OwnerOrder {
  id: string;
  code: string;
  status: Status;
  customer_name: string;
  customer_phone: string;
  fulfilment: "PICKUP" | "DELIVERY";
  address: string | null;
  note: string | null;
  created_at: string;
  order_items: Array<{ id: string; name: string; unit: string | null; price_paise: number | null; qty: number; status: "PENDING" | "AVAILABLE" | "UNAVAILABLE" }>;
}

const OPEN: Status[] = ["NEW", "ACCEPTED", "READY"];

// Customer orders (V-04): accept, mark what the shop doesn't have, say it's
// ready, and finish it, which logs the sales. A WhatsApp message to the
// customer is one tap at every step. New orders come in every 30 seconds.
export function CustomerOrders({ orders, shopName, vapidKey }: { orders: OwnerOrder[]; shopName: string; vapidKey: string | null }) {
  const { t } = useLang();
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(timer);
  }, [router]);

  const groups = (
    [
      { title: "orders.new", items: orders.filter((o) => o.status === "NEW") },
      { title: "orders.open", items: orders.filter((o) => o.status === "ACCEPTED" || o.status === "READY") },
      { title: "orders.done", items: orders.filter((o) => !OPEN.includes(o.status)) },
    ] satisfies Array<{ title: MessageKey; items: OwnerOrder[] }>
  ).filter((g) => g.items.length > 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-6">
      <PageHeader title={t("tab.orders")} />
      {vapidKey && <AlertsSwitch vapidKey={vapidKey} />}
      {groups.length === 0 ? (
        <div className="px-4">
          <EmptyState icon={<Inbox />} title={t("orders.none")} body={t("orders.noneBody")} />
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.title} aria-labelledby={`orders-${group.title}`} className="flex flex-col gap-2 px-4">
            <h2 id={`orders-${group.title}`} className="px-1 text-footnote font-semibold text-ink-2">
              {t(group.title)} · {group.items.length}
            </h2>
            <ul className="flex flex-col gap-3">
              {group.items.map((order) => (
                <OrderCard key={order.id} order={order} shopName={shopName} />
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}

function OrderCard({ order, shopName }: { order: OwnerOrder; shopName: string }) {
  const { lang, t } = useLang();
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(order.order_items);
  const [busy, setBusy] = useState<Status | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const editable = order.status === "NEW" || order.status === "ACCEPTED";
  const have = items.filter((i) => i.status !== "UNAVAILABLE");
  const total = have.reduce((sum, i) => sum + (i.price_paise ?? 0) * i.qty, 0);
  const time = new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(order.created_at));

  // The message the customer most needs right now, ready to send.
  const waKey: MessageKey | null =
    order.status === "NEW" || order.status === "ACCEPTED"
      ? "orders.wa.ACCEPTED"
      : order.status === "READY"
        ? order.fulfilment === "DELIVERY"
          ? "orders.wa.READY.DELIVERY"
          : "orders.wa.READY.PICKUP"
        : order.status === "CANCELLED"
          ? "orders.wa.CANCELLED"
          : null;
  const waText = waKey ? t(waKey, { name: order.customer_name, code: order.code, shop: shopName }) : "";
  const wa = `https://wa.me/${order.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(waText)}`;

  async function move(status: Status) {
    setBusy(status);
    setError(null);
    try {
      await api(`/api/v1/orders/${order.id}`, { method: "PATCH", json: { status } });
      setConfirmCancel(false);
      router.refresh();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(null);
    }
  }

  async function mark(itemId: string, available: boolean) {
    const before = items;
    setItems(items.map((i) => (i.id === itemId ? { ...i, status: available ? "AVAILABLE" : "UNAVAILABLE" } : i)));
    try {
      await api(`/api/v1/orders/${order.id}/items/${itemId}`, { method: "PATCH", json: { status: available ? "AVAILABLE" : "UNAVAILABLE" } });
    } catch (failure) {
      setItems(before);
      toast.show({ message: t(errorKey(failure)) });
    }
  }

  return (
    <li className={cn("flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card", order.status === "NEW" && "ring-2 ring-voice/60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h3 className="text-headline font-semibold">{order.customer_name}</h3>
          <p className="text-footnote text-ink-2 tabular-nums">
            {order.code} · {time} · {formatPhone(order.customer_phone)}
          </p>
        </div>
        <Badge tone={order.status === "NEW" ? "check" : order.status === "CANCELLED" ? "danger" : order.status === "COMPLETED" ? "success" : "neutral"}>
          {t(`orders.status.${order.status}`)}
        </Badge>
      </div>

      <p className="flex items-start gap-2 text-footnote text-ink">
        {order.fulfilment === "DELIVERY" ? <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" /> : <Store aria-hidden className="mt-0.5 size-4 shrink-0" />}
        {order.fulfilment === "DELIVERY" ? t("orders.delivery", { address: order.address ?? "" }) : t("orders.pickup")}
      </p>
      {order.note && <p className="rounded-md bg-fill px-3 py-2 text-footnote">“{order.note}”</p>}

      <ul className="flex flex-col divide-y divide-separator border-y border-separator">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 py-2">
            <span className={cn("flex min-w-0 flex-1 flex-col", item.status === "UNAVAILABLE" && "text-ink-2 line-through")}>
              <span className="text-body">
                {item.name} × {item.qty}
              </span>
              <span className="text-footnote text-ink-2 no-underline">
                {[item.unit, item.price_paise ? formatRupees(item.price_paise * item.qty) : null].filter(Boolean).join(" · ")}
              </span>
            </span>
            {editable ? (
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  aria-pressed={item.status !== "UNAVAILABLE"}
                  onClick={() => mark(item.id, true)}
                  className={cn(
                    "inline-flex h-10 items-center gap-1 rounded-md px-2.5 text-footnote font-semibold",
                    item.status !== "UNAVAILABLE" ? "bg-accent-fill text-on-accent" : "bg-fill text-ink",
                  )}
                >
                  <Check aria-hidden className="size-4" />
                  {t("orders.have")}
                  <span className="sr-only"> {item.name}</span>
                </button>
                <button
                  type="button"
                  aria-pressed={item.status === "UNAVAILABLE"}
                  onClick={() => mark(item.id, false)}
                  className={cn(
                    "inline-flex h-10 items-center gap-1 rounded-md px-2.5 text-footnote font-semibold",
                    item.status === "UNAVAILABLE" ? "bg-danger text-white" : "bg-fill text-ink",
                  )}
                >
                  <X aria-hidden className="size-4" />
                  {t("orders.haveNot")}
                  <span className="sr-only"> {item.name}</span>
                </button>
              </div>
            ) : (
              item.status === "UNAVAILABLE" && <Badge tone="danger">{t("order.unavailable")}</Badge>
            )}
          </li>
        ))}
      </ul>
      {total > 0 && <p className="text-body font-semibold tabular-nums">{t("orders.total", { total: formatRupees(total) })}</p>}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t(error)}
        </p>
      )}

      {order.status === "NEW" && (
        <Button size="lg" loading={busy === "ACCEPTED"} onClick={() => move("ACCEPTED")}>
          {t("orders.accept")}
        </Button>
      )}
      {order.status === "ACCEPTED" && (
        <Button size="lg" loading={busy === "READY"} onClick={() => move("READY")}>
          {t("orders.ready")}
        </Button>
      )}
      {order.status === "READY" && (
        <Button size="lg" loading={busy === "COMPLETED"} onClick={() => move("COMPLETED")}>
          {t("orders.complete")}
        </Button>
      )}

      <div className="flex flex-wrap gap-2">
        <a href={`tel:${order.customer_phone}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-fill px-3 text-footnote font-semibold text-ink">
          <Phone aria-hidden className="size-4" />
          {t("orders.call")}
        </a>
        {waKey && (
          <a href={wa} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-fill px-3 text-footnote font-semibold text-ink">
            <MessageCircle aria-hidden className="size-4" />
            {t("orders.message")}
          </a>
        )}
        {OPEN.includes(order.status) && (
          <button type="button" onClick={() => setConfirmCancel(true)} className="ml-auto inline-flex min-h-11 items-center px-2 text-footnote font-semibold text-danger">
            {t("orders.cancel")}
          </button>
        )}
      </div>

      <AlertDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title={t("orders.cancel.title", { code: order.code })}
        message={t("orders.cancel.body")}
        cancelLabel={t("action.back")}
        confirmLabel={t("orders.cancel")}
        destructive
        busy={busy === "CANCELLED"}
        onConfirm={() => move("CANCELLED")}
      />
    </li>
  );
}

// ------------------------------------------------------------- order alerts
const noSubscribe = () => () => undefined;
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const keyBytes = (base64url: string) => {
  const raw = atob(base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

// "Get a notification for each new order": registers the service worker and
// a push subscription for this phone (web push; no app to install).
function AlertsSwitch({ vapidKey }: { vapidKey: string }) {
  const { t } = useLang();
  const toast = useToast();
  const supported = useSyncExternalStore(noSubscribe, pushSupported, () => false);
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!supported) return;
    let live = true;
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => live && setOn(Boolean(sub)))
      .catch(() => live && setOn(false));
    return () => {
      live = false;
    };
  }, [supported]);

  if (!supported || on === null) return null;

  async function turnOn() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDenied(true);
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) });
      await api("/api/v1/push-subscriptions", { json: sub.toJSON() });
      setOn(true);
    } catch (failure) {
      toast.show({ message: t(errorKey(failure)) });
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api("/api/v1/push-subscriptions", { method: "DELETE", json: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setOn(false);
    } catch (failure) {
      toast.show({ message: t(errorKey(failure)) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-4 flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-card">
      {on ? (
        <div className="flex items-center gap-3">
          <Bell aria-hidden className="size-5 shrink-0" />
          <span className="flex-1 text-body">{t("orders.alertsOn")}</span>
          <Button variant="plain" loading={busy} onClick={turnOff} icon={<BellOff aria-hidden className="size-5" />}>
            {t("orders.alertsOff")}
          </Button>
        </div>
      ) : (
        <Button variant="tinted" loading={busy} onClick={turnOn} icon={<Bell aria-hidden className="size-5" />}>
          {t("orders.alerts")}
        </Button>
      )}
      {denied && (
        <p role="alert" className="text-footnote text-danger">
          {t("orders.alertsDenied")}
        </p>
      )}
    </div>
  );
}

"use client";

import { Check, CircleAlert, Inbox, MapPin, MessageCircle, Phone, RotateCcw, Store, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { OrderAlerts } from "@/components/shell/order-alerts";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Badge } from "@/components/ui/controls";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { AlertDialog, Sheet } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { localeFor, type MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { api } from "@/lib/api";
import { formatPhone, formatRupees } from "@/lib/changes-view";
import { cn } from "@/lib/cn";
import { errorKey } from "@/lib/errors";
import { ProductName } from "@/i18n/products";

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
  delivery_fee_paise: number;
  order_refunds: Array<{ amount_paise: number; reason: string; created_at: string }>;
  order_items: Array<{ id: string; name: string; unit: string | null; price_paise: number | null; qty: number; status: "PENDING" | "AVAILABLE" | "UNAVAILABLE" }>;
}

const OPEN: Status[] = ["NEW", "ACCEPTED", "READY"];

// Customer orders: accept, mark what the shop doesn't have, say it's
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
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-6 lg:max-w-6xl lg:px-4">
      <PageHeader title={t("tab.orders")} />
      {vapidKey && <OrderAlerts vapidKey={vapidKey} />}
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
            <ul className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
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
  const [refunding, setRefunding] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const editable = order.status === "NEW" || order.status === "ACCEPTED";
  const have = items.filter((i) => i.status !== "UNAVAILABLE");
  const total = have.reduce((sum, i) => sum + (i.price_paise ?? 0) * i.qty, 0) + order.delivery_fee_paise;
  const refunded = order.order_refunds.reduce((sum, r) => sum + r.amount_paise, 0);
  const time = new Intl.DateTimeFormat(localeFor(lang), { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(order.created_at));

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
                <ProductName name={item.name} /> × {item.qty}
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
      {total > 0 && (
        <p className="text-body font-semibold tabular-nums">
          {t("orders.total", { total: formatRupees(total) })}
          {order.delivery_fee_paise > 0 && (
            <span className="font-normal text-ink-2"> · {t("deliv.fee", { fee: formatRupees(order.delivery_fee_paise) })}</span>
          )}
        </p>
      )}
      {order.order_refunds.map((r, i) => (
        <p key={i} className="flex items-start gap-2 text-footnote text-success">
          <RotateCcw aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t("order.refunded", { amount: formatRupees(r.amount_paise), reason: r.reason })}
        </p>
      ))}

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
        {!OPEN.includes(order.status) && total - refunded > 0 && (
          <button
            type="button"
            onClick={() => setRefunding(true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-fill px-3 text-footnote font-semibold text-ink"
          >
            <RotateCcw aria-hidden className="size-4" />
            {t("orders.refund")}
          </button>
        )}
        {OPEN.includes(order.status) && (
          <button type="button" onClick={() => setConfirmCancel(true)} className="ml-auto inline-flex min-h-11 items-center px-2 text-footnote font-semibold text-danger">
            {t("orders.cancel")}
          </button>
        )}
      </div>

      {refunding && <RefundSheet order={order} left={total - refunded} onClose={() => setRefunding(false)} />}
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

// A refund on a finished order: the amount and why. The money goes
// back in cash or by UPI; this records it for the shop and the customer.
function RefundSheet({ order, left, onClose }: { order: OwnerOrder; left: number; onClose: () => void }) {
  const { t } = useLang();
  const router = useRouter();
  const [amount, setAmount] = useState(String(left / 100));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  async function save() {
    const paise = Math.round(Number.parseFloat(amount.replace(/[₹,\s]/g, "")) * 100);
    if (!(paise > 0) || !reason.trim()) return setError("error.invalidChange");
    if (paise > left) return setError("error.refundTooBig");
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/orders/${order.id}/refunds`, { json: { amount_paise: paise, reason: reason.trim() } });
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
      title={t("orders.refund.title", { code: order.code })}
      doneLabel={t("action.cancel")}
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
              {t(error)}
            </p>
          )}
          <Button size="lg" loading={busy} onClick={save}>
            {t("orders.refund")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-footnote text-ink-2">{t("orders.refund.note")}</p>
        <TextField label={t("orders.refund.amount")} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <TextField label={t("orders.refund.reason")} value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} />
      </div>
    </Sheet>
  );
}

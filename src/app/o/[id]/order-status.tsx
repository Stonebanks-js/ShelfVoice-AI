"use client";

import { Ban, Check, ChevronLeft, CircleCheck, Clock, IndianRupee, PackageCheck, Phone, RotateCcw, Truck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/feedback";
import { QrCode } from "@/components/ui/qr-code";
import type { MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { api } from "@/lib/api";
import { formatRupees } from "@/lib/changes-view";
import { cn } from "@/lib/cn";
import { upiLink } from "@/lib/delivery";
import type { OrderView } from "@/server/orders";

const OPEN = ["NEW", "ACCEPTED", "READY"];

function headline(order: OrderView): { key: MessageKey; icon: ReactNode; tone: string } {
  switch (order.status) {
    case "NEW":
      return { key: "order.NEW", icon: <Clock />, tone: "bg-fill text-ink" };
    case "ACCEPTED":
      return { key: "order.ACCEPTED", icon: <PackageCheck />, tone: "bg-fill text-ink" };
    case "READY":
      return order.fulfilment === "DELIVERY"
        ? { key: "order.READY.DELIVERY", icon: <Truck />, tone: "bg-success-soft text-success" }
        : { key: "order.READY.PICKUP", icon: <CircleCheck />, tone: "bg-success-soft text-success" };
    case "COMPLETED":
      return { key: "order.COMPLETED", icon: <Check />, tone: "bg-success-soft text-success" };
    case "CANCELLED":
      return { key: "order.CANCELLED", icon: <Ban />, tone: "bg-danger-soft text-danger" };
  }
}

// The customer's order (V-04): where it is, what the shop has, about how
// much, and a way to call. Checks again every 20 seconds while it's open.
export function OrderStatusView({ initial, token }: { initial: OrderView | null; token: string }) {
  const { lang, t } = useLang();
  const [order, setOrder] = useState(initial);
  const [checked, setChecked] = useState(() => new Date());

  useEffect(() => {
    if (!order || !OPEN.includes(order.status)) return;
    const timer = setInterval(async () => {
      try {
        const fresh = await api<{ order: OrderView }>(`/api/v1/public/orders/${order.id}?t=${encodeURIComponent(token)}`);
        setOrder(fresh.order);
        setChecked(new Date());
      } catch {
        // Offline for a moment: try again on the next tick.
      }
    }, 20_000);
    return () => clearInterval(timer);
  }, [order, token]);

  if (!order) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6">
        <EmptyState icon={<Ban />} title={t("order.notFound")} />
      </main>
    );
  }

  const look = headline(order);
  const have = order.items.filter((i) => i.status !== "UNAVAILABLE");
  const total = have.reduce((sum, i) => sum + (i.pricePaise ?? 0) * i.qty, 0);
  const refunded = order.refunds.reduce((sum, r) => sum + r.amountPaise, 0);
  const due = order.status === "CANCELLED" ? 0 : Math.max(0, total + order.deliveryFeePaise - refunded);
  // V-05: pay the shop straight from a UPI app, once the shop has said what it has.
  const canPay = Boolean(order.shop.upiId) && due > 0 && order.status !== "NEW" && order.status !== "CANCELLED";
  const upi = canPay ? upiLink({ upiId: order.shop.upiId!, shopName: order.shop.name, amountPaise: due, note: `Order ${order.code}` }) : null;
  const modes = [order.shop.acceptsCash && t("pay.CASH"), order.shop.upiId && t("pay.UPI"), order.shop.payOnDelivery && order.fulfilment === "DELIVERY" && t("pay.cod")].filter(Boolean).join(" · ");
  const time = new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(checked);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <Link href={`/s/${order.shop.slug}`} className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start px-2 text-body font-semibold text-accent">
        <ChevronLeft aria-hidden className="size-5" />
        {t("order.back", { shop: order.shop.name })}
      </Link>
      <header className="flex flex-col gap-1">
        <p className="text-footnote font-semibold text-ink-2">{order.shop.name}</p>
        <h1 className="font-display text-large-title font-bold tracking-tight">{t("order.title", { code: order.code })}</h1>
      </header>

      <section role="status" className={cn("flex items-start gap-3 rounded-lg p-4", look.tone)}>
        <span aria-hidden className="mt-0.5 [&>svg]:size-6">
          {look.icon}
        </span>
        <span className="flex flex-col gap-1">
          <span className="text-headline font-semibold">{t(look.key)}</span>
          {order.status === "NEW" && <span className="text-footnote">{t("order.NEW.body")}</span>}
          {OPEN.includes(order.status) && <span className="text-footnote opacity-80">{t("order.updated", { time })}</span>}
        </span>
      </section>

      <ul aria-label={t("cart.title")} className="overflow-hidden rounded-md bg-surface shadow-card">
        {order.items.map((item, index) => (
          <li key={index} className="flex items-center gap-3 border-separator px-4 py-3 not-first:border-t">
            <span className={cn("flex min-w-0 flex-1 flex-col", item.status === "UNAVAILABLE" && "text-ink-2")}>
              <span className="text-body">
                {item.name} × {item.qty}
              </span>
              {item.unit && <span className="text-footnote text-ink-2">{item.unit}</span>}
            </span>
            {item.status === "UNAVAILABLE" ? (
              <Badge tone="danger">{t("order.unavailable")}</Badge>
            ) : (
              <span className="text-body tabular-nums">{item.pricePaise ? formatRupees(item.pricePaise * item.qty) : "—"}</span>
            )}
          </li>
        ))}
      </ul>
      {(total > 0 || order.deliveryFeePaise > 0) && (
        <div className="flex flex-col gap-1 px-1 text-body tabular-nums">
          {order.deliveryFeePaise > 0 && (
            <p className="flex justify-between text-footnote text-ink-2">
              <span>{t("cart.deliveryFee")}</span>
              <span>{formatRupees(order.deliveryFeePaise)}</span>
            </p>
          )}
          {order.refunds.map((r, i) => (
            <p key={i} className="flex items-start gap-2 text-footnote text-success">
              <RotateCcw aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t("order.refunded", { amount: formatRupees(r.amountPaise), reason: r.reason })}
            </p>
          ))}
          <p className="font-semibold">{t("order.due", { amount: formatRupees(due) })}</p>
        </div>
      )}
      {upi ? (
        <section className="flex flex-col items-center gap-3 rounded-lg bg-surface p-4 shadow-card">
          <a href={upi} className={buttonClass("filled", "lg")}>
            <IndianRupee aria-hidden className="size-5" />
            {t("order.payUpi", { amount: formatRupees(due) })}
          </a>
          <p className="text-footnote text-ink-2">{t("order.upiQr")}</p>
          <QrCode value={upi} label={t("order.payUpi", { amount: formatRupees(due) })} className="size-44 rounded-md" />
        </section>
      ) : (
        <p className="px-1 text-footnote text-ink-2">{modes ? t("order.payModes", { modes }) : t("cart.pay")}</p>
      )}

      {order.shop.phone && (
        <a href={`tel:${order.shop.phone}`} className={buttonClass("tinted", "lg", "mt-auto")}>
          <Phone aria-hidden className="size-5" />
          {t("store.call")}
        </a>
      )}
    </main>
  );
}

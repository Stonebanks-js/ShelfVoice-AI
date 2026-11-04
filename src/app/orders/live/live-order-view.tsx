"use client";

import { Bike, Check, ChevronLeft, CircleCheck, PackageCheck, Phone, Store } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import type { MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { useProductName } from "@/i18n/products";
import { formatRupees } from "@/lib/changes-view";
import { cn } from "@/lib/cn";
import { stageAt, useLiveOrders, type Stage } from "@/lib/live-orders";

const STAGES: Array<{ stage: Stage; key: MessageKey; icon: typeof Check }> = [
  { stage: "placed", key: "live.placed", icon: CircleCheck },
  { stage: "packed", key: "live.packed", icon: PackageCheck },
  { stage: "onTheWay", key: "live.onTheWay", icon: Bike },
  { stage: "delivered", key: "live.delivered", icon: Check },
];

// The confirmation and live tracker: "Order placed", minutes to go,
// each step lighting up as time passes, the items and the total.
export function LiveOrderView() {
  const { t } = useLang();
  const productName = useProductName();
  const ref = useSearchParams().get("ref");
  const order = useLiveOrders().find((o) => o.ref === ref);
  // Null until the page is live in the browser, where the order is kept: no
  // "not on this phone" flash before it's read.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock starts in the browser
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  if (now === null) return <main aria-busy className="min-h-dvh" />;
  if (!order) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6">
        <EmptyState
          icon={<Store />}
          title={t("live.missing")}
          action={
            <Link href="/shops" className={buttonClass("tinted", "md", "w-full")}>
              {t("store.allShops")}
            </Link>
          }
        />
      </main>
    );
  }

  const { stage, minutesLeft, progress } = stageAt(order, now);
  const reached = STAGES.findIndex((s) => s.stage === stage);
  const pickup = order.fulfilment === "PICKUP";
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <Link href={`/s/${order.slug}`} className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start px-2 text-body font-semibold text-accent">
        <ChevronLeft aria-hidden className="size-5" />
        {order.shop}
      </Link>

      <section className="flex animate-rise-in flex-col items-center gap-3 rounded-xl bg-success-soft px-5 py-6 text-center">
        <span aria-hidden className="grid size-16 place-items-center rounded-full bg-success text-white">
          <Check className="size-9" strokeWidth={3} />
        </span>
        <h1 className="font-display text-title font-bold tracking-tight">{t("live.title")}</h1>
        <p className="text-body text-ink-2">{t("live.code", { code: order.code })}</p>
        <p role="status" className="font-display text-large-title font-bold text-success tabular-nums">
          {stage === "delivered" ? t(pickup ? "live.readyNow" : "live.deliveredNow") : t(pickup ? "live.readyIn" : "live.arrivesIn", { n: minutesLeft })}
        </p>
      </section>

      {/* The live tracker: a bar that fills, and each step as it's reached. */}
      <section aria-labelledby="live-tracker" className="flex flex-col gap-4 rounded-xl bg-surface p-4 shadow-card">
        <h2 id="live-tracker" className="flex items-center gap-2 text-headline font-semibold">
          <span aria-hidden className="relative flex size-2.5">
            {stage !== "delivered" && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />}
            <span className="relative inline-flex size-2.5 rounded-full bg-success" />
          </span>
          {t(pickup ? "live.trackPickup" : "live.track")}
        </h2>
        <div className="h-2 overflow-hidden rounded-full bg-fill" aria-hidden>
          <div className="h-full rounded-full bg-success transition-[width] duration-1000" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <ol className="flex flex-col gap-3">
          {STAGES.filter((s) => !(pickup && s.stage === "onTheWay")).map(({ stage: s, key, icon: Icon }, i) => {
            const done = STAGES.findIndex((x) => x.stage === s) <= reached;
            return (
              <li key={s} className="flex items-center gap-3" aria-current={s === stage ? "step" : undefined}>
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", done ? "bg-success text-white" : "bg-fill text-ink-3")}>
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className={cn("text-body", done ? "font-semibold text-ink" : "text-ink-2")}>
                  {t(pickup && s === "delivered" ? "live.ready" : key)}
                  <span className="sr-only">{done ? ` · ${t("live.done")}` : ""}</span>
                </span>
                {i === 0 && <span className="ml-auto text-footnote text-ink-2 tabular-nums">{new Date(order.placedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="live-items" className="flex flex-col gap-2">
        <h2 id="live-items" className="px-1 text-footnote font-medium text-ink-2">
          {t("live.items")}
        </h2>
        <ul className="overflow-hidden rounded-md bg-surface shadow-card">
          {order.items.map((item, i) => (
            <li key={`${i}-${item.name}`} className="flex justify-between gap-3 border-separator px-4 py-2.5 text-body not-first:border-t">
              <span>
                {productName(item.name)} × {item.qty}
              </span>
              <span className="tabular-nums">{item.pricePaise ? formatRupees(item.pricePaise * item.qty) : ""}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 border-t border-separator px-4 py-2.5 text-body font-semibold">
            <span>{t("cart.totalLine")}</span>
            <span className="tabular-nums">{formatRupees(order.totalPaise)}</span>
          </li>
        </ul>
        <p className="px-1 text-footnote text-ink-2">{t("live.pay")}</p>
      </section>

      <div className="mt-auto grid gap-2">
        {order.link && (
          <Link href={order.link} className={buttonClass("tinted", "lg")}>
            {t("live.status")}
          </Link>
        )}
        {order.phone && (
          <a href={`tel:${order.phone}`} className={buttonClass("gray", "lg")}>
            <Phone aria-hidden className="size-5" />
            {t("store.call")}
          </a>
        )}
      </div>
    </main>
  );
}

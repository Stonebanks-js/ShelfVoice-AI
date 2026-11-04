"use client";

import { Bike, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useLang } from "@/i18n/lang";
import { cn } from "@/lib/cn";
import { isCurrent, stageAt, useLiveOrders } from "@/lib/live-orders";

// "Your current orders": each order still on its way from this phone,
// with minutes to go and a link to its live tracker. Nothing when there are
// none, so pages look the same as before for everyone else.
export function CurrentOrders({ className }: { className?: string }) {
  const { t } = useLang();
  const orders = useLiveOrders();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock starts in the browser
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  if (now === null) return null;
  const current = orders.filter((o) => isCurrent(o, now));
  if (!current.length) return null;
  return (
    <section aria-labelledby="current-orders" className={cn("flex flex-col gap-2", className)}>
      <h2 id="current-orders" className="px-1 text-footnote font-semibold text-ink-2">
        {t("live.current")}
      </h2>
      {current.map((order) => {
        const { stage, minutesLeft } = stageAt(order, now);
        const pickup = order.fulfilment === "PICKUP";
        return (
          <Link
            key={order.ref}
            href={`/orders/live?ref=${encodeURIComponent(order.ref)}`}
            className="flex animate-rise-in items-center gap-3 rounded-lg bg-success-soft p-3 active:opacity-80"
          >
            <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-success">
              <Bike className="size-6" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body font-semibold">{order.shop}</span>
              <span className="text-footnote text-ink">
                {stage === "delivered" ? t(pickup ? "live.readyNow" : "live.deliveredNow") : t(pickup ? "live.readyIn" : "live.arrivesIn", { n: minutesLeft })}
              </span>
            </span>
            <span className="text-footnote font-semibold text-success">{t("live.trackShort")}</span>
            <ChevronRight aria-hidden className="size-5 shrink-0 text-success" />
          </Link>
        );
      })}
    </section>
  );
}

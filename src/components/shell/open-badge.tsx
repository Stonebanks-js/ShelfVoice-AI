"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/controls";
import { useLang } from "@/i18n/lang";
import { dayName, formatTime, openStatus, shopClock, type Hours } from "@/lib/hours";

// Doc 06 OpenNowBadge: "Open now" / "Closed, opens 7 AM", in the shop's time.
export function OpenBadge({ hours, timeZone }: { hours: Hours; timeZone: string }) {
  const { lang, t } = useLang();
  const [now] = useState(() => new Date());
  const status = openStatus(hours, now, timeZone);
  const label = status.open
    ? t("shop.closesAt", { time: formatTime(status.closesAt, lang) })
    : status.opensAt === null || status.opensDay === null
      ? t("shop.noHours")
      : status.opensDay === shopClock(now, timeZone).day
        ? t("shop.opensAt", { time: formatTime(status.opensAt, lang) })
        : t("shop.opensOn", { day: dayName(status.opensDay, lang), time: formatTime(status.opensAt, lang) });
  return (
    // The minute can differ between the server's render and the browser's.
    <span suppressHydrationWarning className="shrink-0">
      <Badge tone={status.open ? "success" : "neutral"}>{label}</Badge>
    </span>
  );
}

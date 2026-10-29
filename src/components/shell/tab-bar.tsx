"use client";

import { ChartColumn, MessageSquareText, Package, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import type { MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { cn } from "@/lib/cn";

const TABS: Array<{ href: string; label: MessageKey; icon: ReactNode }> = [
  { href: "/app", label: "tab.today", icon: <ChartColumn aria-hidden /> },
  { href: "/app/stock", label: "tab.stock", icon: <Package aria-hidden /> },
  { href: "/app/orders", label: "tab.orders", icon: <ShoppingCart aria-hidden /> },
  { href: "/app/reviews", label: "tab.reviews", icon: <MessageSquareText aria-hidden /> },
];

// Doc 06 U3: four tabs with the mic in the centre slot, on a frosted bar that
// sits in the thumb zone. `preview` renders it in place for the style guide.
export function TabBar({ mic, preview = false, active }: { mic: ReactNode; preview?: boolean; active?: string }) {
  const { t } = useLang();
  const pathname = usePathname();
  const current = active ?? pathname;
  const isActive = (href: string) => (href === "/app" ? current === "/app" : current.startsWith(href));
  const tab = (item: (typeof TABS)[number]) => (
    <Link
      key={item.href}
      href={preview ? "#" : item.href}
      aria-current={isActive(item.href) ? "page" : undefined}
      className={cn(
        "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-footnote font-medium [&>svg]:size-6",
        isActive(item.href) ? "text-accent" : "text-ink-2",
      )}
    >
      {item.icon}
      <span className="max-w-full truncate px-0.5">{t(item.label)}</span>
    </Link>
  );
  return (
    <nav
      aria-label={t("tab.label")}
      className={cn(
        "inset-x-0 bottom-0 z-40 border-t border-separator bg-chrome backdrop-blur-xl backdrop-saturate-150",
        preview ? "relative" : "fixed",
      )}
    >
      <div className="mx-auto flex max-w-lg items-end px-1 pb-[env(safe-area-inset-bottom)]">
        {TABS.slice(0, 2).map(tab)}
        <div className="-mt-7 flex shrink-0 justify-center px-2 pb-1">{mic}</div>
        {TABS.slice(2).map(tab)}
      </div>
    </nav>
  );
}

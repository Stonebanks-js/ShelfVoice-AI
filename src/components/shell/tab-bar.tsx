"use client";

import { House, MessageSquareText, ReceiptText, Store } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";

import type { MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { cn } from "@/lib/cn";

type Icon = ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;

// My shop holds the products and their stock, and adding more (V-02, E-36).
const TABS: Array<{ href: string; label: MessageKey; icon: Icon; also?: string[] }> = [
  { href: "/app", label: "tab.home", icon: House },
  { href: "/app/shop", label: "tab.shop", icon: Store, also: ["/app/stock", "/app/add"] },
  { href: "/app/orders", label: "tab.orders", icon: ReceiptText },
  { href: "/app/reviews", label: "tab.reviews", icon: MessageSquareText },
];

// Doc 06 U3, in the iOS 26 shape (E-35): four tabs on a floating frosted
// capsule inset from the screen edges, with the Bolo button beside it in the
// thumb zone. The selected tab is ink with a heavier icon, never colour
// alone. `preview` renders it in place for the style guide.
export function TabBar({ mic, preview = false, active }: { mic: ReactNode; preview?: boolean; active?: string }) {
  const { t } = useLang();
  const pathname = usePathname();
  const current = active ?? pathname;
  const isActive = (href: string, also: string[] = []) => (href === "/app" ? current === "/app" : [href, ...also].some((prefix) => current.startsWith(prefix)));
  return (
    <nav
      aria-label={t("tab.label")}
      className={cn(
        "inset-x-0 bottom-0 z-40 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]",
        preview ? "relative" : "pointer-events-none fixed",
      )}
    >
      <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-3">
        <div className="flex min-w-0 flex-1 rounded-full border border-separator bg-chrome p-1 shadow-float backdrop-blur-xl backdrop-saturate-150">
          {TABS.map(({ href, label, icon: TabIcon, also }) => {
            const on = isActive(href, also);
            return (
              <Link
                key={href}
                href={preview ? "#" : href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-footnote leading-tight",
                  on ? "font-semibold text-ink" : "font-medium text-ink-2",
                )}
              >
                <TabIcon aria-hidden className="size-6" strokeWidth={on ? 2.4 : 1.75} />
                <span className="max-w-full truncate px-0.5">{t(label)}</span>
              </Link>
            );
          })}
        </div>
        <div className="shrink-0">{mic}</div>
      </div>
    </nav>
  );
}

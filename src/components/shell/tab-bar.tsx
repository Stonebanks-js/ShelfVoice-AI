"use client";

import { ExternalLink, House, MessageSquareText, PackagePlus, ReceiptText, Store } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";

import { LogoMark, Wordmark } from "@/components/brand/logo";
import { isRegional, type MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { cn } from "@/lib/cn";

type Icon = ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;

// My shop holds the products and their stock, and adding more (V-02, E-36).
// The same four places are the desktop sidebar (E-37).
export const TABS: Array<{ href: string; label: MessageKey; icon: Icon; also?: string[] }> = [
  { href: "/app", label: "tab.home", icon: House },
  { href: "/app/shop", label: "tab.shop", icon: Store, also: ["/app/stock", "/app/add", "/app/restock"] },
  { href: "/app/orders", label: "tab.orders", icon: ReceiptText },
  { href: "/app/reviews", label: "tab.reviews", icon: MessageSquareText },
];

export const isTabActive = (current: string, href: string, also: string[] = []) =>
  href === "/app" ? current === "/app" : [href, ...also].some((prefix) => current.startsWith(prefix));

// Doc 06 U3, in the iOS 26 shape (E-35): four tabs on a floating frosted
// capsule inset from the screen edges, with the Bolo button beside it in the
// thumb zone. The selected tab is ink with a heavier icon, never colour
// alone. `preview` renders it in place for the style guide.
// From 1024 px the same nav is a sidebar (E-37): the product and the shop at
// the top, the four places, quick links, and the Bolo button at the foot. One
// nav and one mic at every width, so the landmark never moves.
export function TabBar({
  mic,
  preview = false,
  active,
  shop,
}: {
  mic: ReactNode;
  preview?: boolean;
  active?: string;
  shop?: { name: string; slug: string };
}) {
  const { lang, t } = useLang();
  const pathname = usePathname();
  const current = active ?? pathname;
  const isActive = (href: string, also: string[] = []) => isTabActive(current, href, also);
  const side = !preview; // the style guide shows the phone bar only
  return (
    <nav
      aria-label={t("tab.label")}
      className={cn(
        "inset-x-0 bottom-0 z-40 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]",
        preview ? "relative" : "pointer-events-none fixed",
        side &&
          "lg:pointer-events-auto lg:inset-y-0 lg:right-auto lg:w-64 lg:border-r lg:border-separator lg:bg-surface lg:px-3 lg:pt-5 lg:pb-5",
      )}
    >
      <div className={cn("pointer-events-auto mx-auto flex max-w-lg items-center gap-3", side && "lg:h-full lg:max-w-none lg:flex-col lg:items-stretch lg:gap-6")}>
        {side && (
          <>
            <div className="hidden items-center gap-3 px-2 lg:flex">
              <Link href="/app" className="flex shrink-0 items-center gap-3 rounded-lg">
                <LogoMark className="h-9 w-auto text-ink" cut="stroke-surface" />
                <Wordmark name={t("app.name")} className="text-headline leading-tight" />
              </Link>
            </div>
            {shop && <p className="-mt-5 hidden truncate px-2 pl-[3.75rem] text-footnote text-ink-2 lg:block">{shop.name}</p>}
          </>
        )}
        <div
          className={cn(
            "flex min-w-0 flex-1 rounded-full border border-separator bg-chrome p-1 shadow-float backdrop-blur-xl backdrop-saturate-150",
            side && "lg:flex-none lg:flex-col lg:gap-1 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none",
          )}
        >
          {TABS.map(({ href, label, icon: TabIcon, also }) => {
            const on = isActive(href, also);
            return (
              <Link
                key={href}
                href={preview ? "#" : href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-footnote leading-tight transition-colors",
                  side && "lg:min-h-11 lg:flex-none lg:flex-row lg:justify-start lg:gap-3 lg:rounded-md lg:px-3 lg:text-body lg:hover:bg-fill",
                  on ? "font-semibold text-ink" : "font-medium text-ink-2",
                  on && side && "lg:bg-accent-soft lg:hover:bg-accent-soft",
                )}
              >
                <TabIcon aria-hidden className={cn("size-6 shrink-0", side && "lg:size-5", on && side && "lg:text-accent-fill")} strokeWidth={on ? 2.4 : 1.75} />
                {/* Regional scripts run wider (V-06): a phone tab bar's 12 px, and a
                    second line between words ("ನನ್ನ ಅಂಗಡಿ") rather than cut off. */}
                <span className={cn("line-clamp-2 max-w-full text-center", side && "lg:text-left", isRegional(lang) && "text-xs lg:text-body")}>
                  {t(label)}
                </span>
              </Link>
            );
          })}
        </div>
        {side && (
          <div className="hidden flex-col gap-1 border-t border-separator pt-4 lg:flex">
            <SideLink href="/app/add" icon={<PackagePlus />} label={t("add.title")} />
            {shop && <SideLink href={`/s/${shop.slug}`} icon={<ExternalLink />} label={t("shop.view")} />}
          </div>
        )}
        <div className={cn("shrink-0", side && "lg:mt-auto lg:flex lg:items-center lg:gap-3 lg:rounded-lg lg:bg-surface-2 lg:p-3")}>
          {mic}
          {side && (
            <span className="hidden min-w-0 lg:block">
              <span className="block text-body font-semibold">{t("tab.bolo")}</span>
              <span className="block text-footnote text-ink-2">{t("tab.boloHint")}</span>
            </span>
          )}
        </div>
      </div>
    </nav>
  );
}

function SideLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center gap-3 rounded-md px-3 text-body font-medium text-ink-2 transition-colors hover:bg-fill [&>svg]:size-5 [&>svg]:shrink-0"
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
}

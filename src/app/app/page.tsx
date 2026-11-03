import { Camera, CircleAlert, Frown, History, Meh, MessageSquareText, Mic, Package, ReceiptText, ShoppingBag, Smile, Store, TrendingDown, TrendingUp, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { Badge } from "@/components/ui/controls";
import { ListGroup, ListRow } from "@/components/ui/list";
import { ProductThumb } from "@/components/ui/product-thumb";
import { type Lang, localeFor, type MessageKey, translate } from "@/i18n/dictionary";
import { formatRupees } from "@/lib/changes-view";
import { ownerState, requestLang } from "@/server/session";
import { ownerClient } from "@/server/supabase";
import { todaySummary, type TodaySummary } from "@/server/today";

import Loading from "./loading";
import { ShopCard } from "./shop-card";

// O-5 Home (doc 06 Today, reshaped by V-02): the shop first, with View,
// Share and Edit (or Build for an empty shop), then today's sales, what's
// running low, what customers said and the latest changes.
export default function TodayPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Today />
    </Suspense>
  );
}

async function Today() {
  const state = await ownerState();
  if (!state) redirect("/");
  if (!state.shop) redirect("/app/welcome");
  const lang = await requestLang(state);
  const now = new Date(); // one clock for the whole screen
  const summary = await todaySummary(await ownerClient(), state.shop.id, now);
  const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const weekday = new Intl.DateTimeFormat(localeFor(lang), { weekday: "long", timeZone: "Asia/Kolkata" }).format(now);

  return (
    // Phone: one column, the day's answer first. From 1024 px a two-column
    // dashboard: the day on the left, the shop and what customers said on
    // the right (E-37).
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-6 lg:max-w-6xl lg:px-4">
      <header className="flex items-end justify-between gap-3 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] lg:pt-8">
        <div>
          <p className="text-footnote font-medium text-ink-2">{t("home.today", { day: weekday })}</p>
          <h1 className="font-display text-large-title font-bold tracking-tight">{t("tab.home")}</h1>
        </div>
        <Link
          href="/app/shop"
          aria-label={t("home.account")}
          className="mb-1 grid size-11 place-items-center rounded-full bg-surface text-ink shadow-card transition-transform active:scale-95"
        >
          <UserRound aria-hidden className="size-5" />
        </Link>
      </header>

      {summary.productCount === 0 ? (
        <ShopCard id={state.shop.id} name={state.shop.name} slug={state.shop.slug} published={state.shop.isPublished} productCount={0} />
      ) : (
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <SalesCard summary={summary} weekday={weekday.split(",")[0]} t={t} />
          </div>
          <div className="min-w-0 lg:col-start-2 lg:row-start-1">
            <ShopCard id={state.shop.id} name={state.shop.name} slug={state.shop.slug} published={state.shop.isPublished} productCount={summary.productCount} />
          </div>
          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <OrdersList summary={summary} lang={lang} now={now} t={t} />
          </div>
          <div className="min-w-0 lg:col-start-1 lg:row-start-3">
            <LowList summary={summary} t={t} />
          </div>
          <div className="flex min-w-0 flex-col gap-6 lg:col-start-2 lg:row-span-2 lg:row-start-2">
            <ReviewList summary={summary} lang={lang} now={now} t={t} />
            <RecentList summary={summary} lang={lang} now={now} t={t} />
          </div>
        </div>
      )}
    </main>
  );
}

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

function SalesCard({ summary, weekday, t }: { summary: TodaySummary; weekday: string; t: T }) {
  const change = summary.lastWeekPaise > 0 ? Math.round(((summary.salesPaise - summary.lastWeekPaise) / summary.lastWeekPaise) * 100) : null;
  return (
    // The day's answer, in the logo's red (E-37); white on it is 5.9:1.
    <section aria-labelledby="sales-title" className="relative mx-4 overflow-hidden rounded-xl bg-accent-fill p-5 text-on-accent shadow-float lg:p-6">
      <svg aria-hidden viewBox="0 0 200 120" className="pointer-events-none absolute -right-6 -bottom-8 h-28 w-auto opacity-15 lg:h-40">
        {/* The logo's voice bars, large and quiet, as the card's mark. */}
        {[20, 55, 90, 125, 160].map((x, i) => {
          const h = [40, 70, 100, 70, 40][i];
          return <rect key={x} x={x} y={60 - h / 2} width="18" height={h} rx="9" fill="currentColor" />;
        })}
      </svg>
      <h2 id="sales-title" className="text-footnote font-semibold">
        {t("today.sales")}
      </h2>
      {summary.salesPaise === 0 ? (
        <p className="mt-2 max-w-sm text-body">{t("today.noSales")}</p>
      ) : (
        <>
          <p className="mt-1 font-display text-figure font-bold tabular-nums tracking-tight lg:text-[3.25rem] lg:leading-[3.5rem]">
            {formatRupees(summary.salesPaise)}
          </p>
          <p className="text-footnote">{t("today.units", { n: summary.unitsSold })}</p>
          {change !== null && (
            // Icon plus words, never colour alone (doc 06).
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1 text-footnote font-semibold">
              {change >= 0 ? <TrendingUp aria-hidden className="size-4" /> : <TrendingDown aria-hidden className="size-4" />}
              {change === 0
                ? t("today.vsSame", { day: weekday })
                : t(change > 0 ? "today.vsUp" : "today.vsDown", { pct: Math.abs(change), day: weekday })}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function daysLabel(days: number | null, t: T): string {
  if (days === null) return t("status.low");
  const whole = Math.floor(days);
  if (whole <= 0) return t("today.low.out");
  return whole === 1 ? t("today.low.day") : t("today.low.days", { n: whole });
}

function SeeAll({ href, t }: { href: string; t: T }) {
  return (
    <Link href={href} className="inline-flex min-h-10 items-center text-footnote font-semibold text-accent">
      {t("today.seeAll")}
    </Link>
  );
}

function LowList({ summary, t }: { summary: TodaySummary; t: T }) {
  return (
    <div className="px-4">
      <ListGroup
        header={
          <span className="flex items-center justify-between">
            {/* Own colour classes: inherited colours can lag a live light/dark switch. */}
            <span className="text-ink-2">
              {t("today.low.title")} {summary.lowCount > 0 && <span className="text-ink-2 tabular-nums">· {summary.lowCount}</span>}
            </span>
            {summary.lowCount > 0 && <SeeAll href="/app/restock" t={t} />}
          </span>
        }
      >
        {summary.low.length === 0 ? (
          <ListRow icon={<Package />} iconTone="success" title={t("today.low.none")} />
        ) : (
          summary.low.map((item) => (
            <ListRow
              key={item.id}
              wrap
              href="/app/restock"
              media={<ProductThumb name={item.name} size="sm" />}
              title={item.name}
              subtitle={
                item.flagged ? (
                  <span className="inline-flex items-center gap-1 text-danger">
                    <CircleAlert aria-hidden className="size-3.5" />
                    {t("today.low.flagged")}
                  </span>
                ) : item.orderQty ? (
                  t("today.low.order", { n: item.orderQty })
                ) : undefined
              }
              value={<Badge tone="low">{daysLabel(item.daysLeft, t)}</Badge>}
            />
          ))
        )}
      </ListGroup>
    </div>
  );
}

const SENTIMENT: Record<string, { icon: ReactNode; tone: "success" | "accent" | "danger" }> = {
  POSITIVE: { icon: <Smile />, tone: "success" },
  NEUTRAL: { icon: <Meh />, tone: "accent" },
  NEGATIVE: { icon: <Frown />, tone: "danger" },
};

function ReviewList({ summary, lang, now, t }: { summary: TodaySummary; lang: Lang; now: Date; t: T }) {
  const when = new Intl.RelativeTimeFormat(localeFor(lang), { numeric: "auto" });
  const ago = (iso: string) => {
    const hours = Math.round((new Date(iso).getTime() - now.getTime()) / 3_600_000);
    return Math.abs(hours) < 24 ? when.format(hours, "hour") : when.format(Math.round(hours / 24), "day");
  };
  return (
    <div className="px-4">
      <ListGroup
        header={
          <span className="flex items-center justify-between">
            <span className="text-ink-2">
              {t("today.reviews.title")}
              {summary.newReviews > 0 && <span className="text-ink-2"> · {t("today.reviews.new", { n: summary.newReviews })}</span>}
            </span>
            {summary.newReviews > 0 && <SeeAll href="/app/reviews" t={t} />}
          </span>
        }
      >
        {summary.reviews.length === 0 ? (
          <ListRow icon={<MessageSquareText />} iconTone="gray" title={t("today.reviews.none")} />
        ) : (
          summary.reviews.map((review) => {
            const look = review.sentiment ? SENTIMENT[review.sentiment] : null;
            return (
              <ListRow
                key={review.id}
                wrap
                href="/app/reviews"
                icon={look?.icon ?? <MessageSquareText />}
                iconTone={look?.tone ?? "gray"}
                title={review.summary ?? "…"}
                subtitle={`${review.sentiment ? t(`sentiment.${review.sentiment}`) : ""} · ${ago(review.createdAt)}`}
              />
            );
          })
        )}
      </ListGroup>
    </div>
  );
}

const KIND_ICON: Record<TodaySummary["recent"][number]["kind"], ReactNode> = {
  COMMAND: <Mic />,
  SETUP: <Store />,
  BILL: <ReceiptText />,
  SHELF: <Camera />,
};

// The last few confirmed voice and photo changes, so the owner can see what
// the app just did (V-02).
function RecentList({ summary, lang, now, t }: { summary: TodaySummary; lang: Lang; now: Date; t: T }) {
  const when = new Intl.RelativeTimeFormat(localeFor(lang), { numeric: "auto" });
  const ago = (iso: string) => {
    const minutes = Math.round((new Date(iso).getTime() - now.getTime()) / 60_000);
    if (Math.abs(minutes) < 60) return when.format(minutes, "minute");
    const hours = Math.round(minutes / 60);
    return Math.abs(hours) < 24 ? when.format(hours, "hour") : when.format(Math.round(hours / 24), "day");
  };
  return (
    <div className="px-4">
      <ListGroup header={t("home.recent.title")}>
        {summary.recent.length === 0 ? (
          <ListRow icon={<History />} iconTone="gray" title={t("home.recent.none")} wrap />
        ) : (
          summary.recent.map((change) => (
            <ListRow
              key={change.id}
              icon={KIND_ICON[change.kind]}
              title={t(`home.recent.${change.kind}`)}
              subtitle={`${t("toast.saved", { n: change.changes })} · ${ago(change.decidedAt)}`}
            />
          ))
        )}
      </ListGroup>
    </div>
  );
}

// New customer orders, first on Home so none waits (V-04).
function OrdersList({ summary, lang, now, t }: { summary: TodaySummary; lang: Lang; now: Date; t: T }) {
  const when = new Intl.RelativeTimeFormat(localeFor(lang), { numeric: "auto" });
  const ago = (iso: string) => {
    const minutes = Math.round((new Date(iso).getTime() - now.getTime()) / 60_000);
    return Math.abs(minutes) < 60 ? when.format(minutes, "minute") : when.format(Math.round(minutes / 60), "hour");
  };
  const count = summary.newOrders.length;
  return (
    <div className="px-4">
      <ListGroup
        header={
          <span className="flex items-center justify-between">
            <span className="text-ink-2">
              {t("home.requests.title")} {count > 0 && <span className="text-ink-2">· {t("home.requests.new", { n: count })}</span>}
            </span>
            {count > 0 && <SeeAll href="/app/orders" t={t} />}
          </span>
        }
      >
        {count === 0 ? (
          <ListRow icon={<ShoppingBag />} iconTone="gray" title={t("home.requests.none")} href="/app/orders" />
        ) : (
          summary.newOrders.slice(0, 3).map((order) => (
            <ListRow
              key={order.id}
              href="/app/orders"
              icon={<ShoppingBag />}
              iconTone="check"
              title={order.name}
              subtitle={`${order.code} · ${order.items === 1 ? t("cart.item1") : t("cart.items", { n: order.items })} · ${ago(order.createdAt)}`}
              value={<Badge tone="check">{t("orders.status.NEW")}</Badge>}
            />
          ))
        )}
      </ListGroup>
    </div>
  );
}

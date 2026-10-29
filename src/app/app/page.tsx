import { ChevronRight, CircleAlert, Frown, Meh, MessageSquareText, Mic, Package, Smile, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/feedback";
import { ListGroup, ListRow } from "@/components/ui/list";
import { translate, type Lang, type MessageKey } from "@/i18n/dictionary";
import { formatRupees } from "@/lib/changes-view";
import { ownerState, requestLang } from "@/server/session";
import { ownerClient } from "@/server/supabase";
import { todaySummary, type TodaySummary } from "@/server/today";

import Loading from "./loading";

// O-5 Today (doc 06): the daily overview. Sales so far, what's running low
// and what customers said, each linking to its tab; the mic is in the bar.
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
  const weekday = new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { weekday: "long", timeZone: "Asia/Kolkata" }).format(now);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-6">
      {/* The shop name opens My shop (doc 06 information architecture). */}
      <header className="flex items-end justify-between gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-2">
        <div className="min-w-0">
          <Link href="/app/shop" className="-mx-1 inline-flex min-h-8 items-center gap-0.5 rounded-sm px-1 text-footnote font-semibold text-accent">
            <span className="truncate">{state.shop.name}</span>
            <ChevronRight aria-hidden className="size-4 shrink-0" />
          </Link>
          <h1 className="font-display text-large-title font-bold tracking-tight">{t("tab.today")}</h1>
        </div>
        <p className="pb-1.5 text-footnote text-ink-2">{weekday}</p>
      </header>

      {summary.productCount === 0 ? (
        <div className="px-4">
          <EmptyState
            icon={<Mic />}
            title={t("today.setup.title")}
            body={t("today.setup.body")}
            action={
              <ButtonLink href="/app/setup" size="lg" icon={<Mic aria-hidden className="size-5" />}>
                {t("today.setup.cta")}
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <>
          <SalesCard summary={summary} weekday={weekday.split(",")[0]} t={t} />
          <LowList summary={summary} t={t} />
          <ReviewList summary={summary} lang={lang} now={now} t={t} />
        </>
      )}
    </main>
  );
}

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

function SalesCard({ summary, weekday, t }: { summary: TodaySummary; weekday: string; t: T }) {
  const change = summary.lastWeekPaise > 0 ? Math.round(((summary.salesPaise - summary.lastWeekPaise) / summary.lastWeekPaise) * 100) : null;
  return (
    <section aria-labelledby="sales-title" className="mx-4 rounded-lg bg-surface p-4 shadow-card">
      <h2 id="sales-title" className="text-footnote font-semibold text-ink-2">
        {t("today.sales")}
      </h2>
      {summary.salesPaise === 0 ? (
        <p className="mt-2 text-body text-ink-2">{t("today.noSales")}</p>
      ) : (
        <>
          <p className="font-display text-figure font-bold tabular-nums tracking-tight">{formatRupees(summary.salesPaise)}</p>
          <p className="text-footnote text-ink-2">{t("today.units", { n: summary.unitsSold })}</p>
          {change !== null && (
            // Icon plus words, never colour alone (doc 06).
            <p className={`mt-2 flex items-center gap-1.5 text-footnote font-medium ${change >= 0 ? "text-success" : "text-danger"}`}>
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
            <span>
              {t("today.low.title")} {summary.lowCount > 0 && <span className="tabular-nums">· {summary.lowCount}</span>}
            </span>
            {summary.lowCount > 0 && <SeeAll href="/app/orders" t={t} />}
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
              href="/app/orders"
              icon={<Package />}
              iconTone="check"
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
  const when = new Intl.RelativeTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { numeric: "auto" });
  const ago = (iso: string) => {
    const hours = Math.round((new Date(iso).getTime() - now.getTime()) / 3_600_000);
    return Math.abs(hours) < 24 ? when.format(hours, "hour") : when.format(Math.round(hours / 24), "day");
  };
  return (
    <div className="px-4">
      <ListGroup
        header={
          <span className="flex items-center justify-between">
            <span>
              {t("today.reviews.title")}
              {summary.newReviews > 0 && <span> · {t("today.reviews.new", { n: summary.newReviews })}</span>}
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


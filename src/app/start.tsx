"use client";

import { AudioLines, ChevronLeft, ChevronRight, MapPin, PackageCheck, ShoppingBag, Store } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { LanguagePicker, SuggestLanguage, type LanguageSuggestion } from "@/components/shell/language-picker";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { buttonClass } from "@/components/ui/button";
import { ProductThumb } from "@/components/ui/product-thumb";
import { useLang } from "@/i18n/lang";

import { Splash } from "./splash";

// The first screen (E-36): two plain choices, so nobody has to guess which
// button is theirs. Shop owners go on to sign in; customers find shops
// near them without an account.
//
// E-37: the brand leads. On a phone the logo's red fills the screen and the
// choices rise over it on a sheet at the bottom, in thumb reach; from 1024 px the screen splits, the red
// side showing what the app does (a spoken line becoming shop products).
//
// V-10 (testers, Nov 3): first a short splash, then a welcome that says what
// the app is, and only after "Get started" the two choices. The choices live
// at /?who=1, so the phone's back button returns to the welcome.
export function Start({ suggestion }: { suggestion: LanguageSuggestion | null }) {
  const { lang, t } = useLang();
  const choosing = useSearchParams().get("who") === "1";
  return (
    <>
      <Splash />
      <main className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="relative flex flex-1 flex-col overflow-hidden bg-accent-fill px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-14 text-on-accent lg:min-h-dvh lg:px-14 lg:pt-10 lg:pb-12">
          <VoiceBars />
          <div className="relative flex items-center justify-between gap-4">
            <span className="grid size-14 place-items-center rounded-lg bg-surface shadow-float lg:size-16">
              <LogoMark className="h-9 w-auto text-ink lg:h-10" cut="stroke-surface" />
            </span>
            {/* The pill stays white on the red so its words keep their contrast. */}
            <div className="[&_[data-testid=language-picker]]:bg-surface [&_[data-testid=language-picker]]:text-ink">
              <LanguagePicker />
            </div>
          </div>

          <div className="relative flex flex-1 flex-col justify-end gap-3 pt-10 lg:justify-center lg:gap-5">
            <h1 className="font-display text-[2.75rem] leading-[1] font-bold tracking-tight lg:text-[4.5rem]">
              <Wordmark name={t("app.name")} />
            </h1>
            <p className="max-w-md text-headline lg:text-title lg:leading-snug">{t("app.tagline")}</p>
            <SpokenDemo />
          </div>
        </section>

        <section className="relative -mt-6 flex flex-col rounded-t-[1.75rem] bg-bg px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:mt-0 lg:justify-center lg:rounded-none lg:px-14">
          {choosing ? (
            <div key="choose" className="mx-auto flex w-full max-w-md animate-rise-in flex-col gap-4">
              <nav aria-labelledby="start-question" className="flex flex-col gap-3">
                <div className="flex items-center gap-1">
                  <Link href="/" aria-label={t("action.back")} className="-ml-2 grid size-11 place-items-center rounded-full text-ink active:bg-fill">
                    <ChevronLeft aria-hidden className="size-6" />
                  </Link>
                  <h2 id="start-question" className="font-display text-title font-bold tracking-tight">
                    {t("start.question")}
                  </h2>
                </div>
                <Choice href="/owner" tone="brand" icon={<Store />} title={t("start.owner.title")} body={t("start.owner.body")} />
                <Choice href="/shops" tone="green" icon={<MapPin />} title={t("start.customer.title")} body={t("start.customer.body")} />
              </nav>
              <PrivacyLink lang={lang} label={t("privacy.link")} />
            </div>
          ) : (
            <div key="welcome" className="mx-auto flex w-full max-w-md animate-rise-in flex-col gap-4">
              {suggestion && <SuggestLanguage suggestion={suggestion} />}
              <ul className="flex flex-col gap-3">
                <Point tone={1} icon={<AudioLines />} title={t("start.point.voice")} body={t("start.point.voiceBody")} />
                <Point tone={4} icon={<PackageCheck />} title={t("start.point.stock")} body={t("start.point.stockBody")} />
                <Point tone={8} icon={<ShoppingBag />} title={t("start.point.orders")} body={t("start.point.ordersBody")} />
              </ul>
              <Link href="/?who=1" data-testid="get-started" className={buttonClass("filled", "lg")}>
                {t("start.getStarted")}
                <ChevronRight aria-hidden className="size-5" />
              </Link>
              <Link href="/shops" className={buttonClass("tinted", "lg")}>
                <MapPin aria-hidden className="size-5" />
                {t("start.findShops")}
              </Link>
              <PrivacyLink lang={lang} label={t("privacy.link")} />
            </div>
          )}
        </section>
      </main>
    </>
  );
}

// What the app does, one line each, on the welcome (V-10).
function Point({ icon, title, body, tone }: { icon: ReactNode; title: string; body: string; tone: number }) {
  return (
    <li className="flex items-start gap-3 rounded-xl bg-surface p-4 shadow-card">
      <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-lg [&>svg]:size-6" style={{ background: `var(--cat-${tone}-bg)`, color: `var(--cat-${tone}-fg)` }}>
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-body font-semibold">{title}</span>
        <span className="text-footnote text-ink-2">{body}</span>
      </span>
    </li>
  );
}

function PrivacyLink({ lang, label }: { lang: string; label: string }) {
  return (
    <Link href={`/privacy?lang=${lang}`} className="inline-flex min-h-11 items-center self-center text-footnote text-ink-2 underline-offset-4 hover:underline">
      {label}
    </Link>
  );
}

function Choice({ href, icon, title, body, tone }: { href: string; icon: ReactNode; title: string; body: string; tone: "brand" | "green" }) {
  return (
    <Link
      href={href}
      className="group flex min-h-24 items-center gap-4 rounded-xl bg-surface px-5 py-4 shadow-card transition-[transform,box-shadow] active:scale-[0.98] [@media(hover:hover)]:hover:shadow-float"
    >
      <span
        aria-hidden
        className={`grid size-14 shrink-0 place-items-center rounded-lg [&>svg]:size-7 ${tone === "brand" ? "bg-accent-soft text-accent-fill" : "bg-success-soft text-success"}`}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-display text-title font-bold tracking-tight">{title}</span>
        <span className="text-footnote text-ink-2">{body}</span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

// The logo's five voice bars, large and quiet behind the brand panel.
function VoiceBars() {
  return (
    <svg aria-hidden viewBox="0 0 220 140" className="pointer-events-none absolute -right-10 -bottom-6 h-56 w-auto text-on-accent opacity-[0.12] lg:-right-16 lg:h-[28rem]">
      {[10, 55, 100, 145, 190].map((x, i) => {
        const h = [50, 90, 130, 90, 50][i];
        return <rect key={x} x={x} y={70 - h / 2} width="22" height={h} rx="11" fill="currentColor" />;
      })}
    </svg>
  );
}

// What the app does, shown rather than told: a line said at the counter and
// the products it makes. Desktop only; the phone keeps its first screen short.
function SpokenDemo() {
  const { t } = useLang();
  return (
    <figure className="mt-6 hidden w-full max-w-md flex-col gap-3 rounded-xl bg-surface p-5 text-ink shadow-float lg:flex">
      <blockquote className="flex items-start gap-3 text-headline font-semibold">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-fill text-on-accent [&>svg]:size-5">
          <AudioLines />
        </span>
        <span className="pt-1">{t("signin.example.said")}</span>
      </blockquote>
      <ul className="flex flex-col divide-y divide-separator rounded-lg bg-surface-2 px-3">
        {[
          [t("signin.example.item1"), "₹14"],
          [t("signin.example.item2"), "₹10"],
        ].map(([name, price]) => (
          <li key={name} className="flex items-center gap-3 py-2.5">
            <ProductThumb name={name} size="sm" />
            <span className="min-w-0 flex-1 truncate text-body">{name}</span>
            <span className="font-display text-body font-bold tabular-nums">{price}</span>
          </li>
        ))}
      </ul>
      <figcaption className="text-footnote text-ink-2">{t("signin.example.note")}</figcaption>
    </figure>
  );
}

"use client";

import { ChevronLeft, CircleAlert } from "lucide-react";
import Link from "next/link";

import { LanguagePicker } from "@/components/shell/language-picker";
import { GoogleMark } from "@/components/brand/google-mark";
import { VoiceBars } from "@/components/shell/mic-button";
import { buttonClass } from "@/components/ui/button";
import { useLang } from "@/i18n/lang";

// What the app does, shown rather than listed: a spoken line becomes two
// priced products, as it will on the owner's own shop page.
function Example() {
  const { t } = useLang();
  return (
    <figure className="flex flex-col gap-2">
      <div className="rounded-xl bg-surface p-4 shadow-float">
        <p className="flex items-center gap-2 border-b border-separator pb-3 text-body font-medium">
          <VoiceBars className="size-5 shrink-0 text-voice" />
          {t("signin.example.said")}
        </p>
        <dl className="flex flex-col gap-2 pt-3 text-body">
          {(
            [
              ["signin.example.item1", "₹14"],
              ["signin.example.item2", "₹10"],
            ] as const
          ).map(([name, price]) => (
            <div key={name} className="flex justify-between gap-4">
              <dt>{t(name)}</dt>
              <dd className="font-semibold tabular-nums">{price}</dd>
            </div>
          ))}
        </dl>
      </div>
      <figcaption className="px-1 text-footnote text-on-accent">{t("signin.example.note")}</figcaption>
    </figure>
  );
}

// The first screen's shape. On a phone the red panel holds the promise
// and the example, and the sign-in rises over it at the bottom, in thumb
// reach; from 1024 px the two sit side by side.
export function OwnerSignIn({ failed }: { failed: boolean }) {
  const { lang, t } = useLang();

  return (
    <main className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section className="relative flex flex-1 flex-col overflow-hidden bg-accent-fill px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-14 text-on-accent lg:min-h-dvh lg:px-14 lg:pt-8 lg:pb-12">
        <div className="relative flex items-center justify-between gap-3">
          <Link href="/" className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-body font-semibold">
            <ChevronLeft aria-hidden className="size-5" />
            {t("action.back")}
          </Link>
          {/* The pill stays white on the red so its words keep their contrast. */}
          <div className="[&_[data-testid=language-picker]]:bg-surface [&_[data-testid=language-picker]]:text-ink">
            <LanguagePicker />
          </div>
        </div>
        <div className="relative flex flex-1 flex-col justify-center gap-6 py-8 lg:gap-8">
          <div className="flex flex-col gap-2">
            <p className="text-body font-semibold">{t("start.owner.title")}</p>
            <h1 className="max-w-lg font-display text-[2.25rem] leading-[1.05] font-bold tracking-tight lg:text-[3.5rem]">{t("owner.title")}</h1>
          </div>
          <div className="max-w-md text-ink">
            <Example />
          </div>
        </div>
      </section>

      {/* The primary action sits in the thumb zone. */}
      <section className="relative -mt-6 flex flex-col rounded-t-[1.75rem] bg-bg px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:mt-0 lg:justify-center lg:rounded-none lg:px-14">
        <div className="mx-auto flex w-full max-w-md flex-col gap-3">
          {failed && (
            <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t("signin.failed")}
            </p>
          )}
          {/* A plain link: the sign-in route redirects to Google. Google's
              rules allow its mark only on a white or near-black button. */}
          <a href="/api/v1/auth/google" className={buttonClass("ink", "lg")}>
            <GoogleMark />
            {t("signin.google")}
          </a>
          <p className="text-center text-footnote text-ink-2">{t("owner.note")}</p>
          <Link
            href={`/privacy?lang=${lang}`}
            className="inline-flex min-h-11 items-center self-center text-footnote text-ink-2 underline-offset-4 hover:underline"
          >
            {t("privacy.link")}
          </Link>
        </div>
      </section>
    </main>
  );
}

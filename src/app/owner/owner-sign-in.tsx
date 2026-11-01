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
      <div className="rounded-lg bg-surface p-4 shadow-card">
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
      <figcaption className="px-1 text-footnote text-ink-2">{t("signin.example.note")}</figcaption>
    </figure>
  );
}

export function OwnerSignIn({ failed }: { failed: boolean }) {
  const { lang, t } = useLang();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-body font-semibold text-accent">
          <ChevronLeft aria-hidden className="size-5" />
          {t("action.back")}
        </Link>
        <LanguagePicker />
      </div>

      <div className="flex flex-1 flex-col justify-center gap-8 py-10">
        <div className="flex flex-col gap-2">
          <p className="text-footnote font-semibold text-ink-2">{t("start.owner.title")}</p>
          <h1 className="font-display text-large-title font-bold tracking-tight">{t("owner.title")}</h1>
        </div>
        <Example />
      </div>

      {/* Doc 06: the primary action sits in the thumb zone. */}
      <div className="flex flex-col gap-3">
        {failed && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t("signin.failed")}
          </p>
        )}
        {/* A plain link: the sign-in route redirects to Google. */}
        <a href="/api/v1/auth/google" className={buttonClass("filled", "lg")}>
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
    </main>
  );
}


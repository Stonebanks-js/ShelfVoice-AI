"use client";

import { ChevronLeft, CircleAlert } from "lucide-react";
import Link from "next/link";

import { VoiceBars } from "@/components/shell/mic-button";
import { buttonClass } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import type { Lang } from "@/i18n/dictionary";
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
  const { lang, setLang, t } = useLang();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-body font-semibold text-accent">
          <ChevronLeft aria-hidden className="size-5" />
          {t("action.back")}
        </Link>
        <Segmented<Lang>
          label={t("lang.label")}
          value={lang}
          onValueChange={setLang}
          className="w-44"
          options={[
            { value: "en", label: "English" },
            { value: "hi", label: <span lang="hi">हिन्दी</span> },
          ]}
        />
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

// Google's "G", drawn on a white disc so it reads on the black button.
function GoogleMark() {
  return (
    <span aria-hidden className="grid size-6 place-items-center rounded-full bg-white">
      <svg viewBox="0 0 48 48" className="size-4">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l8 6.2C12.6 13.6 17.8 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.4-4.6 7l7.4 5.8c4.3-4 6.9-9.9 6.9-17.3z" />
        <path fill="#FBBC05" d="M10.7 28.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-8-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l8-6.2z" />
        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.4-4.1-13.3-9.7l-8 6.2C6.6 42.6 14.6 48 24 48z" />
      </svg>
    </span>
  );
}

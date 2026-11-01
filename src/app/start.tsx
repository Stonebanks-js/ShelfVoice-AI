"use client";

import { ChevronRight, MapPin, Store } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { LanguagePicker, SuggestLanguage, type LanguageSuggestion } from "@/components/shell/language-picker";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { useLang } from "@/i18n/lang";

// The first screen (E-36): two plain choices, so nobody has to guess which
// button is theirs. Shop owners go on to sign in; customers find shops
// near them without an account.
export function Start({ suggestion }: { suggestion: LanguageSuggestion | null }) {
  const { lang, t } = useLang();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex justify-end">
        <LanguagePicker />
      </div>

      <div className="flex flex-1 flex-col justify-center gap-4 py-8">
        <LogoMark className="-ml-2 h-24 w-auto self-start" />
        <div>
          <h1 className="text-large-title">
            <Wordmark name={t("app.name")} />
          </h1>
          <p className="mt-1 text-headline text-ink-2">{t("app.tagline")}</p>
        </div>
      </div>

      {suggestion && (
        <div className="pb-4">
          <SuggestLanguage suggestion={suggestion} />
        </div>
      )}
      <nav aria-labelledby="start-question" className="flex flex-col gap-3">
        <h2 id="start-question" className="px-1 text-headline font-semibold">
          {t("start.question")}
        </h2>
        <Choice href="/owner" icon={<Store />} title={t("start.owner.title")} body={t("start.owner.body")} />
        <Choice href="/shops" icon={<MapPin />} title={t("start.customer.title")} body={t("start.customer.body")} />
        <Link
          href={`/privacy?lang=${lang}`}
          className="inline-flex min-h-11 items-center self-center text-footnote text-ink-2 underline-offset-4 hover:underline"
        >
          {t("privacy.link")}
        </Link>
      </nav>
    </main>
  );
}

function Choice({ href, icon, title, body }: { href: string; icon: ReactNode; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-24 items-center gap-4 rounded-lg bg-surface px-5 py-4 shadow-card transition-transform active:scale-[0.99]"
    >
      <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-fill text-ink [&>svg]:size-6">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-title font-semibold">{title}</span>
        <span className="text-footnote text-ink-2">{body}</span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-3" />
    </Link>
  );
}

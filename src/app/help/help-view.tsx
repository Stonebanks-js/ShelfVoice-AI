"use client";

import { ChevronDown, ChevronLeft, MessageCircleQuestion } from "lucide-react";
import Link from "next/link";

import type { MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";

import { ISSUES_URL } from "../privacy/content";

const QUESTIONS = [1, 2, 3, 4, 5] as const;

export function HelpView() {
  const { t } = useLang();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <Link href="/app/shop" className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start px-2 text-body font-semibold text-accent">
        <ChevronLeft aria-hidden className="size-5" />
        {t("tab.shop")}
      </Link>
      <h1 className="font-display text-large-title font-bold tracking-tight">{t("help.title")}</h1>
      <div className="flex flex-col gap-3">
        {QUESTIONS.map((n) => (
          <details key={n} className="group rounded-lg bg-surface shadow-card">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 text-body font-semibold [&::-webkit-details-marker]:hidden">
              <span className="flex-1">{t(`help.q${n}` as MessageKey)}</span>
              <ChevronDown aria-hidden className="size-5 shrink-0 text-ink-2 transition-transform group-open:rotate-180" />
            </summary>
            <p className="px-4 pb-4 text-body text-ink-2">{t(`help.a${n}` as MessageKey)}</p>
          </details>
        ))}
      </div>
      <a href={ISSUES_URL} target="_blank" rel="noopener" className="inline-flex min-h-12 items-center gap-2 self-start font-semibold text-accent">
        <MessageCircleQuestion aria-hidden className="size-5" />
        {t("help.contact")}
      </a>
    </main>
  );
}

"use client";

import { Check, ChevronRight, Languages, MapPin } from "lucide-react";
import { useState } from "react";

import { Sheet } from "@/components/ui/overlay";
import { LANG_ENGLISH, LANG_NAMES, LANGS, type Lang } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { cn } from "@/lib/cn";

// The language switch (V-06): eleven languages, each written in its own
// script with its English name under it, in a sheet. A pill for the top of
// a screen, or a row inside a settings list.
export function LanguagePicker({ variant = "pill", onChange }: { variant?: "pill" | "row"; onChange?: (lang: Lang) => void }) {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);

  function choose(next: Lang) {
    setOpen(false);
    if (next === lang) return;
    setLang(next);
    onChange?.(next);
  }

  return (
    <>
      {variant === "pill" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="language-picker"
          aria-label={`${t("lang.change")}: ${LANG_NAMES[lang]}`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-fill px-4 text-footnote font-semibold text-ink active:bg-fill-strong"
        >
          <Languages aria-hidden className="size-4" />
          <span lang={lang}>{LANG_NAMES[lang]}</span>
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-fill">
          <Languages aria-hidden className="size-5 shrink-0 text-ink-2" />
          <span className="flex-1 text-body">{t("lang.title")}</span>
          <span lang={lang} className="text-body text-ink-2">
            {LANG_NAMES[lang]}
          </span>
          <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-3" />
        </button>
      )}
      {open && (
        <Sheet open onClose={() => setOpen(false)} title={t("lang.title")} doneLabel={t("action.done")}>
          <LanguageList value={lang} onChoose={choose} />
        </Sheet>
      )}
    </>
  );
}

// The eleven languages as a single-choice list.
export function LanguageList({ value, onChoose, label }: { value: Lang; onChoose: (lang: Lang) => void; label?: string }) {
  const { t } = useLang();
  return (
    <div role="radiogroup" aria-label={label ?? t("lang.title")} className="flex flex-col gap-2">
      {LANGS.map((option) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChoose(option)}
            className={cn("flex min-h-16 items-center gap-4 rounded-lg bg-surface px-5 text-left shadow-card active:scale-[0.99]", selected && "ring-3 ring-accent")}
          >
            <span className="flex-1">
              <span lang={option} className="block text-headline font-semibold">
                {LANG_NAMES[option]}
              </span>
              {option !== "en" && <span className="block text-footnote text-ink-2">{LANG_ENGLISH[option]}</span>}
            </span>
            <span aria-hidden className={cn("grid size-7 place-items-center rounded-full border-2", selected ? "border-accent-fill bg-accent-fill text-on-accent" : "border-separator")}>
              {selected && <Check className="size-4" strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export interface LanguageSuggestion {
  state: string;
  lang: Lang;
  // The question already in the suggested language, from the server.
  question: string;
}

// "You seem to be in Karnataka. Which language do you want?" (V-06), from the
// visitor's rough location (the internet address's region, no permission
// asked), in the screen's language and in the suggested one.
export function SuggestLanguage({ suggestion, onChosen }: { suggestion: LanguageSuggestion; onChosen?: (lang: Lang) => void }) {
  const { lang, setLang, t } = useLang();
  const [done, setDone] = useState(false);
  if (done || suggestion.lang === lang) return null;
  const options = [...new Set<Lang>([suggestion.lang, "en", "hi"])];
  return (
    <section aria-labelledby="lang-suggest" className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
      <p id="lang-suggest" className="flex items-start gap-2 text-body font-semibold">
        <MapPin aria-hidden className="mt-0.5 size-5 shrink-0" />
        {t("lang.suggest", { state: suggestion.state })}
      </p>
      {suggestion.question !== t("lang.suggest", { state: suggestion.state }) && (
        <p lang={suggestion.lang} className="-mt-2 pl-7 text-footnote text-ink-2">
          {suggestion.question}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pl-7">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            lang={option}
            onClick={() => {
              setDone(true);
              setLang(option);
              onChosen?.(option);
            }}
            className={cn(
              "inline-flex min-h-11 items-center rounded-md px-4 text-body font-semibold",
              option === suggestion.lang ? "bg-accent-fill text-on-accent" : "bg-fill text-ink",
            )}
          >
            {LANG_NAMES[option]}
          </button>
        ))}
      </div>
    </section>
  );
}

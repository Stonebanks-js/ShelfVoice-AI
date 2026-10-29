"use client";

import { Check, CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Lang, MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { api, ApiFailure } from "@/lib/api";
import { errorKey } from "@/lib/errors";
import { cn } from "@/lib/cn";

const CHOICES: Array<{ value: Lang; name: string; sample: string }> = [
  { value: "hi", name: "हिन्दी", sample: "नमस्ते! आज क्या बिका?" },
  { value: "en", name: "English", sample: "Hello! What sold today?" },
];

export function LanguageChoice({ initial }: { initial: Lang }) {
  const { setLang, t } = useLang();
  const router = useRouter();
  const [choice, setChoice] = useState<Lang>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  function pick(lang: Lang) {
    setChoice(lang);
    setLang(lang); // the screen switches language as soon as it's tapped
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/shops", { json: { language: choice } });
    } catch (failure) {
      // Already has a shop (another tab got there first): carry on.
      if (!(failure instanceof ApiFailure && failure.code === "SHOP_EXISTS")) {
        // Signed out, or a demo visitor whose demo shop has expired: demo
        // accounts can't create shops, and the API reports that RLS denial as
        // 404 (fromPostgres). Start again from sign-in.
        if (failure instanceof ApiFailure && [401, 403, 404].includes(failure.status)) {
          await api("/api/v1/auth/signout", { method: "POST" }).catch(() => undefined);
          router.replace("/");
          router.refresh();
          return;
        }
        setError(errorKey(failure));
        setBusy(false);
        return;
      }
    }
    // Doc 06: language first (O-2), then voice setup (O-3).
    router.replace("/app/setup");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-1 flex-col gap-6">
        <div>
          <h1 className="font-display text-large-title font-bold tracking-tight">{t("welcome.title")}</h1>
          <p className="mt-2 text-body text-ink-2">{t("welcome.body")}</p>
        </div>
        <div role="radiogroup" aria-label={t("lang.label")} className="flex flex-col gap-3">
          {CHOICES.map((c) => {
            const selected = c.value === choice;
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={selected}
                lang={c.value}
                onClick={() => pick(c.value)}
                className={cn(
                  "flex min-h-20 items-center gap-4 rounded-lg bg-surface px-5 text-left shadow-card transition-[box-shadow,transform] active:scale-[0.99]",
                  selected && "ring-3 ring-accent",
                )}
              >
                <span className="flex-1">
                  <span className="block text-title font-semibold">{c.name}</span>
                  <span className="block text-footnote text-ink-2">{c.sample}</span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "grid size-7 place-items-center rounded-full border-2",
                    selected ? "border-accent-fill bg-accent-fill text-on-accent" : "border-separator",
                  )}
                >
                  {selected && <Check className="size-4" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t(error)}
          </p>
        )}
        <Button size="lg" loading={busy} onClick={confirm}>
          {t("action.continue")}
        </Button>
      </div>
    </main>
  );
}

"use client";

import { CircleAlert, MessageSquareText, Mic, ShoppingCart, Store } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { buttonClass, Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { IconTile } from "@/components/ui/list";
import type { Lang, MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { api } from "@/lib/api";
import { errorKey } from "@/lib/errors";

function Feature({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <IconTile icon={icon} />
      <div>
        <p className="text-body font-semibold">{title}</p>
        <p className="text-footnote text-ink-2">{body}</p>
      </div>
    </li>
  );
}

export function SignIn({ failed }: { failed: boolean }) {
  const { lang, setLang, t } = useLang();
  const router = useRouter();
  const [demoBusy, setDemoBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(failed ? "signin.failed" : null);

  async function tryDemo() {
    setDemoBusy(true);
    setError(null);
    try {
      await api<{ shopId: string }>("/api/v1/auth/demo", { method: "POST" });
      router.replace("/app");
      router.refresh();
    } catch (failure) {
      setError(errorKey(failure));
      setDemoBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex justify-end">
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
        <div className="flex flex-col gap-4">
          <span
            aria-hidden
            className="grid size-20 place-items-center rounded-[1.375rem] bg-accent-fill text-on-accent shadow-mic"
          >
            <Mic className="size-10" />
          </span>
          <div>
            <h1 className="font-display text-large-title font-bold tracking-tight">{t("app.name")}</h1>
            <p className="mt-1 text-headline text-ink-2">{t("app.tagline")}</p>
          </div>
        </div>
        <ul className="flex flex-col gap-5">
          <Feature icon={<Store />} title={t("signin.voice.title")} body={t("signin.voice.body")} />
          <Feature icon={<ShoppingCart />} title={t("signin.restock.title")} body={t("signin.restock.body")} />
          <Feature icon={<MessageSquareText />} title={t("signin.reviews.title")} body={t("signin.reviews.body")} />
        </ul>
      </div>

      {/* Doc 06: the primary action sits in the thumb zone. */}
      <div className="flex flex-col gap-3">
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t(error)}
          </p>
        )}
        {/* A plain link: the sign-in route redirects to Google. */}
        <a href="/api/v1/auth/google" className={buttonClass("filled", "lg")}>
          <GoogleMark />
          {t("signin.google")}
        </a>
        <Button variant="tinted" size="lg" loading={demoBusy} onClick={tryDemo}>
          {t("signin.demo")}
        </Button>
        <p className="text-center text-footnote text-ink-2">{t("signin.demoNote")}</p>
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

// Google's "G", drawn on a white disc so it reads on the blue button.
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

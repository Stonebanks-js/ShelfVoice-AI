"use client";

import { Clock, MapPin, ShoppingBasket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { VoiceCapture } from "@/components/shell/voice-capture";
import { buttonClass } from "@/components/ui/button";
import { IconTile } from "@/components/ui/list";
import { useLang } from "@/i18n/lang";
import { submitVoice } from "@/lib/voice";

export function SetupScreen() {
  const { t } = useLang();
  const router = useRouter();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-large-title font-bold tracking-tight">{t("setup.title")}</h1>
        <p className="text-body text-ink-2">{t("setup.body")}</p>
      </div>

      {/* Doc 06 O-3: three example prompts. */}
      <ul className="mt-6 flex flex-col gap-3">
        {[
          { icon: <MapPin />, text: t("setup.tip1") },
          { icon: <Clock />, text: t("setup.tip2") },
          { icon: <ShoppingBasket />, text: t("setup.tip3") },
        ].map((tip) => (
          <li key={tip.text} className="flex items-center gap-3 text-body">
            <IconTile icon={tip.icon} />
            {tip.text}
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-lg bg-surface p-4 text-footnote text-ink-2 shadow-card">{t("setup.example")}</p>

      <div className="flex flex-1 flex-col items-center justify-end gap-6 pt-24">
        <VoiceCapture
          size="hero"
          maxSeconds={120}
          queueAs="SETUP"
          onUploaded={async (path) => {
            const id = await submitVoice(path, "SETUP");
            router.push(`/app/check/${id}`);
          }}
        />
        <Link href="/app" className={buttonClass("plain", "md")}>
          {t("setup.skip")}
        </Link>
      </div>
    </main>
  );
}

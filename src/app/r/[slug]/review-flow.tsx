"use client";

import { CircleAlert, CircleCheck, Mic, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { MicButton } from "@/components/shell/mic-button";
import { Button } from "@/components/ui/button";
import type { MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { buzz, useRecorder, type Recording } from "@/lib/audio/use-recorder";
import { useTurnstile } from "@/lib/turnstile";

type Step = "consent" | "record" | "sending" | "done" | "failed";

const LIMIT_SECONDS = 15; // doc 06: reviews stop by themselves at 15 seconds

export function ReviewFlow({ slug, shopName, siteKey }: { slug: string; shopName: string; siteKey: string }) {
  const { t } = useLang();
  const [step, setStep] = useState<Step>("consent");
  const [failure, setFailure] = useState<MessageKey | null>(null);
  const clip = useRef<{ recording: Recording; reviewId: string } | null>(null);
  const { containerRef, token: turnstileToken } = useTurnstile(siteKey);

  async function send() {
    const current = clip.current;
    if (!current) return;
    setStep("sending");
    setFailure(null);
    try {
      const token = await turnstileToken();
      const form = new FormData();
      form.set("reviewId", current.reviewId); // same ID on retry, so it's stored once
      form.set("consent", "true");
      form.set("turnstileToken", token);
      form.set("audio", new Blob([current.recording.wav], { type: "audio/wav" }), "review.wav");
      const res = await fetch(`/api/v1/public/shops/${slug}/reviews`, { method: "POST", body: form });
      if (res.ok) {
        buzz(30);
        setStep("done");
        return;
      }
      const code = ((await res.json().catch(() => null)) as { error?: { code?: string } } | null)?.error?.code;
      setFailure(
        res.status === 429
          ? "review.rate"
          : code?.startsWith("TURNSTILE")
            ? "review.verify"
            : code === "BAD_AUDIO" || code === "AUDIO_REQUIRED"
              ? "mic.error.badAudio"
              : "review.error",
      );
    } catch {
      setFailure("review.error"); // offline, or Turnstile couldn't run
    }
    buzz([40, 60, 40]);
    setStep("failed");
  }

  const recorder = useRecorder({
    maxSeconds: LIMIT_SECONDS,
    onRecorded: (recording) => {
      clip.current = { recording, reviewId: crypto.randomUUID() };
      void send();
    },
  });

  // Consent is the tap that starts recording (doc 03 P3).
  function agree() {
    setStep("record");
    void recorder.start();
  }

  const reRecord = failure === "mic.error.badAudio" || failure === "review.rate";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <p className="text-footnote font-semibold text-ink-2">{shopName}</p>
      <h1 className="mt-1 font-display text-title font-bold tracking-tight">{t("review.title", { shop: shopName })}</h1>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10">
        {step === "consent" && (
          <p className="rounded-lg bg-surface p-4 text-body shadow-card">{t("review.consent")}</p>
        )}

        {(step === "record" || step === "sending") && (
          <MicButton
            size="hero"
            state={step === "sending" ? "uploading" : recorder.recording ? "recording" : "idle"}
            onPress={() => (recorder.recording ? recorder.stop() : void recorder.start())}
            elapsedMs={recorder.elapsedMs}
            maxSeconds={LIMIT_SECONDS}
            level={recorder.level}
          />
        )}
        {step === "sending" && <p className="text-body text-ink-2">{t("review.sending")}</p>}
        {recorder.error && step === "record" && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-4 py-3 text-footnote text-danger">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t(recorder.error)}
          </p>
        )}

        {step === "done" && (
          <div role="status" className="flex flex-col items-center gap-3 text-center">
            <span aria-hidden className="grid size-20 place-items-center rounded-full bg-success-soft text-success">
              <CircleCheck className="size-10" />
            </span>
            <p className="text-title font-semibold">{t("review.thanks")}</p>
          </div>
        )}

        {step === "failed" && failure && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-4 py-3 text-body text-danger">
            <CircleAlert aria-hidden className="mt-1 size-4 shrink-0" />
            {t(failure)}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {step === "consent" && (
          <Button size="lg" icon={<Mic aria-hidden className="size-5" />} onClick={agree}>
            {t("review.agree")}
          </Button>
        )}
        {step === "failed" &&
          (reRecord ? (
            <Button size="lg" icon={<Mic aria-hidden className="size-5" />} onClick={() => setStep("record")}>
              {t("review.recordAgain")}
            </Button>
          ) : (
            <Button size="lg" icon={<RotateCcw aria-hidden className="size-5" />} onClick={() => void send()}>
              {t("action.retry")}
            </Button>
          ))}
        {(step === "done" || step === "failed") && (
          <Link href={`/s/${slug}`} className="text-center text-body font-semibold text-accent">
            {t("review.back", { shop: shopName })}
          </Link>
        )}
      </div>
      {/* Turnstile shows itself here only if Cloudflare needs a tap. */}
      <div ref={containerRef} className="flex justify-center" />
    </main>
  );
}

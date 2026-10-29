"use client";

import { CircleAlert, Mic, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/overlay";
import type { MessageKey } from "@/i18n/dictionary";
import { useLang } from "@/i18n/lang";
import { uploadVoice } from "@/lib/audio/upload";
import { buzz, useRecorder, type Recording } from "@/lib/audio/use-recorder";
import { errorKey } from "@/lib/errors";

import { MicButton } from "./mic-button";

const PRIMED_KEY = "sv_mic_primed";

function primed(): boolean {
  try {
    return localStorage.getItem(PRIMED_KEY) === "1";
  } catch {
    return false;
  }
}

// The mic, wired up (doc 06 "Mic button behaviour"): the first tap explains
// why the microphone is needed and what to say, before the browser asks;
// then tap to record, tap to stop, upload, and hand the stored path on.
// Failures appear above the button with what to do next.
export function VoiceCapture({
  maxSeconds,
  onUploaded,
  onRecorded,
  processing = false,
  paused = false,
  size = "tab",
}: {
  maxSeconds: number;
  onUploaded?: (path: string) => void; // omit to record without uploading (style guide)
  onRecorded?: (recording: Recording) => void;
  processing?: boolean; // the caller is turning the clip into changes
  paused?: boolean; // AI is resting (budget or breaker)
  size?: "tab" | "hero";
}) {
  const { t } = useLang();
  const [primer, setPrimer] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<MessageKey | null>(null);
  const pending = useRef<{ wav: Uint8Array<ArrayBuffer>; clientId: string } | null>(null);

  const send = useCallback(async () => {
    const clip = pending.current;
    if (!clip || !onUploaded) return;
    setUploading(true);
    setUploadError(null);
    try {
      const path = await uploadVoice(clip.wav, clip.clientId);
      pending.current = null;
      onUploaded(path);
    } catch (failure) {
      const key = errorKey(failure);
      setUploadError(key === "error.generic" ? "mic.error.upload" : key);
      buzz([40, 60, 40]);
    } finally {
      setUploading(false);
    }
  }, [onUploaded]);

  const recorder = useRecorder({
    maxSeconds,
    onRecorded: (recording) => {
      onRecorded?.(recording);
      if (!onUploaded) return;
      // Same client ID on every retry, so Storage keeps one copy (doc 07).
      pending.current = { wav: recording.wav, clientId: crypto.randomUUID() };
      void send();
    },
  });

  function press() {
    if (recorder.recording) return recorder.stop();
    setUploadError(null);
    if (!primed()) return setPrimer(true);
    void recorder.start();
  }

  function startFromPrimer() {
    try {
      localStorage.setItem(PRIMED_KEY, "1");
    } catch {
      // Private mode: the tip shows again next time, which is harmless.
    }
    setPrimer(false);
    void recorder.start();
  }

  const state = paused
    ? "paused"
    : recorder.recording
      ? "recording"
      : uploading
        ? "uploading"
        : processing
          ? "processing"
          : "idle";
  const message: MessageKey | null = paused ? "mic.paused" : (recorder.error ?? uploadError);
  const canRetry = uploadError !== null; // only send() sets it, and it keeps the clip

  return (
    <div className="relative flex flex-col items-center">
      {message && (
        <div
          role="alert"
          className="absolute bottom-full z-10 mb-3 flex w-[min(20rem,calc(100vw-2rem))] items-start gap-2 rounded-lg bg-surface p-3 text-footnote text-ink shadow-float"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
          <div className="flex flex-1 flex-col items-start gap-1">
            <p>{t(message)}</p>
            {canRetry && (
              <button type="button" onClick={() => void send()} className="min-h-10 font-semibold text-accent">
                {t("action.retry")}
              </button>
            )}
          </div>
          {!paused && (
            <button
              type="button"
              aria-label={t("action.done")}
              onClick={() => {
                recorder.setError(null);
                setUploadError(null);
              }}
              className="-m-2 grid size-10 shrink-0 place-items-center text-ink-2"
            >
              <X aria-hidden className="size-4" />
            </button>
          )}
        </div>
      )}
      <MicButton
        state={state}
        size={size}
        onPress={press}
        elapsedMs={recorder.elapsedMs}
        maxSeconds={maxSeconds}
        level={recorder.level}
      />
      <Sheet
        open={primer}
        onClose={() => setPrimer(false)}
        title={t("mic.primer.title")}
        doneLabel={t("action.cancel")}
        footer={
          <Button size="lg" icon={<Mic aria-hidden className="size-5" />} onClick={startFromPrimer}>
            {t("mic.primer.start")}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-body text-ink-2">{t("mic.primer.reason")}</p>
          <ul className="flex flex-col gap-2">
            {(["mic.primer.tip1", "mic.primer.tip2", "mic.primer.tip3"] as const).map((tip) => (
              <li key={tip} className="rounded-md bg-surface px-4 py-3 text-body shadow-card">
                {t(tip)}
              </li>
            ))}
          </ul>
          <p className="text-footnote text-ink-2">{t("mic.primer.limit", { seconds: maxSeconds })}</p>
        </div>
      </Sheet>
    </div>
  );
}

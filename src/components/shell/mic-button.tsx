"use client";

import { LoaderCircle, Mic, Square } from "lucide-react";

import { useLang } from "@/i18n/lang";
import { cn } from "@/lib/cn";

export type MicState = "idle" | "recording" | "processing" | "paused";

// The one memorable element (doc 06): a large round button that behaves the
// same everywhere. Tap to start, tap to stop. Recording and upload arrive in
// F-03; this is the look and every state.
export function MicButton({
  state,
  onPress,
  size = "tab",
  elapsed,
}: {
  state: MicState;
  onPress?: () => void;
  size?: "tab" | "hero";
  elapsed?: string; // "0:12", shown while recording
}) {
  const { t } = useLang();
  const label =
    state === "recording" ? t("mic.recording") : state === "processing" ? t("mic.processing") : state === "paused" ? t("mic.paused") : t("mic.idle");
  const hero = size === "hero";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        aria-label={label}
        aria-pressed={state === "recording"}
        disabled={state === "processing" || state === "paused"}
        onClick={onPress}
        className={cn(
          "relative grid place-items-center rounded-full transition-[background-color,transform] duration-200 active:scale-95",
          hero ? "size-24" : "size-16",
          state === "recording" && "bg-record text-white",
          state === "paused" && "bg-fill-strong text-ink-2",
          (state === "idle" || state === "processing") && "bg-accent-fill text-on-accent shadow-mic",
          "disabled:active:scale-100",
        )}
      >
        {state === "recording" && (
          <span aria-hidden className="absolute inset-0 animate-ring rounded-full border-4 border-record" />
        )}
        {state === "recording" ? (
          <Square aria-hidden className={cn("fill-current", hero ? "size-8" : "size-6")} />
        ) : state === "processing" ? (
          <LoaderCircle aria-hidden className={cn("animate-spin", hero ? "size-10" : "size-7")} />
        ) : (
          <Mic aria-hidden className={hero ? "size-10" : "size-7"} />
        )}
      </button>
      <span
        aria-hidden
        className={cn(
          "font-semibold tabular-nums",
          hero ? "text-body" : "text-footnote",
          state === "recording" ? "text-danger" : "text-ink-2",
        )}
      >
        {state === "recording" ? (elapsed ?? t("mic.stop")) : t("mic.label")}
      </span>
    </div>
  );
}

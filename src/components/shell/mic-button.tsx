"use client";

import { LoaderCircle } from "lucide-react";

import { useLang } from "@/i18n/lang";
import { cn } from "@/lib/cn";

export type MicState = "idle" | "recording" | "uploading" | "processing" | "paused";

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// The logo's five voice bars (short, tall, tallest, tall, short), as an icon.
export function VoiceBars({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
      <path d="M4 10.5v3M8 8v8M12 5v14M16 8v8M20 10.5v3" />
    </svg>
  );
}

// The one memorable element, drawn from the logo: a red
// circle with the logo's five voice bars, the same everywhere. While
// recording, a ring fills clockwise toward the time limit and the bars move
// with the voice; while sending and thinking the ring spins slowly. In the
// tab bar the timer floats above the button; as a hero it sits under it.
export function MicButton({
  state,
  onPress,
  size = "tab",
  elapsedMs = 0,
  maxSeconds = 30,
  level = 0,
}: {
  state: MicState;
  onPress?: () => void;
  size?: "tab" | "hero";
  elapsedMs?: number;
  maxSeconds?: number;
  level?: number; // 0..1, microphone loudness
}) {
  const { t } = useLang();
  const hero = size === "hero";
  const busy = state === "uploading" || state === "processing";
  const label =
    state === "recording"
      ? t("mic.recording")
      : state === "uploading"
        ? t("mic.uploading")
        : state === "processing"
          ? t("mic.processing")
          : state === "paused"
            ? t("mic.paused")
            : t("mic.idle");
  const caption =
    state === "recording"
      ? `${clock(elapsedMs)} / ${clock(maxSeconds * 1000)}`
      : state === "uploading"
        ? t("mic.uploading")
        : state === "processing"
          ? t("mic.processing")
          : t("mic.label");
  const progress = Math.min(1, elapsedMs / (maxSeconds * 1000));
  const r = 47; // ring radius in a 100-unit box
  const circumference = 2 * Math.PI * r;

  return (
    <div className="relative flex flex-col items-center gap-1.5">
      <button
        type="button"
        aria-label={label}
        aria-pressed={state === "recording"}
        disabled={busy || state === "paused"}
        onClick={onPress}
        className={cn(
          "relative grid place-items-center rounded-full transition-[background-color,transform] duration-200 active:scale-95 disabled:active:scale-100",
          hero ? "size-24" : "size-16",
          state === "recording" && "bg-voice text-on-voice",
          state === "paused" && "bg-fill-strong text-ink-2",
          (state === "idle" || busy) && "bg-voice text-on-voice shadow-mic",
        )}
      >
        {/* Ring: fills clockwise with time while recording, spins while busy. */}
        {(state === "recording" || busy) && (
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            className={cn("absolute -inset-1.5 -rotate-90", busy && "animate-[spin_1.6s_linear_infinite]")}
          >
            <circle cx="50" cy="50" r={r} fill="none" strokeWidth="4" className="stroke-fill-strong" />
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              className="stroke-voice"
              strokeDasharray={circumference}
              strokeDashoffset={state === "recording" ? circumference * (1 - progress) : circumference * 0.72}
            />
          </svg>
        )}
        {state === "recording" ? (
          <span aria-hidden className="flex h-8 items-center gap-1">
            {[0.55, 0.85, 1, 0.85, 0.55].map((weight, i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-white transition-[height] duration-75"
                style={{ height: `${Math.max(18, Math.min(100, level * weight * 130))}%` }}
              />
            ))}
          </span>
        ) : busy ? (
          <LoaderCircle aria-hidden className={cn("animate-spin", hero ? "size-10" : "size-8")} />
        ) : (
          <VoiceBars className={hero ? "size-11" : "size-8"} />
        )}
      </button>
      {(hero || state !== "idle") && (
        <span
          aria-hidden
          className={cn(
            "font-semibold whitespace-nowrap tabular-nums",
            hero
              ? "text-body"
              : "absolute bottom-full mb-2 rounded-full bg-surface px-3 py-1 text-footnote shadow-float",
            state === "recording" ? "text-danger" : "text-ink-2",
          )}
        >
          {caption}
        </span>
      )}
    </div>
  );
}

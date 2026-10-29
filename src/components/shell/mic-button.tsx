"use client";

import { LoaderCircle, Mic } from "lucide-react";

import { useLang } from "@/i18n/lang";
import { cn } from "@/lib/cn";

export type MicState = "idle" | "recording" | "uploading" | "processing" | "paused";

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// The one memorable element (doc 06): a large round button that behaves the
// same everywhere. Idle is a 72 px filled circle; while recording, a ring
// fills clockwise toward the time limit with live level bars inside and a
// timer under it; while sending and thinking the ring spins slowly.
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
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        aria-label={label}
        aria-pressed={state === "recording"}
        disabled={busy || state === "paused"}
        onClick={onPress}
        className={cn(
          "relative grid place-items-center rounded-full transition-[background-color,transform] duration-200 active:scale-95 disabled:active:scale-100",
          hero ? "size-24" : "size-[72px]",
          state === "recording" && "bg-record text-white",
          state === "paused" && "bg-fill-strong text-ink-2",
          (state === "idle" || busy) && "bg-accent-fill text-on-accent shadow-mic",
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
              className={state === "recording" ? "stroke-record" : "stroke-accent"}
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
          <Mic aria-hidden className={hero ? "size-10" : "size-8"} />
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
        {caption}
      </span>
    </div>
  );
}

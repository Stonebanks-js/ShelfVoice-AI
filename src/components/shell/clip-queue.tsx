"use client";

import { Clock, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { useToast } from "@/components/ui/toast";
import { useLang } from "@/i18n/lang";
import { ApiFailure } from "@/lib/api";
import { uploadVoice } from "@/lib/audio/upload";
import { isRetryable, listClips, removeClip, retryDelayMs, saveClip, type QueuedClip } from "@/lib/offline/clip-queue";
import { submitVoice } from "@/lib/voice";

type Enqueue = (clip: Pick<QueuedClip, "clientId" | "kind" | "wav" | "path">) => Promise<void>;

const Context = createContext<Enqueue | null>(null);

// The queue for voice notes recorded without a connection; null outside the
// owner app (the style guide records without sending).
export function useClipQueue(): Enqueue | null {
  return useContext(Context);
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

// Doc 06 offline state: a slim bar says recordings will send later, the mic
// keeps working, and each waiting clip shows a clock until it's sent. Clips
// live in IndexedDB, so closing the app doesn't lose them; whichever tab
// holds the lock sends them, oldest first, when the phone is back online.
export function ClipQueueProvider({ ownerId, children }: { ownerId: string; children: ReactNode }) {
  const { t } = useLang();
  const toast = useToast();
  const router = useRouter();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [clips, setClips] = useState<QueuedClip[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draining = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const list = await listClips(ownerId);
      setClips(list);
      return list;
    } catch {
      return []; // IndexedDB unavailable (private mode): nothing queued
    }
  }, [ownerId]);

  const sendOne = useCallback(
    async (clip: QueuedClip) => {
      try {
        if (!clip.path) {
          clip.path = await uploadVoice(clip.wav, clip.clientId);
          await saveClip(clip);
        }
        const id = await submitVoice(clip.path, clip.kind);
        await removeClip(clip.clientId);
        toast.show({ message: t("queue.sent"), action: { label: t("queue.check"), onAction: () => router.push(`/app/check/${id}`) } });
      } catch (error) {
        // The upload was cleared away after a day unused: send it again.
        if (error instanceof ApiFailure && error.code === "UPLOAD_MISSING") {
          await saveClip({ ...clip, path: null });
          return;
        }
        if (isRetryable(error)) {
          clip.attempts += 1;
          clip.nextAttemptAt = Date.now() + retryDelayMs(clip.attempts);
          await saveClip(clip);
          throw error; // stop this round; the rest wait their turn
        }
        // Nothing heard, or audio the server can't use: say it again.
        await removeClip(clip.clientId);
        toast.show({ message: t("queue.failed") });
      }
    },
    [router, t, toast],
  );

  const drain = useCallback(
    async (force = false) => {
      if (draining.current || !navigator.onLine) return;
      draining.current = true;
      try {
        const work = async () => {
          for (const clip of await refresh()) {
            if (!force && clip.nextAttemptAt > Date.now()) continue;
            await sendOne(clip);
          }
        };
        try {
          // One tab at a time, where the browser supports it.
          if (navigator.locks) await navigator.locks.request("sv-clip-queue", { ifAvailable: true }, (lock) => (lock ? work() : undefined));
          else await work();
        } catch {
          // A retryable failure: scheduled below.
        }
      } finally {
        draining.current = false;
        const left = await refresh();
        if (timer.current) clearTimeout(timer.current);
        if (left.length) {
          const next = Math.min(...left.map((c) => c.nextAttemptAt));
          timer.current = setTimeout(() => void drain(), Math.max(1_000, next - Date.now()));
        }
      }
    },
    [refresh, sendOne],
  );

  useEffect(() => {
    // Mount, coming back online and reopening the app all try at once.
    const now = () => void drain(true);
    const visible = () => document.visibilityState === "visible" && now();
    now();
    window.addEventListener("online", now);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("online", now);
      document.removeEventListener("visibilitychange", visible);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [drain]);

  const enqueue = useCallback<Enqueue>(
    async (clip) => {
      await saveClip({ ...clip, ownerId, createdAt: Date.now(), attempts: 0, nextAttemptAt: Date.now() + retryDelayMs(1) });
      await refresh();
      void drain();
    },
    [drain, ownerId, refresh],
  );

  const waiting = clips.length;
  const value = useMemo(() => enqueue, [enqueue]);
  return (
    <Context value={value}>
      {(!online || waiting > 0) && (
        <div
          role="status"
          className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-fill-strong px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 text-footnote font-medium text-ink"
        >
          {!online && <WifiOff aria-hidden className="size-4 shrink-0" />}
          <span>
            {online ? "" : `${t("queue.offline")} `}
            {waiting === 1 ? t("queue.waiting1") : waiting > 1 ? t("queue.waitingN", { n: waiting }) : ""}
          </span>
          {/* One clock per waiting clip (doc 06), up to five. */}
          {waiting > 0 && (
            <span aria-hidden className="flex items-center gap-0.5">
              {clips.slice(0, 5).map((clip) => (
                <Clock key={clip.clientId} className="size-4 shrink-0 text-ink-2" />
              ))}
            </span>
          )}
        </div>
      )}
      {children}
    </Context>
  );
}

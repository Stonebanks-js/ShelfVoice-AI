"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

interface ToastOptions {
  message: string;
  action?: { label: string; onAction: () => void };
  durationMs?: number; // doc 06: the undo toast stays 10 s
}

interface ToastState extends ToastOptions {
  id: number;
}

const Context = createContext<((options: ToastOptions) => void) | null>(null);

// One toast at a time, above the tab bar, announced politely to screen readers.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const nextId = useRef(0);
  const show = useCallback((options: ToastOptions) => {
    nextId.current += 1;
    setToast({ ...options, id: nextId.current });
  }, []);
  // Stable, so the toast's timer doesn't restart when the provider re-renders.
  const dismiss = useCallback(() => setToast(null), []);
  return (
    <Context value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6rem)] z-50 flex justify-center px-4"
      >
        {toast && <ToastCard key={toast.id} toast={toast} onDone={dismiss} />}
      </div>
    </Context>
  );
}

function ToastCard({ toast, onDone }: { toast: ToastState; onDone: () => void }) {
  const duration = toast.durationMs ?? (toast.action ? 10_000 : 4_000);
  useEffect(() => {
    const timer = setTimeout(onDone, duration);
    return () => clearTimeout(timer);
  }, [duration, onDone]);
  return (
    <div
      className={cn(
        "pointer-events-auto relative flex w-full max-w-md items-center gap-3 overflow-hidden rounded-lg py-2 pr-2 pl-4",
        "animate-toast-in bg-ink text-bg shadow-float",
      )}
    >
      <p className="flex-1 py-2 text-body">{toast.message}</p>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action!.onAction();
            onDone();
          }}
          className="min-h-12 shrink-0 rounded-md px-4 text-body font-semibold text-bg underline-offset-4 active:opacity-60"
        >
          {toast.action.label}
        </button>
      )}
      {/* Time left, so the owner can see how long Undo stays. */}
      <span
        aria-hidden
        className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-bg/50"
        style={{ animation: `toast-timer ${duration}ms linear forwards` }}
      />
    </div>
  );
}

export function useToast() {
  const show = useContext(Context);
  if (!show) throw new Error("useToast must be used inside <ToastProvider>");
  return useMemo(() => ({ show }), [show]);
}

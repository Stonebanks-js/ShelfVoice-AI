"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Button } from "./button";

// Native <dialog> as a modal: focus moves in and is trapped, Escape closes,
// and the page behind is inert. The parent owns `open`.
function useModal(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);
  return ref;
}

// Bottom sheet (doc 06 Sheet): slides up on phones, centred card on wide screens.
export function Sheet({
  open,
  onClose,
  title,
  doneLabel,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  doneLabel: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useModal(open, onClose);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // A click on the backdrop lands on the dialog element itself.
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className={cn(
        "m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-xl bg-bg p-0 text-ink shadow-float",
        "open:flex open:animate-sheet-up open:flex-col",
        "sm:m-auto sm:max-w-lg sm:rounded-xl",
      )}
    >
      <div className="flex shrink-0 flex-col items-center pt-2">
        <span aria-hidden className="h-1.5 w-9 rounded-full bg-fill-strong" />
      </div>
      <header className="flex shrink-0 items-center justify-between gap-4 px-4 pt-2 pb-3">
        <h2 id={titleId} className="text-headline font-semibold">
          {title}
        </h2>
        <Button variant="plain" onClick={onClose} className="-mr-2">
          {doneLabel}
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      {footer && <footer className="shrink-0 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer>}
    </dialog>
  );
}

// Centred alert for decisions that can't be undone, like deleting the shop.
export function AlertDialog({
  open,
  onClose,
  title,
  message,
  cancelLabel,
  confirmLabel,
  onConfirm,
  destructive = false,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
  busy?: boolean;
}) {
  const ref = useModal(open, onClose);
  const titleId = useId();
  const messageId = useId();
  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      className="m-auto w-[min(20rem,calc(100vw-2rem))] rounded-xl bg-surface p-0 text-ink shadow-float open:animate-fade-in"
    >
      <div className="flex flex-col gap-2 px-5 pt-5 pb-4 text-center">
        <h2 id={titleId} className="text-headline font-semibold">
          {title}
        </h2>
        <div id={messageId} className="text-footnote text-ink-2">
          {message}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pb-4">
        <Button variant="gray" onClick={onClose} autoFocus>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? "destructive" : "filled"} onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}

"use client";

import { Check, Minus, Plus } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

// Instamart-style quantity control: − count +. A null count reads as
// `emptyLabel` (not counted yet); − at the minimum goes back to null when
// `clearable`, so "not counted" stays reachable.
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 10_000,
  clearable = false,
  emptyLabel = "–",
  lessLabel,
  moreLabel,
  className,
  filled = false,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  clearable?: boolean;
  emptyLabel?: string;
  lessLabel: string;
  moreLabel: string;
  className?: string;
  filled?: boolean; // the brand-red pill of a cart line
}) {
  const less = () => {
    if (value === null) return;
    if (value <= min) return clearable ? onChange(null) : undefined;
    onChange(value - 1);
  };
  const more = () => onChange(value === null ? Math.max(min, 1) : Math.min(max, value + 1));
  const button = cn(
    "grid size-11 shrink-0 place-items-center active:bg-fill disabled:opacity-30",
    filled ? "text-on-accent active:bg-black/15" : "text-ink",
  );
  return (
    <div
      className={cn(
        "inline-flex h-11 items-center rounded-md border",
        // ADD becoming the stepper pops once, so the change is seen.
        filled ? "animate-pop border-accent-fill bg-accent-fill text-on-accent" : "border-fill-strong bg-surface",
        className,
      )}
    >
      <button type="button" aria-label={lessLabel} onClick={less} disabled={value === null || (value <= min && !clearable)} className={cn(button, "rounded-l-md")}>
        <Minus aria-hidden className="size-4" strokeWidth={2.5} />
      </button>
      <output
        aria-live="polite"
        className={cn(
          "min-w-9 flex-1 px-1 text-center whitespace-nowrap tabular-nums",
          value === null ? "text-footnote text-ink-2" : "text-body font-semibold",
          filled && "text-on-accent",
        )}
      >
        {value ?? emptyLabel}
      </output>
      <button type="button" aria-label={moreLabel} onClick={more} disabled={value !== null && value >= max} className={cn(button, "rounded-r-md")}>
        <Plus aria-hidden className="size-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

// The ADD button of a product list (Instamart's): outlined "Add", then a
// filled tick "Added"; tapping again takes the product back out. Screen
// readers hear the visible word followed by the product's name.
export function AddToggle({ added, onToggle, name, addText, addedText }: { added: boolean; onToggle: () => void; name: string; addText: string; addedText: string }) {
  return (
    <button
      type="button"
      aria-pressed={added}
      onClick={onToggle}
      className={cn(
        "inline-flex h-11 min-w-24 shrink-0 items-center justify-center gap-1 rounded-md px-3 text-footnote font-bold uppercase tracking-wide transition-colors active:scale-[0.98]",
        added ? "bg-accent-fill text-on-accent" : "border border-fill-strong bg-surface text-ink",
      )}
    >
      {added && <Check aria-hidden className="size-4" strokeWidth={3} />}
      {added ? addedText : addText}
      <span className="sr-only"> {name}</span>
    </button>
  );
}

// A price in rupees typed straight into a row, with the ₹ shown before it.
export function PriceInput({ className, ...rest }: Omit<ComponentProps<"input">, "type" | "inputMode">) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <span aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-footnote text-ink-2">
        ₹
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className="h-11 w-full rounded-md bg-fill pr-2 pl-6 text-body tabular-nums text-ink outline-none focus-visible:outline-3 focus-visible:outline-accent aria-invalid:outline-2 aria-invalid:outline-danger"
        {...rest}
      />
    </span>
  );
}

// Rupees as typed ("14", "14.50", "₹ 1,200") to paise, or null if empty or not a price.
export function rupeesInput(text: string): number | null {
  const n = Number.parseFloat(text.replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) && n > 0 && n <= 100_000 ? Math.round(n * 100) : null;
}

export const paiseText = (paise: number | null | undefined) => (paise ? String(paise / 100) : "");

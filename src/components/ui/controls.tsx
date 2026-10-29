"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/cn";

// iOS-style switch. Pass `label` for screen readers, or `labelledBy` when a
// visible row title already names it.
export function Switch({
  checked,
  onCheckedChange,
  label,
  labelledBy,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  labelledBy?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      // 48 px hit area around a 51 x 31 track.
      className="group -my-2 grid min-h-12 shrink-0 place-items-center disabled:opacity-40"
    >
      <span
        className={cn(
          "relative h-[31px] w-[51px] rounded-full transition-colors duration-200",
          checked ? "bg-accent-fill" : "bg-fill-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-[27px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.2)] transition-transform duration-200",
            checked && "translate-x-5",
          )}
        />
      </span>
    </button>
  );
}

// Segmented control: one choice out of a few, arrow keys move between them.
export function Segmented<T extends string>({
  label,
  options,
  value,
  onValueChange,
  className,
}: {
  label: string;
  options: Array<{ value: T; label: ReactNode }>;
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onValueChange(options[next].value);
    refs.current[next]?.focus();
  }
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex rounded-[14px] bg-fill p-0.5", className)}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              // Unselected labels stay in body ink: ink-2 on the grey track is under 4.5:1.
              "min-h-11 flex-1 rounded-md px-3 text-footnote text-ink transition-[background-color,box-shadow] duration-200",
              selected ? "bg-surface font-semibold shadow-[0_1px_4px_rgb(0_0_0/0.12)]" : "font-medium",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// Filter chip (doc 06 U4: category chips). Round means "tap to filter".
export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        // 40 px pill with an invisible 48 px hit area.
        "relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-footnote font-semibold transition-colors",
        "before:absolute before:-inset-1 before:content-['']",
        selected ? "bg-ink text-bg" : "bg-surface text-ink shadow-card",
      )}
    >
      {children}
    </button>
  );
}

export type BadgeTone = "neutral" | "accent" | "success" | "danger" | "check" | "low";

const BADGE: Record<BadgeTone, string> = {
  neutral: "bg-fill text-ink",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  check: "bg-check-soft text-check",
  low: "bg-turmeric text-on-turmeric",
};

// Status badge: icon plus word, never colour alone (doc 06).
export function Badge({ tone = "neutral", icon, children }: { tone?: BadgeTone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-footnote font-semibold whitespace-nowrap [&>svg]:size-3.5",
        BADGE[tone],
      )}
    >
      {icon}
      {children}
    </span>
  );
}

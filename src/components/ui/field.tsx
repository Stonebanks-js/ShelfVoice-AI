"use client";

import { Search, X } from "lucide-react";
import { useId, type ComponentProps } from "react";

import { cn } from "@/lib/cn";

const INPUT = cn(
  "min-h-12 w-full rounded-md bg-fill px-4 text-body text-ink placeholder:text-ink-2",
  "outline-none focus-visible:outline-3 focus-visible:outline-accent focus-visible:outline-offset-0",
  "aria-invalid:outline-2 aria-invalid:outline-danger",
);

// Label above the input, always visible; hint or error below it.
export function TextField({
  label,
  hint,
  error,
  className,
  ...rest
}: { label: string; hint?: string; error?: string } & ComponentProps<"input">) {
  const id = useId();
  const noteId = `${id}-note`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="px-1 text-footnote font-medium text-ink-2">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? noteId : undefined}
        className={INPUT}
        {...rest}
      />
      {(error || hint) && (
        <p id={noteId} className={cn("px-1 text-footnote", error ? "text-danger" : "text-ink-2")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function SearchField({
  label,
  clearLabel,
  value,
  onValueChange,
  className,
  ...rest
}: {
  label: string;
  clearLabel: string;
  value: string;
  onValueChange: (value: string) => void;
} & Omit<ComponentProps<"input">, "value" | "onChange" | "type">) {
  return (
    <div className={cn("relative", className)}>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-2" />
      <input
        type="search"
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn(INPUT, "pr-12 pl-10 [&::-webkit-search-cancel-button]:hidden")}
        {...rest}
      />
      {value && (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => onValueChange("")}
          className="absolute top-0 right-0 grid size-12 place-items-center text-ink-2"
        >
          <X aria-hidden className="size-5 rounded-full bg-fill-strong p-0.5" />
        </button>
      )}
    </div>
  );
}

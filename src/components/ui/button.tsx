import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "filled" | "ink" | "tinted" | "gray" | "plain" | "destructive";
export type ButtonSize = "md" | "lg";

// At least 48 px tall; one filled (primary) button per screen. Filled
// is the logo's red; ink is near-black (white in dark mode), for
// buttons whose brand rules forbid our colour, such as Sign in with Google;
// tinted is the outlined secondary.
export function buttonClass(variant: ButtonVariant = "filled", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-semibold select-none transition-[background-color,transform,opacity] duration-150",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 aria-busy:pointer-events-none",
    size === "md" && "min-h-12 rounded-md px-4 text-body",
    size === "lg" && "min-h-[3.25rem] w-full rounded-lg px-6 text-body",
    variant === "filled" && "bg-accent-fill text-on-accent active:bg-accent-pressed [@media(hover:hover)]:hover:bg-accent-pressed",
    variant === "ink" && "bg-ink text-bg active:opacity-85",
    variant === "tinted" && "border border-fill-strong bg-surface text-ink active:bg-fill",
    variant === "gray" && "bg-fill text-ink active:bg-fill-strong",
    variant === "plain" && "text-accent active:opacity-60",
    variant === "destructive" && "bg-danger-soft text-danger",
    className,
  );
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode; // shown before the label; the label is always words
}

export function Button({
  variant,
  size,
  icon,
  loading = false,
  className,
  children,
  type = "button",
  ...rest
}: CommonProps & ComponentProps<"button"> & { loading?: boolean }) {
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
      {...rest}
    >
      {loading ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, icon, className, children, ...rest }: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

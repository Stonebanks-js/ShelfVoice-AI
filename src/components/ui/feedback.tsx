import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

// Placeholder block while content loads; the container announces loading.
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block animate-shimmer rounded-sm bg-[linear-gradient(90deg,var(--fill)_25%,var(--fill-strong)_37%,var(--fill)_63%)] bg-[length:400%_100%]",
        className,
      )}
    />
  );
}

export function SkeletonList({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-busy aria-label={label} className="overflow-hidden rounded-md bg-surface shadow-card">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-separator px-4 py-3 not-first:border-t">
          <Skeleton className="size-8" />
          <span className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </span>
          <Skeleton className="h-3.5 w-12" />
        </div>
      ))}
    </div>
  );
}

// Every screen designs its empty state up front (doc 06): what's missing and
// the one thing to do about it.
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg bg-surface px-6 py-10 text-center shadow-card">
      <span aria-hidden className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent [&>svg]:size-7">
        {icon}
      </span>
      <h3 className="text-headline font-semibold">{title}</h3>
      {body && <p className="max-w-xs text-body text-ink-2">{body}</p>}
      {action && <div className="mt-2 w-full max-w-xs">{action}</div>}
    </div>
  );
}

// Large title at the top of each tab, as in iOS.
export function PageHeader({ title, subtitle, trailing }: { title: string; subtitle?: ReactNode; trailing?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-2">
      <div className="min-w-0">
        {subtitle && <p className="text-footnote font-medium text-ink-2">{subtitle}</p>}
        <h1 className="truncate font-display text-large-title font-bold tracking-tight">{title}</h1>
      </div>
      {trailing}
    </header>
  );
}

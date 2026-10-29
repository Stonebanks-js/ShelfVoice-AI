import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

// Inset grouped list, the main building block of every owner screen.
export function ListGroup({
  header,
  footer,
  children,
  className,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-1.5", className)}>
      {header && <h2 className="px-4 text-footnote font-medium text-ink-2">{header}</h2>}
      <ul className="overflow-hidden rounded-md bg-surface shadow-card">{children}</ul>
      {footer && <p className="px-4 text-footnote text-ink-2">{footer}</p>}
    </section>
  );
}

export type IconTone = "accent" | "success" | "danger" | "check" | "gray";

const TONE: Record<IconTone, string> = {
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  check: "bg-check-soft text-check",
  gray: "bg-fill text-ink-2",
};

export function IconTile({ icon, tone = "accent" }: { icon: ReactNode; tone?: IconTone }) {
  return (
    <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-sm [&>svg]:size-[18px]", TONE[tone])}>
      {icon}
    </span>
  );
}

interface ListRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  iconTone?: IconTone;
  value?: ReactNode; // trailing text or badge
  accessory?: ReactNode; // trailing control, e.g. a Switch
  href?: string;
  onClick?: () => void;
  titleId?: string;
}

// One row. A link or button when it navigates or acts (with a chevron for
// links); plain otherwise. The separator is inset past the icon, as on iOS.
export function ListRow({ title, subtitle, icon, iconTone, value, accessory, href, onClick, titleId }: ListRowProps) {
  const interactive = Boolean(href || onClick);
  const body = (
    <>
      {icon && <IconTile icon={icon} tone={iconTone} />}
      <span className="flex min-h-12 min-w-0 flex-1 items-center gap-3 border-separator py-2.5 pr-4 [li+li_&]:border-t">
        <span className="flex min-w-0 flex-1 flex-col">
          <span id={titleId} className="truncate text-body text-ink">
            {title}
          </span>
          {subtitle && <span className="truncate text-footnote text-ink-2">{subtitle}</span>}
        </span>
        {value && <span className="shrink-0 text-body text-ink-2">{value}</span>}
        {accessory}
        {href && <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-3" />}
      </span>
    </>
  );
  const rowClass = cn(
    "flex w-full items-center gap-3 pl-4 text-left",
    interactive && "transition-colors active:bg-fill",
  );
  return (
    <li>
      {href ? (
        <Link href={href} className={rowClass}>
          {body}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={rowClass}>
          {body}
        </button>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}

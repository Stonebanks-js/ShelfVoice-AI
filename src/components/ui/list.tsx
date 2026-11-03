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
      <ul className="overflow-hidden rounded-lg bg-surface shadow-card">{children}</ul>
      {footer && <p className="px-4 text-footnote text-ink-2">{footer}</p>}
    </section>
  );
}

export type IconTone = "accent" | "success" | "danger" | "check" | "gray";

const TONE: Record<IconTone, string> = {
  accent: "text-ink",
  success: "text-success",
  danger: "text-danger",
  check: "text-check",
  gray: "text-ink-2",
};

// A row's leading icon, plain as in SF Symbols lists: no tinted square (E-35).
export function IconTile({ icon, tone = "accent" }: { icon: ReactNode; tone?: IconTone }) {
  return (
    <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center [&>svg]:size-[22px] [&>svg]:stroke-[1.75]", TONE[tone])}>
      {icon}
    </span>
  );
}

interface ListRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  iconTone?: IconTone;
  media?: ReactNode; // a product thumbnail or photo in place of the icon (E-37)
  value?: ReactNode; // trailing text or badge
  accessory?: ReactNode; // trailing control, e.g. a Switch
  href?: string;
  onClick?: () => void;
  titleId?: string;
  wrap?: boolean; // up to two lines of subtitle too, for names that matter
}

// One row. A link or button when it navigates or acts (with a chevron for
// links); plain otherwise. The separator is inset past the icon, as on iOS.
export function ListRow({ title, subtitle, icon, iconTone, media, value, accessory, href, onClick, titleId, wrap = false }: ListRowProps) {
  const interactive = Boolean(href || onClick);
  const body = (
    <>
      {media ? <span className="my-2 shrink-0">{media}</span> : icon && <IconTile icon={icon} tone={iconTone} />}
      <span className="flex min-h-12 min-w-0 flex-1 items-center gap-3 border-separator py-2.5 pr-4 [li+li_&]:border-t">
        <span className="flex min-w-0 flex-1 flex-col">
          {/* Titles wrap rather than cut off: regional labels run longer (V-06). */}
          <span id={titleId} className="line-clamp-2 text-body text-ink [overflow-wrap:anywhere]">
            {title}
          </span>
          {subtitle && <span className={cn("text-footnote text-ink-2", wrap ? "line-clamp-2" : "truncate")}>{subtitle}</span>}
        </span>
        {value && <span className="shrink-0 text-body text-ink-2">{value}</span>}
        {accessory}
        {href && <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-3" />}
      </span>
    </>
  );
  const rowClass = cn(
    "flex w-full items-center gap-3 pl-4 text-left",
    interactive && "transition-colors active:bg-fill [@media(hover:hover)]:hover:bg-fill/60",
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

import { cn } from "@/lib/cn";

// The Shelf S (errata E-35): an S drawn as a two-bay shelf, a marigold item
// in one bay and a speech bubble in the other. Source files are in brand/logo.
// Drawn on a 100 × 100 grid; the S is a 10-unit stroke with round ends.
export const LOGO = {
  shelf: "M76 20H31Q23 20 23 28V42Q23 50 31 50H69Q77 50 77 58V72Q77 80 69 80H24",
  item: { x: 53, y: 32, size: 13, radius: 4 },
  bubble:
    "M39 59H53A5.5 5.5 0 0 1 58.5 64.5V65A5.5 5.5 0 0 1 53 70.5H44L39.6 73.4Q37.8 74.4 38.1 72.4L38.4 70.3A5.5 5.5 0 0 1 33.5 65V64.5A5.5 5.5 0 0 1 39 59Z",
  // For print and canvas, where theme tokens don't apply.
  teal: "#0e5a5e",
  marigold: "#f29f05",
};

// The S and bubble take the current text colour; the item is always marigold.
export function LogoMark({ className }: { className?: string }) {
  const { item } = LOGO;
  return (
    <svg aria-hidden viewBox="0 0 100 100" className={cn("shrink-0", className)}>
      <path
        d={LOGO.shelf}
        fill="none"
        stroke="currentColor"
        strokeWidth={10}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x={item.x} y={item.y} width={item.size} height={item.size} rx={item.radius} className="fill-marigold" />
      <path fill="currentColor" d={LOGO.bubble} />
    </svg>
  );
}

// The app icon: white mark on a teal rounded square.
export function LogoTile({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("grid place-items-center bg-accent-fill text-on-accent", className)}>
      <LogoMark className="size-[73%]" />
    </span>
  );
}

// "Shelf Voice" with "AI" on a price tag. `name` is the localised app name;
// screen readers hear it once, as plain text. The tag's hole shows the page
// background, so use it on bg, not on a surface.
export function Wordmark({ name, className }: { name: string; className?: string }) {
  const [first, ...rest] = name.split(" ");
  return (
    <span className={cn("inline-flex items-center gap-2 font-brand font-extrabold tracking-tight", className)}>
      <span className="sr-only">{name} AI</span>
      <span aria-hidden>
        {first} {rest.length > 0 && <span className="text-accent">{rest.join(" ")}</span>}
      </span>
      <span
        aria-hidden
        className="relative rounded-r-[0.3em] bg-marigold py-[0.08em] pr-[0.35em] pl-[0.65em] text-[0.5em] leading-none tracking-normal text-on-marigold [clip-path:polygon(0.3em_0,100%_0,100%_100%,0.3em_100%,0_50%)] before:absolute before:top-1/2 before:left-[0.24em] before:size-[0.18em] before:-translate-y-1/2 before:rounded-full before:bg-bg"
      >
        AI
      </span>
    </span>
  );
}

import { cn } from "@/lib/cn";

// The Shelf Voice logo (errata E-35): a shopping bag with five voice bars
// inside and a red orbit around it. Source files are in brand/logo. Drawn on
// the original artwork's grid; the small mark drops the orbit and thickens the
// bars so it holds at favicon sizes.
export const LOGO = {
  full: { x: 350, y: 140, width: 840, height: 740 },
  small: { x: 440, y: 160, width: 655, height: 720 },
  handle: "M640 362V318C640 238 698 189 767 189C836 189 893 238 893 318V362",
  handleWidth: 53,
  bag: "M580 362H952C980 362 1001 382 1005 410L1063 785C1068 825 1037 857 997 857H537C497 857 466 825 471 785L527 410C531 382 552 362 580 362Z",
  bars: ["M632 535V577", "M699 501V607", "M767 451V647", "M834 501V607", "M901 532V574"],
  barWidth: 38,
  smallBars: ["M632 560V610", "M699 520V650", "M767 470V700", "M834 520V650", "M901 560V610"],
  smallBarWidth: 44,
  orbit:
    "M476 620C410 660 360 720 383 760C410 805 520 815 640 805C800 792 980 735 1090 640C1170 570 1175 495 1032 450C1100 482 1120 540 1060 610C960 715 760 770 590 772C470 773 410 745 433 690C442 668 456 645 476 620Z",
  keyline: 22,
  // For print and canvas, where theme tokens don't apply.
  ink: "#101010",
  red: "#b80a16",
};

// The bag takes the current text colour (ink on the page) and the orbit is
// the voice red. The bars and the gap around the orbit are cut-outs, so `cut` must name the
// colour behind the logo (stroke-bg on the page, stroke-surface on a card).
export function LogoMark({
  className,
  orbit = true,
  cut = "stroke-bg",
}: {
  className?: string;
  orbit?: boolean;
  cut?: string;
}) {
  const box = orbit ? LOGO.full : LOGO.small;
  return (
    <svg
      aria-hidden
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      className={cn("shrink-0", className)}
    >
      <path d={LOGO.handle} fill="none" stroke="currentColor" strokeWidth={LOGO.handleWidth} />
      <path d={LOGO.bag} fill="currentColor" />
      <g className={cut} strokeWidth={orbit ? LOGO.barWidth : LOGO.smallBarWidth} strokeLinecap="round">
        {(orbit ? LOGO.bars : LOGO.smallBars).map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {orbit && <path d={LOGO.orbit} className={cn("fill-voice", cut)} strokeWidth={LOGO.keyline} paintOrder="stroke" />}
    </svg>
  );
}

// "Shelf Voice" in the display face. `name` is the localised app name.
export function Wordmark({ name, className }: { name: string; className?: string }) {
  return <span className={cn("font-display font-bold tracking-tight", className)}>{name}</span>;
}

// Draws the full logo on a canvas, `height` px tall with its top-left corner
// at (x, y), on a white background. Returns the width it used.
export function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, height: number) {
  const { full } = LOGO;
  const scale = height / full.height;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-full.x, -full.y);
  ctx.strokeStyle = LOGO.ink;
  ctx.lineWidth = LOGO.handleWidth;
  ctx.stroke(new Path2D(LOGO.handle));
  ctx.fillStyle = LOGO.ink;
  ctx.fill(new Path2D(LOGO.bag));
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = LOGO.barWidth;
  ctx.lineCap = "round";
  for (const d of LOGO.bars) ctx.stroke(new Path2D(d));
  const orbit = new Path2D(LOGO.orbit);
  ctx.lineWidth = LOGO.keyline;
  ctx.stroke(orbit);
  ctx.fillStyle = LOGO.red;
  ctx.fill(orbit);
  ctx.restore();
  return full.width * scale;
}

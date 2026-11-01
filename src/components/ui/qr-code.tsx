"use client";

import qrcode from "qrcode-generator";
import { useMemo } from "react";

// A QR code as plain SVG (no injected markup): one path of dark squares on
// white, with the quiet zone scanners need. Used for UPI payments (V-05).
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { size, path } = useMemo(() => {
    const code = qrcode(0, "M");
    code.addData(value);
    code.make();
    const n = code.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (code.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
    return { size: n, path: d };
  }, [value]);
  return (
    <svg role="img" aria-label={label} viewBox={`-4 -4 ${size + 8} ${size + 8}`} className={className} shapeRendering="crispEdges">
      <rect x={-4} y={-4} width={size + 8} height={size + 8} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}

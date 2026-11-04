"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useLang } from "@/i18n/lang";
import { cn } from "@/lib/cn";

// Shops near you on a map: the customer's rounded position as a
// blue dot and each shop as a red pin with its initial. Pins closer than a
// thumb's width merge into one bubble with a count; tapping it zooms in.
// Tapping a pin shows the shop in a card with a way into it. Tiles come from
// OpenFreeMap (OpenStreetMap data): free, no account, no key. The light map
// stays light in dark mode, as the big delivery apps do: the dark style was
// too dark to read streets on. The list beside it stays the way in for
// keyboards and screen readers, so pins are hidden from assistive technology
// rather than repeating it. MapLibre loads only when the map is shown, and a
// phone that can't draw maps (no WebGL) simply gets the list.

const STYLE = "https://tiles.openfreemap.org/styles/positron";
const MERGE_PX = 40;

// Test builds turn the map off, so journeys never reach the internet.
const ENABLED = process.env.NEXT_PUBLIC_MAP_TILES !== "off";

export interface MapShop {
  slug: string;
  name: string;
  lat: number | null;
  lng: number | null;
  detail?: string; // "Kirana · 0.5 km away", shown in the card
}

type Pin = MapShop & { lat: number; lng: number };

// `focus`: the shops the first view frames (a searched pincode's own), the
// others still on the map around them.
export function ShopMap({ shops, me, focus = null, className }: { shops: MapShop[]; me: { lat: number; lng: number } | null; focus?: string[] | null; className?: string }) {
  const { t } = useLang();
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<Pin | null>(null);
  const pins = shops.filter((s): s is Pin => s.lat !== null && s.lng !== null);

  // The pins as a stable key, so the map is rebuilt only when they change.
  const key = JSON.stringify([me, focus, pins.map((p) => [p.slug, p.lat, p.lng])]);

  useEffect(() => {
    if (!ENABLED || !box.current || pins.length === 0) return;
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (disposed || !box.current) return;
        maplibre.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
        const framed = focus ? pins.filter((p) => focus.includes(p.slug)) : [];
        const points: Array<[number, number]> = (framed.length ? framed : pins).map((p) => [p.lng, p.lat]);
        if (me) points.push([me.lng, me.lat]);
        const bounds = points.reduce((b, point) => b.extend(point), new maplibre.LngLatBounds(points[0], points[0]));
        const map = new maplibre.Map({
          container: box.current,
          style: STYLE,
          // The first frame already shows every pin and the customer.
          bounds,
          fitBoundsOptions: { padding: 48, maxZoom: 15 },
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        // The credit starts folded to its "i" button, so it never covers pins.
        map.once("load", () => box.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"));
        map.on("click", () => setPicked(null));

        if (me) {
          const dot = document.createElement("div");
          dot.className = "sv-map-me";
          dot.setAttribute("aria-hidden", "true");
          new maplibre.Marker({ element: dot }).setLngLat([me.lng, me.lat]).addTo(map);
        }

        // Pins closer than MERGE_PX on screen become one bubble with a count,
        // worked out again whenever the map stops moving.
        let markers: Array<InstanceType<typeof maplibre.Marker>> = [];
        const draw = () => {
          markers.forEach((m) => m.remove());
          markers = [];
          const groups: Array<{ x: number; y: number; members: Pin[] }> = [];
          for (const pin of pins) {
            const { x, y } = map.project([pin.lng, pin.lat]);
            const near = groups.find((g) => Math.hypot(g.x - x, g.y - y) < MERGE_PX);
            if (near) near.members.push(pin);
            else groups.push({ x, y, members: [pin] });
          }
          for (const group of groups) {
            const el = document.createElement("div");
            el.setAttribute("aria-hidden", "true");
            if (group.members.length === 1) {
              const pin = group.members[0];
              el.className = "sv-map-pin";
              el.title = pin.name;
              el.textContent = pin.name.trim().charAt(0).toUpperCase();
              el.addEventListener("click", (event) => {
                event.stopPropagation();
                setPicked(pin);
                map.easeTo({ center: [pin.lng, pin.lat], duration: 300 });
              });
              markers.push(new maplibre.Marker({ element: el, anchor: "bottom" }).setLngLat([pin.lng, pin.lat]).addTo(map));
            } else {
              el.className = "sv-map-cluster";
              el.textContent = String(group.members.length);
              const area = group.members.reduce((b, m) => b.extend([m.lng, m.lat]), new maplibre.LngLatBounds([group.members[0].lng, group.members[0].lat], [group.members[0].lng, group.members[0].lat]));
              el.addEventListener("click", (event) => {
                event.stopPropagation();
                map.fitBounds(area, { padding: 64, maxZoom: Math.min(map.getZoom() + 3, 17), duration: 400 });
              });
              markers.push(new maplibre.Marker({ element: el }).setLngLat(area.getCenter()).addTo(map));
            }
          }
        };
        map.on("load", draw);
        map.on("moveend", draw);
        map.on("error", (event) => {
          // A tile that fails to load is fine; a style that fails is not.
          if (!map.isStyleLoaded() && String(event.error?.message ?? "").includes("style")) setFailed(true);
        });
        cleanup = () => {
          markers.forEach((m) => m.remove());
          map.remove();
        };
      } catch {
        if (!disposed) setFailed(true);
      }
    })();
    return () => {
      disposed = true;
      cleanup();
    };
    // `key` stands for `pins` and `me`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!ENABLED || failed || pins.length === 0) return null;
  return (
    <section aria-label={t("shops.mapLabel", { n: pins.length })} className={cn("relative isolate overflow-hidden rounded-xl bg-surface-2 shadow-card", className)}>
      {/* Sized by width and height: MapLibre's own CSS makes it position: relative. */}
      <div ref={box} className="size-full" />
      {picked && (
        <div className="absolute inset-x-3 bottom-3 z-10 flex animate-rise-in items-center gap-3 rounded-lg bg-surface p-3 shadow-float">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-fill font-display text-body font-bold text-on-accent">
            {picked.name.trim().charAt(0).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-body font-semibold">{picked.name}</span>
            {picked.detail && <span className="truncate text-footnote text-ink-2">{picked.detail}</span>}
          </span>
          <Link href={`/s/${picked.slug}`} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md bg-accent-fill px-3 text-footnote font-semibold text-on-accent">
            {t("shops.open")}
            <ChevronRight aria-hidden className="size-4" />
          </Link>
          <button type="button" aria-label={t("action.close")} onClick={() => setPicked(null)} className="-mr-1 grid size-11 shrink-0 place-items-center rounded-full text-ink-2">
            <X aria-hidden className="size-5" />
          </button>
        </div>
      )}
    </section>
  );
}

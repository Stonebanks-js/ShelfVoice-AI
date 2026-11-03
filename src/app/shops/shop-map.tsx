"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useLang } from "@/i18n/lang";
import { cn } from "@/lib/cn";

// Shops near you on a map (V-09): the customer's rounded position as a blue
// dot and each shop as a red pin with its initial; a tap opens the shop.
// Tiles come from OpenFreeMap (OpenStreetMap data): free, no account, no key.
// The list beside it stays the way in for keyboards and screen readers, so
// the pins are hidden from assistive technology rather than repeating it.
// MapLibre loads only when this map is shown, and a phone that can't draw
// maps (no WebGL) simply gets the list.

const STYLE = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

// Test builds turn the map off, so journeys never reach the internet.
const ENABLED = process.env.NEXT_PUBLIC_MAP_TILES !== "off";

export interface MapShop {
  slug: string;
  name: string;
  lat: number | null;
  lng: number | null;
}

export function ShopMap({ shops, me, className }: { shops: MapShop[]; me: { lat: number; lng: number } | null; className?: string }) {
  const { t } = useLang();
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const pins = shops.filter((s): s is MapShop & { lat: number; lng: number } => s.lat !== null && s.lng !== null);

  // The pins as a stable key, so the map is rebuilt only when they change.
  const key = JSON.stringify([me, pins.map((p) => [p.slug, p.lat, p.lng])]);

  useEffect(() => {
    if (!ENABLED || !box.current || pins.length === 0) return;
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (disposed || !box.current) return;
        maplibre.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
        const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const points: Array<[number, number]> = pins.map((p) => [p.lng, p.lat]);
        if (me) points.push([me.lng, me.lat]);
        const bounds = points.reduce((b, point) => b.extend(point), new maplibre.LngLatBounds(points[0], points[0]));
        const map = new maplibre.Map({
          container: box.current,
          style: dark ? STYLE.dark : STYLE.light,
          // The first frame already shows every pin and the customer.
          bounds,
          fitBoundsOptions: { padding: 56, maxZoom: 15 },
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
          cooperativeGestures: false,
        });
        map.touchZoomRotate.disableRotation();
        // The credit starts folded to its "i" button, so it never covers pins.
        map.once("load", () => box.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"));
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");

        if (me) {
          const dot = document.createElement("div");
          dot.className = "sv-map-me";
          dot.setAttribute("aria-hidden", "true");
          new maplibre.Marker({ element: dot }).setLngLat([me.lng, me.lat]).addTo(map);
        }
        for (const shop of pins) {
          const pin = document.createElement("div");
          pin.className = "sv-map-pin";
          pin.setAttribute("aria-hidden", "true");
          pin.title = shop.name;
          pin.textContent = shop.name.trim().charAt(0).toUpperCase();
          pin.addEventListener("click", () => router.push(`/s/${shop.slug}`));
          new maplibre.Marker({ element: pin, anchor: "bottom" }).setLngLat([shop.lng, shop.lat]).addTo(map);
        }

        map.on("error", (event) => {
          // A tile that fails to load is fine; a style that fails is not.
          if (!map.isStyleLoaded() && String(event.error?.message ?? "").includes("style")) setFailed(true);
        });
        cleanup = () => map.remove();
      } catch {
        if (!disposed) setFailed(true);
      }
    })();
    return () => {
      disposed = true;
      cleanup();
    };
    // `key` stands for `pins` and `me`; `router` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!ENABLED || failed || pins.length === 0) return null;
  return (
    <section aria-label={t("shops.mapLabel", { n: pins.length })} className={cn("relative isolate overflow-hidden rounded-xl bg-surface-2 shadow-card", className)}>
      {/* Sized by width and height: MapLibre's own CSS makes it position: relative. */}
      <div ref={box} className="size-full" />
    </section>
  );
}

import "server-only";

import { env } from "@/env/server";
import { log } from "@/server/log";

export interface Place {
  address: string | null;
  pincode: string | null;
}

type NominatimAddress = Partial<
  Record<"house_number" | "road" | "neighbourhood" | "suburb" | "quarter" | "village" | "town" | "city" | "city_district" | "county" | "state_district" | "postcode", string>
>;

// The street, area and town of a position, and its pincode (testers, Nov 4:
// "it takes the location but fills nothing in"). Asks OpenStreetMap's
// Nominatim, free with no key, from our server with the position rounded to
// about 100 m; the owner or customer can still change what it fills in.
// Null when the service is off, slow or unsure.
export async function placeAt(lat: number, lng: number): Promise<Place | null> {
  if (env.REVERSE_GEOCODE_URL === "off") return null;
  const round = (n: number) => Math.round(n * 1000) / 1000;
  try {
    const url = new URL("/reverse", env.REVERSE_GEOCODE_URL);
    url.search = new URLSearchParams({ format: "jsonv2", lat: String(round(lat)), lon: String(round(lng)), zoom: "17", addressdetails: "1", "accept-language": "en" }).toString();
    const response = await fetch(url, {
      // Nominatim's usage policy asks every app to name itself.
      headers: { "User-Agent": "ShelfVoice/1.0 (https://shelfvoice.vercel.app)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      log("warn", "place.lookup_failed", { status: response.status });
      return null;
    }
    const body = (await response.json()) as { address?: NominatimAddress };
    return placeFrom(body.address ?? {});
  } catch (failure) {
    log("warn", "place.lookup_failed", { error: failure });
    return null;
  }
}

// "12, Station Road, Govind Nagar, Kanpur": the parts an Indian address is
// written with, each once, in that order.
export function placeFrom(a: NominatimAddress): Place {
  const street = [a.house_number, a.road].filter(Boolean).join(", ");
  const area = a.neighbourhood ?? a.suburb ?? a.quarter;
  const town = a.city ?? a.town ?? a.village ?? a.city_district ?? a.county ?? a.state_district;
  const parts = [street, area, town].filter((p): p is string => Boolean(p));
  const address = [...new Set(parts)].join(", ").slice(0, 300) || null;
  const digits = (a.postcode ?? "").replace(/\s/g, "");
  return { address, pincode: /^[1-9][0-9]{5}$/.test(digits) ? digits : null };
}

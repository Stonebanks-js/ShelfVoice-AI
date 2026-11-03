import "server-only";

import { fromPostgres } from "@/server/http";
import { adminClient } from "@/server/supabase";

export interface NearbyShop {
  slug: string;
  name: string;
  category: string | null;
  address: string | null;
  pincode: string | null;
  hours: unknown;
  timezone: string;
  distanceKm: number | null;
  // Rounded to about 100 m by the database: a pin on the map (V-09).
  lat: number | null;
  lng: number | null;
  delivers: boolean;
}

// Published shops near a point, or in a pincode area (V-03). Public data
// only: what each shop already shows on its page.
export async function nearbyShops(where: { lat?: number; lng?: number; pincode?: string }): Promise<NearbyShop[]> {
  const { data, error } = await adminClient().rpc("nearby_shops", {
    p_lat: where.lat ?? null,
    p_lng: where.lng ?? null,
    p_pincode: where.pincode ?? null,
    p_limit: 30,
  } as never);
  if (error) throw fromPostgres(error);
  return (data as Array<{ slug: string; name: string; category: string | null; address: string | null; pincode: string | null; hours: unknown; timezone: string; distance_km: number | null; lat: number | null; lng: number | null; delivers: boolean }>).map((s) => ({
    slug: s.slug,
    name: s.name,
    category: s.category,
    address: s.address,
    pincode: s.pincode,
    hours: s.hours,
    timezone: s.timezone,
    distanceKm: s.distance_km === null ? null : Math.round(s.distance_km * 10) / 10,
    lat: s.lat,
    lng: s.lng,
    delivers: s.delivers,
  }));
}

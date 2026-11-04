import { z } from "zod";

import { ipHash, limit } from "@/server/abuse";
import { ApiError, route } from "@/server/http";
import { Latitude, Longitude, Pincode } from "@/server/location";
import { nearbyShops } from "@/server/nearby";

const Query = z.union([
  z.object({ lat: z.coerce.number().pipe(Latitude), lng: z.coerce.number().pipe(Longitude) }).strict(),
  z.object({ pincode: Pincode }).strict(),
]);

// Shops near a customer: by the phone's location or a pincode. No
// sign-in; 60 searches per minute per device.
export const GET = route(async (request) => {
  await limit(`nearby:${ipHash(request)}`, 60, 60);
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) throw new ApiError(422, "BAD_LOCATION", "Share your location or type a 6-digit pincode");
  return Response.json({ shops: await nearbyShops(parsed.data) });
});

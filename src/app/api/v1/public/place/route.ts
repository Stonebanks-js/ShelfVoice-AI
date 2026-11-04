import { z } from "zod";

import { ipHash, limit } from "@/server/abuse";
import { ApiError, route } from "@/server/http";
import { Latitude, Longitude } from "@/server/location";
import { placeAt } from "@/server/place";

const Query = z.object({ lat: z.coerce.number().pipe(Latitude), lng: z.coerce.number().pipe(Longitude) }).strict();

// The address and pincode at the phone's position, to fill a form after
// "Use my location" (testers, Nov 4). No sign-in; 10 a minute per device,
// as the free OpenStreetMap service asks apps to stay gentle.
export const GET = route(async (request) => {
  await limit(`place:${ipHash(request)}`, 10, 60);
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) throw new ApiError(422, "BAD_LOCATION", "Share your location again");
  const place = await placeAt(parsed.data.lat, parsed.data.lng);
  return Response.json(place ?? { address: null, pincode: null });
});

import { z } from "zod";

// Where a shop is: a 6-digit Indian pincode and, when the owner
// shared it, the phone's location. Latitude and longitude come together.
export const Pincode = z.string().regex(/^[1-9][0-9]{5}$/);
export const Latitude = z.number().min(-90).max(90);
export const Longitude = z.number().min(-180).max(180);

export const ShopLocation = {
  address: z.string().trim().max(300).nullable().optional(),
  pincode: Pincode.nullable().optional(),
  lat: Latitude.nullable().optional(),
  lng: Longitude.nullable().optional(),
};

export const bothOrNeither = (body: { lat?: number | null; lng?: number | null }) =>
  (body.lat === undefined) === (body.lng === undefined) && (body.lat === null) === (body.lng === null);

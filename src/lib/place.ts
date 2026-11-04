import { api } from "@/lib/api";

export interface Place {
  address: string | null;
  pincode: string | null;
}

// The address and pincode at a position, for filling a form after "Use my
// location" (testers, Nov 4). Null when nothing was found or the network
// failed: the form simply stays as it was.
export async function placeFor(at: { lat: number; lng: number }): Promise<Place | null> {
  try {
    const place = await api<Place>(`/api/v1/public/place?lat=${at.lat}&lng=${at.lng}`);
    return place.address || place.pincode ? place : null;
  } catch {
    return null;
  }
}

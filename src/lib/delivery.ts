// Delivery rules and UPI payment links (V-05), shared by the shop page,
// checkout, the order page and the server's check when an order is placed.

export interface DeliveryRules {
  minPaise: number | null;
  feePaise: number | null;
  freeAbovePaise: number | null;
  radiusKm: number | null;
}

// The delivery charge for a cart: the shop's fee, unless the cart reaches
// its free-delivery amount. Below the minimum, delivery isn't offered.
export function deliveryFee(rules: DeliveryRules, subtotalPaise: number): number | "BELOW_MINIMUM" {
  if (rules.minPaise && subtotalPaise < rules.minPaise) return "BELOW_MINIMUM";
  if (!rules.feePaise || (rules.freeAbovePaise && subtotalPaise >= rules.freeAbovePaise)) return 0;
  return rules.feePaise;
}

// Great-circle distance in km, as nearby_shops() measures it.
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export const UPI_ID = /^[A-Za-z0-9._-]{2,64}@[A-Za-z]{2,64}$/;

// The standard UPI payment link (NPCI's upi://pay), which GPay, PhonePe,
// Paytm and BHIM open with the payee, amount and note filled in. Money goes
// straight from the customer to the shop.
export function upiLink({ upiId, shopName, amountPaise, note }: { upiId: string; shopName: string; amountPaise: number; note: string }): string {
  const params = new URLSearchParams({
    pa: upiId,
    pn: shopName.slice(0, 50),
    am: (amountPaise / 100).toFixed(2),
    cu: "INR",
    tn: note.slice(0, 50),
  });
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}

// The discount a customer sees (V-11): only from the shop's own price and
// the MRP the owner entered, worked out here and never by the AI. Whole
// percent, rounded down so it never overstates; nothing when either is
// missing or the price isn't below the MRP.
export function discountPercent(pricePaise: number | null | undefined, mrpPaise: number | null | undefined): number | null {
  if (!pricePaise || !mrpPaise || pricePaise <= 0 || mrpPaise <= pricePaise) return null;
  const percent = Math.floor(((mrpPaise - pricePaise) * 100) / mrpPaise);
  return percent >= 1 ? percent : null;
}

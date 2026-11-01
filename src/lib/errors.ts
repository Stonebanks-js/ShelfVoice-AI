import type { MessageKey } from "@/i18n/dictionary";

import { ApiFailure } from "./api";

// Server error codes to words the owner understands, in their language
// (doc 06: never show raw errors). Screens add their own codes on top.
export function errorKey(error: unknown): MessageKey {
  if (!(error instanceof ApiFailure)) return "error.generic";
  if (error.code === "OFFLINE") return "error.offline";
  if (error.status === 429) return "error.rateLimited";
  if (error.status === 401) return "error.signedOut";
  if (error.code === "PRICE_OUT_OF_RANGE") return "error.priceRange";
  if (error.code === "STOCK_NEGATIVE") return "error.stockNegative";
  if (error.code === "PROPOSAL_NOT_PENDING") return "error.notPending";
  if (error.code === "BAD_BARCODE") return "scan.bad";
  if (error.code === "BAD_LOCATION") return "shops.body";
  if (error.code === "BAD_PHONE") return "cart.error.phone";
  if (error.code === "ADDRESS_NEEDED") return "cart.error.address";
  if (error.code === "ITEMS_CHANGED" || error.code === "NO_DELIVERY") return "cart.error.changed";
  if (error.code === "BELOW_MINIMUM") return "cart.error.min";
  if (error.code === "OUT_OF_RANGE") return "cart.error.far";
  if (error.code === "LOCATION_NEEDED") return "cart.error.location";
  if (error.code === "REFUND_TOO_BIG") return "error.refundTooBig";
  if (error.code === "TURNSTILE_REQUIRED" || error.code === "TURNSTILE_FAILED") return "cart.error.check";
  if (error.code === "UNDO_WINDOW_CLOSED") return "error.undoClosed";
  if (["INVALID_CHANGES", "VALIDATION", "CONSTRAINT", "PRODUCT_NOT_FOUND"].includes(error.code)) return "error.invalidChange";
  return "error.generic";
}

import type { MessageKey } from "@/i18n/dictionary";

import { ApiFailure } from "./api";

// Server error codes to words the owner understands, in their language
// (doc 06: never show raw errors). Screens add their own codes on top.
export function errorKey(error: unknown): MessageKey {
  if (!(error instanceof ApiFailure)) return "error.generic";
  if (error.code === "OFFLINE") return "error.offline";
  if (error.status === 429) return "error.rateLimited";
  if (error.status === 401) return "error.signedOut";
  if (error.code === "DEMO_UNAVAILABLE") return "error.demoUnavailable";
  if (error.code === "PRICE_OUT_OF_RANGE") return "error.priceRange";
  if (error.code === "STOCK_NEGATIVE") return "error.stockNegative";
  if (error.code === "PROPOSAL_NOT_PENDING") return "error.notPending";
  if (error.code === "UNDO_WINDOW_CLOSED") return "error.undoClosed";
  if (["INVALID_CHANGES", "VALIDATION", "CONSTRAINT", "PRODUCT_NOT_FOUND"].includes(error.code)) return "error.invalidChange";
  return "error.generic";
}

// Which products belong on the order list (doc 01 FR-07): at or below the
// reorder point with something to order, or, during cold start (no reorder
// point yet), at or below the owner's own low-stock level. Shared by the
// Orders tab and the Today summary so both always agree.
export interface LowInput {
  stock_qty: number | null;
  low_stock_level: number;
}

export interface LowForecast {
  order_qty: number | null;
  reorder_point: number | null;
}

export function isRunningLow(product: LowInput, forecast: LowForecast | null | undefined): forecast is LowForecast {
  if (!forecast || product.stock_qty === null) return false;
  return (forecast.order_qty ?? 0) > 0 || (forecast.reorder_point === null && product.stock_qty <= product.low_stock_level);
}

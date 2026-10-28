// Restock forecast (doc 02 "Restock forecasting method", decision T7).
// Pure functions: every suggested quantity can be checked by hand, and the
// model only words the explanation (ADR-002).
export const FORECAST = {
  // Smoothing factor. Doc 02 starts at 0.3 and says to tune it in the doc 04
  // backtest: 0.3 held 11% more stock than a moving average (gate: 10%),
  // 0.2 passes every gate on four seeds (errata E-31).
  alpha: 0.2,
  z: 1.28, // 90% service level
  stockoutFactor: 1.2, // demand hidden by a stock-out (doc 02 step 2)
  stockoutBoostDays: 14,
  coldStartDays: 14,
  sigmaWindowDays: 28,
};

export interface ForecastInput {
  dailySales: number[]; // units sold per day, oldest first, zero days included
  historyDays: number; // days since the item's first logged movement
  stock: number | null; // null: the owner doesn't track counts for this item
  leadTimeDays: number; // L
  reviewPeriodDays: number; // R
  packSize: number;
  lowStockLevel: number;
  festivalFactor?: number;
  stockoutFlagged?: boolean;
}

export interface Forecast {
  coldStart: boolean;
  level: number; // smoothed daily demand
  sigma: number; // standard deviation of daily sales
  demand: number; // d = level x festival x stock-out factors
  safetyStock: number;
  reorderPoint: number | null;
  orderQty: number | null;
  daysLeft: number | null;
  needsReorder: boolean;
}

export function smooth(series: number[], alpha = FORECAST.alpha): number {
  if (series.length === 0) return 0;
  // Start from the first week's mean so a single early day doesn't dominate.
  const warmup = series.slice(0, Math.min(7, series.length));
  let level = warmup.reduce((a, b) => a + b, 0) / warmup.length;
  for (const x of series) level = alpha * x + (1 - alpha) * level;
  return level;
}

export function stdDev(series: number[]): number {
  if (series.length < 2) return 0;
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  return Math.sqrt(series.reduce((a, b) => a + (b - mean) ** 2, 0) / (series.length - 1));
}

export function roundUpToPack(qty: number, packSize: number): number {
  if (qty <= 0) return 0;
  return Math.ceil(qty / packSize) * packSize;
}

export function forecast(input: ForecastInput): Forecast {
  const level = smooth(input.dailySales);
  const sigma = stdDev(input.dailySales.slice(-FORECAST.sigmaWindowDays));
  const demand = level * (input.festivalFactor ?? 1) * (input.stockoutFlagged ? FORECAST.stockoutFactor : 1);
  const L = input.leadTimeDays;
  const R = input.reviewPeriodDays;
  const safetyStock = FORECAST.z * sigma * Math.sqrt(L);
  const daysLeft = input.stock === null ? null : demand > 0 ? input.stock / demand : null;

  // Cold start (doc 02): under two weeks of logs, warn at the owner's own
  // low-stock level and don't suggest a quantity yet.
  if (input.historyDays < FORECAST.coldStartDays) {
    return {
      coldStart: true,
      level,
      sigma,
      demand,
      safetyStock,
      reorderPoint: null,
      orderQty: null,
      daysLeft,
      needsReorder: input.stock !== null && input.stock <= input.lowStockLevel,
    };
  }

  const reorderPoint = demand * L + safetyStock;
  const orderQty = input.stock === null ? null : roundUpToPack(demand * (L + R) + safetyStock - input.stock, input.packSize);
  return {
    coldStart: false,
    level,
    sigma,
    demand,
    safetyStock,
    reorderPoint,
    orderQty,
    daysLeft,
    needsReorder: input.stock !== null && input.stock <= reorderPoint && (orderQty ?? 0) > 0,
  };
}

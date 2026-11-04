// Orders on their way, kept on this phone (V-12): what the "Your current
// orders" cards and the live delivery page read.
//
// TEMPORARY, for the demo recording (owner, Nov 5): when a real order can't
// be placed (the bot check, the network or the server failing, never a
// mistake the customer can fix), the cart still shows "Order placed" with a
// 15-minute delivery and a live tracker, and keeps it here only. Such an
// order never reaches the shop. Turn it off with NEXT_PUBLIC_DEMO_ORDERS=off;
// it also switches itself off a week after the demo, so a forgotten flag can
// never keep hiding real failures from customers. Remove it after the demo.
import { useSyncExternalStore } from "react";

import { ApiFailure } from "@/lib/api";

const DEMO_ENDS = Date.parse("2026-11-12T00:00:00+05:30");
export const demoOrdersOn = (now = Date.now()) => process.env.NEXT_PUBLIC_DEMO_ORDERS !== "off" && now < DEMO_ENDS;

// Only failures the customer can't fix stand in for an order: no answer, a
// server error, the rate limit, the bot check. A shop that isn't online, an
// item gone, a phone or address to correct: those keep their own message.
export function canStandIn(failure: unknown): boolean {
  if (!(failure instanceof ApiFailure)) return true;
  return failure.code === "OFFLINE" || failure.status === 429 || failure.status >= 500 || failure.code === "TURNSTILE_FAILED" || failure.code === "TURNSTILE_REQUIRED";
}

export const DELIVERY_MINUTES = 15;
const KEY = "sv_live_orders";

export interface LiveOrder {
  ref: string;
  code: string;
  shop: string;
  slug: string;
  phone: string | null;
  items: Array<{ name: string; qty: number; pricePaise: number | null }>;
  totalPaise: number;
  fulfilment: "PICKUP" | "DELIVERY";
  placedAt: string;
  // A real order's own status page, when it reached the shop.
  link: string | null;
}

const listeners = new Set<() => void>();

export function liveOrders(): LiveOrder[] {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as LiveOrder[];
  } catch {
    return [];
  }
}

export function saveLiveOrder(order: LiveOrder) {
  try {
    const list = liveOrders().filter((o) => o.ref !== order.ref);
    window.localStorage.setItem(KEY, JSON.stringify([order, ...list].slice(0, 10)));
  } catch {
    // Storage blocked: the confirmation still shows this visit.
  }
  listeners.forEach((listener) => listener());
}

const none = () => "[]";
const read = () => JSON.stringify(liveOrders());

// The orders, kept in step with other tabs; empty until the page is live.
export function useLiveOrders(): LiveOrder[] {
  return JSON.parse(useSyncExternalStore(subscribeLiveOrders, read, none)) as LiveOrder[];
}

export function subscribeLiveOrders(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => event.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

// Where the order is, from the minutes since it was placed: placed, packed
// at 2, on the way at 5, delivered at 15 (picked up: ready at 10).
export type Stage = "placed" | "packed" | "onTheWay" | "delivered";
export function stageAt(order: Pick<LiveOrder, "placedAt" | "fulfilment">, now: number): { stage: Stage; minutesLeft: number; progress: number } {
  const elapsed = Math.max(0, (now - Date.parse(order.placedAt)) / 60_000);
  const total = order.fulfilment === "PICKUP" ? 10 : DELIVERY_MINUTES;
  const stage: Stage = elapsed >= total ? "delivered" : elapsed >= 5 ? "onTheWay" : elapsed >= 2 ? "packed" : "placed";
  return { stage, minutesLeft: Math.max(0, Math.ceil(total - elapsed)), progress: Math.min(1, elapsed / total) };
}

// Still on its way, or delivered in the last half hour.
export const isCurrent = (order: LiveOrder, now: number) => now - Date.parse(order.placedAt) < (DELIVERY_MINUTES + 30) * 60_000;

export function demoCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(4)), (n) => letters[n % letters.length]).join("");
}

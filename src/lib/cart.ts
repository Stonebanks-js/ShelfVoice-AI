// A customer's cart for one shop, kept on their phone so it survives
// a reload. Browser storage can be missing or blocked (private windows), so
// the cart then lives in memory for the visit. Read through
// useSyncExternalStore with cartSnapshot/subscribeCart.

export type Cart = Record<string, number>; // product id -> quantity

const memory = new Map<string, string>();
const listeners = new Set<() => void>();
const key = (slug: string) => `sv_cart:${slug}`;

export function cartSnapshot(slug: string): string {
  try {
    return window.localStorage.getItem(key(slug)) ?? memory.get(slug) ?? "{}";
  } catch {
    return memory.get(slug) ?? "{}";
  }
}

export function subscribeCart(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => event.key?.startsWith("sv_cart:") && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function parseCart(raw: string): Cart {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, number] => Number.isInteger(entry[1]) && (entry[1] as number) > 0 && (entry[1] as number) < 100),
    );
  } catch {
    return {};
  }
}

export function setCart(slug: string, cart: Cart) {
  const raw = JSON.stringify(Object.fromEntries(Object.entries(cart).filter(([, n]) => n > 0)));
  memory.set(slug, raw);
  try {
    if (raw === "{}") window.localStorage.removeItem(key(slug));
    else window.localStorage.setItem(key(slug), raw);
  } catch {
    // Storage blocked: the in-memory copy is enough for this visit.
  }
  listeners.forEach((listener) => listener());
}

// Orders this phone has placed, newest first, for the status links and for
// "Previously ordered" later. Only what the customer already has.
export interface PlacedOrder {
  id: string;
  token: string;
  code: string;
  shop: string;
  slug: string;
  at: string;
}

export function rememberOrder(order: PlacedOrder) {
  try {
    const list = JSON.parse(window.localStorage.getItem("sv_orders") ?? "[]") as PlacedOrder[];
    window.localStorage.setItem("sv_orders", JSON.stringify([order, ...list.filter((o) => o.id !== order.id)].slice(0, 20)));
  } catch {
    // Storage blocked: the status page link still works this visit.
  }
}

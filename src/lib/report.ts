// The page a report belongs to, without anything that identifies a person
// or record: IDs become ":id", query strings and fragments are dropped.
export function pageFor(pathname: string): string {
  return pathname
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .slice(0, 200);
}

const NOISE = [/^Script error\.?$/i, /ResizeObserver loop/i, /Non-Error promise rejection captured/i];

// Doc 05: drop browser-extension and cross-origin noise, so alerts reflect
// errors in Shelf Voice's own code.
export function isNoise(message: string, source?: string, stack?: string): boolean {
  if (NOISE.some((pattern) => pattern.test(message))) return true;
  const where = `${source ?? ""}\n${stack ?? ""}`;
  return /(chrome|moz|safari(-web)?)-extension:\/\//.test(where);
}

// Removes query strings from URLs inside messages and stacks.
// Keeps a trailing ":line:col", as stack frames end with one.
export const scrub = (value: string | undefined, max: number) =>
  value?.replace(/(https?:\/\/[^\s?#)]+)[?#][^\s)]*?((?::\d+){1,2})?(?=[\s)]|$)/g, "$1$2").slice(0, max);

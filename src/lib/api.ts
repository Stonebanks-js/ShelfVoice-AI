// Browser-side calls to our own API. Every failure becomes an ApiFailure with
// the server's error code, so screens can pick the right words (doc 06).
export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; json?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.json === undefined ? "GET" : "POST"),
      headers: init.json === undefined ? undefined : { "content-type": "application/json" },
      body: init.json === undefined ? undefined : JSON.stringify(init.json),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiFailure(0, "OFFLINE", "You're offline");
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiFailure(res.status, error?.code ?? "UNKNOWN", error?.message ?? res.statusText);
  }
  return body as T;
}

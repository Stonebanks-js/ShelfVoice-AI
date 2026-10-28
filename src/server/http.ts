import "server-only";

import { z } from "zod";

import { log } from "./log";

// Doc 02 contract rules: one error shape everywhere, no stack traces to
// clients, Zod at every boundary.
export class ApiError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 500 | 503,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

// Postgres errors raised by our functions carry a machine-readable hint.
const HINTS: Record<string, [ApiError["status"], string]> = {
  PROPOSAL_NOT_FOUND: [404, "Proposal not found"],
  PRODUCT_NOT_FOUND: [404, "Product not found in this shop"],
  PROPOSAL_NOT_PENDING: [409, "This proposal was already decided"],
  UNDO_WINDOW_CLOSED: [409, "It's too late to undo this"],
  STOCK_NEGATIVE: [409, "Stock would go below zero; correct the count first"],
  INVALID_CHANGES: [422, "The changes are not valid"],
};

export function fromPostgres(error: { code?: string; message: string; hint?: string | null }): ApiError {
  const mapped = error.hint ? HINTS[error.hint] : undefined;
  if (mapped) return new ApiError(mapped[0], error.hint!, mapped[1]);
  if (error.code === "23505") return new ApiError(409, "CONFLICT", "That already exists");
  if (error.code === "23514") return new ApiError(422, "CONSTRAINT", "A value is out of range");
  if (error.code === "42501") return new ApiError(404, "NOT_FOUND", "Not found");
  return new ApiError(500, "DATABASE", "Something went wrong");
}

export function errorResponse(error: ApiError, requestId: string) {
  return Response.json(
    { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } },
    { status: error.status, headers: { "x-request-id": requestId } },
  );
}

export interface Handle {
  requestId: string;
}

// Wraps a route handler: request ID, same-origin check for state-changing
// calls (doc 03 TH-09, CSRF), error mapping and one log line per request.
export function route<C>(handler: (request: Request, context: C, handle: Handle) => Promise<Response>) {
  return async (request: Request, context: C): Promise<Response> => {
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    const started = performance.now();
    const url = new URL(request.url);
    let status = 500;
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
        const origin = request.headers.get("origin");
        if (origin && new URL(origin).host !== url.host) {
          throw new ApiError(403, "CROSS_ORIGIN", "Cross-origin requests are not allowed");
        }
      }
      const response = await handler(request, context, { requestId });
      response.headers.set("x-request-id", requestId);
      status = response.status;
      return response;
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : error instanceof z.ZodError
            ? new ApiError(422, "VALIDATION", "The request is not valid", z.flattenError(error))
            : new ApiError(500, "INTERNAL", "Something went wrong");
      status = apiError.status;
      if (apiError.status >= 500) log("error", "api.error", { requestId, route: url.pathname, error });
      return errorResponse(apiError, requestId);
    } finally {
      log("info", "api.request", {
        requestId,
        method: request.method,
        route: url.pathname,
        status,
        durationMs: Math.round(performance.now() - started),
      });
    }
  };
}

export async function readJson<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError(415, "JSON_REQUIRED", "Send JSON");
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "BAD_JSON", "The body is not valid JSON");
  }
  return schema.parse(body);
}

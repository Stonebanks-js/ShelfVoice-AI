import type { Instrumentation } from "next";

// Runs once when a server instance starts, before it handles requests. A
// missing or malformed variable stops startup with a clear message (doc 08),
// while lint, typegen and typecheck run without secrets.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { parseServerEnv } = await import("./env/schema");
    parseServerEnv();
  }
}

// Errors no route handler caught (doc 05 "Error tracking"): logged with the
// route and request ID, which also sends them to Axiom and Discord.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { flushLogs, log } = await import("./server/log");
  const requestId = request.headers["x-request-id"];
  log("error", "request.unhandled", {
    requestId: Array.isArray(requestId) ? requestId[0] : requestId,
    method: request.method,
    route: context.routePath,
    routeType: context.routeType,
    error,
  });
  await flushLogs();
};

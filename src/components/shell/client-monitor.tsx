"use client";

import { useReportWebVitals } from "next/web-vitals";
import { useEffect } from "react";

import { isNoise, pageFor, scrub } from "@/lib/report";

const ENDPOINT = "/api/v1/client-errors";
const MAX_ERRORS_PER_PAGE = 5;
const VITALS = new Set(["LCP", "CLS", "INP", "FCP", "TTFB"]);

// Sent even while the page is closing, without holding it open.
function send(body: Record<string, unknown>) {
  const json = JSON.stringify({ ...body, release: process.env.NEXT_PUBLIC_RELEASE || undefined });
  if (navigator.sendBeacon?.(ENDPOINT, new Blob([json], { type: "application/json" }))) return;
  void fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: json, keepalive: true }).catch(() => undefined);
}

// Browser errors and Web Vitals for the logs (doc 05): never what anyone
// typed or said, only the page, the message and where it came from.
export function ClientMonitor() {
  useReportWebVitals((metric) => {
    if (!VITALS.has(metric.name)) return;
    send({ type: "vital", page: pageFor(location.pathname), name: metric.name, value: metric.value, rating: metric.rating });
  });

  useEffect(() => {
    const seen = new Set<string>();
    const report = (type: "error" | "rejection", message: string, source?: string, line?: number, stack?: string) => {
      if (isNoise(message, source, stack) || seen.has(message) || seen.size >= MAX_ERRORS_PER_PAGE) return;
      seen.add(message);
      send({ type, page: pageFor(location.pathname), message: scrub(message, 500), source: scrub(source, 300), line, stack: scrub(stack, 2000) });
    };
    const onError = (event: ErrorEvent) => report("error", event.message || "Unknown error", event.filename || undefined, event.lineno || undefined, event.error?.stack);
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      report("rejection", reason instanceof Error ? reason.message : String(reason).slice(0, 500), undefined, undefined, reason instanceof Error ? reason.stack : undefined);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}

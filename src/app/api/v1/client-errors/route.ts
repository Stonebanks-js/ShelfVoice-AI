import { z } from "zod";

import { ipHash, limit } from "@/server/abuse";
import { readJson, route } from "@/server/http";
import { log } from "@/server/log";

const text = (max: number) => z.string().max(max).optional();

const Report = z.discriminatedUnion("type", [
  z
    .object({
      type: z.enum(["error", "rejection"]),
      page: z.string().max(200),
      message: z.string().max(500),
      source: text(300),
      line: z.number().int().min(0).optional(),
      stack: text(2000),
      release: text(40),
    })
    .strict(),
  z
    .object({
      type: z.literal("vital"),
      page: z.string().max(200),
      name: z.enum(["LCP", "CLS", "INP", "FCP", "TTFB"]),
      value: z.number().min(0).max(600_000),
      rating: z.enum(["good", "needs-improvement", "poor"]),
      release: text(40),
    })
    .strict(),
]);

// Browser errors and Web Vitals (doc 05 "Error tracking"): logged with the
// page and release, never user text, and shipped to Axiom with every other
// log line. Rate-limited per device so a broken page can't flood the logs.
export const POST = route(async (request) => {
  await limit(`client:${ipHash(request)}`, 60, 60);
  const report = await readJson(request, Report);
  if (report.type === "vital") {
    log("info", "web.vital", { page: report.page, name: report.name, value: Math.round(report.value * 1000) / 1000, rating: report.rating, clientRelease: report.release });
  } else {
    log("warn", "client.error", {
      kind: report.type,
      page: report.page,
      message: report.message,
      source: report.source,
      line: report.line,
      stack: report.stack,
      clientRelease: report.release,
    });
  }
  return new Response(null, { status: 204 });
});

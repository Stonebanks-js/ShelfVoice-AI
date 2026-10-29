import { connection } from "next/server";
import { release } from "@/server/log";

// Liveness (doc 05): the process responds. Called by the uptime monitor, so it
// must run on every request rather than be served as a prerendered file.
export async function GET() {
  await connection();
  return Response.json({ status: "ok", release: release() });
}

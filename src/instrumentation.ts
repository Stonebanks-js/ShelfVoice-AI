// Runs once when a server instance starts, before it handles requests. A
// missing or malformed variable stops startup with a clear message (doc 08),
// while lint, typegen and typecheck run without secrets.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { parseServerEnv } = await import("./env/schema");
    parseServerEnv();
  }
}

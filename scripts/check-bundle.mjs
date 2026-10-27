// Doc 03 TH-08: fail if the browser bundle contains a server secret.
// Run after `next build`; scans every file the browser can download.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const STATIC_DIR = path.join(".next", "static");

const SECRET_VARS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "META_API_KEY",
  "TURNSTILE_SECRET_KEY",
  "CRON_SECRET",
  "AXIOM_TOKEN",
  "DISCORD_ALERT_WEBHOOK_URL",
  "BETTERSTACK_HEARTBEAT_URL",
];

// Variable names mean server code leaked into the client; values mean a secret did.
const needles = [
  { label: "service_role", text: "service_role" },
  ...SECRET_VARS.map((name) => ({ label: `name ${name}`, text: name })),
  ...SECRET_VARS.filter((name) => (process.env[name] ?? "").length >= 12).map((name) => ({
    label: `value of ${name}`,
    text: process.env[name],
  })),
];

async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else yield full;
  }
}

let scanned = 0;
const hits = [];
try {
  for await (const file of files(STATIC_DIR)) {
    if (!/\.(js|mjs|css|json|html|txt|map)$/.test(file)) continue;
    scanned += 1;
    const content = await readFile(file, "utf8");
    for (const needle of needles) {
      if (content.includes(needle.text)) hits.push(`${file}: ${needle.label}`);
    }
  }
} catch (error) {
  if (error.code === "ENOENT") {
    console.error(`No ${STATIC_DIR} directory; run \`pnpm build\` first.`);
    process.exit(1);
  }
  throw error;
}

if (scanned === 0) {
  console.error(`No bundle files found under ${STATIC_DIR}.`);
  process.exit(1);
}
if (hits.length > 0) {
  console.error(`Server secrets found in the client bundle:\n${hits.map((h) => `  ${h}`).join("\n")}`);
  process.exit(1);
}
console.log(`Bundle check passed: ${scanned} files, ${needles.length} patterns.`);

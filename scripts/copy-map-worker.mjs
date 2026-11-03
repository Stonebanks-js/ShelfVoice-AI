// Copies MapLibre's map worker into public/ before dev and build (V-09).
// MapLibre 6 looks for its worker beside its own module file, which no
// longer exists once Next bundles the library; the shop finder points it at
// /vendor/maplibre/ instead. Ignored by git; rebuilt from node_modules.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve("maplibre-gl/package.json"));
const out = path.join(process.cwd(), "public", "vendor", "maplibre");
mkdirSync(out, { recursive: true });
copyFileSync(path.join(dist, "dist", "maplibre-gl-worker.mjs"), path.join(out, "maplibre-gl-worker.mjs"));

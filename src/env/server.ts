import "server-only";

import { parseServerEnv } from "./schema";

// Secrets live only here; importing this from a client component fails the build.
export const env = parseServerEnv();

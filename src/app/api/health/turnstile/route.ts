import { ipHash, limit, turnstileSecretStatus } from "@/server/abuse";
import { route } from "@/server/http";

// Whether the person check is set up right: Cloudflare accepts our
// secret, or rejects it. Names no key; 10 checks a minute per device.
export const GET = route(async (request) => {
  await limit(`turnstile-check:${ipHash(request)}`, 10, 60);
  return Response.json({ secret: await turnstileSecretStatus() });
});
